// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake EMQX REST API that
// answers with real recorded bodies (test/fixtures/emqx/), and the
// integration wired on top through registerHandlers — the same wiring as
// index.js.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';

// The integration logs its lifecycle; keep the test output readable
// (LOG_LEVEL is read on every log call). LOG_LEVEL=debug npm test shows them.
process.env.LOG_LEVEL ??= 'silent';

export const VERSIONS = ['5.8.6', '6.3.2'];

/** A recorded body. */
export function fixture(version, name) {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/emqx/${version}/${name}.json`, import.meta.url), 'utf8'),
  );
}

export const URL_BASE = 'http://emqx.example:18083';
export const API_KEY = 'a1b2c3d4e5f60718';
export const API_SECRET = 'test-secret-value';
export const CONFIG = { url: URL_BASE, api_key: API_KEY, api_secret: API_SECRET };

/**
 * A fake EMQX: the httpGet seam of the client. `routes` maps an API path
 * (after /api/v5/) to { status, body }; `down` makes every request fail like
 * a stopped broker.
 */
export function createFakeEmqx(version = '6.3.2') {
  const emqx = {
    requests: [],
    down: false,
    routes: {
      nodes: { status: 200, body: fixture(version, 'nodes') },
      monitor_current: { status: 200, body: fixture(version, 'monitor_current') },
      'alarms?activated=true&limit=100': { status: 200, body: { data: [], meta: { count: 0 } } },
    },
    clients: {},
    // API paths answering 500, and a promise every request waits for.
    failing: new Set(),
    gate: null,
    /** Answer every request with a status (401, 500…). */
    failWith(status, body = null) {
      emqx.status = status;
      emqx.statusBody = body;
    },
    setAlarms(list) {
      emqx.routes['alarms?activated=true&limit=100'] = {
        status: 200,
        body: { data: list, meta: { count: list.length } },
      };
    },
    setMonitor(patch) {
      const route = emqx.routes.monitor_current;
      route.body = { ...route.body, ...patch };
    },
    setUptime(ms) {
      emqx.routes.nodes.body = emqx.routes.nodes.body.map((node) => ({ ...node, uptime: ms }));
    },
    /** A client: 'connected', 'disconnected', or null (404). */
    setClient(clientId, state) {
      emqx.clients[clientId] = state;
    },
    async get(url, options) {
      emqx.requests.push({ url, options });
      if (emqx.gate) {
        await emqx.gate;
      }
      if (emqx.down) {
        const err = new Error('connect ECONNREFUSED 192.0.2.10:18083');
        err.code = 'ECONNREFUSED';
        throw err;
      }
      if (emqx.status) {
        return { status: emqx.status, body: emqx.statusBody ?? fixture(version, 'bad-auth') };
      }
      const path = url.replace(/^.*\/api\/v5\//, '');
      if (emqx.failing.has(path)) {
        return { status: 500, body: null };
      }
      const client = path.match(/^clients\/(.+)$/);
      if (client) {
        const state = emqx.clients[decodeURIComponent(client[1])];
        if (!state) {
          return { status: 404, body: fixture(version, 'client-not-found') };
        }
        const name = state === 'connected' ? 'client-connected' : 'client-disconnected';
        const base = fixture('6.3.2', name);
        return { status: 200, body: { ...base, clientid: decodeURIComponent(client[1]) } };
      }
      const route = emqx.routes[path];
      return route ?? { status: 404, body: { code: 'NOT_FOUND', message: 'Not found' } };
    },
  };
  return emqx;
}

/** The alarm of the 6.3.2 capture. */
export const MEMORY_ALARM = fixture('6.3.2', 'alarms').data[0];

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {string} [options.version] the EMQX fixtures to answer with
 * @param {Array<object>} [options.devices] devices already created in Gladys
 * @param {boolean} [options.connect]
 * @param {object} [options.timings]
 */
export async function createWorld({
  config = CONFIG,
  version = '6.3.2',
  devices = [],
  connect = true,
  timings,
} = {}) {
  const emqx = createFakeEmqx(version);
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, { httpGet: emqx.get, timings });
  if (connect) {
    await gladys.connect();
    await flush();
  }
  return { gladys, emqx, app, hub: app.hub };
}

/** Let the pending promise callbacks and zero-delay timers run. */
export const flush = async () => {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
};

/** Create a discovered device in Gladys, as the user would. */
export async function addDevice(world, externalId) {
  const discovered = world.gladys.fake.discoveredDevices;
  const device = discovered.find((entry) => entry.external_id === externalId);
  if (!device) {
    throw new Error(`${externalId} was not discovered`);
  }
  await world.gladys.fake.deviceCreated(device);
  return device;
}

export const brokerId = (gladys) => gladys.externalIds('broker', 'emqx').device;
export const clientDeviceId = (gladys, clientId) =>
  gladys.externalIds('client', encodeURIComponent(clientId)).device;
export const featureId = (gladys, key) => `${brokerId(gladys)}:${key}`;
