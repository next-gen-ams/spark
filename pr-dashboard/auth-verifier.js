const AUTH_CONFIG = Object.freeze({
  iterations: 310000,
  salt: 'ltsFZSCpsNOxYYWi_92nCw',
  verifier: 'ZKI9d7yRaaZJ9sfco1BH71IexE6cRbHMEPCEJpeYoDE',
});

export const AUTH_SESSION_KEY = 'rmit-dsc-pr-dashboard-access';

export async function verifyDashboardPassword(candidate, config = AUTH_CONFIG) {
  if (typeof candidate !== 'string' || candidate.length < 1 || candidate.length > 128) return false;
  const derived = await derivePasswordVerifier(candidate, config);
  return constantTimeEqual(derived, config.verifier);
}

export async function derivePasswordVerifier(password, config) {
  const passwordBytes = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey('raw', passwordBytes, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: decodeBase64Url(config.salt),
    iterations: config.iterations,
  }, key, 256);
  return encodeBase64Url(new Uint8Array(bits));
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function decodeBase64Url(value) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function encodeBase64Url(bytes) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/u, '');
}
