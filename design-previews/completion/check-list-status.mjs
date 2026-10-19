import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from '/Users/cocohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const folder = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch({
  headless: true,
  executablePath:
    '/Users/cocohu/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell',
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.clock.setFixedTime(new Date('2026-10-19T01:00:00Z'));
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) =>
    new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue()
      : route.abort(),
  );
  await page.goto('http://127.0.0.1:4193/?view=backlog');
  const pending = page
    .locator('.backlog-open')
    .filter({ hasText: 'Review the onboarding rollout' });
  const completed = page
    .locator('.backlog-open')
    .filter({ hasText: 'Confirm leave coverage owners' });
  await pending
    .getByLabel('Follow-up status: Pending', { exact: true })
    .waitFor();
  await completed
    .getByLabel('Follow-up status: Completed', { exact: true })
    .waitFor();
  await page.screenshot({
    path: `${folder}/preview-list-status.png`,
    fullPage: true,
  });
  await pending.click();
  await page.getByRole('tab', { name: 'Decision', exact: true }).click();
  await page
    .getByRole('button', { name: 'Mark complete', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Reopen follow-up', exact: true })
    .waitFor();
  await page.locator('.topic-sheet [data-slot="sheet-close"]').click();
  await page.locator('.topic-sheet').waitFor({ state: 'hidden' });
  await pending
    .getByLabel('Follow-up status: Completed', { exact: true })
    .waitFor();
  await page.reload();
  await pending
    .getByLabel('Follow-up status: Completed', { exact: true })
    .waitFor();
  await pending.click();
  await page.getByRole('tab', { name: 'Decision', exact: true }).click();
  await page
    .getByRole('button', { name: 'Reopen follow-up', exact: true })
    .click();
  await page
    .getByRole('button', { name: 'Mark complete', exact: true })
    .waitFor();
  await page.locator('.topic-sheet [data-slot="sheet-close"]').click();
  await page.locator('.topic-sheet').waitFor({ state: 'hidden' });
  await pending
    .getByLabel('Follow-up status: Pending', { exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: `${folder}/preview-list-status-mobile.png`,
    fullPage: true,
  });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole('button', { name: 'Next meeting', exact: true }).click();
  await page
    .locator('.agenda-row')
    .getByLabel('Follow-up status: Pending', { exact: true })
    .waitFor();
  await page.getByRole('button', { name: /Decision log/ }).click();
  // The preview harness opens its example once when the decision list first mounts.
  await page
    .getByRole('button', { name: 'Mark complete', exact: true })
    .waitFor();
  await page.locator('.topic-sheet [data-slot="sheet-close"]').click();
  await page.locator('.topic-sheet').waitFor({ state: 'hidden' });
  assert.ok(
    await page
      .locator('.decision-row')
      .getByLabel('Follow-up status: Pending', { exact: true })
      .count(),
  );
  assert.ok(
    await page
      .locator('.decision-row')
      .getByLabel('Follow-up status: Completed', { exact: true })
      .count(),
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      backlog: true,
      agenda: true,
      decisionLog: true,
      completeRefreshReopen: true,
      mobile: true,
      errors,
    }),
  );
} finally {
  await browser.close();
}
