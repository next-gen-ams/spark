import { chromium } from '/Users/cocohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'node:url';

const folder = fileURLToPath(new URL('.', import.meta.url));
const browser = await chromium.launch({
  headless: true,
  executablePath:
    '/Users/cocohu/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell',
});
try {
  const page = await browser.newPage({
    viewport: { width: 1512, height: 1100 },
    deviceScaleFactor: 1,
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/*', (route) => {
    const url = new URL(route.request().url());
    return url.hostname === '127.0.0.1' ? route.continue() : route.abort();
  });
  await page.goto('http://127.0.0.1:4193/?view=decisions');
  const complete = page.getByRole('button', {
    name: 'Mark complete',
    exact: true,
  });
  await complete.waitFor({ timeout: 20000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${folder}/preview-open.png`, fullPage: true });
  await complete.click();
  await page.getByRole('button', { name: 'Saving…', exact: true }).waitFor();
  const reopen = page.getByRole('button', {
    name: 'Reopen follow-up',
    exact: true,
  });
  await reopen.waitFor();
  await page.screenshot({
    path: `${folder}/preview-completed.png`,
    fullPage: true,
  });
  await page.reload();
  await reopen.waitFor();
  await reopen.click();
  await complete.waitFor();
  await page.getByRole('tab', { name: 'Topic', exact: true }).click();
  await page.getByRole('tab', { name: 'Decision', exact: true }).click();
  await complete.waitFor();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${folder}/preview-mobile.png` });
  console.log(
    JSON.stringify({
      completed: true,
      reloadPersisted: true,
      reopened: true,
      errors,
      images: [
        'preview-open.png',
        'preview-completed.png',
        'preview-mobile.png',
      ],
    }),
  );
  if (errors.length) process.exitCode = 1;
} finally {
  await browser.close();
}
