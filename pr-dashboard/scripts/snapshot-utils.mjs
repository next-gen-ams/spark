import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const MELBOURNE_TIME_ZONE = 'Australia/Melbourne';

export function getNextMelbourneWeeklyRefresh(now = new Date()) {
  const local = getZonedParts(now, MELBOURNE_TIME_ZONE);
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(local.weekday);
  const hasPassedMondayRun = weekday === 1 && (
    local.hour > 10
    || (local.hour === 10 && (local.minute > 0 || local.second > 0))
  );
  let daysUntilMonday = (8 - weekday) % 7;
  if (daysUntilMonday === 0 && hasPassedMondayRun) daysUntilMonday = 7;

  const localDate = new Date(Date.UTC(local.year, local.month - 1, local.day + daysUntilMonday));
  return zonedDateTimeToUtc({
    year: localDate.getUTCFullYear(),
    month: localDate.getUTCMonth() + 1,
    day: localDate.getUTCDate(),
    hour: 10,
    minute: 0,
    second: 0,
  }, MELBOURNE_TIME_ZONE);
}

export async function archivePreviousSnapshot({ currentPath, previousPath, nextSnapshot }) {
  let currentSnapshot;
  try {
    currentSnapshot = JSON.parse(await readFile(currentPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }

  if (stableSnapshot(currentSnapshot) === stableSnapshot(nextSnapshot)) return false;
  await mkdir(path.dirname(previousPath), { recursive: true });
  await writeFile(previousPath, `${JSON.stringify(currentSnapshot, null, 2)}\n`, { mode: 0o600 });
  return true;
}

function stableSnapshot(snapshot) {
  return JSON.stringify(snapshot, (key, value) => (
    ['fetchedAt', 'nextRefreshAt'].includes(key) ? undefined : value
  ));
}

function getZonedParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [
    part.type,
    ['year', 'month', 'day', 'hour', 'minute', 'second'].includes(part.type)
      ? Number(part.value)
      : part.value,
  ]));
}

function zonedDateTimeToUtc(parts, timeZone) {
  const desiredAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  let candidate = new Date(desiredAsUtc);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const observed = getZonedParts(candidate, timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
    );
    const correction = desiredAsUtc - observedAsUtc;
    if (correction === 0) break;
    candidate = new Date(candidate.getTime() + correction);
  }
  return candidate;
}
