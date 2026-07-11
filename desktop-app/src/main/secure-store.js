'use strict';

const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');

// The API token is the only credential this app ever touches - the game
// login itself happens inside the embedded BrowserView's own page, so
// account passwords never pass through our process at all. The token is
// encrypted at rest via Electron's `safeStorage` (backed by DPAPI on
// Windows, Keychain on macOS, libsecret on Linux) and tied to the OS user
// account: another Windows user - or a copy of this file to another
// machine - cannot decrypt it.
function secureDir() {
  const dir = path.join(app.getPath('userData'), 'secure');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

function tokenFilePath() {
  return path.join(secureDir(), 'token.enc');
}

let cachedToken = null;

function setToken(token) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('OS-Verschlüsselung ist auf diesem System nicht verfügbar.');
  }
  const encrypted = safeStorage.encryptString(token);
  fs.writeFileSync(tokenFilePath(), encrypted, { mode: 0o600 });
  cachedToken = token;
}

function getToken() {
  if (cachedToken) return cachedToken;
  const file = tokenFilePath();
  if (!fs.existsSync(file)) return null;
  cachedToken = safeStorage.decryptString(fs.readFileSync(file));
  return cachedToken;
}

function hasToken() {
  return fs.existsSync(tokenFilePath());
}

function clearToken() {
  cachedToken = null;
  const file = tokenFilePath();
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

module.exports = { setToken, getToken, hasToken, clearToken };
