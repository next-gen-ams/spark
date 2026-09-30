import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const removedFiles = [
  './data/geo.json',
  './scripts/refresh-geo-snapshot.mjs',
  './scripts/translate-geo-snapshot.mjs',
];

test('the retired local GEO snapshot pipeline is absent', async () => {
  const [packageJson, server, readme] = await Promise.all([
    readFile(new URL('./package.json', import.meta.url), 'utf8'),
    readFile(new URL('./scripts/local-server.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./README.md', import.meta.url), 'utf8'),
  ]);

  for (const relativePath of removedFiles) {
    await assert.rejects(access(new URL(relativePath, import.meta.url)));
  }
  assert.doesNotMatch(packageJson, /refresh:geo|translate:geo/);
  assert.doesNotMatch(server, /data\/geo\.json|KMT GEO snapshots/);
  assert.doesNotMatch(readme, /refresh:geo|translate:geo|committed read-only browser snapshot|refresh the KMT GEO snapshot/i);
});
