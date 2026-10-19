import assert from 'node:assert/strict';
import { chromium } from '/Users/cocohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';

const url = process.argv[2] || 'http://127.0.0.1:4194/emt-tracker/';
const browser = await chromium.launch({
  headless: true,
  executablePath:
    '/Users/cocohu/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell',
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  const errors = [];
  const failedAssets = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400 && response.url().includes('/emt-tracker/'))
      failedAssets.push(
        response.status() + ' ' + new URL(response.url()).pathname,
      );
  });
  await page.goto(url);
  await page
    .getByRole('button', { name: 'Continue with Microsoft', exact: true })
    .waitFor();
  assert.equal(
    await page.locator('.access-configuration').count(),
    0,
    'Public Microsoft identifiers must be configured',
  );
  assert.equal(
    await page.locator('.workspace-layout').count(),
    0,
    'Workspace must remain private before verification',
  );
  await page.waitForFunction(() => {
    const image = document.querySelector('img.gms-logo');
    return (
      image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0
    );
  });
  await page.reload();
  await page
    .getByRole('button', { name: 'Continue with Microsoft', exact: true })
    .waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    true,
    'Phone viewport must not overflow',
  );
  const silent = await page.request.get(new URL('auth-silent.html', url).href);
  assert.equal(silent.status(), 200);
  assert.equal(
    (await silent.text()).includes('<script'),
    false,
    'Silent auth callback must stay script-free',
  );
  assert.deepEqual(errors, []);
  assert.deepEqual(failedAssets, []);
  console.log(
    JSON.stringify({
      url,
      loginConfigured: true,
      privateWorkspaceGate: true,
      logo: true,
      refresh: true,
      mobile: true,
      silentCallback: true,
      errors,
      failedAssets,
    }),
  );
} finally {
  await browser.close();
}
