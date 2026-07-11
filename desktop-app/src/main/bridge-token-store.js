'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, safeStorage } = require('electron');

// Pairing secret between this app's local HTTP bridge and the Tampermonkey
// userscript. Encrypted at rest the same way as the API token (safeStorage,
// see secure-store.js) - a copy of the file is useless off this OS account.
// Unlike the API token this one has no meaning outside this app: it never
// talks to leitstellenspiel.de, it only authenticates POSTs arriving on
// 127.0.0.1 as actually coming from the paired userscript instead of some
// other local process guessing the port.
function secureDir() {
  const dir = path.join(app.getPath('userData'), 'secure');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function tokenFilePath() {
  return path.join(secureDir(), 'bridge-token.enc');
}

function persist(token) {
  fs.writeFileSync(tokenFilePath(), safeStorage.encryptString(token), { mode: 0o600 });
  return token;
}

let cachedToken = null;

function getOrCreateBridgeToken() {
  if (cachedToken) return cachedToken;
  const file = tokenFilePath();
  if (fs.existsSync(file)) {
    cachedToken = safeStorage.decryptString(fs.readFileSync(file));
    return cachedToken;
  }
  cachedToken = persist(crypto.randomBytes(24).toString('hex'));
  return cachedToken;
}

function regenerateBridgeToken() {
  cachedToken = persist(crypto.randomBytes(24).toString('hex'));
  return cachedToken;
}

module.exports = { getOrCreateBridgeToken, regenerateBridgeToken };
