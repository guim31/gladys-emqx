// -----------------------------------------------------------------------------
// Quiet logs: nothing at info level for a normal cycle, one line when a
// failure starts and one when it ends, never the API secret.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CONFIG,
  addDevice,
  brokerId,
  clientDeviceId,
  createWorld,
  flush,
} from './helpers/world.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

/** Capture every log line at the given level and above. */
function captureLogs(t, level = 'debug') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => lines.push(args.map(String).join(' '));
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}

const atLevel = (lines, level) => lines.filter((line) => line.includes(`[${level}]`));

async function tick(t, ms) {
  t.mock.timers.tick(ms);
  await flush();
}

test('a normal cycle writes nothing at info level', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: Date.now() });
  const world = await createWorld({ config: { ...CONFIG, client_ids: 'sensor-1' } });
  t.after(() => world.app.stop());
  world.emqx.setClient('sensor-1', 'connected');
  await world.hub.poll();
  await addDevice(world, brokerId(world.gladys));
  await addDevice(world, clientDeviceId(world.gladys, 'sensor-1'));
  const lines = captureLogs(t, 'info');
  for (let i = 1; i <= 30; i += 1) {
    world.emqx.setMonitor({ live_connections: 2 + (i % 3), received_msg_rate: i });
    world.emqx.setUptime(200000 + 30000 * i);
    await tick(t, 30 * SECOND);
  }
  assert.deepEqual(lines, []);
});

test('an outage is told once, its end once, the rest goes to debug', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: Date.now() });
  const world = await createWorld();
  t.after(() => world.app.stop());
  const lines = captureLogs(t, 'info');
  world.emqx.down = true;
  await tick(t, 5 * MINUTE);
  assert.equal(atLevel(lines, 'WARN').length, 1);
  world.emqx.down = false;
  await tick(t, 30 * SECOND);
  const info = atLevel(lines, 'INFO');
  assert.equal(info.length, 1, info.join('\n'));
  assert.match(info[0], /answers again/);
});

test('the API secret never appears in the logs, at any level', async (t) => {
  const lines = captureLogs(t, 'debug');
  const world = await createWorld({ config: { ...CONFIG, client_ids: 'sensor-1' } });
  world.emqx.failWith(401);
  await world.hub.poll();
  await world.gladys.fake.action('check_connection', {});
  world.emqx.failWith(0);
  world.emqx.down = true;
  await world.hub.poll();
  world.emqx.down = false;
  await world.gladys.fake.configUpdated({ ...CONFIG, url: 'https://emqx.example' });
  await flush();
  world.app.stop();
  assert.ok(lines.length > 5, 'the scenario logs something');
  const basic = Buffer.from(`${CONFIG.api_key}:${CONFIG.api_secret}`).toString('base64');
  for (const line of lines) {
    for (const secret of [CONFIG.api_secret, basic]) {
      assert.ok(!line.includes(secret), `${secret} in: ${line}`);
    }
  }
});
