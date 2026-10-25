// -----------------------------------------------------------------------------
// From the raw answers of the EMQX API to the numbers the integration uses.
//
// - `GET /nodes`: one entry per node of the cluster (version, uptime in ms,
//   node_status "running" or "stopped").
// - `GET /monitor_current`: the cluster-wide counts and rates of the
//   dashboard. `live_connections` are the clients connected right now;
//   `connections` also counts the disconnected persistent sessions. The rates
//   are messages per second, sampled every 10 s by EMQX: published here per
//   minute, like the Mosquitto integration, since Gladys has no "per second"
//   unit for messages and a home broker carries a few per second at most.
// - `GET /alarms?activated=true`: the alarms in progress.
// - `GET /clients/{id}`: one client (`connected`, `connected_at`,
//   `disconnected_at`), or a 404 once its session is gone.
//
// Checked on EMQX 5.8.6 (Opensource) and 6.3.2, see test/fixtures/emqx/.
// -----------------------------------------------------------------------------

const num = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

const perMinute = (value) => (num(value) === null ? null : Math.round(value * 60));

/**
 * @param {unknown} nodes the body of GET /nodes
 * @param {unknown} monitor the body of GET /monitor_current
 * @param {unknown} alarms the body of GET /alarms?activated=true
 */
export function parseBroker(nodes, monitor, alarms) {
  const list = Array.isArray(nodes) ? nodes.filter((node) => node && typeof node === 'object') : [];
  const running = list.filter((node) => node.node_status === 'running');
  // The cluster runs since its youngest running node started: a restart of
  // any node shows.
  const uptimes = running.map((node) => num(node.uptime)).filter((value) => value !== null);
  const m = monitor && typeof monitor === 'object' ? monitor : {};
  const live = num(m.live_connections) ?? num(m.connections);
  const alarmList = Array.isArray(alarms?.data) ? alarms.data : [];
  return {
    version: list.find((node) => typeof node.version === 'string')?.version ?? null,
    edition: list.find((node) => typeof node.edition === 'string')?.edition ?? null,
    nodesTotal: list.length,
    nodesRunning: running.length,
    nodeUptimes: Object.fromEntries(
      running
        .filter((node) => typeof node.node === 'string' && num(node.uptime) !== null)
        .map((node) => [node.node, node.uptime]),
    ),
    uptimeSeconds: uptimes.length > 0 ? Math.floor(Math.min(...uptimes) / 1000) : null,
    clientsConnected: live,
    sessions: num(m.connections),
    subscriptions: num(m.subscriptions),
    topics: num(m.topics),
    retainedMessages: num(m.retained_msg_count),
    messagesReceived: perMinute(m.received_msg_rate),
    messagesSent: perMinute(m.sent_msg_rate),
    messagesDropped: perMinute(m.dropped_msg_rate),
    alarms: alarmList
      .filter((alarm) => alarm && typeof alarm.name === 'string')
      .map((alarm) => ({
        name: alarm.name,
        node: typeof alarm.node === 'string' ? alarm.node : '',
        message: typeof alarm.message === 'string' ? alarm.message : alarm.name,
        activatedAt: parseDate(alarm.activate_at),
      })),
  };
}

/** The key of an alarm: EMQX raises one alarm of a name per node. */
export const alarmKey = (alarm) => `${alarm.name}@${alarm.node}`;

/** An ISO date of EMQX in ms, or null. */
export function parseDate(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * One followed client.
 * @param {unknown} body the body of GET /clients/{id}, null on a 404
 * @returns {{ known: boolean, connected: boolean, connectedAt: number|null, disconnectedAt: number|null }}
 */
export function parseClient(body) {
  if (!body || typeof body !== 'object') {
    return { known: false, connected: false, connectedAt: null, disconnectedAt: null };
  }
  return {
    known: true,
    connected: body.connected === true,
    connectedAt: parseDate(body.connected_at),
    disconnectedAt: parseDate(body.disconnected_at),
  };
}
