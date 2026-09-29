import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchMeltwaterDashboard } from '../api/_lib/meltwater.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const searchId = Number(process.env.MELTWATER_SEARCH_ID || 29175637);
const cacheTtlMs = 7 * 24 * 60 * 60 * 1000;
const allowedFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/dashboard.js', ['dashboard.js', 'text/javascript; charset=utf-8']],
  ['/assets/rmit-university-logo.png', ['assets/rmit-university-logo.png', 'image/png']],
  ['/assets/kmt-logo.png', ['assets/kmt-logo.png', 'image/png']],
  ['/assets/gms-logo.png', ['assets/gms-logo.png', 'image/png']],
]);
const requestLog = new Map();
let cache = null;
let refreshInFlight = null;

const server = createServer(async (request, response) => {
  setSecurityHeaders(response);
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

  if (request.method === 'GET' && requestUrl.pathname === '/api/meltwater/dashboard') {
    if (!withinRateLimit(request.socket.remoteAddress || 'local')) {
      return sendJson(response, 429, { error: 'Too many refresh requests. Please try again shortly.' });
    }
    try {
      const isFresh = Boolean(cache && Date.now() - cache.createdAt < cacheTtlMs);
      if (!isFresh) await refreshMeltwaterCache();
      const nextRefreshAt = new Date(cache.createdAt + cacheTtlMs).toISOString();
      return sendJson(response, 200, {
        ...cache.data,
        meta: {
          ...cache.data.meta,
          cached: isFresh,
          refreshMode: 'weekly',
          nextRefreshAt,
        },
      });
    } catch (error) {
      console.error(`[meltwater] dashboard refresh failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      return sendJson(response, 502, { error: 'Live Meltwater data is temporarily unavailable.' });
    }
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  const fileDefinition = allowedFiles.get(requestUrl.pathname);
  if (!fileDefinition) return sendJson(response, 404, { error: 'Not found.' });
  const [fileName, contentType] = fileDefinition;
  const filePath = path.join(root, fileName);
  try {
    const fileStat = await stat(filePath);
    response.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': fileStat.size,
      'Cache-Control': 'no-store',
    });
    if (request.method === 'HEAD') return response.end();
    createReadStream(filePath).pipe(response);
  } catch {
    sendJson(response, 404, { error: 'Not found.' });
  }
});

server.listen(port, host, () => {
  console.log(`RMIT DSC PR Tracker running at http://${host}:${port}`);
  console.log('Data source: Meltwater Saved Search 29175637 (rolling past 3 months, refreshed weekly)');
  void refreshMeltwaterCache().catch((error) => {
    console.error(`[meltwater] initial weekly refresh failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  });
});

const weeklyRefreshTimer = setInterval(() => {
  void refreshMeltwaterCache().catch((error) => {
    console.error(`[meltwater] scheduled weekly refresh failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  });
}, cacheTtlMs);
weeklyRefreshTimer.unref();

async function refreshMeltwaterCache() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const data = await fetchMeltwaterDashboard({
      apiKey: process.env.MELTWATER_API_KEY,
      searchId,
    });
    cache = { createdAt: Date.now(), data };
  })();
  try {
    await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

function withinRateLimit(address) {
  const now = Date.now();
  const recent = (requestLog.get(address) || []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= 20) return false;
  recent.push(now);
  requestLog.set(address, recent);
  return true;
}

function setSecurityHeaders(response) {
  response.setHeader('Content-Security-Policy', "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self'");
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
}

function sendJson(response, status, body) {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
  });
  response.end(payload);
}
