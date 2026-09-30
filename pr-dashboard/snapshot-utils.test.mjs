import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  archivePreviousSnapshot,
  getNextMelbourneWeeklyRefresh,
} from './scripts/snapshot-utils.mjs';

test('calculates the next Monday 10:00 in Melbourne across daylight saving', () => {
  assert.equal(
    getNextMelbourneWeeklyRefresh(new Date('2026-09-30T00:04:48.023Z')).toISOString(),
    '2026-10-04T23:00:00.000Z',
  );
  assert.equal(
    getNextMelbourneWeeklyRefresh(new Date('2026-10-05T00:30:00.000Z')).toISOString(),
    '2026-10-11T23:00:00.000Z',
  );
});

test('archives the current snapshot before a changed refresh and preserves it on identical refreshes', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'rmit-snapshot-'));
  const currentPath = path.join(directory, 'current.json');
  const previousPath = path.join(directory, 'history', 'previous.json');
  const current = { meta: { generatedAt: '2026-09-30T00:00:00Z' }, summary: { totalMentions: 246 } };
  const changed = { meta: { generatedAt: '2026-10-05T00:00:00Z' }, summary: { totalMentions: 260 } };

  try {
    await writeFile(currentPath, `${JSON.stringify(current)}\n`);
    assert.equal(await archivePreviousSnapshot({ currentPath, previousPath, nextSnapshot: changed }), true);
    assert.deepEqual(JSON.parse(await readFile(previousPath, 'utf8')), current);

    await writeFile(currentPath, `${JSON.stringify(changed)}\n`);
    assert.equal(await archivePreviousSnapshot({ currentPath, previousPath, nextSnapshot: changed }), false);
    assert.deepEqual(JSON.parse(await readFile(previousPath, 'utf8')), current);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
