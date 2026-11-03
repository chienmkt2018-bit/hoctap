import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const FRONTEND_URL = process.env.PRODUCTION_FRONTEND_URL;
const ARTIFACT_DIR = 'artifacts/p54-06-production-readonly';
const ALLOWED_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const results = [];
const blockedRequests = [];
const pageErrors = [];
const consoleErrors = [];

const record = (id, ok, detail) => {
  const item = { id, status: ok ? 'PASS' : 'FAIL', detail };
  results.push(item);
  console.log(`${item.status} | ${id} | ${detail}`);
};

const shortError = (error) => String(error?.message ?? error).slice(0, 900);

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true });

  if (FRONTEND_URL !== 'https://hoctap-frontend.onrender.com') {
    record('P54-06-SETUP-01 production target is fixed', false,
      `Unexpected PRODUCTION_FRONTEND_URL: ${FRONTEND_URL ?? 'missing'}`);
    await writeEvidence();
    process.exitCode = 1;
    return;
  }

  let browser;
  let context;
  let page;

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1365, height: 900 },
      serviceWorkers: 'block'
    });
    page = await context.newPage();

    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    // Enforce read-only at the browser boundary: disallowed methods are
    // aborted before they can be sent to the production server.
    await context.route('**/*', async route => {
      const request = route.request();
      const method = request.method().toUpperCase();
      if (ALLOWED_METHODS.has(method)) {
        await route.continue();
        return;
      }
      const entry = { method, url: request.url() };
      blockedRequests.push(entry);
      console.error(`BLOCKED non-read request before network: ${method} ${request.url()}`);
      await route.abort('blockedbyclient');
    });

    let response;
    try {
      response = await page.goto(FRONTEND_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      });
      const ok = Boolean(response && response.status() >= 200 && response.status() < 400);
      record('P54-06-UI-01 production frontend loads', ok,
        `HTTP ${response?.status() ?? 'no response'}; URL=${FRONTEND_URL}`);
    } catch (error) {
      record('P54-06-UI-01 production frontend loads', false, shortError(error));
    }

    if (response && response.status() >= 200 && response.status() < 400) {
      await page.locator('body').waitFor({ state: 'visible', timeout: 15000 });
      const title = (await page.title()).trim();
      const bodyText = (await page.locator('body').innerText()).trim();
      const contentOk = title.length > 0 && bodyText.length > 30;
      record('P54-06-UI-02 page title and content', contentOk,
        `title="${title.slice(0, 100)}"; visibleTextLength=${bodyText.length}`);
      await page.screenshot({
        path: `${ARTIFACT_DIR}/production-home-desktop.png`,
        fullPage: true
      });

      let libraryReady = false;
      try {
        const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
        const lessonNav = nav.getByRole('button', { name: 'Bài học', exact: true });
        const navVisible = await lessonNav.isVisible();
        record('P54-06-NAV-01 lesson navigation visible', navVisible,
          `Bài học navigation visible=${navVisible}`);
        if (navVisible) {
          await lessonNav.click();
          const library = page.getByRole('region', { name: 'Thư viện bài học' });
          await library.waitFor({ state: 'visible', timeout: 15000 });
          await library.getByRole('heading', { name: 'Khám phá bài học', exact: true })
            .waitFor({ state: 'visible', timeout: 10000 });
          libraryReady = true;
          record('P54-06-LESSON-01 lesson library opens', true,
            'Opened Thư viện bài học using the primary Bài học navigation');
          await page.screenshot({
            path: `${ARTIFACT_DIR}/production-lesson-library-desktop.png`,
            fullPage: true
          });
        }
      } catch (error) {
        record('P54-06-NAV-01 lesson navigation and library', false, shortError(error));
      }

      if (libraryReady) {
        const library = page.getByRole('region', { name: 'Thư viện bài học' });

        // Available lesson: open only its informational detail panel.
        try {
          const availableCard = library.locator('.lesson-card-available')
            .filter({ has: page.getByRole('heading', { name: 'Khởi động tư duy', exact: true }) })
            .first();
          const availableVisible = await availableCard.isVisible();
          const detailButton = availableCard.getByRole('button', { name: /Xem chi tiết/ });
          const detailButtonVisible = await detailButton.isVisible();
          if (availableVisible && detailButtonVisible) {
            await detailButton.click();
            await library.getByRole('heading', { name: 'Chi tiết bài học', exact: true })
              .waitFor({ state: 'visible', timeout: 10000 });
            await library.getByRole('heading', { name: 'Khởi động tư duy', exact: true })
              .waitFor({ state: 'visible', timeout: 10000 });
            record('P54-06-LESSON-02 available lesson detail opens', true,
              'Khởi động tư duy detail opened; no quiz was started or submitted');
            await page.screenshot({
              path: `${ARTIFACT_DIR}/production-available-lesson-detail.png`,
              fullPage: true
            });
            await library.getByRole('button', { name: /Quay lại danh sách/ }).click();
            await library.getByRole('heading', { name: 'Khám phá bài học', exact: true })
              .waitFor({ state: 'visible', timeout: 10000 });
          } else {
            record('P54-06-LESSON-02 available lesson detail opens', false,
              `available card visible=${availableVisible}; detail action visible=${detailButtonVisible}`);
          }
        } catch (error) {
          record('P54-06-LESSON-02 available lesson detail opens', false, shortError(error));
        }

        // Locked lesson: verify the lock notice and ensure detail does not open.
        try {
          const lockedCard = library.locator('.lesson-card-locked')
            .filter({ has: page.getByRole('heading', { name: 'Thử thách nhanh', exact: true }) })
            .first();
          const lockedCardVisible = await lockedCard.isVisible();
          const lockedButton = lockedCard.getByRole('button', { name: /Đang khóa/ });
          const lockedButtonVisible = await lockedButton.isVisible();
          if (lockedCardVisible && lockedButtonVisible) {
            await lockedButton.click();
            const notice = page.getByRole('status')
              .filter({ hasText: 'Bài học này đang khóa' });
            await notice.waitFor({ state: 'visible', timeout: 7000 });
            const detailCount = await library.getByRole('heading', {
              name: 'Chi tiết bài học', exact: true
            }).count();
            const remainsLocked = detailCount === 0;
            record('P54-06-LESSON-03 locked lesson remains inaccessible',
              remainsLocked,
              `locked card visible=true; locked action visible=true; lock notice visible=true; detail panel absent=${remainsLocked}`);
          } else {
            record('P54-06-LESSON-03 locked lesson remains inaccessible', false,
              `locked card visible=${lockedCardVisible}; locked action visible=${lockedButtonVisible}`);
          }
        } catch (error) {
          record('P54-06-LESSON-03 locked lesson remains inaccessible', false, shortError(error));
        }

        await page.screenshot({
          path: `${ARTIFACT_DIR}/production-lesson-lock-state-desktop.png`,
          fullPage: true
        });

        // Repeat the lesson-library and locked-card visibility check on mobile.
        try {
          await page.setViewportSize({ width: 390, height: 844 });
          await library.getByRole('heading', { name: 'Khám phá bài học', exact: true })
            .waitFor({ state: 'visible', timeout: 10000 });
          const mobileLockedCard = library.locator('.lesson-card-locked')
            .filter({ has: page.getByRole('heading', { name: 'Thử thách nhanh', exact: true }) })
            .first();
          const mobileLockedVisible = await mobileLockedCard.isVisible();
          const mobileActionVisible = await mobileLockedCard
            .getByRole('button', { name: /Đang khóa/ }).isVisible();
          const viewport = await page.evaluate(() => ({
            width: window.innerWidth,
            height: window.innerHeight,
            documentWidth: document.documentElement.scrollWidth
          }));
          await page.screenshot({
            path: `${ARTIFACT_DIR}/production-lesson-lock-state-mobile-390x844.png`,
            fullPage: true
          });
          record('P54-06-MOBILE-01 lesson lock state at 390x844',
            mobileLockedVisible && mobileActionVisible,
            `viewport=${viewport.width}x${viewport.height}; documentWidth=${viewport.documentWidth}; locked card visible=${mobileLockedVisible}; locked action visible=${mobileActionVisible}`);
        } catch (error) {
          record('P54-06-MOBILE-01 lesson lock state at 390x844', false, shortError(error));
        }
      } else {
        record('P54-06-LESSON-02 available lesson detail opens', false,
          'Blocked because lesson library did not open');
        record('P54-06-LESSON-03 locked lesson remains inaccessible', false,
          'Blocked because lesson library did not open');
        record('P54-06-MOBILE-01 lesson lock state at 390x844', false,
          'Blocked because lesson library did not open');
      }
    } else {
      record('P54-06-UI-02 page title and content', false,
        'Not evaluated because production frontend did not return a successful page response');
      record('P54-06-NAV-01 lesson navigation and library', false,
        'Not evaluated because production frontend did not load');
      record('P54-06-LESSON-02 available lesson detail opens', false,
        'Not evaluated because production frontend did not load');
      record('P54-06-LESSON-03 locked lesson remains inaccessible', false,
        'Not evaluated because production frontend did not load');
      record('P54-06-MOBILE-01 lesson lock state at 390x844', false,
        'Not evaluated because production frontend did not load');
    }

    record('P54-06-SAFE-01 no non-read HTTP requests attempted',
      blockedRequests.length === 0,
      blockedRequests.length
        ? `${blockedRequests.length} request(s) blocked before network: ${blockedRequests.map(x => `${x.method} ${x.url}`).join(' | ').slice(0, 1200)}`
        : 'Only GET, HEAD, and OPTIONS requests were observed');
    record('P54-06-UI-03 no uncaught page errors',
      pageErrors.length === 0,
      pageErrors.length ? pageErrors.join(' | ').slice(0, 1200) : 'No uncaught page errors observed');
    record('P54-06-UI-04 no console.error messages',
      consoleErrors.length === 0,
      consoleErrors.length ? consoleErrors.join(' | ').slice(0, 1200) : 'No console.error messages observed');
  } catch (error) {
    record('P54-06-RUN-01 Playwright runner', false, shortError(error));
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
    await writeEvidence();
  }

  const passed = results.filter(item => item.status === 'PASS').length;
  const failed = results.filter(item => item.status === 'FAIL').length;
  console.log(`\\nP54-06 summary: ${passed} PASS, ${failed} FAIL`);
  if (failed > 0) process.exitCode = 1;
}

async function writeEvidence() {
  const summary = {
    testSuite: 'P54-06 production read-only Playwright',
    environment: 'production',
    target: FRONTEND_URL ?? null,
    generatedAt: new Date().toISOString(),
    policy: {
      allowedHttpMethods: [...ALLOWED_METHODS],
      disallowedMethodsAbortedBeforeNetwork: true,
      noLogin: true,
      noQuizSubmission: true,
      noLessonCompletion: true,
      noLearningProgressWrites: true
    },
    totals: {
      pass: results.filter(item => item.status === 'PASS').length,
      fail: results.filter(item => item.status === 'FAIL').length
    },
    blockedRequests,
    pageErrors,
    consoleErrors,
    results
  };
  await writeFile(`${ARTIFACT_DIR}/p54-06-results.json`,
    JSON.stringify(summary, null, 2), 'utf8');
}

await main();
