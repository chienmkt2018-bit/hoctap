import { expect, test } from '@playwright/test';

test.describe('HOC TAP QUEST production — read-only checks', () => {
  test('homepage loads and primary navigation is available', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/HOC TAP QUEST/i);
    await expect(page.getByRole('navigation', { name: 'Điều hướng chính' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bài học' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /nhà thám hiểm/i }).first()).toBeVisible();
    expect(pageErrors, 'uncaught browser exceptions').toEqual([]);
  });

  test('lesson library and read-only lesson details are reachable without starting a quiz', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Bài học' }).click();

    const library = page.getByRole('region', { name: 'Thư viện bài học' });
    await expect(library).toBeVisible();
    await expect(library.getByRole('heading', { name: 'Khám phá bài học' })).toBeVisible();
    await expect(library.getByText(/bài học phù hợp/i)).toBeVisible();

    const detailButton = library.getByRole('button', { name: /Xem chi tiết/ }).first();
    await expect(detailButton).toBeVisible();
    await detailButton.click();
    await expect(library.getByRole('heading', { name: 'Chi tiết bài học' })).toBeVisible();
    await expect(library.getByRole('heading', { name: 'Nội dung dự kiến' })).toBeVisible();
    await expect(library.getByRole('button', { name: /Bắt đầu quiz/ })).toBeVisible();
    // Deliberately do not click "Bắt đầu quiz", answer questions, or submit progress.
  });

  test('lesson status filter displays locked lessons without changing progress', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Bài học' }).click();

    const library = page.getByRole('region', { name: 'Thư viện bài học' });
    await library.getByLabel('Trạng thái').selectOption({ label: 'Chưa mở khóa' });
    await expect(library.getByText('Chưa mở khóa').first()).toBeVisible();
    await expect(library.getByRole('button', { name: 'Đang khóa' }).first()).toBeVisible();
    await expect(library.getByRole('heading', { name: 'Khám phá bài học' })).toBeVisible();
  });

  test('lesson library remains visible at a mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Bài học' }).click();

    const library = page.getByRole('region', { name: 'Thư viện bài học' });
    await expect(library).toBeVisible();
    await expect(library.getByRole('heading', { name: 'Khám phá bài học' })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewportWidth: document.documentElement.clientWidth,
      documentWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 2);
  });
});
