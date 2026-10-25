// -----------------------------------------------------------------------------
// Scene action handlers (manifest `scene_actions`).
//
// `broker_summary` — the state of the broker as a ready-made sentence ("EMQX
// 5.8.6 has been running for 3 days, 12 clients connected, 64 messages
// received and 87 sent per minute, no alarm.") plus its numbers, for a daily
// report or a check before a scene that relies on MQTT. Its language is the
// one of the configuration (a scene action does not receive the user's
// language). An unreachable broker is an answer, not an error: the scene can
// branch on `reachable`. The numbers are those of the latest read (30 s old
// at most).
// -----------------------------------------------------------------------------

import { round } from './devices.js';
import { brokerSentence } from './i18n.js';

export const SCENE_ACTION = {
  BROKER_SUMMARY: 'broker_summary',
};

/**
 * @param {import('./hub.js').EmqxHub} hub
 */
export function brokerSummary(hub) {
  const data = hub.data();
  const stats = hub.live() ? data.stats : {};
  const alarms = Array.isArray(stats.alarms) ? stats.alarms : [];
  return {
    summary: brokerSentence(data, hub.config?.language ?? 'fr'),
    // The numbers are readable: a refused key or a wrong address is not fine.
    reachable: hub.live(),
    clients_connected: round(stats.clientsConnected),
    messages_received_per_minute: round(stats.messagesReceived),
    messages_sent_per_minute: round(stats.messagesSent),
    messages_dropped_per_minute: round(stats.messagesDropped),
    active_alarms: hub.live() ? alarms.length : null,
    alarm_names: [...new Set(alarms.map((alarm) => alarm.name))].join(', '),
    uptime_hours: Number.isFinite(stats.uptimeSeconds)
      ? round(stats.uptimeSeconds / 3600, 1)
      : null,
    version: stats.version ?? '',
  };
}
