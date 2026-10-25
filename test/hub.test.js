// -----------------------------------------------------------------------------
// The integration end to end, against the SDK's fake Gladys and a fake EMQX
// answering with real recorded bodies: discovery, states, scene triggers,
// outages, the action, the scene action and the widget.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import {
  CONFIG,
  MEMORY_ALARM,
  addDevice,
  brokerId,
  clientDeviceId,
  createWorld,
  featureId,
  flush,
} from './helpers/world.js';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

const keys = (world) => world.gladys.fake.sceneEvents.map((event) => event.key);

async function tick(t, ms) {
  t.mock.timers.tick(ms);
  await flush();
}

/** A world with the broker (and the given clients) added in Gladys. */
async function addedWorld(t, { clients = [], version } = {}) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: Date.now() });
  const world = await createWorld({
    config: { ...CONFIG, client_ids: clients.join(',') },
    version,
  });
  t.after(() => world.app.stop());
  for (const clientId of clients) {
    world.emqx.setClient(clientId, 'connected');
  }
  await world.hub.poll();
  await addDevice(world, brokerId(world.gladys));
  for (const clientId of clients) {
    await addDevice(world, clientDeviceId(world.gladys, clientId));
  }
  await flush();
  return world;
}

test('the broker is discovered at the first answer, with Basic credentials', async () => {
  const world = await createWorld();
  try {
    const devices = world.gladys.fake.discoveredDevices;
    assert.deepEqual(
      devices.map((device) => device.external_id),
      [brokerId(world.gladys)],
    );
    assert.equal(devices[0].model, 'EMQX Enterprise');
    assert.equal(devices[0].features[0].name, 'Joignable');
    const { url, options } = world.emqx.requests[0];
    assert.match(url, /^http:\/\/emqx\.example:18083\/api\/v5\//);
    assert.equal(
      options.authorization,
      `Basic ${Buffer.from(`${CONFIG.api_key}:${CONFIG.api_secret}`).toString('base64')}`,
    );
    assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
  } finally {
    world.app.stop();
  }
});

test('nothing is discovered while EMQX never answered', async () => {
  const world = await createWorld({ connect: false });
  world.emqx.down = true;
  await world.gladys.connect();
  await flush();
  try {
    assert.deepEqual(world.gladys.fake.discoveredDevices, []);
    assert.equal(world.gladys.fake.connectionStatus.connected, false);
    assert.match(world.gladys.fake.connectionStatus.message.fr, /injoignable/);
  } finally {
    world.app.stop();
  }
});

test('adding the broker publishes every state at once (5.8.6 numbers)', async (t) => {
  const world = await addedWorld(t, { version: '5.8.6' });
  const { fake } = world.gladys;
  assert.equal(fake.lastState(featureId(world.gladys, 'reachable')), 1);
  assert.equal(fake.lastState(featureId(world.gladys, 'clients_connected')), 1);
  assert.equal(fake.lastState(featureId(world.gladys, 'subscriptions')), 1);
  assert.equal(fake.lastState(featureId(world.gladys, 'active_alarms')), 0);
  assert.equal(fake.lastState(featureId(world.gladys, 'nodes_running')), 1);
  assert.equal(fake.lastState(featureId(world.gladys, 'version')), '5.8.6');
  assert.deepEqual(fake.widgetRefreshes.slice(-1), ['broker']);
});

test('the container reads EMQX itself every 30 s, without any core poll', async (t) => {
  const world = await addedWorld(t);
  const before = world.emqx.requests.length;
  world.emqx.setMonitor({ live_connections: 7, received_msg_rate: 2 });
  await tick(t, 30 * SECOND);
  assert.equal(world.emqx.requests.length, before + 3);
  assert.equal(world.gladys.fake.lastState(featureId(world.gladys, 'clients_connected')), 7);
  assert.equal(world.gladys.fake.lastState(featureId(world.gladys, 'messages_received')), 120);
  assert.ok(world.gladys.fake.discoveredDevices[0].should_poll === false);
});

test('only the changed states are published', async (t) => {
  const world = await addedWorld(t);
  const before = world.gladys.fake.states.length;
  await tick(t, 30 * SECOND);
  assert.equal(world.gladys.fake.states.length, before);
  world.emqx.setMonitor({ topics: 9 });
  await tick(t, 30 * SECOND);
  assert.deepEqual(world.gladys.fake.states.slice(before), [
    { device_feature_external_id: featureId(world.gladys, 'topics'), state: 9 },
  ]);
});

test('an outage: Reachable at 0, triggers after 1 and 5 minutes, then back', async (t) => {
  const world = await addedWorld(t);
  world.emqx.down = true;
  await tick(t, 30 * SECOND);
  assert.equal(world.gladys.fake.lastState(featureId(world.gladys, 'reachable')), 0);
  assert.deepEqual(keys(world), []);
  await tick(t, 6 * MINUTE);
  const unreachable = world.gladys.fake.sceneEvents.filter(
    (event) => event.key === 'broker_unreachable',
  );
  assert.deepEqual(
    unreachable.map((event) => event.data.after_minutes),
    ['1', '5'],
  );
  assert.equal(unreachable[0].data.broker, 'EMQX');
  world.emqx.down = false;
  await tick(t, 30 * SECOND);
  const back = world.gladys.fake.sceneEvents.at(-1);
  assert.equal(back.key, 'broker_back');
  assert.ok(back.data.offline_minutes >= 6);
  assert.equal(world.gladys.fake.lastState(featureId(world.gladys, 'reachable')), 1);
});

test('a refused key is not an outage: no trigger, a clear status', async (t) => {
  const world = await addedWorld(t);
  world.emqx.failWith(401);
  await tick(t, 10 * MINUTE);
  assert.deepEqual(keys(world), []);
  assert.equal(world.gladys.fake.lastState(featureId(world.gladys, 'reachable')), 1);
  assert.match(world.gladys.fake.connectionStatus.message.en, /refused the API key/);
});

test('a 404 on the API tells that this is not EMQX 5', async () => {
  const world = await createWorld({ connect: false });
  world.emqx.failWith(404, { code: 'NOT_FOUND' });
  await world.gladys.connect();
  await flush();
  try {
    assert.match(world.gladys.fake.connectionStatus.message.en, /No EMQX 5 API/);
    const ack = await world.gladys.fake.action('check_connection', {});
    assert.equal(ack.success, false);
  } finally {
    world.app.stop();
  }
});

test('an alarm fires alarm_raised, then alarm_cleared with its duration', async (t) => {
  const world = await addedWorld(t);
  const alarm = { ...MEMORY_ALARM, activate_at: new Date(Date.now()).toISOString() };
  world.emqx.setAlarms([alarm]);
  await tick(t, 30 * SECOND);
  assert.deepEqual(keys(world), ['alarm_raised']);
  assert.deepEqual(world.gladys.fake.sceneEvents[0].data, {
    device: brokerId(world.gladys),
    broker: 'EMQX',
    alarm: 'high_system_memory_usage',
    message: '63.65% mem usage',
    node: 'emqx@192.0.2.10',
  });
  assert.equal(world.gladys.fake.lastState(featureId(world.gladys, 'active_alarms')), 1);
  await tick(t, 3 * MINUTE);
  world.emqx.setAlarms([]);
  await tick(t, 30 * SECOND);
  assert.deepEqual(keys(world), ['alarm_raised', 'alarm_cleared']);
  assert.ok(world.gladys.fake.sceneEvents[1].data.duration_minutes >= 3);
  assert.equal(world.gladys.fake.lastState(featureId(world.gladys, 'active_alarms')), 0);
});

test('an alarm already raised at start fires nothing (baseline)', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: Date.now() });
  const world = await createWorld({ connect: false });
  t.after(() => world.app.stop());
  world.emqx.setAlarms([MEMORY_ALARM]);
  await world.gladys.connect();
  await flush();
  await addDevice(world, brokerId(world.gladys));
  await tick(t, 2 * MINUTE);
  assert.deepEqual(keys(world), []);
});

test('a followed client: states, then disconnected and reconnected triggers', async (t) => {
  const world = await addedWorld(t, { clients: ['zigbee2mqtt'] });
  const ids = world.gladys.externalIds('client', 'zigbee2mqtt');
  assert.equal(world.gladys.fake.lastState(ids.feature('connected')), 1);
  assert.match(String(world.gladys.fake.lastState(ids.feature('last_connection'))), /2026/);
  // Gone, session included: EMQX answers 404.
  world.emqx.setClient('zigbee2mqtt', null);
  await tick(t, 30 * SECOND);
  assert.equal(world.gladys.fake.lastState(ids.feature('connected')), 0);
  assert.deepEqual(world.gladys.fake.sceneEvents.at(-1), {
    key: 'client_disconnected',
    data: { device: ids.device, client: 'zigbee2mqtt', client_name: 'zigbee2mqtt' },
  });
  await tick(t, 4 * MINUTE);
  world.emqx.setClient('zigbee2mqtt', 'connected');
  await tick(t, 30 * SECOND);
  const back = world.gladys.fake.sceneEvents.at(-1);
  assert.equal(back.key, 'client_reconnected');
  assert.ok(back.data.offline_minutes >= 4);
});

test('a client id with special characters keeps a stable, encoded external id', async (t) => {
  const world = await addedWorld(t, { clients: ['shellies/plug:1'] });
  const device = world.gladys.fake.discoveredDevices.find(
    (entry) => entry.name === 'shellies/plug:1',
  );
  assert.equal(device.external_id, 'ext:test-integration:client:shellies%2Fplug%3A1');
  assert.ok(world.emqx.requests.some(({ url }) => url.endsWith('/clients/shellies%2Fplug%3A1')));
});

test('a node whose uptime goes backwards fires broker_restarted', async (t) => {
  const world = await addedWorld(t);
  world.emqx.setUptime(5 * SECOND);
  await tick(t, 30 * SECOND);
  assert.deepEqual(keys(world), ['broker_restarted']);
  assert.equal(world.gladys.fake.sceneEvents[0].data.node, 'emqx@192.0.2.10');
  assert.equal(world.gladys.fake.sceneEvents[0].data.version, '6.3.2');
});

test('fewer clients for a minute fires clients_below once per threshold', async (t) => {
  const world = await addedWorld(t);
  world.emqx.setMonitor({ live_connections: 6 });
  await tick(t, 30 * SECOND);
  world.emqx.setMonitor({ live_connections: 2 });
  await tick(t, 30 * SECOND);
  assert.deepEqual(keys(world), []);
  await tick(t, 2 * MINUTE);
  const below = world.gladys.fake.sceneEvents.map((event) => event.data.below);
  assert.deepEqual(below, ['3', '4', '5']);
});

test('a message spike fires messages_above, for the thresholds crossed', async (t) => {
  // The capture carries 11 messages/s (660/min): 100 and 500 are already over.
  const world = await addedWorld(t);
  world.emqx.setMonitor({ received_msg_rate: 50 });
  await tick(t, 30 * SECOND);
  assert.deepEqual(
    world.gladys.fake.sceneEvents.map((event) => event.data.above),
    ['1000', '2000'],
  );
  assert.equal(world.gladys.fake.sceneEvents[0].data.messages_per_minute, 3000);
});

test('check_connection reads EMQX now and reports in four languages', async (t) => {
  const world = await addedWorld(t, { clients: ['sensor-1'] });
  const ack = await world.gladys.fake.action('check_connection', {});
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /EMQX 6\.3\.2/);
  assert.match(ack.data.message.fr, /Clients suivis : 1 sur 1/);
  assert.deepEqual(Object.keys(ack.data.message).sort(), ['de', 'en', 'es', 'fr']);
  world.emqx.down = true;
  const failed = await world.gladys.fake.action('check_connection', {});
  assert.equal(failed.success, false);
  assert.match(failed.error ?? failed.message ?? JSON.stringify(failed), /injoignable/);
});

test('broker_summary gives a sentence and the numbers', async (t) => {
  const world = await addedWorld(t);
  world.emqx.setAlarms([MEMORY_ALARM]);
  await tick(t, 30 * SECOND);
  const ack = await world.gladys.fake.sceneAction('broker_summary', {});
  const outputs = ack.data.outputs;
  assert.equal(outputs.reachable, true);
  assert.equal(outputs.active_alarms, 1);
  assert.equal(outputs.alarm_names, 'high_system_memory_usage');
  assert.equal(outputs.version, '6.3.2');
  assert.match(outputs.summary, /^EMQX 6\.3\.2 fonctionne depuis .* 1 alarme\(s\) en cours\.$/);
  world.emqx.down = true;
  await tick(t, 30 * SECOND);
  const down = (await world.gladys.fake.sceneAction('broker_summary', {})).data.outputs;
  assert.equal(down.reachable, false);
  assert.equal(down.summary, 'EMQX est injoignable.');
  assert.equal(down.clients_connected, null);
});

test('the widget shows the state, the alarms and live tiles, within the budget', async (t) => {
  const world = await addedWorld(t);
  const alarms = ['a', 'b', 'c', 'd', 'e'].map((name) => ({
    ...MEMORY_ALARM,
    name: `alarm_${name}`,
  }));
  world.emqx.setAlarms(alarms);
  await tick(t, 30 * SECOND);
  for (const language of ['en', 'fr', 'de', 'es']) {
    const ack = await world.gladys.fake.widgetGet('broker', {
      settings: { device: brokerId(world.gladys) },
      language,
    });
    const { content } = ack.data;
    const report = validateWidgetContent(content);
    assert.deepEqual(report.errors ?? [], [], JSON.stringify(report));
    assert.deepEqual(report.warnings ?? [], [], JSON.stringify(report));
    assert.ok(content.components.length <= 8);
    assert.ok(content.components.filter((c) => c.type === 'text').length <= 2);
    const status = content.components[0].items;
    assert.equal(status.filter((item) => item.icon === 'alert-triangle').length, 4);
    // Every live tile is bound to a feature of the broker as discovered.
    const discovered = new Set(
      world.gladys.fake.discoveredDevices[0].features.map((feature) => feature.external_id),
    );
    for (const component of content.components.filter((c) => c.device_feature)) {
      assert.ok(discovered.has(component.device_feature), component.device_feature);
    }
  }
});

test('the widget asks for the configuration, the device, or to add the broker', async () => {
  const world = await createWorld({ config: {} });
  try {
    const get = async (settings) =>
      (await world.gladys.fake.widgetGet('broker', { settings, language: 'en' })).data.content
        .components[0].text;
    assert.match(await get({}), /address of EMQX/);
    await world.gladys.fake.configUpdated(CONFIG);
    await flush();
    assert.match(await get({}), /Pick the broker/);
    assert.match(await get({ device: brokerId(world.gladys) }), /Add the EMQX broker/);
  } finally {
    world.app.stop();
  }
});

test('a new list of clients updates the Discovery tab, an old client is forgotten', async (t) => {
  const world = await addedWorld(t, { clients: ['sensor-1'] });
  await world.gladys.fake.configUpdated({ ...CONFIG, client_ids: 'sensor-2' });
  await flush();
  assert.deepEqual(
    world.gladys.fake.discoveredDevices.map((device) => device.name),
    ['EMQX', 'sensor-2'],
  );
  assert.ok(!world.hub.clients.has('sensor-1'));
});
