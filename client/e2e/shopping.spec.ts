import { expect, test } from '@playwright/test';
import { API, appReady, signIn } from './helpers';

test('visitor tries the demo from the landing page', async ({ page }) => {
  await page.goto('/');
  await appReady(page);
  await expect(page.getByRole('heading', { name: /Set your price once/ })).toBeVisible();
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page).toHaveURL(/\/wishes\/$/);
  await expect(page.getByText('Fellow Stagg EKG Electric Pour-Over Kettle')).toBeVisible();
});

test('signed-out visitors are sent to log in', async ({ page }) => {
  await page.goto('/wishes/');
  await expect(page).toHaveURL(/\/login\/$/);
});

test('make a wish, get AI matches and advice, pick one, reach the PayPal step', async ({ page, request }) => {
  await signIn(page, request);
  await page.goto('/wishes/');
  await appReady(page);

  await page.getByLabel('Describe what you want').fill('Sony WH-CH720N headphones under $70');
  await page.getByRole('button', { name: 'Start shopping' }).click();

  await expect(page).toHaveURL(/\/wish\/\?id=/, { timeout: 60_000 });
  await expect(page.getByText('1. Pick the one you want')).toBeVisible();
  await expect(page.locator('.advice .verdict')).toHaveText(/Your limit|Already at your price/);
  await page.getByRole('button', { name: 'Select', exact: true }).first().click();

  await expect(page.getByText('2. Approve a PayPal hold for your top price')).toBeVisible();
  await expect(page.locator('.hold-amount')).toHaveText('$70');
  // PayPal's real button renders inside its own iframe.
  await expect(page.locator('.paypal-slot iframe').first()).toBeVisible();

  // Clean up so the demo list stays short.
  const id = new URL(page.url()).searchParams.get('id');
  await request.delete(`${API}/wishes/${id}`, { headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('waitforit.token'))}` } });
});
