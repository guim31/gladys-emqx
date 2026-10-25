// -----------------------------------------------------------------------------
// The scene triggers, as transitions.
//
// Scene filters only compare for equality (a threshold belongs to a device
// feature), so a trigger with a threshold fires once per threshold crossed,
// and the scene author picks one (required filter).
//
// `broker_unreachable` — the API has not answered for N minutes: once per
// outage and per threshold. A restart of a few seconds fires nothing, which
// the "Reachable" feature cannot offer.
// `broker_back` — the API answers again after an outage of at least
// OUTAGE_MIN_MS (one that could have fired `broker_unreachable`).
// `broker_restarted` — the uptime of a node went backwards: EMQX restarted
// (or crashed) between two reads, even if no outage was seen.
// `clients_below` — fewer than N connected clients for CONFIRM_MS (a sensor,
// a bridge or Zigbee2MQTT that dropped). Re-armed when the count is back.
// `messages_above` — more than N messages received per minute (a device in a
// loop, a flood): once per crossing, at most once per QUIET_PERIOD_MS (a
// crossing within it is reported when it ends).
// `alarm_raised` / `alarm_cleared` — an alarm of EMQX (memory, CPU,
// congestion…) appears in, or leaves, the list of alarms in progress.
// `client_disconnected` / `client_reconnected` — a followed client drops, or
// comes back (with the minutes it was away).
//
// After a restart of the integration, the first values are a baseline: an
// alarm already raised, a client already away, a count already below a
// threshold fire nothing (it would re-run every scene).
// -----------------------------------------------------------------------------

import { alarmKey } from './emqx/snapshot.js';

export const TRIGGER = {
  BROKER_UNREACHABLE: 'broker_unreachable',
  BROKER_BACK: 'broker_back',
  BROKER_RESTARTED: 'broker_restarted',
  ALARM_RAISED: 'alarm_raised',
  ALARM_CLEARED: 'alarm_cleared',
  CLIENT_DISCONNECTED: 'client_disconnected',
  CLIENT_RECONNECTED: 'client_reconnected',
  CLIENTS_BELOW: 'clients_below',
  MESSAGES_ABOVE: 'messages_above',
};

const MINUTE = 60 * 1000;

// Thresholds offered to the scene author.
export const UNREACHABLE_MINUTES = [1, 5, 15, 30, 60];
// The integration reads the REST API: it is not an MQTT client of the broker.
export const CLIENTS_THRESHOLDS = [1, 2, 3, 4, 5, 10, 15, 20, 30, 50, 100];
export const MESSAGES_THRESHOLDS = [100, 500, 1000, 2000, 5000, 10000, 50000];

export const OUTAGE_MIN_MS = UNREACHABLE_MINUTES[0] * MINUTE;
export const CONFIRM_MS = MINUTE;
export const QUIET_PERIOD_MS = 30 * MINUTE;

/**
 * @param {object} options
 * @param {() => number} [options.now]
 */
export function createTriggerTracker({ now = () => Date.now() } = {}) {
  // Link: when the outage started (null: up or unknown).
  let linkKnown = false;
  let downSince = null;
  let unreachableFired = new Set();
  let lastUptimes = null;
  // Clients count: per threshold, armed (seen at or above) and since when below.
  const clientsArmed = new Set();
  const clientsBelowSince = new Map();
  // Messages: per threshold, armed (seen at or below) and last fire.
  const messagesArmed = new Set();
  const messagesFiredAt = new Map();
  // Alarms in progress: key -> alarm; null before the first list.
  let alarms = null;
  // Followed clients: id -> { connected, since }.
  const clients = new Map();

  return {
    /**
     * A read of the API ended.
     * @param {boolean} up the broker answered (even with a refusal)
     * @returns {{ back: boolean, offlineMinutes: number }}
     */
    onLink(up) {
      const at = now();
      if (!up) {
        if (downSince === null) {
          downSince = at;
          unreachableFired = new Set();
        }
        linkKnown = true;
        return { back: false, offlineMinutes: 0 };
      }
      const wasDown = downSince;
      downSince = null;
      const known = linkKnown;
      linkKnown = true;
      if (!known || wasDown === null) {
        return { back: false, offlineMinutes: 0 };
      }
      // The clients count seen before the outage is stale.
      clientsBelowSince.clear();
      const duration = at - wasDown;
      return {
        back: duration >= OUTAGE_MIN_MS,
        offlineMinutes: Math.floor(duration / MINUTE),
      };
    },

    /**
     * The outage, if any, at this time.
     * @returns {{ unreachable: number[], offlineMinutes: number }}
     */
    onTick() {
      const at = now();
      const unreachable = [];
      if (downSince === null) {
        return { unreachable, offlineMinutes: 0 };
      }
      for (const minutes of UNREACHABLE_MINUTES) {
        if (!unreachableFired.has(minutes) && at - downSince >= minutes * MINUTE) {
          unreachableFired.add(minutes);
          unreachable.push(minutes);
        }
      }
      return { unreachable, offlineMinutes: Math.floor((at - downSince) / MINUTE) };
    },

    /**
     * The uptime of every running node, in ms.
     * @param {Record<string, number>} uptimes
     * @returns {string[]} the nodes that restarted
     */
    onUptimes(uptimes) {
      const restarted =
        lastUptimes === null
          ? []
          : Object.keys(uptimes).filter(
              (node) => lastUptimes[node] !== undefined && uptimes[node] < lastUptimes[node],
            );
      lastUptimes = { ...lastUptimes, ...uptimes };
      return restarted;
    },

    /**
     * The connected clients count.
     * @returns {number[]} the thresholds crossed downwards for CONFIRM_MS
     */
    onClients(count) {
      const fired = [];
      if (count === null) {
        return fired;
      }
      const at = now();
      for (const threshold of CLIENTS_THRESHOLDS) {
        if (count >= threshold) {
          clientsArmed.add(threshold);
          clientsBelowSince.delete(threshold);
          continue;
        }
        if (!clientsArmed.has(threshold)) {
          continue;
        }
        if (!clientsBelowSince.has(threshold)) {
          clientsBelowSince.set(threshold, at);
        }
        if (at - clientsBelowSince.get(threshold) >= CONFIRM_MS) {
          clientsArmed.delete(threshold);
          clientsBelowSince.delete(threshold);
          fired.push(threshold);
        }
      }
      return fired;
    },

    /**
     * The messages received per minute.
     * @returns {number[]} the thresholds crossed upwards
     */
    onMessages(perMinute) {
      const fired = [];
      if (perMinute === null) {
        return fired;
      }
      const at = now();
      for (const threshold of MESSAGES_THRESHOLDS) {
        if (perMinute <= threshold) {
          messagesArmed.add(threshold);
          continue;
        }
        if (!messagesArmed.has(threshold)) {
          continue;
        }
        // Within the quiet period the threshold stays armed: a flood still
        // going on when it ends is reported then.
        const last = messagesFiredAt.get(threshold);
        if (last === undefined || at - last >= QUIET_PERIOD_MS) {
          messagesArmed.delete(threshold);
          messagesFiredAt.set(threshold, at);
          fired.push(threshold);
        }
      }
      return fired;
    },

    /**
     * The alarms in progress.
     * @param {Array<{ name: string, node: string, activatedAt: number|null }>} list
     * @returns {{ raised: object[], cleared: Array<{ alarm: object, minutes: number }> }}
     */
    onAlarms(list) {
      const current = new Map(list.map((alarm) => [alarmKey(alarm), alarm]));
      const previous = alarms;
      alarms = current;
      if (previous === null) {
        return { raised: [], cleared: [] };
      }
      const at = now();
      const raised = [...current].filter(([key]) => !previous.has(key)).map(([, alarm]) => alarm);
      const cleared = [...previous]
        .filter(([key]) => !current.has(key))
        .map(([, alarm]) => ({
          alarm,
          minutes:
            alarm.activatedAt === null
              ? 0
              : Math.max(0, Math.floor((at - alarm.activatedAt) / MINUTE)),
        }));
      return { raised, cleared };
    },

    /**
     * A followed client was read.
     * @param {string} clientId
     * @param {boolean} connected
     * @returns {{ event: 'disconnected'|'reconnected'|null, offlineMinutes: number }}
     */
    onClient(clientId, connected) {
      const at = now();
      const previous = clients.get(clientId);
      if (previous && previous.connected === connected) {
        return { event: null, offlineMinutes: 0 };
      }
      clients.set(clientId, { connected, since: at });
      if (!previous) {
        return { event: null, offlineMinutes: 0 };
      }
      if (!connected) {
        return { event: 'disconnected', offlineMinutes: 0 };
      }
      return { event: 'reconnected', offlineMinutes: Math.floor((at - previous.since) / MINUTE) };
    },

    /** A client no longer followed. */
    forgetClient(clientId) {
      clients.delete(clientId);
    },

    /** A new configuration (another broker): forget everything. */
    reset() {
      linkKnown = false;
      downSince = null;
      unreachableFired = new Set();
      lastUptimes = null;
      clientsArmed.clear();
      clientsBelowSince.clear();
      messagesArmed.clear();
      messagesFiredAt.clear();
      alarms = null;
      clients.clear();
    },
  };
}
