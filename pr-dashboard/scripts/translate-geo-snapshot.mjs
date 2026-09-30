import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const geoPath = path.join(root, 'data', 'geo.json');
const data = JSON.parse(await readFile(geoPath, 'utf8'));
let translated = 0;

for (const persona of data.personas || []) {
  for (const journey of persona.journeys || []) {
    if (!journey.promptEn) journey.promptEn = await translateText(journey.prompt);
    for (const answer of journey.answers || []) {
      if (answer.answerTextEn) continue;
      answer.answerTextEn = await translateText(answer.answerText);
      translated += 1;
      console.log(`Translated ${persona.shortName} · ${journey.stage} · ${answer.model}`);
    }
  }
}

await writeFile(geoPath, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
console.log(`Wrote ${geoPath} with ${translated} new English answer translations`);

async function translateText(value) {
  const chunks = splitText(String(value || '').trim());
  const translatedChunks = [];
  for (const chunk of chunks) {
    translatedChunks.push(await translateChunk(chunk));
    await wait(120);
  }
  return translatedChunks.join('').trim();
}

async function translateChunk(chunk) {
  const body = new URLSearchParams({
    client: 'gtx',
    sl: 'zh-CN',
    tl: 'en',
    dt: 't',
    q: chunk,
  });
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(TRANSLATE_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body,
      });
      if (!response.ok) throw new Error(`Translation service returned ${response.status}`);
      const payload = await response.json();
      const result = (payload?.[0] || []).map((segment) => segment?.[0] || '').join('');
      if (!result.trim()) throw new Error('Translation service returned an empty result');
      return result;
    } catch (error) {
      lastError = error;
      await wait(attempt * 500);
    }
  }
  throw lastError;
}

function splitText(value, maxLength = 3400) {
  const chunks = [];
  let remaining = value;
  while (remaining.length > maxLength) {
    let splitAt = remaining.lastIndexOf('\n\n', maxLength);
    if (splitAt < maxLength * 0.55) splitAt = remaining.lastIndexOf('\n', maxLength);
    if (splitAt < maxLength * 0.55) splitAt = findSentenceBoundary(remaining, maxLength);
    if (splitAt < 1) splitAt = maxLength;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function findSentenceBoundary(value, maxLength) {
  for (let index = maxLength; index > Math.floor(maxLength * 0.55); index -= 1) {
    if ('。！？；.!?;'.includes(value[index])) return index + 1;
  }
  return -1;
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
