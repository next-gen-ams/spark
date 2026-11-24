import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('organic coverage shows the six reviewed Beijing Open Day sources and their reach', async () => {
  const javascript = await readFile(new URL('./dashboard.js', import.meta.url), 'utf8');
  const records = javascript.match(/const campaignPickups = \[([\s\S]*?)\];/)?.[1];
  const urls = [...(records ?? '').matchAll(/url: '([^']+)'/g)].map((match) => match[1]);

  assert.deepEqual(urls, [
    'https://www.toutiao.com/article/7688029637980537383/',
    'https://www.163.com/dy/article/L7C0EJBJ05506BEH.html',
    'https://www.sohu.com/a/1078991782_120244154',
    'http://cn.geceo.com/hangye/147928.html',
    'https://news.qq.com/rain/a/20260921A071QP00',
    'https://app.myzaker.com/news/article.php?pk=6ab0d3338e9f0952b33fb37f',
  ]);
  const dates = [...(records ?? '').matchAll(/date: '([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(dates, ['2026-09-22', '2026-09-21', '2026-09-21', '2026-09-21', '2026-09-21', '2026-09-21']);
  const reach = [...(records ?? '').matchAll(/reach: (\d+)/g)].map((match) => Number(match[1]));
  assert.deepEqual(reach, [8562549, 28311861, 17156201, 0, 4045397, 618026]);
  assert.match(javascript, /renderPublishedMedia\(\);\s*renderCampaignPickups\(\);/);
  assert.doesNotMatch(javascript, /renderMentions\(|mentionsGrid/);
});

test('peak-day articles fall back to the source title when a translation is unavailable', async () => {
  const javascript = await readFile(new URL('./dashboard.js', import.meta.url), 'utf8');

  assert.doesNotMatch(javascript, /English title pending review/);
  assert.match(javascript, /title\.textContent = mention\.titleEn \|\| mention\.title/);
});
