// -----------------------------------------------------------------------------
// The configuration, the parsing of real EMQX answers, and the HTTP client —
// the latter against a local server on 127.0.0.1 (no outside network).
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { normalizeConfig, normalizeUrl, parseClientIds } from '../src/config.js';
import { createEmqxClient, httpGet } from '../src/emqx/client.js';
import { parseBroker, parseClient } from '../src/emqx/snapshot.js';
import { VERSIONS, fixture } from './helpers/world.js';

test('the address accepts a bare host, a port, a full URL and the /api/v5 path', () => {
  assert.equal(normalizeUrl('192.0.2.10'), 'http://192.0.2.10:18083');
  assert.equal(normalizeUrl(' emqx.local:8080 '), 'http://emqx.local:8080');
  assert.equal(normalizeUrl('https://emqx.example/'), 'https://emqx.example');
  assert.equal(normalizeUrl('http://emqx.local:18083/api/v5/'), 'http://emqx.local:18083');
  assert.equal(normalizeUrl('https://u:p@proxy.example/emqx?x=1'), 'https://proxy.example/emqx');
  assert.equal(normalizeUrl('mqtt://emqx.local:1883'), '');
  assert.equal(normalizeUrl(''), '');
});

test('the client ids: commas, spaces or lines, no duplicates, 20 at most', () => {
  assert.deepEqual(parseClientIds('zigbee2mqtt, shelly-1\nshelly-1;  ha '), [
    'zigbee2mqtt',
    'shelly-1',
    'ha',
  ]);
  assert.equal(parseClientIds(Array.from({ length: 30 }, (_, i) => `c${i}`).join(',')).length, 20);
  assert.deepEqual(parseClientIds(undefined), []);
});

test('the configuration is normalized, French by default', () => {
  assert.deepEqual(normalizeConfig({ url: 'emqx.local', api_key: ' k ', api_secret: 's' }), {
    url: 'http://emqx.local:18083',
    api_key: 'k',
    api_secret: 's',
    tls_insecure: false,
    client_ids: [],
    language: 'fr',
  });
  assert.equal(normalizeConfig(null).language, 'fr');
});

for (const version of VERSIONS) {
  test(`the real answers of EMQX ${version} are read`, () => {
    const broker = parseBroker(
      fixture(version, 'nodes'),
      fixture(version, 'monitor_current'),
      fixture(version, 'alarms'),
    );
    assert.equal(broker.version, version);
    assert.equal(broker.nodesTotal, 1);
    assert.equal(broker.nodesRunning, 1);
    assert.ok(broker.uptimeSeconds > 0);
    assert.ok(Number.isInteger(broker.clientsConnected));
    assert.ok(Number.isInteger(broker.messagesReceived));
    assert.equal(broker.alarms.length, 1);
    assert.equal(broker.alarms[0].name, 'high_system_memory_usage');
    assert.ok(broker.alarms[0].activatedAt > 0);
    const client = parseClient(fixture(version, 'client-connected'));
    assert.equal(client.connected, true);
    assert.ok(client.connectedAt > 0);
  });
}

test('the rates of monitor_current are per second: published per minute', () => {
  const broker = parseBroker(fixture('6.3.2', 'nodes'), fixture('6.3.2', 'monitor_current'), {
    data: [],
  });
  assert.equal(broker.messagesReceived, 11 * 60);
  assert.equal(broker.messagesDropped, 60);
  assert.equal(broker.clientsConnected, 0, 'live_connections, not the sessions');
  assert.equal(broker.sessions, 1);
});

test('a cluster: running nodes counted, uptime of the youngest node', () => {
  const nodes = [
    { node: 'emqx@a', version: '5.8.6', node_status: 'running', uptime: 90000000 },
    { node: 'emqx@b', version: '5.8.6', node_status: 'running', uptime: 3600000 },
    { node: 'emqx@c', version: '5.8.6', node_status: 'stopped' },
  ];
  const broker = parseBroker(nodes, {}, null);
  assert.equal(broker.nodesTotal, 3);
  assert.equal(broker.nodesRunning, 2);
  assert.equal(broker.uptimeSeconds, 3600);
  assert.deepEqual(broker.alarms, []);
  assert.equal(broker.clientsConnected, null);
});

test('a disconnected persistent client, and a forgotten one', () => {
  const gone = parseClient(fixture('6.3.2', 'client-disconnected'));
  assert.equal(gone.known, true);
  assert.equal(gone.connected, false);
  assert.ok(gone.disconnectedAt > gone.connectedAt);
  assert.deepEqual(parseClient(null), {
    known: false,
    connected: false,
    connectedAt: null,
    disconnectedAt: null,
  });
});

/** A local HTTP server answering with a handler; resolves its base URL. */
async function serve(t, handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}

test('the client sends Basic credentials and reads JSON', async (t) => {
  let seen;
  const url = await serve(t, (req, res) => {
    seen = { url: req.url, auth: req.headers.authorization };
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(fixture('5.8.6', 'nodes')));
  });
  const client = createEmqxClient({ url, apiKey: 'key', apiSecret: 'secret' });
  const nodes = await client.nodes();
  assert.equal(nodes[0].version, '5.8.6');
  assert.equal(seen.url, '/api/v5/nodes');
  assert.equal(seen.auth, `Basic ${Buffer.from('key:secret').toString('base64')}`);
});

test('the client sorts the failures: refused, not found, unreachable', async (t) => {
  const url = await serve(t, (req, res) => {
    const status = { '/api/v5/nodes': 401, '/api/v5/alarms?activated=true&limit=100': 503 }[
      req.url
    ];
    if (req.url.startsWith('/api/v5/clients/')) {
      res.statusCode = 404;
      res.end(JSON.stringify(fixture('6.3.2', 'client-not-found')));
      return;
    }
    if (req.url === '/api/v5/monitor_current') {
      res.end('<html>not json</html>');
      return;
    }
    res.statusCode = status ?? 500;
    res.end(JSON.stringify(fixture('6.3.2', 'bad-auth')));
  });
  const client = createEmqxClient({ url, apiKey: 'key', apiSecret: 'secret' });
  await assert.rejects(client.nodes(), { kind: 'refused', message: /401 BAD_API_KEY_OR_SECRET/ });
  await assert.rejects(client.alarms(), { kind: 'unreachable' });
  await assert.rejects(client.monitorCurrent(), { kind: 'unreachable', message: /JSON/ });
  assert.equal(await client.client('sensor/1'), null);
});

test('a closed port and a silent server are unreachable, without the secret', async (t) => {
  const closed = createEmqxClient({ url: 'http://127.0.0.1:1', apiKey: 'k', apiSecret: 'secret' });
  await assert.rejects(closed.nodes(), (err) => {
    assert.equal(err.kind, 'unreachable');
    assert.doesNotMatch(err.message, /secret/);
    return true;
  });
  const url = await serve(t, () => {});
  await assert.rejects(
    httpGet(`${url}/api/v5/nodes`, { authorization: 'x', tlsInsecure: false, timeoutMs: 50 }),
    /no answer within 50 ms/,
  );
});
