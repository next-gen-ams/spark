import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const meltwaterPath = new URL('./data/meltwater.json', import.meta.url);

test('the visible organic coverage queue always has reviewed English titles', async () => {
  const data = JSON.parse(await readFile(meltwaterPath, 'utf8'));
  const visibleMentions = data.mentions.slice(0, 6);

  assert.equal(visibleMentions.length, 6);
  for (const mention of visibleMentions) {
    assert.ok(mention.titleEn?.trim(), `Missing titleEn for: ${mention.title}`);
    assert.doesNotMatch(mention.titleEn, /[\u3400-\u9fff]/);
  }
});

test('missing translations degrade to the source title without a review placeholder', async () => {
  const javascript = await readFile(new URL('./dashboard.js', import.meta.url), 'utf8');

  assert.doesNotMatch(javascript, /English title pending review/);
  assert.equal((javascript.match(/mention\.titleEn \|\| mention\.title/g) || []).length, 2);
});
