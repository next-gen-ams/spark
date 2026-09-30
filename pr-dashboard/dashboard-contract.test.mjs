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

test('GEO visibility opens the verified full report without a duplicate local page', async () => {
  const [html, javascript] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./dashboard.js', import.meta.url), 'utf8'),
  ]);

  assert.match(html, new RegExp(`<a class="nav-item nav-item-external" href="${GEO_REPORT_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  assert.match(html, /target="_blank" rel="noopener noreferrer"[\s\S]*?GEO Visibility/);
  assert.doesNotMatch(html, /data-view="geo-visibility"|data-view-panel="geo-visibility"|id="geoPersonaGrid"/);
  assert.doesNotMatch(javascript, /loadGeoData|renderGeoData|fetch\('\.\/data\/geo\.json'/);
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

test('coverage sections use concise client-facing headings without helper copy', async () => {
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');

  assert.match(html, /<span class="panel-kicker">PUBLISHED MEDIA<\/span>\s*<h2>Confirmed coverage<\/h2>/);
  assert.match(html, /<span class="panel-kicker">POTENTIAL & RELATED PICKUPS<\/span>\s*<h2>Organic coverage<\/h2>/);
  assert.doesNotMatch(html, /Additional organic coverage|<h2>Published media<\/h2>/);
  assert.doesNotMatch(html, /Confirmed placements, bilingual article titles|Recent Meltwater mentions for review/);
});

test('PR performance does not render a separate AI insights surface', async () => {
  const [html, javascript, server] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./dashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('./scripts/local-server.mjs', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(html, /id="prInsights"|AI INSIGHTS|What changed and what matters/);
  assert.doesNotMatch(javascript, /loadInsightsData|renderPrInsights|data\/insights\.json/);
  assert.doesNotMatch(server, /\/data\/insights\.json/);
});

test('workspace keeps PR local and GEO as an external report destination', async () => {
  const [html, javascript] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./dashboard.js', import.meta.url), 'utf8'),
  ]);

  assert.equal((html.match(/class="nav-item[^"]*"/g) || []).length, 2);
  assert.match(html, /data-view="pr-performance"[^>]*>[\s\S]*?PR Performance/);
  assert.match(html, /nav-item-external[\s\S]*?GEO Visibility/);
  assert.equal((html.match(/data-view-panel=/g) || []).length, 1);
  assert.doesNotMatch(javascript, /geo-visibility/);
  assert.match(javascript, /searchParams\.set\('view', view\)/);
  assert.match(javascript, /window\.history\.pushState/);
  assert.match(javascript, /window\.addEventListener\('popstate'/);
});

test('topbar uses an explicit logout control without a Meltwater status chip', async () => {
  const [html, javascript, css] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./dashboard.js', import.meta.url), 'utf8'),
    readFile(new URL('./styles.css', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(html, /id="connectionStatus"|class="status-chip"/);
  assert.match(html, /class="logout-button"[^>]*id="lockDashboard"/);
  assert.match(html, /<span>Log out<\/span>/);
  assert.doesNotMatch(javascript, /connectionStatus/);
  assert.match(javascript, /localStorage\.removeItem\(AUTH_SESSION_KEY\)/);
  assert.match(css, /\.logout-button\s*\{/);
});

test('sidebar uses the actual weekly schedule and no GEO context switch', async () => {
  const [html, javascript] = await Promise.all([
    readFile(new URL('./index.html', import.meta.url), 'utf8'),
    readFile(new URL('./dashboard.js', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(html, /id="sidebarGeoLogo"/);
  assert.doesNotMatch(javascript, /renderSidebarContext|Monthly GEO snapshot|Last GEO check/);
  assert.match(html, /Next automatic update/);
  assert.match(javascript, /meta\.nextRefreshAt/);
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
