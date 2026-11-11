import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { appReady, signIn } from './helpers';

// axe-core scans each main page for WCAG 2.1 A/AA problems. Serious or critical ones fail the test.

async function scan(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // PayPal's own button iframe is outside our control.
    .exclude('.paypal-slot')
    .analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  return bad.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} element(s), e.g. ${v.nodes[0]?.target.join(' ')}`);
}

test('landing page', async ({ page }) => {
  await page.goto('/');
  await appReady(page);
  expect(await scan(page)).toEqual([]);
});

test('login page', async ({ page }) => {
  await page.goto('/login/');
  await appReady(page);
  expect(await scan(page)).toEqual([]);
});

test('my wishes', async ({ page, request }) => {
  await signIn(page, request);
  await page.goto('/wishes/');
  await appReady(page);
  await expect(page.getByRole('heading', { name: 'My wishes' })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('a finished wish (receipt, chart, activity)', async ({ page, request }) => {
  await signIn(page, request);
  await page.goto('/wishes/');
  await appReady(page);
  await page.getByText('Fellow Stagg EKG Electric Pour-Over Kettle').click();
  await expect(page.getByText('Bought for $139')).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test('dark mode keeps enough contrast', async ({ page, request }) => {
  await signIn(page, request);
  await page.addInitScript(() => localStorage.setItem('waitforit.theme', 'dark'));
  await page.goto('/wishes/');
  await appReady(page);
  await expect(page.getByRole('heading', { name: 'My wishes' })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});
