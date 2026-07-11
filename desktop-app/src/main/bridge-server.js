'use strict';

const http = require('http');
const crypto = require('crypto');
const { BRIDGE_HOST, BRIDGE_PORT } = require('../shared/constants');

const MAX_BODY_BYTES = 2_000_000;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// Constant-time token compare - a plain `!==` would leak how many leading
// bytes matched via response timing, letting a local process on the same
// machine brute-force the pairing token character by character.
function tokensMatch(expected, provided) {
  if (typeof expected !== 'string' || typeof provided !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function sendJson(res, status, body) {
  const json = JSON.stringify(body);
  // Deliberately no Access-Control-Allow-Origin header: this endpoint is only
  // ever meant to be called via GM_xmlhttpRequest (which isn't subject to
  // CORS), never via an ordinary page's fetch/XHR. Omitting CORS headers
  // means a malicious webpage that guesses the port still can't read the
  // response even if the browser lets the request itself through.
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(json);
}

// `getToken`/`onIngest` are injected so this module stays a pure transport
// layer with no knowledge of secure-store or the AAO engine.
function createBridgeServer({ getToken, onIngest }) {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { ok: true, service: 'lss-dashboard-bridge' });
      return;
    }

    if (req.method !== 'POST' || req.url !== '/ingest') {
      sendJson(res, 404, { ok: false, error: 'not_found' });
      return;
    }

    const expectedToken = getToken();
    const providedToken = req.headers['x-bridge-token'];
    if (!expectedToken || !tokensMatch(expectedToken, providedToken)) {
      sendJson(res, 401, { ok: false, error: 'invalid_token' });
      return;
    }

    let payload;
    try {
      const raw = await readBody(req);
      payload = JSON.parse(raw);
    } catch {
      sendJson(res, 400, { ok: false, error: 'invalid_payload' });
      return;
    }

    try {
      onIngest(payload);
      sendJson(res, 200, { ok: true });
    } catch (err) {
      console.error('[lss-dashboard] Bridge-Ingest fehlgeschlagen:', err.message);
      sendJson(res, 500, { ok: false, error: 'ingest_failed' });
    }
  });

  server.on('error', (err) => {
    console.error('[lss-dashboard] Bridge-Server-Fehler:', err.message);
  });

  // Bind explicitly to loopback only - never 0.0.0.0. This must not be
  // reachable from other devices on the network.
  server.listen(BRIDGE_PORT, BRIDGE_HOST);

  return server;
}

module.exports = { createBridgeServer };
