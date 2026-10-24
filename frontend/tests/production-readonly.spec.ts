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
    await expect(library.locator('.lesson-status.status-locked').first()).toHaveText('Chưa mở khóa');
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

  test('full Quest Map shows chapter choices and handles locked quests safely', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Bản đồ nhiệm vụ' }).click();

    const map = page.locator('.alternate-panel').filter({ has: page.getByRole('heading', { name: 'Chọn chặng tiếp theo' }) });
    await expect(map).toBeVisible();
    await expect(map.getByRole('button', { name: /Khởi động tư duy/ })).toBeVisible();
    await expect(map.getByRole('button', { name: /Mở khóa kiến thức/ })).toBeVisible();

    await map.getByRole('button', { name: /Mở khóa kiến thức/ }).click();
    await expect(page.getByRole('status')).toContainText('Hoàn thành nhiệm vụ đang mở để mở khóa chặng tiếp theo nhé.');
    // Locked-quest inspection only; no quiz is started and no progress is submitted.
  });

  test('navigation works from dashboard to Quest Map to lessons and back home', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Xem bản đồ đầy đủ/ }).click();
    await expect(page.getByRole('heading', { name: 'Chọn chặng tiếp theo' })).toBeVisible();

    await page.getByRole('navigation', { name: 'Điều hướng chính' }).getByRole('button', { name: 'Bài học' }).click();
    await expect(page.getByRole('region', { name: 'Thư viện bài học' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Khám phá bài học' })).toBeVisible();

    await page.getByRole('link', { name: 'HOC TAP QUEST trang chủ' }).click();
    await expect(page.getByRole('heading', { name: /chào mừng trở lại/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /bản đồ nhiệm vụ/i })).toBeVisible();
  });

  test('authentication loading and error states are tested with a mocked API response', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Intercept the auth request in-browser: no login request or test credentials reach production.
    await page.route('**/api/v1/auth/login', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Thông tin đăng nhập không hợp lệ.' } }),
      });
    });

    await page.getByRole('button', { name: 'Đăng nhập' }).first().click();
    const form = page.locator('.auth-form');
    await form.getByLabel('Email').fill('playwright-readonly@example.invalid');
    await form.getByLabel('Mật khẩu').fill('not-a-real-password');
    const submit = form.getByRole('button', { name: /Đăng nhập/ });
    await submit.click();
    await expect(form.getByRole('button', { name: /Đang xử lý/ })).toBeDisabled();
    await expect(page.getByRole('status')).toContainText('Thông tin đăng nhập không hợp lệ.');
    await expect(form.getByRole('button', { name: /Đăng nhập/ })).toBeEnabled();
  });

});
