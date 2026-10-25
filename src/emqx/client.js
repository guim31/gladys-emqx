// -----------------------------------------------------------------------------
// The EMQX REST API v5 (EMQX 5.x and 6.x), read with an API key: the key and
// its secret travel as HTTP Basic credentials. Only GET requests: the
// integration never changes anything on the broker.
//
// node:http(s) rather than fetch: the global fetch cannot skip the check of
// a self-signed certificate without an extra dependency.
// -----------------------------------------------------------------------------

import http from 'node:http';
import https from 'node:https';

export const TIMEOUT_MS = 10 * 1000;
// A page of alarms: far more than a healthy broker ever has.
const MAX_BODY_BYTES = 2 * 1024 * 1024;

/**
 * Why a request failed:
 * - `unreachable` — no answer, a timeout, an HTTP 5xx, or a body that is not JSON;
 * - `refused` — 401/403: wrong key or secret, or a key without the rights;
 * - `not_found` — 404: no such client, or no EMQX 5 API at this address;
 * - `http` — any other status.
 */
export class EmqxError extends Error {
  constructor(kind, message, status = null) {
    super(message);
    this.name = 'EmqxError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * The default transport: one GET, the parsed JSON body.
 * @param {string} url
 * @param {{ authorization: string, tlsInsecure: boolean, timeoutMs: number }} options
 * @returns {Promise<{ status: number, body: unknown }>}
 */
export function httpGet(url, { authorization, tlsInsecure, timeoutMs }) {
  const target = new URL(url);
  const lib = target.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const request = lib.request(
      target,
      {
        method: 'GET',
        headers: { accept: 'application/json', authorization },
        timeout: timeoutMs,
        ...(target.protocol === 'https:' ? { rejectUnauthorized: !tlsInsecure } : {}),
      },
      (response) => {
        const chunks = [];
        let size = 0;
        response.on('data', (chunk) => {
          size += chunk.length;
          if (size > MAX_BODY_BYTES) {
            request.destroy(new Error('response too large'));
            return;
          }
          chunks.push(chunk);
        });
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let body;
          try {
            body = text === '' ? null : JSON.parse(text);
          } catch {
            body = undefined;
          }
          resolve({ status: response.statusCode, body });
        });
        response.on('error', reject);
      },
    );
    request.on('timeout', () => request.destroy(new Error(`no answer within ${timeoutMs} ms`)));
    request.on('error', reject);
    request.end();
  });
}

/**
 * @param {object} options
 * @param {string} options.url normalized base URL (src/config.js)
 * @param {string} options.apiKey
 * @param {string} options.apiSecret
 * @param {boolean} [options.tlsInsecure]
 * @param {Function} [options.get] test seam, same contract as httpGet
 * @param {number} [options.timeoutMs]
 */
export function createEmqxClient({
  url,
  apiKey,
  apiSecret,
  tlsInsecure = false,
  get = httpGet,
  timeoutMs = TIMEOUT_MS,
}) {
  const authorization = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;

  /** GET /api/v5/<path>, the JSON body or an EmqxError. */
  async function request(path) {
    let response;
    try {
      response = await get(`${url}/api/v5/${path}`, { authorization, tlsInsecure, timeoutMs });
    } catch (err) {
      // The message of a network error never holds the credentials.
      throw new EmqxError('unreachable', err.code ? `${err.code}: ${err.message}` : err.message);
    }
    const { status, body } = response;
    const code = body && typeof body === 'object' && body.code ? ` ${body.code}` : '';
    if (status === 401 || status === 403) {
      throw new EmqxError('refused', `HTTP ${status}${code}`, status);
    }
    if (status === 404) {
      throw new EmqxError('not_found', `HTTP 404${code}`, status);
    }
    if (status >= 500) {
      throw new EmqxError('unreachable', `HTTP ${status}${code}`, status);
    }
    if (status < 200 || status >= 300) {
      throw new EmqxError('http', `HTTP ${status}${code}`, status);
    }
    if (body === undefined || body === null) {
      throw new EmqxError('unreachable', `HTTP ${status} without a JSON body`, status);
    }
    return body;
  }

  return {
    request,
    nodes: () => request('nodes'),
    monitorCurrent: () => request('monitor_current'),
    alarms: () => request('alarms?activated=true&limit=100'),
    /**
     * One client: its details, or null when EMQX knows no session for it
     * (disconnected and without a persistent session).
     */
    async client(clientId) {
      try {
        return await request(`clients/${encodeURIComponent(clientId)}`);
      } catch (err) {
        if (err.kind === 'not_found') {
          return null;
        }
        throw err;
      }
    },
  };
}
