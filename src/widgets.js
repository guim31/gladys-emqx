// -----------------------------------------------------------------------------
// The "EMQX broker" dashboard widget: the state of the broker, its alarms in
// progress and its key numbers.
//
// Content budget of the core: 8 components, 2 texts at most. Here: 1 status
// list (state, version, uptime, nodes of a cluster, alarms), up to 4 live
// tiles bound to the broker's features (they follow the published states
// without any refresh), 1 caption. Pre-localized from the viewer's
// `language` (the core caches the content per settings, language and units).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { isConfigured } from './config.js';
import { brokerIds } from './devices.js';
import { formatDuration, pick, relativeTime } from './i18n.js';
import { WIDGET_KEY } from './hub.js';

export const WIDGET = {
  BROKER: WIDGET_KEY,
};

export const CONTENT_TTL_SECONDS = 30;
// Alarm rows shown; the rest is summed up in one row.
export const MAX_ALARM_ROWS = 3;

export const TEXT = {
  en: {
    notConfigured: 'Enter the address of EMQX and an API key in the integration configuration.',
    pickBroker: 'Pick the broker in the widget settings.',
    unknownBroker: 'Add the EMQX broker to Gladys first (Discovery tab), then pick it here.',
    broker: 'Broker',
    online: 'Online',
    unreachable: 'Unreachable',
    refused: 'API key refused',
    incompatible: 'No EMQX 5 API',
    connecting: 'Connecting…',
    version: 'Version',
    uptime: 'Uptime',
    nodes: 'Nodes',
    alarms: 'Alarms',
    noAlarm: 'None',
    moreAlarms: (count) => `+${count} more`,
    clients: 'Clients',
    received: 'Received /min',
    sent: 'Sent /min',
    dropped: 'Dropped /min',
    updated: (ago) => `Read ${ago}`,
  },
  fr: {
    notConfigured:
      "Saisissez l'adresse d'EMQX et une clé d'API dans la configuration de l'intégration.",
    pickBroker: 'Choisissez le broker dans les réglages du widget.',
    unknownBroker:
      "Ajoutez d'abord le broker EMQX à Gladys (onglet Découverte), puis choisissez-le ici.",
    broker: 'Broker',
    online: 'En ligne',
    unreachable: 'Injoignable',
    refused: "Clé d'API refusée",
    incompatible: "Pas d'API EMQX 5",
    connecting: 'Connexion…',
    version: 'Version',
    uptime: 'En marche depuis',
    nodes: 'Nœuds',
    alarms: 'Alarmes',
    noAlarm: 'Aucune',
    moreAlarms: (count) => `${count} de plus`,
    clients: 'Clients',
    received: 'Reçus /min',
    sent: 'Envoyés /min',
    dropped: 'Jetés /min',
    updated: (ago) => `Lu ${ago}`,
  },
  de: {
    notConfigured:
      'Gib die Adresse von EMQX und einen API-Schlüssel in der Konfiguration der Integration ein.',
    pickBroker: 'Wähle den Broker in den Einstellungen des Widgets.',
    unknownBroker:
      'Füge den EMQX-Broker zuerst zu Gladys hinzu (Tab „Erkennung“) und wähle ihn dann hier.',
    broker: 'Broker',
    online: 'Online',
    unreachable: 'Nicht erreichbar',
    refused: 'API-Schlüssel abgelehnt',
    incompatible: 'Keine EMQX-5-API',
    connecting: 'Verbinde…',
    version: 'Version',
    uptime: 'Laufzeit',
    nodes: 'Knoten',
    alarms: 'Alarme',
    noAlarm: 'Keine',
    moreAlarms: (count) => `${count} weitere`,
    clients: 'Clients',
    received: 'Empfangen /min',
    sent: 'Gesendet /min',
    dropped: 'Verworfen /min',
    updated: (ago) => `Gelesen ${ago}`,
  },
  es: {
    notConfigured:
      'Introduzca la dirección de EMQX y una clave de API en la configuración de la integración.',
    pickBroker: 'Elija el broker en los ajustes del widget.',
    unknownBroker:
      'Añada primero el broker EMQX a Gladys (pestaña Descubrimiento) y luego elíjalo aquí.',
    broker: 'Broker',
    online: 'En línea',
    unreachable: 'Inaccesible',
    refused: 'Clave de API rechazada',
    incompatible: 'Sin API de EMQX 5',
    connecting: 'Conectando…',
    version: 'Versión',
    uptime: 'En marcha desde hace',
    nodes: 'Nodos',
    alarms: 'Alarmas',
    noAlarm: 'Ninguna',
    moreAlarms: (count) => `${count} más`,
    clients: 'Clientes',
    received: 'Recibidos /min',
    sent: 'Enviados /min',
    dropped: 'Descartados /min',
    updated: (ago) => `Leído ${ago}`,
  },
};

// The live tiles: feature key, label key, icon.
const TILES = [
  ['clients_connected', 'clients', 'users'],
  ['messages_received', 'received', 'download'],
  ['messages_sent', 'sent', 'upload'],
  ['messages_dropped', 'dropped', 'trash-2'],
];

const LINK = {
  connected: ['online', WIDGET_COLORS.SUCCESS],
  refused: ['refused', WIDGET_COLORS.DANGER],
  incompatible: ['incompatible', WIDGET_COLORS.DANGER],
  unreachable: ['unreachable', WIDGET_COLORS.DANGER],
};

// A status value holds 40 characters at most.
const clip = (value) => (value.length > 40 ? `${value.slice(0, 39)}…` : value);

const textContent = (text) => ({
  ttl_seconds: CONTENT_TTL_SECONDS,
  components: [{ type: 'text', variant: 'body', text }],
});

/**
 * Pure builder of the widget content.
 * @param {object} input
 * @param {object} input.gladys
 * @param {string|null} input.link
 * @param {object} input.stats
 * @param {Set<string>} input.features the feature keys of the added device
 * @param {string} input.language
 * @param {number|null} input.statsAt ms
 * @param {number} input.now ms
 */
export function buildBrokerContent({ gladys, link, stats, features, language, statsAt, now }) {
  const text = pick(TEXT, language);
  const [stateKey, color] = LINK[link] ?? ['connecting', WIDGET_COLORS.NEUTRAL];
  const items = [{ label: text.broker, value: text[stateKey], icon: 'server', color }];
  if (stats.version) {
    items.push({ label: text.version, value: stats.version, icon: 'tag' });
  }
  const live = link === 'connected';
  if (live && Number.isFinite(stats.uptimeSeconds)) {
    items.push({
      label: text.uptime,
      value: formatDuration(stats.uptimeSeconds, language),
      icon: 'clock',
    });
  }
  if (live && stats.nodesTotal > 1) {
    items.push({
      label: text.nodes,
      value: `${stats.nodesRunning}/${stats.nodesTotal}`,
      icon: 'layers',
      color: stats.nodesRunning < stats.nodesTotal ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS,
    });
  }
  if (live && Array.isArray(stats.alarms)) {
    if (stats.alarms.length === 0) {
      items.push({
        label: text.alarms,
        value: text.noAlarm,
        icon: 'check-circle',
        color: WIDGET_COLORS.SUCCESS,
      });
    }
    for (const alarm of stats.alarms.slice(0, MAX_ALARM_ROWS)) {
      items.push({
        label: clip(alarm.name),
        value: clip(alarm.message),
        icon: 'alert-triangle',
        color: WIDGET_COLORS.WARNING,
      });
    }
    if (stats.alarms.length > MAX_ALARM_ROWS) {
      items.push({
        label: text.alarms,
        value: text.moreAlarms(stats.alarms.length - MAX_ALARM_ROWS),
        icon: 'alert-triangle',
        color: WIDGET_COLORS.WARNING,
      });
    }
  }
  const components = [{ type: 'status', items }];
  const ids = brokerIds(gladys);
  for (const [key, label, icon] of TILES) {
    if (features.has(key)) {
      components.push({
        type: 'value',
        label: text[label],
        icon,
        device_feature: ids.feature(key),
      });
    }
  }
  if (statsAt !== null) {
    components.push({
      type: 'text',
      variant: 'caption',
      text: text.updated(relativeTime((now - statsAt) / 1000, language)),
    });
  }
  return { ttl_seconds: CONTENT_TTL_SECONDS, components };
}

/**
 * The onWidgetGet handler of the broker widget.
 * @param {import('./hub.js').EmqxHub} hub
 * @param {{ settings?: object, language?: string }} request
 */
export function getBrokerWidget(hub, { settings = {}, language = 'en' } = {}) {
  const text = pick(TEXT, language);
  if (!isConfigured(hub.config)) {
    return textContent(text.notConfigured);
  }
  if (!settings.device) {
    return textContent(text.pickBroker);
  }
  const device = hub.addedBroker();
  if (!device || device.external_id !== settings.device) {
    return textContent(text.unknownBroker);
  }
  // Tiles only for the features of the device as added.
  const ids = brokerIds(hub.gladys);
  const added = new Set((device.features ?? []).map((feature) => feature.external_id));
  const features = new Set(TILES.map(([key]) => key).filter((key) => added.has(ids.feature(key))));
  return buildBrokerContent({
    gladys: hub.gladys,
    link: hub.link,
    stats: hub.stats,
    features,
    language,
    statsAt: hub.statsAt,
    now: hub.now(),
  });
}
