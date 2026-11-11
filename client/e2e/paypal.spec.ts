import { expect, test, type APIRequestContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { API, appReady, signIn } from './helpers';

// The whole money path with the real PayPal sandbox: hold → deal found → ask → approve → capture → undo → refund.
// A PayPal sandbox test card stands in for the buyer clicking "Approve" in PayPal's window,
// which a test can't do (it needs a person's sandbox login).

function paypalKeys() {
  const env = readFileSync(join(__dirname, '..', '..', '.env'), 'utf8');
  const get = (k: string) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1].trim() ?? '';
  return { id: get('PAYPAL_CLIENT_ID'), secret: get('PAYPAL_CLIENT_SECRET') };
}

async function approveWithTestCard(request: APIRequestContext, orderId: string) {
  const { id, secret } = paypalKeys();
  const tokenRes = await request.post('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString('base64')}` },
    form: { grant_type: 'client_credentials' },
  });
  const { access_token } = await tokenRes.json();
  const res = await request.post(`https://api-m.sandbox.paypal.com/v2/checkout/orders/${orderId}/confirm-payment-source`, {
    headers: { Authorization: `Bearer ${access_token}` },
    data: {
      payment_source: {
        card: {
          number: '4032039317984658',
          expiry: '2030-12',
          security_code: '123',
          name: 'Test Buyer',
          billing_address: { address_line_1: '123 Main St', admin_area_2: 'Austin', admin_area_1: 'TX', postal_code: '78701', country_code: 'US' },
        },
      },
    },
  });
  expect((await res.json()).status).toBe('APPROVED');
}

test('ask me first: approve the deal, then undo it with a PayPal refund', async ({ page, request }) => {
  test.skip(!paypalKeys().id, 'needs PayPal sandbox keys in .env');
  const token = await signIn(page, request);
  const headers = { Authorization: `Bearer ${token}` };

  // Set up a watched wish with a real PayPal hold.
  let res = await request.post(`${API}/wishes`, { headers, data: { text: 'Sony WH-CH720N headphones under $70', mode: 'ask' } });
  const { wish } = await res.json();
  await request.post(`${API}/wishes/${wish._id}/choose`, { headers, data: { productId: wish.candidates[0].productId } });
  const { orderId } = await (await request.post(`${API}/wishes/${wish._id}/paypal/order`, { headers })).json();
  await approveWithTestCard(request, orderId);
  res = await request.post(`${API}/wishes/${wish._id}/paypal/authorize`, { headers, data: { orderId } });
  expect((await res.json()).wish.status).toBe('watching');

  // From here on, everything happens in the browser.
  await page.goto(`/wish/?id=${wish._id}`);
  await appReady(page);
  await expect(page.getByText('Watching the price')).toBeVisible();
  await page.getByLabel('Simulated new price').fill('65');
  await page.getByRole('button', { name: 'Simulate drop' }).click();

  await expect(page.getByText('The agent found a deal. Buy it?')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: /Approve and buy for \$65/ }).click();
  await expect(page.getByRole('heading', { name: 'Bought for $65' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('Released back to you')).toBeVisible();

  await page.getByRole('button', { name: 'Undo purchase' }).click();
  await page.getByRole('button', { name: 'Undo and refund' }).click();
  await expect(page.getByRole('heading', { name: 'Refunded $65' })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('PayPal refund ID')).toBeVisible();

  await request.delete(`${API}/wishes/${wish._id}`, { headers });
});
