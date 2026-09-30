import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const GEO_REPORT_URL = 'https://geo.kmt.global/share/XYK19lgzKLyGdYjkoELc5o8aA1pO0RIUPQD45KRMn0g';

test('all KMT GEO entry points use the verified shared report URL', async () => {
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const matches = html.match(new RegExp(GEO_REPORT_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || [];

  assert.equal(matches.length, 3);
  assert.doesNotMatch(html, /data-action=["']geo["']/);
});

test('GEO audience journeys render from a local read-only snapshot', async () => {
  const [html, javascript, server] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./dashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('./scripts/local-server.mjs', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /id="geo-visibility"/);
  assert.match(html, /id="geoPersonaGrid"/);
  assert.match(javascript, /fetch\('\.\/data\/geo\.json'/);
  assert.match(javascript, /answerText\.textContent = formatGeoAnswer\(answer\.answerText\)/);
  assert.doesNotMatch(javascript, /innerHTML\s*=.*answer/i);
  assert.match(server, /\/data\/geo\.json/);
});

test('peak tooltip is constrained to its trend panel', async () => {
  const [css, javascript] = await Promise.all([
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
    readFile(new URL('./dashboard.js', import.meta.url), 'utf8'),
  ]);

  assert.match(css, /\.trend-panel\s*\{\s*overflow:\s*hidden;/);
  assert.match(css, /\.trend-tooltip\s*\{[^}]*max-height:\s*calc\(100% - 16px\)/s);
  assert.match(css, /\.trend-tooltip\.tip-align-left\s*\{/);
  assert.match(javascript, /classList\.toggle\('tip-align-left'/);
});

test('China-IP coverage records include local page captures', async () => {
  const [html, javascript, server, beijingNews, beijingYouth] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./dashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('./scripts/local-server.mjs', import.meta.url), 'utf8'),
    readFile(new URL('./assets/coverage-beijing-news.jpg', import.meta.url)),
    readFile(new URL('./assets/coverage-beijing-youth-online.png', import.meta.url)),
  ]);

  assert.match(html, /id="coverageEvidenceModal"/);
  assert.equal((javascript.match(/accessNote: 'May require a China-based IP address'/g) || []).length, 2);
  assert.match(javascript, /coverage-beijing-news\.jpg/);
  assert.match(javascript, /coverage-beijing-youth-online\.png/);
  assert.match(server, /coverage-beijing-news\.jpg/);
  assert.match(server, /coverage-beijing-youth-online\.png/);
  assert.ok(beijingNews.length > 100_000);
  assert.ok(beijingYouth.length > 100_000);
});

test('summary cards use production data-source labels', async () => {
  const [html, javascript] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./dashboard.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /UPDATED · 29 SEP/);
  assert.doesNotMatch(html, /TEMP DATA|Temporary tracker records/i);
  assert.match(javascript, /meltwaterMetricStatus'\)\.textContent = 'MELTWATER API'/);
  assert.doesNotMatch(javascript, /WEEKLY CACHE|WEEKLY SNAPSHOT/);
});

test('locked markets use right-aligned dashboard lock icons', async () => {
  const [html, css] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
  ]);

  assert.equal((html.match(/class="country-option-lock"/g) || []).length, 3);
  assert.equal((html.match(/aria-disabled="true" disabled/g) || []).length, 3);
  assert.doesNotMatch(html, /🔒/);
  assert.match(css, /\.country-option\s*\{[^}]*justify-content:\s*space-between/s);
  assert.match(css, /\.country-option \.country-option-lock\s*\{/);
});
