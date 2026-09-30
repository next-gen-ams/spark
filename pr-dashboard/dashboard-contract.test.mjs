import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const GEO_REPORT_URL = 'https://geo.kmt.global/share/XYK19lgzKLyGdYjkoELc5o8aA1pO0RIUPQD45KRMn0g';

test('both KMT GEO entry points use the verified shared report URL', async () => {
  const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
  const matches = html.match(new RegExp(GEO_REPORT_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || [];

  assert.equal(matches.length, 2);
  assert.doesNotMatch(html, /data-action=["']geo["']/);
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
