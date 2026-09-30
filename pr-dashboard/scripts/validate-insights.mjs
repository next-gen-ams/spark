import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [insights, meltwater, geo] = await Promise.all([
  readJson('data/insights.json'),
  readJson('data/meltwater.json'),
  readJson('data/geo.json'),
]);

if (insights.version !== 1) throw new Error('Unsupported insights snapshot version');
validateSection(insights.pr, ['Trend change', 'Core topics', 'Coverage themes'], 'PR');
validateSection(insights.geo, ['Pre-brand visibility', 'Audience gap', 'Content opportunity'], 'GEO');

if (insights.pr.sourceGeneratedAt !== meltwater.meta.generatedAt) {
  throw new Error('PR insights do not match the current Meltwater snapshot');
}
if (insights.geo.sourceCheckedLabel !== geo.meta.checkedLabel) {
  throw new Error('GEO insights do not match the current KMT GEO check');
}

console.log('Insights snapshot is valid and bound to the current source snapshots.');

function validateSection(section, labels, name) {
  if (!section || !['baseline', 'week-on-week', 'month-on-month'].includes(section.comparison)) {
    throw new Error(`${name} insights comparison mode is invalid`);
  }
  if (!Array.isArray(section.items) || section.items.length !== 3) {
    throw new Error(`${name} insights must contain exactly three items`);
  }
  section.items.forEach((item, index) => {
    if (item.label !== labels[index]) throw new Error(`${name} insight ${index + 1} has the wrong label`);
    if (typeof item.title !== 'string' || item.title.length < 6 || item.title.length > 100) {
      throw new Error(`${name} insight ${index + 1} title length is invalid`);
    }
    if (typeof item.body !== 'string' || item.body.length < 20 || item.body.length > 320) {
      throw new Error(`${name} insight ${index + 1} body length is invalid`);
    }
    if (!Array.isArray(item.evidence) || !item.evidence.length || item.evidence.some((value) => typeof value !== 'string')) {
      throw new Error(`${name} insight ${index + 1} needs explicit evidence`);
    }
  });
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}
