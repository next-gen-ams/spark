import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('organic coverage shows the four reviewed Beijing Open Day sources', async () => {
  const javascript = await readFile(new URL('./dashboard.js', import.meta.url), 'utf8');
  const records = javascript.match(/const campaignPickups = \[([\s\S]*?)\];/)?.[1];
  const urls = [...(records ?? '').matchAll(/url: '([^']+)'/g)].map((match) => match[1]);

  assert.deepEqual(urls, [
    'https://www.toutiao.com/article/7688029637980537383/',
    'https://www.163.com/dy/article/L7C0EJBJ05506BEH.html',
    'https://www.sohu.com/a/1078991782_120244154',
    'http://cn.geceo.com/hangye/147928.html',
  ]);
  assert.match(javascript, /renderPublishedMedia\(\);\s*renderCampaignPickups\(\);/);
  assert.doesNotMatch(javascript, /renderMentions\(|mentionsGrid/);
});

test('peak-day articles fall back to the source title when a translation is unavailable', async () => {
  const javascript = await readFile(new URL('./dashboard.js', import.meta.url), 'utf8');

  assert.doesNotMatch(javascript, /English title pending review/);
  assert.match(javascript, /title\.textContent = mention\.titleEn \|\| mention\.title/);
});
