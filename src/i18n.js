// -----------------------------------------------------------------------------
// Every text the container produces, in the four languages of the Gladys
// interface. German says "du", Spanish says "usted" (house rule, enforced by
// test/i18n.test.js). Vocabulary follows the Gladys front translations.
//
// An integration of type "device" does not receive the user's language: the
// feature names, the scene action outputs and the action messages follow the
// `language` field of the configuration (French by default). Widgets get the
// viewer's language with every request.
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

/** Pick the text of a language, English as the fallback. */
export function pick(texts, language) {
  return texts[LANGUAGES.includes(language) ? language : 'en'] ?? texts.en;
}

// Feature names, by feature key (src/devices.js). Frozen at device creation
// in Gladys: changing one only affects devices added afterwards.
export const FEATURE_NAMES = {
  en: {
    reachable: 'Reachable',
    clients_connected: 'Connected clients',
    subscriptions: 'Subscriptions',
    topics: 'Topics',
    messages_received: 'Messages received (/min)',
    messages_sent: 'Messages sent (/min)',
    messages_dropped: 'Messages dropped (/min)',
    retained_messages: 'Retained messages',
    active_alarms: 'Active alarms',
    nodes_running: 'Running nodes',
    uptime: 'Uptime',
    version: 'Version',
  },
  fr: {
    reachable: 'Joignable',
    clients_connected: 'Clients connectés',
    subscriptions: 'Abonnements',
    topics: 'Topics',
    messages_received: 'Messages reçus (/min)',
    messages_sent: 'Messages envoyés (/min)',
    messages_dropped: 'Messages jetés (/min)',
    retained_messages: 'Messages retenus',
    active_alarms: 'Alarmes en cours',
    nodes_running: 'Nœuds en marche',
    uptime: 'Durée de fonctionnement',
    version: 'Version',
  },
  de: {
    reachable: 'Erreichbar',
    clients_connected: 'Verbundene Clients',
    subscriptions: 'Abonnements',
    topics: 'Topics',
    messages_received: 'Empfangene Nachrichten (/min)',
    messages_sent: 'Gesendete Nachrichten (/min)',
    messages_dropped: 'Verworfene Nachrichten (/min)',
    retained_messages: 'Gespeicherte Nachrichten',
    active_alarms: 'Aktive Alarme',
    nodes_running: 'Laufende Knoten',
    uptime: 'Laufzeit',
    version: 'Version',
  },
  es: {
    reachable: 'Accesible',
    clients_connected: 'Clientes conectados',
    subscriptions: 'Suscripciones',
    topics: 'Temas',
    messages_received: 'Mensajes recibidos (/min)',
    messages_sent: 'Mensajes enviados (/min)',
    messages_dropped: 'Mensajes descartados (/min)',
    retained_messages: 'Mensajes retenidos',
    active_alarms: 'Alarmas activas',
    nodes_running: 'Nodos en marcha',
    uptime: 'Tiempo en marcha',
    version: 'Versión',
  },
};

export const CLIENT_FEATURE_NAMES = {
  en: { connected: 'Connected', last_connection: 'Last connection' },
  fr: { connected: 'Connecté', last_connection: 'Dernière connexion' },
  de: { connected: 'Verbunden', last_connection: 'Letzte Verbindung' },
  es: { connected: 'Conectado', last_connection: 'Última conexión' },
};

// Connection status messages (Gladys shows them on the integration page) and
// errors of the actions.
export const MESSAGES = {
  notConfigured: {
    en: 'Enter the address of EMQX, an API key and its secret in the configuration.',
    fr: "Saisissez l'adresse d'EMQX, une clé d'API et son secret dans la configuration.",
    de: 'Gib die Adresse von EMQX, einen API-Schlüssel und sein Secret in der Konfiguration ein.',
    es: 'Introduzca la dirección de EMQX, una clave de API y su secreto en la configuración.',
  },
  unreachable: {
    en: 'EMQX cannot be reached: check its address (dashboard port, 18083 by default) and that it is running.',
    fr: 'EMQX est injoignable : vérifiez son adresse (port du tableau de bord, 18083 par défaut) et qu’il fonctionne.',
    de: 'EMQX ist nicht erreichbar: Prüfe seine Adresse (Port des Dashboards, standardmäßig 18083) und ob es läuft.',
    es: 'No se puede acceder a EMQX: compruebe su dirección (puerto del panel, 18083 por defecto) y que esté en marcha.',
  },
  refused: {
    en: 'EMQX refused the API key: check the key, its secret, that it is enabled and not expired.',
    fr: "EMQX refuse la clé d'API : vérifiez la clé, son secret, qu'elle est activée et pas expirée.",
    de: 'EMQX lehnt den API-Schlüssel ab: Prüfe Schlüssel, Secret, ob er aktiviert und nicht abgelaufen ist.',
    es: 'EMQX rechaza la clave de API: compruebe la clave, su secreto, que esté activada y no caducada.',
  },
  incompatible: {
    en: 'No EMQX 5 API at this address: point to the dashboard port. EMQX 4 is not supported.',
    fr: "Pas d'API EMQX 5 à cette adresse : indiquez le port du tableau de bord. EMQX 4 n'est pas pris en charge.",
    de: 'Keine EMQX-5-API unter dieser Adresse: Gib den Port des Dashboards an. EMQX 4 wird nicht unterstützt.',
    es: 'No hay API de EMQX 5 en esta dirección: indique el puerto del panel. EMQX 4 no es compatible.',
  },
  startFailed: {
    en: 'The integration could not read its configuration from Gladys: see its logs.',
    fr: "L'intégration n'a pas pu lire sa configuration dans Gladys : consultez ses journaux.",
    de: 'Die Integration konnte ihre Konfiguration nicht aus Gladys lesen: Sieh dir ihre Protokolle an.',
    es: 'La integración no pudo leer su configuración en Gladys: consulte sus registros.',
  },
  publishFailed: {
    en: 'Gladys refused the EMQX devices: see the integration logs.',
    fr: "Gladys a refusé les appareils EMQX : consultez les journaux de l'intégration.",
    de: 'Gladys hat die EMQX-Geräte abgelehnt: Sieh dir die Protokolle der Integration an.',
    es: 'Gladys rechazó los dispositivos de EMQX: consulte los registros de la integración.',
  },
};

// The "Check the connection" report.
export const REPORT_TEXT = {
  en: {
    ok: (url, version) => `Connected to ${url} (EMQX ${version}).`,
    numbers: (clients, received, sent) =>
      `${clients} clients connected, ${received} messages received and ${sent} sent per minute.`,
    alarms: (count) => `${count} alarm(s) in progress.`,
    noAlarm: 'No alarm in progress.',
    clients: (connected, total) => `Followed clients: ${connected} of ${total} connected.`,
    down: (url, detail) => `${url} cannot be reached (${detail}).`,
    pending: (url) => `Still reading ${url}: try again in a few seconds.`,
  },
  fr: {
    ok: (url, version) => `Connecté à ${url} (EMQX ${version}).`,
    numbers: (clients, received, sent) =>
      `${clients} clients connectés, ${received} messages reçus et ${sent} envoyés par minute.`,
    alarms: (count) => `${count} alarme(s) en cours.`,
    noAlarm: 'Aucune alarme en cours.',
    clients: (connected, total) => `Clients suivis : ${connected} sur ${total} connectés.`,
    down: (url, detail) => `${url} est injoignable (${detail}).`,
    pending: (url) => `Lecture de ${url} en cours : réessayez dans quelques secondes.`,
  },
  de: {
    ok: (url, version) => `Verbunden mit ${url} (EMQX ${version}).`,
    numbers: (clients, received, sent) =>
      `${clients} Clients verbunden, ${received} Nachrichten empfangen und ${sent} gesendet pro Minute.`,
    alarms: (count) => `${count} Alarm(e) aktiv.`,
    noAlarm: 'Kein Alarm aktiv.',
    clients: (connected, total) => `Beobachtete Clients: ${connected} von ${total} verbunden.`,
    down: (url, detail) => `${url} ist nicht erreichbar (${detail}).`,
    pending: (url) => `${url} wird noch gelesen: Versuche es in ein paar Sekunden erneut.`,
  },
  es: {
    ok: (url, version) => `Conectado a ${url} (EMQX ${version}).`,
    numbers: (clients, received, sent) =>
      `${clients} clientes conectados, ${received} mensajes recibidos y ${sent} enviados por minuto.`,
    alarms: (count) => `${count} alarma(s) activa(s).`,
    noAlarm: 'Ninguna alarma activa.',
    clients: (connected, total) => `Clientes seguidos: ${connected} de ${total} conectados.`,
    down: (url, detail) => `No se puede acceder a ${url} (${detail}).`,
    pending: (url) => `Leyendo todavía ${url}: vuelva a intentarlo en unos segundos.`,
  },
};

export const SUMMARY_TEXT = {
  en: {
    up: (version, duration) => `EMQX ${version} has been running for ${duration}`,
    clients: (count) => `${count} clients connected`,
    messages: (received, sent) => `${received} messages received and ${sent} sent per minute`,
    alarms: (count) => `${count} alarm(s) in progress`,
    noAlarm: 'no alarm',
    unreachable: 'EMQX cannot be reached.',
    refused: 'EMQX refuses the API key.',
    noData: 'No data from EMQX yet.',
  },
  fr: {
    up: (version, duration) => `EMQX ${version} fonctionne depuis ${duration}`,
    clients: (count) => `${count} clients connectés`,
    messages: (received, sent) => `${received} messages reçus et ${sent} envoyés par minute`,
    alarms: (count) => `${count} alarme(s) en cours`,
    noAlarm: 'aucune alarme',
    unreachable: 'EMQX est injoignable.',
    refused: "EMQX refuse la clé d'API.",
    noData: "Aucune donnée d'EMQX pour le moment.",
  },
  de: {
    up: (version, duration) => `EMQX ${version} läuft seit ${duration}`,
    clients: (count) => `${count} Clients verbunden`,
    messages: (received, sent) =>
      `${received} Nachrichten empfangen und ${sent} gesendet pro Minute`,
    alarms: (count) => `${count} Alarm(e) aktiv`,
    noAlarm: 'kein Alarm',
    unreachable: 'EMQX ist nicht erreichbar.',
    refused: 'EMQX lehnt den API-Schlüssel ab.',
    noData: 'Noch keine Daten von EMQX.',
  },
  es: {
    up: (version, duration) => `EMQX ${version} lleva en marcha ${duration}`,
    clients: (count) => `${count} clientes conectados`,
    messages: (received, sent) => `${received} mensajes recibidos y ${sent} enviados por minuto`,
    alarms: (count) => `${count} alarma(s) activa(s)`,
    noAlarm: 'ninguna alarma',
    unreachable: 'No se puede acceder a EMQX.',
    refused: 'EMQX rechaza la clave de API.',
    noData: 'Todavía no hay datos de EMQX.',
  },
};

const LOCALES = { en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' };

export const locale = (language) => LOCALES[language] ?? LOCALES.en;

// Plain spaces: the no-break ones of some locales would surprise a message.
const plainSpaces = (text) => text.replace(/[\u00a0\u202f]/g, ' ');

/** A number with the separators of the language. */
export function formatNumber(value, language, decimals = 0) {
  return plainSpaces(
    new Intl.NumberFormat(locale(language), {
      maximumFractionDigits: decimals,
      minimumFractionDigits: 0,
    }).format(value),
  );
}

/** "3 days", "5 hours", "12 minutes", "40 seconds", in the language. */
export function formatDuration(seconds, language) {
  const abs = Math.max(0, seconds);
  const [unit, value] =
    abs >= 86400
      ? ['day', Math.floor(abs / 86400)]
      : abs >= 3600
        ? ['hour', Math.floor(abs / 3600)]
        : abs >= 60
          ? ['minute', Math.floor(abs / 60)]
          : ['second', Math.floor(abs)];
  return plainSpaces(
    new Intl.NumberFormat(locale(language), { style: 'unit', unit, unitDisplay: 'long' }).format(
      value,
    ),
  );
}

/** A date and time, short, in the language and the time zone of the process (TZ). */
export function formatDate(ms, language) {
  return plainSpaces(
    new Intl.DateTimeFormat(locale(language), { dateStyle: 'short', timeStyle: 'short' }).format(
      new Date(ms),
    ),
  );
}

/** "3 minutes ago", in the language. */
export function relativeTime(seconds, language) {
  const format = new Intl.RelativeTimeFormat(locale(language), { numeric: 'auto' });
  const abs = Math.max(0, seconds);
  if (abs < 60) {
    return format.format(-Math.round(abs), 'second');
  }
  if (abs < 3600) {
    return format.format(-Math.round(abs / 60), 'minute');
  }
  return format.format(-Math.round(abs / 3600), 'hour');
}

/**
 * The broker as one sentence: "EMQX 5.8.6 has been running for 3 days, 12
 * clients connected, 64 messages received and 87 sent per minute, no alarm."
 * @param {{ reachable: boolean|null, link: string|null, stats: object }} data
 * @param {string} language
 */
export function brokerSentence({ reachable, link, stats }, language) {
  const text = pick(SUMMARY_TEXT, language);
  if (link === 'refused') {
    return text.refused;
  }
  if (reachable === false || link === 'incompatible') {
    return text.unreachable;
  }
  const n = (value) => formatNumber(value, language, 0);
  const parts = [];
  if (stats.version && Number.isFinite(stats.uptimeSeconds)) {
    parts.push(text.up(stats.version, formatDuration(stats.uptimeSeconds, language)));
  }
  if (Number.isFinite(stats.clientsConnected)) {
    parts.push(text.clients(n(stats.clientsConnected)));
  }
  if (Number.isFinite(stats.messagesReceived) && Number.isFinite(stats.messagesSent)) {
    parts.push(text.messages(n(stats.messagesReceived), n(stats.messagesSent)));
  }
  if (parts.length === 0) {
    return text.noData;
  }
  if (Array.isArray(stats.alarms)) {
    parts.push(stats.alarms.length > 0 ? text.alarms(n(stats.alarms.length)) : text.noAlarm);
  }
  const sentence = parts.join(', ');
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}
