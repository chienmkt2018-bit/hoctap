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
    expect(response?.status(), 'staging frontend root should return HTTP 200').toBe(200);
    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: /Bản đồ nhiệm vụ/ }).click();
    await expect(page.getByRole('heading', { name: 'Bản đồ nhiệm vụ.', level: 1 })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(dimensions.document, 'document must not overflow horizontally').toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(dimensions.body, 'body must not overflow horizontally').toBeLessThanOrEqual(dimensions.viewport + 1);

    const lockedQuest = page.getByRole('button', { name: /Mở khóa kiến thức/ });
    await expect(lockedQuest).toBeVisible();
    await expect(lockedQuest).toBeDisabled();
    await expect(lockedQuest).toHaveAttribute('disabled', '');
    await expect(lockedQuest).toHaveAttribute('aria-disabled', 'true');
    await expect.poll(() => lockedQuest.evaluate((element) => (element as HTMLButtonElement).disabled)).toBe(true);
    // A native disabled button ignores programmatic click(), matching its non-interactive user state.
    await lockedQuest.evaluate((element) => (element as HTMLButtonElement).click());
    await expect(page.getByText('Hoàn thành nhiệm vụ đang mở để mở khóa chặng tiếp theo nhé.', { exact: true })).toHaveCount(0);
    expect(attemptedWrites, 'locked quest must not trigger a mutating HTTP request').toEqual([]);

    const dailyToggle = page.getByRole('button', { name: /Thử thách hôm nay/ });
    await expect(dailyToggle).toHaveAttribute('aria-expanded', 'false');
    await dailyToggle.click();
    await expect(dailyToggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('region', { name: 'Chi tiết thử thách hôm nay' })).toBeVisible();

    await page.getByRole('button', { name: 'Bài học', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Bài học.', level: 1 })).toBeVisible();
    await page.getByRole('button', { name: 'Bản đồ nhiệm vụ' }).click();
    await expect(page.getByRole('heading', { name: 'Bản đồ nhiệm vụ.' })).toBeVisible();

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

    if (viewport.name === 'tablet-768x1024') {
      // Navigation and disclosure checks may scroll the page; measure the topbar at scroll origin.
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      const tabletLayout = await page.evaluate(() => {
        const topbar = document.querySelector('.topbar');
        const hud = document.querySelector('.rpg-hud');
        const map = document.querySelector('.rpg-stone-map');
        const aside = document.querySelector('.rpg-world-aside');
        const world = document.querySelector('.rpg-world-layout');
        if (!topbar || !hud || !map || !aside || !world) throw new Error('Tablet RPG layout elements are missing');
        const topbarRect = topbar.getBoundingClientRect();
        const hudRect = hud.getBoundingClientRect();
        const mapRect = map.getBoundingClientRect();
        const asideRect = aside.getBoundingClientRect();
        return {
          topbarVisible: getComputedStyle(topbar).display !== 'none',
          topbarBottom: topbarRect.bottom,
          hudTop: hudRect.top,
          mapBottom: mapRect.bottom,
          asideTop: asideRect.top,
          worldColumns: getComputedStyle(world).gridTemplateColumns.trim().split(/\s+/).length,
        };
      });
      expect(tabletLayout.topbarVisible, 'tablet should retain the desktop topbar').toBeTruthy();
      expect(tabletLayout.topbarBottom, 'topbar must not overlap the RPG HUD at initial scroll position').toBeLessThanOrEqual(tabletLayout.hudTop + 1);
      expect(tabletLayout.worldColumns, 'tablet world layout should use a single column below 900px').toBe(1);
      expect(tabletLayout.asideTop, 'tablet information panel should follow the map, not overlap it').toBeGreaterThanOrEqual(tabletLayout.mapBottom);
      await page.screenshot({ path: 'test-results-staging/tablet-768x1024-viewport.png' });
    }

    await page.screenshot({ path: `test-results-staging/${viewport.name}.png`, fullPage: true });
    expect(attemptedWrites, 'no mutating HTTP requests may be sent').toEqual([]);
    expect(pageErrors, 'no uncaught browser exceptions').toEqual([]);
    expect(consoleErrors, 'no console errors').toEqual([]);
  });
}


test('active quest opens its preview without submitting learning data', async ({ page }) => {
  const attemptedWrites = await installReadOnlyGuards(page);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: /Bản đồ nhiệm vụ/ }).click();
  await expect(page.getByRole('heading', { name: 'Bản đồ nhiệm vụ.', level: 1 })).toBeVisible();

  const activeQuest = page.getByRole('button', { name: /Khởi động tư duy/ });
  await expect(activeQuest).toBeVisible();
  await expect(activeQuest).toBeEnabled();
  await activeQuest.click();

  const panel = page.locator('.lesson-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Khởi động tư duy' })).toBeVisible();
  await panel.getByRole('button', { name: 'Đóng nhiệm vụ' }).click();
  await expect(panel).toHaveCount(0);
  expect(attemptedWrites, 'opening and closing an active quest must not write learning data').toEqual([]);
});

test('locked quest is disabled and pointer interaction sends no write request', async ({ page }) => {
  const attemptedWrites = await installReadOnlyGuards(page);
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: /Bản đồ nhiệm vụ/ }).click();
  await expect(page.getByRole('heading', { name: 'Bản đồ nhiệm vụ.', level: 1 })).toBeVisible();

  const lockedQuest = page.getByRole('button', { name: /Mở khóa kiến thức/ });
  await expect(lockedQuest).toBeVisible();
  await expect(lockedQuest).toBeDisabled();
  await expect(lockedQuest).toHaveAttribute('disabled', '');
  await expect(lockedQuest).toHaveAttribute('aria-disabled', 'true');
  expect(await lockedQuest.evaluate(el => (el as HTMLButtonElement).matches(':disabled'))).toBe(true);

  const bounds = await lockedQuest.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2);
  expect(attemptedWrites, 'a pointer click on a locked quest must not send a mutating request').toEqual([]);
});

test('reduced-motion preference disables continuous animation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await installReadOnlyGuards(page);
  await page.goto('/');
  const motionDurationsMs = await page.evaluate(() => {
    const candidates = [...document.querySelectorAll('*')];
    return candidates.flatMap(element =>
      getComputedStyle(element).animationDuration.split(',').map(value => {
        const duration = value.trim();
        const numericValue = Number.parseFloat(duration);
        if (duration.endsWith('ms')) return numericValue;
        if (duration.endsWith('s')) return numericValue * 1000;
        throw new Error(`Unexpected CSS animation-duration value: ${duration}`);
      }),
    );
  });
  expect(
    motionDurationsMs.filter(duration => duration > 0.01),
    'reduced-motion mode should suppress continuous CSS animations',
  ).toEqual([]);
});
