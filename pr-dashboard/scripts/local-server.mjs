import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 4173);
const allowedFiles = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/dashboard.js', ['dashboard.js', 'text/javascript; charset=utf-8']],
  ['/auth-verifier.js', ['auth-verifier.js', 'text/javascript; charset=utf-8']],
  ['/data/meltwater.json', ['data/meltwater.json', 'application/json; charset=utf-8']],
  ['/data/geo.json', ['data/geo.json', 'application/json; charset=utf-8']],
  ['/assets/rmit-university-logo.png', ['assets/rmit-university-logo.png', 'image/png']],
  ['/assets/kmt-logo.png', ['assets/kmt-logo.png', 'image/png']],
  ['/assets/gms-logo.png', ['assets/gms-logo.png', 'image/png']],
]);

const server = createServer(async (request, response) => {
  setSecurityHeaders(response);
  const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);

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
  console.log('Data sources: committed Meltwater and KMT GEO snapshots');
});

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
