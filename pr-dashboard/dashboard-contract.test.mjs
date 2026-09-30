import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const GEO_REPORT_URL = 'https://geo.kmt.global/share/XYK19lgzKLyGdYjkoELc5o8aA1pO0RIUPQD45KRMn0g';

test('the GEO report keeps one intentional entry point to the verified shared report', async () => {
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const matches = html.match(new RegExp(GEO_REPORT_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || [];

  assert.equal(matches.length, 1);
  assert.doesNotMatch(html, /Open KMT GEO Dashboard|SEPARATE WORKSPACE/);
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
  assert.match(javascript, /answerText\.textContent = formatGeoAnswer\(answer\.answerTextEn \|\| answer\.answerText\)/);
  assert.match(javascript, /English translation · Translated from the original Chinese response/);
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
  assert.equal((html.match(/MELTWATER API/g) || []).length, 2);
  assert.match(html, /<span class="pending-label">MELTWATER API<\/span>[\s\S]*?id="reachMetric"/);
  assert.doesNotMatch(html, /MELTWATER AI/);
  assert.doesNotMatch(javascript, /WEEKLY CACHE|WEEKLY SNAPSHOT/);
});

test('GEO report uses spacious bilingual persona and journey cards', async () => {
  const [html, javascript, css] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./dashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
  ]);

  assert.match(html, /GEO Report Snapshots/);
  assert.doesNotMatch(html, /Audience journey snapshots|geoMethodNote/);
  assert.match(javascript, /marker\.textContent = `Persona \$\{personaIndex \+ 1\}`/);
  assert.match(javascript, /sampleLabel\.textContent = 'Sample prompt'/);
  assert.match(javascript, /promptEn\.textContent = journey\.promptEn/);
  assert.doesNotMatch(javascript, /Problem framed|Comparing named options|Asking about RMIT by name/);
  assert.doesNotMatch(javascript, /RMIT named|RMIT not named|answers name no vendor/);
  assert.match(javascript, /Chinese leading AI models/);
  assert.match(css, /\.geo-persona-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /\.geo-journey\[open\]\s*\{[^}]*grid-column:\s*1 \/ -1/s);
});

test('workspace separates PR performance and GEO visibility into routed views', async () => {
  const [html, javascript, css] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./dashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
  ]);

  assert.equal((html.match(/class="nav-item(?: is-active)?"/g) || []).length, 2);
  assert.match(html, /data-view="pr-performance"[^>]*>[\s\S]*?PR Performance/);
  assert.match(html, /data-view="geo-visibility"[^>]*>[\s\S]*?GEO Visibility/);
  assert.equal((html.match(/data-view-panel=/g) || []).length, 2);
  assert.match(javascript, /searchParams\.set\('view', view\)/);
  assert.match(javascript, /window\.history\.pushState/);
  assert.match(javascript, /window\.addEventListener\('popstate'/);
  assert.match(css, /\.dashboard-view\[hidden\]\s*\{\s*display:\s*none;/);
});

test('GEO snapshot metadata reads as passive text instead of buttons', async () => {
  const [javascript, css] = await Promise.all([
    readFile(new URL('./dashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
  ]);

  assert.match(javascript, /`Updated on \$\{data\.meta\.checkedLabel\}`/);
  const metadataRule = css.match(/\.geo-summary-chip\s*\{([^}]*)\}/)?.[1] || '';
  assert.doesNotMatch(metadataRule, /border-radius|background|cursor/);
  assert.match(metadataRule, /border-left:\s*1px solid/);
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
