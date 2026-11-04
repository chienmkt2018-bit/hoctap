import { test, expect, type Page } from '@playwright/test';

const viewports = [
  { name: 'mobile-390x844', width: 390, height: 844 },
  { name: 'tablet-768x1024', width: 768, height: 1024 },
  { name: 'desktop-1365x900', width: 1365, height: 900 },
];

async function installReadOnlyGuards(page: Page) {
  // Keep the application in a clean guest session and prevent local progress writes.
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () { /* intentionally blocked in QA */ };
    Storage.prototype.removeItem = function () { /* intentionally blocked in QA */ };
    Storage.prototype.clear = function () { /* intentionally blocked in QA */ };
  });

  const attemptedWrites: string[] = [];
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
      attemptedWrites.push(`${request.method()} ${new URL(request.url()).pathname}`);
      await route.abort('blockedbyclient');
      return;
    }
    await route.continue();
  });
  return attemptedWrites;
}

for (const viewport of viewports) {
  test(`RPG dashboard renders and remains usable at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    const attemptedWrites = await installReadOnlyGuards(page);

    const response = await page.goto('/');
    expect(response?.status(), 'Vite development server should serve the app').toBe(200);
    await expect(page.getByRole('heading', { name: 'Khởi nguyên tri thức' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(dimensions.document, 'document must not overflow horizontally').toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(dimensions.body, 'body must not overflow horizontally').toBeLessThanOrEqual(dimensions.viewport + 1);

    const lockedQuest = page.getByRole('button', { name: 'Mở khóa kiến thức, đang khóa' });
    await expect(lockedQuest).toBeVisible();
    await expect(lockedQuest).toHaveAttribute('aria-disabled', 'true');
    await lockedQuest.click();
    await expect(page.getByText('Hoàn thành nhiệm vụ đang mở để mở khóa chặng tiếp theo nhé.')).toBeVisible();

    const dailyToggle = page.getByRole('button', { name: /Thử thách hôm nay/ });
    await expect(dailyToggle).toHaveAttribute('aria-expanded', 'false');
    await dailyToggle.click();
    await expect(dailyToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('region', { name: 'Chi tiết thử thách hôm nay' })).toBeVisible();

    await page.getByRole('button', { name: 'Bài học' }).click();
    await expect(page.getByRole('heading', { name: 'Khám phá bài học' })).toBeVisible();
    await page.getByRole('button', { name: 'Bản đồ nhiệm vụ' }).click();
    await expect(page.getByRole('heading', { name: 'Khởi nguyên tri thức' })).toBeVisible();

    // Verify keyboard focus is visible on a real navigation control.
    const navButton = page.getByRole('button', { name: 'Bản đồ nhiệm vụ' });
    await navButton.focus();
    const focusStyle = await navButton.evaluate(element => {
      const style = getComputedStyle(element);
      return { outlineStyle: style.outlineStyle, outlineWidth: style.outlineWidth, boxShadow: style.boxShadow };
    });
    expect(
      focusStyle.outlineStyle !== 'none' && focusStyle.outlineWidth !== '0px' || focusStyle.boxShadow !== 'none',
      'focused navigation control should have a visible focus indicator',
    ).toBeTruthy();

    await page.screenshot({ path: `test-results/${viewport.name}.png`, fullPage: true });
    expect(attemptedWrites, 'no mutating HTTP requests may be sent').toEqual([]);
    expect(pageErrors, 'no uncaught browser exceptions').toEqual([]);
    expect(consoleErrors, 'no console errors').toEqual([]);
  });
}

test('reduced-motion preference disables continuous animation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installReadOnlyGuards(page);
  await page.goto('/');
  const motion = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('*')];
    return candidates.map(element => getComputedStyle(element).animationDuration)
      .filter(duration => !['0s', '0ms', '0.01ms'].includes(duration));
  });
  expect(motion, 'reduced-motion mode should suppress continuous CSS animations').toEqual([]);
});
