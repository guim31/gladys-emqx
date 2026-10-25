// -----------------------------------------------------------------------------
// The Gladys devices: the EMQX broker (or cluster), and one device per
// followed MQTT client.
//
// The broker is keyed on a fixed id: a new address (another host, HTTPS)
// keeps the same device and its history. A client is keyed on its MQTT client
// id, URI-encoded (a client id may hold ":" or "/"). Feature keys are forever
// (Gladys keys the history, scenes and dashboards on them): add new ones,
// never rename one.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import { CLIENT_FEATURE_NAMES, FEATURE_NAMES, formatDate, pick } from './i18n.js';

export const BROKER_TYPE = 'broker';
export const BROKER_ID = 'emqx';
export const CLIENT_TYPE = 'client';
export const DEFAULT_NAME = 'EMQX';

const MAX_COUNT = 10000000;

export const round = (value, decimals = 0) => {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const counter = (key, stat) => ({
  key,
  category: C.COUNTER_SENSOR,
  type: T.SENSOR.INTEGER,
  min: 0,
  max: MAX_COUNT,
  read: ({ stats }) => round(stats[stat]),
});

const binary = (key, read) => ({
  key,
  category: C.INPUT,
  type: T.SENSOR.BINARY,
  min: 0,
  max: 1,
  read,
});

/**
 * The features of the broker, in display order. `read` turns the broker data
 * ({ reachable, stats }) into the state, or null when unknown (nothing is
 * published then).
 */
export const FEATURES = [
  binary('reachable', ({ reachable }) => (reachable === null ? null : reachable ? 1 : 0)),
  counter('clients_connected', 'clientsConnected'),
  counter('subscriptions', 'subscriptions'),
  counter('topics', 'topics'),
  counter('messages_received', 'messagesReceived'),
  counter('messages_sent', 'messagesSent'),
  counter('messages_dropped', 'messagesDropped'),
  counter('retained_messages', 'retainedMessages'),
  {
    ...counter('active_alarms', 'alarms'),
    read: ({ stats }) => (Array.isArray(stats.alarms) ? stats.alarms.length : null),
  },
  counter('nodes_running', 'nodesRunning'),
  {
    // In days: Gladys has no "uptime" display, and days read best on a tile.
    key: 'uptime',
    category: C.DURATION,
    type: T.DURATION.DECIMAL,
    unit: U.DAYS,
    min: 0,
    max: 36500,
    keepHistory: false,
    read: ({ stats }) =>
      Number.isFinite(stats.uptimeSeconds) ? round(stats.uptimeSeconds / 86400, 2) : null,
  },
  {
    key: 'version',
    category: C.TEXT,
    type: T.TEXT.TEXT,
    // NOT NULL in the core, even for a text (422 on "Add to Gladys").
    min: 0,
    max: 0,
    keepHistory: false,
    read: ({ stats }) => (stats.version ? { text: stats.version } : null),
  },
];

/** The features of a followed client. */
export const CLIENT_FEATURES = [
  binary('connected', ({ client }) => (client ? (client.connected ? 1 : 0) : null)),
  {
    // The date of the latest connection, in the configured language and the
    // time zone of Gladys (TZ). Kept as long as EMQX forgets the client.
    key: 'last_connection',
    category: C.TEXT,
    type: T.TEXT.TEXT,
    min: 0,
    max: 0,
    keepHistory: false,
    read: ({ client, language }) =>
      client?.connectedAt ? { text: formatDate(client.connectedAt, language) } : null,
  },
];

/** The external ids of the broker. */
export const brokerIds = (gladys) => gladys.externalIds(BROKER_TYPE, BROKER_ID);

/** The external ids of a followed client. */
export const clientIds = (gladys, clientId) =>
  gladys.externalIds(CLIENT_TYPE, encodeURIComponent(clientId));

/** The client id behind a device external id, or null if not a client. */
export function clientIdOf(gladys, externalId) {
  const prefix = gladys.externalIds(CLIENT_TYPE, '').device;
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  try {
    return decodeURIComponent(externalId.slice(prefix.length));
  } catch {
    return null;
  }
}

const toFeature = (ids, names) => (feature) => ({
  name: names[feature.key],
  external_id: ids.feature(feature.key),
  category: feature.category,
  type: feature.type,
  ...(feature.unit ? { unit: feature.unit } : {}),
  min: feature.min,
  max: feature.max,
  read_only: true,
  has_feedback: false,
  keep_history: feature.keepHistory ?? true,
});

/**
 * The discovered device of the broker.
 * @param {object} gladys
 * @param {{ language: string, edition?: string|null }} options
 */
export function buildBrokerDevice(gladys, { language, edition = null }) {
  const ids = brokerIds(gladys);
  return {
    name: DEFAULT_NAME,
    external_id: ids.device,
    model: edition ? `EMQX ${edition}` : 'EMQX',
    // Read by the container every 30 s: the core never polls.
    should_poll: false,
    features: FEATURES.map(toFeature(ids, pick(FEATURE_NAMES, language))),
  };
}

/**
 * The discovered device of a followed client, named after its client id.
 * @param {object} gladys
 * @param {{ clientId: string, language: string }} options
 */
export function buildClientDevice(gladys, { clientId, language }) {
  const ids = clientIds(gladys, clientId);
  return {
    name: clientId,
    external_id: ids.device,
    model: 'MQTT client',
    should_poll: false,
    features: CLIENT_FEATURES.map(toFeature(ids, pick(CLIENT_FEATURE_NAMES, language))),
  };
}

function toStates(ids, features, data) {
  const states = [];
  for (const feature of features) {
    const value = feature.read(data);
    if (value === null || value === undefined) {
      continue;
    }
    const id = ids.feature(feature.key);
    // A text feature takes `text`, never an empty one (the core ignores it).
    states.push(
      typeof value === 'object'
        ? { device_feature_external_id: id, text: value.text }
        : { device_feature_external_id: id, state: value },
    );
  }
  return states;
}

/**
 * The states of the broker, in the publishStates format.
 * @param {object} gladys
 * @param {{ reachable: boolean|null, stats: object }} data
 */
export const buildBrokerStates = (gladys, data) => toStates(brokerIds(gladys), FEATURES, data);

/**
 * The states of a followed client.
 * @param {object} gladys
 * @param {string} clientId
 * @param {{ client: object|null, language: string }} data
 */
export const buildClientStates = (gladys, clientId, data) =>
  toStates(clientIds(gladys, clientId), CLIENT_FEATURES, data);
