import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchMeltwaterDashboard } from './meltwater.mjs';
import { archivePreviousSnapshot, getNextMelbourneWeeklyRefresh } from './snapshot-utils.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'data', 'meltwater.json');
const previousPath = path.join(root, 'data', 'history', 'meltwater-previous.json');
const generatedAt = new Date();
const data = process.env.SNAPSHOT_SOURCE_URL
  ? await fetch(process.env.SNAPSHOT_SOURCE_URL).then((response) => {
      if (!response.ok) throw new Error(`Snapshot source failed with status ${response.status}`);
      return response.json();
    })
  : await fetchMeltwaterDashboard({
      apiKey: process.env.MELTWATER_API_KEY,
      searchId: Number(process.env.MELTWATER_SEARCH_ID || 29175637),
      now: generatedAt,
    });
const snapshot = {
  ...data,
  meta: {
    ...data.meta,
    cached: true,
    refreshMode: 'weekly',
    nextRefreshAt: getNextMelbourneWeeklyRefresh(generatedAt).toISOString(),
  },
};

await mkdir(path.join(root, 'data'), { recursive: true });
await archivePreviousSnapshot({ currentPath: outputPath, previousPath, nextSnapshot: snapshot });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
console.log(`Saved Meltwater snapshot generated at ${snapshot.meta.generatedAt}`);
