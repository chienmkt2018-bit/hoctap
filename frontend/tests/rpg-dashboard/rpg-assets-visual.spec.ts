import { test, expect, type Page } from '@playwright/test';

const viewports = [
  { name: 'desktop-1365x900', width: 1365, height: 900, background: 'bg-world-main.webp' },
  { name: 'mobile-390x844', width: 390, height: 844, background: 'bg_mobile_9x16.webp' },
];

async function installReadOnlyGuards(page: Page) {
  const attemptedWrites: string[] = [];
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () { /* blocked for visual QA */ };
    Storage.prototype.removeItem = function () { /* blocked for visual QA */ };
    Storage.prototype.clear = function () { /* blocked for visual QA */ };
  });
  await page.route('**/*', async route => {
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
  test(`RPG map visual capture — ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    const attemptedWrites = await installReadOnlyGuards(page);

    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    await page.getByRole('navigation', { name: 'Điều hướng chính' })
      .getByRole('button', { name: /Bản đồ nhiệm vụ/ }).click();
    await expect(page.getByRole('heading', { name: 'Chọn chặng tiếp theo', level: 2 })).toBeVisible();

    const map = page.locator('.rpg-stone-map');
    await expect(map).toBeVisible();
    const backgroundImage = await map.evaluate(element => getComputedStyle(element).backgroundImage);
    expect(backgroundImage).toContain(viewport.background);

    const imageReport = await page.locator('.rpg-map-screen img').evaluateAll(images =>
      images.map(image => {
        const img = image as HTMLImageElement;
        return {
          className: img.className,
          src: img.getAttribute('src'),
          loaded: img.complete && img.naturalWidth > 0 && img.naturalHeight > 0,
          naturalWidth: img.naturalWidth,
          naturalHeight: img.naturalHeight,
        };
      }),
    );
    expect(imageReport.length, 'RPG map should render its incoming image assets').toBeGreaterThanOrEqual(8);
    expect(imageReport.filter(image => !image.loaded), 'every RPG map image must load successfully').toEqual([]);
    expect(imageReport.every(image => image.src?.startsWith('/assets/incoming/'))).toBeTruthy();

    await expect(page.locator('.rpg-node-art')).toHaveCount(4);
    await expect(page.locator('.rpg-companion-art')).toBeVisible();
    const companionBounds = await page.locator('.rpg-companion').evaluate(element => {
      const rect = element.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height), left: Math.round(rect.left), top: Math.round(rect.top) };
    });
    expect(companionBounds.width, 'companion layout box should be prominent at this viewport').toBeGreaterThanOrEqual(viewport.width <= 390 ? 145 : 200);
    expect(companionBounds.height, 'companion layout box should have sufficient vertical presence').toBeGreaterThanOrEqual(viewport.width <= 390 ? 210 : 280);
    const companionImageScale = await page.locator('.rpg-companion-art').evaluate(element => {
      const style = getComputedStyle(element);
      return { width: Math.round(element.getBoundingClientRect().width), parentWidth: Math.round(element.parentElement!.getBoundingClientRect().width), objectFit: style.objectFit };
    });
    expect(companionImageScale.width, 'companion artwork must be scaled beyond its transparent image canvas').toBeGreaterThan(companionImageScale.parentWidth * 1.5);
    expect(companionImageScale.objectFit).toBe('contain');
    await expect(page.getByRole('heading', { name: 'Chọn chặng tiếp theo' })).toHaveCount(0);
    const mapBounds = await map.boundingBox();
    expect(mapBounds).not.toBeNull();
    expect(companionBounds.left, 'companion should occupy the right side of the map, away from the active node').toBeGreaterThan(mapBounds!.x + mapBounds!.width * 0.45);
    await expect(page.locator('.rpg-start-button-art')).toBeVisible();
    const startButtonLayout = await page.locator('.rpg-start-button').evaluate(element => {
      const map = element.closest('.rpg-stone-map');
      const rect = element.getBoundingClientRect();
      return { insideMap: Boolean(map), height: rect.height };
    });
    expect(startButtonLayout.insideMap, 'start CTA must stay inside the RPG map panel').toBeTruthy();
    expect(startButtonLayout.height, 'start CTA must not stretch to the map column height').toBeLessThan(90);
    await expect(page.locator('.rpg-side-stat-icon.xp img')).toBeVisible();
    await expect(page.locator('.rpg-side-stat-icon.gems img')).toBeVisible();
    await expect(page.locator('.rpg-challenge-cup')).toBeVisible();

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);

    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: testInfo.outputPath(`${viewport.name}.png`),
      fullPage: true,
      animations: 'disabled',
    });

    expect(attemptedWrites, 'visual-only run must not send mutating HTTP requests').toEqual([]);
    expect(pageErrors, 'no uncaught browser exceptions').toEqual([]);
    expect(consoleErrors, 'no browser console errors').toEqual([]);
    await testInfo.attach('rpg-image-load-report.json', {
      body: JSON.stringify({ viewport, backgroundImage, imageReport, companionBounds, companionImageScale, dimensions }, null, 2),
      contentType: 'application/json',
    });
  });
}
