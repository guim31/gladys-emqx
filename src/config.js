// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with blanks, strings or `undefined`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Each followed client is one device and one request per cycle.
export const MAX_CLIENTS = 20;

export const DEFAULT_CONFIG = {
  url: '',
  api_key: '',
  api_secret: '',
  tls_insecure: false,
  client_ids: '',
  language: 'fr',
};

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * The address of the EMQX dashboard / REST API: users type `192.0.2.10`,
 * `192.0.2.10:18083` or a full `http://` / `https://` URL, sometimes with the
 * `/api/v5` path copied from the documentation.
 * @returns {string} '' when absent or not an HTTP URL; no trailing slash
 */
export function normalizeUrl(value) {
  const raw = text(value);
  if (raw === '') {
    return '';
  }
  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
  const withScheme = hasScheme ? raw : `http://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) {
      return '';
    }
    if (!hasScheme && !url.port) {
      // A bare host: the dashboard listens on 18083 by default. A full URL
      // without port (a reverse proxy) is kept as typed.
      url.port = '18083';
    }
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = '';
    const path = url.pathname.replace(/\/+$/, '').replace(/\/api\/v5$/, '');
    return `${url.protocol}//${url.host}${path}`;
  } catch {
    return '';
  }
}

/**
 * The client ids to follow: one per line, or separated by commas or spaces
 * (a client id with a space cannot be followed). Duplicates removed, order
 * kept, MAX_CLIENTS at most.
 * @returns {string[]}
 */
export function parseClientIds(value) {
  const ids = [];
  for (const id of text(value).split(/[\s,;]+/)) {
    if (id !== '' && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids.slice(0, MAX_CLIENTS);
}

/**
 * @param {object} [raw] the values received from Gladys
 */
export function normalizeConfig(raw = {}) {
  const source = raw ?? {};
  return {
    url: normalizeUrl(source.url),
    api_key: text(source.api_key),
    api_secret: text(source.api_secret),
    tls_insecure: source.tls_insecure === true || source.tls_insecure === 'true',
    client_ids: parseClientIds(source.client_ids),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}

export const isConfigured = (config) => Boolean(config?.url && config.api_key && config.api_secret);
