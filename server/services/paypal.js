const env = require('../config/env');
const { HttpError } = require('../middleware/errors');

// PayPal Orders v2 with intent AUTHORIZE: the buyer approves a hold for their top price,
// and later we capture only what the item actually costs. A final capture releases the rest.

let cachedToken = null;

async function accessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const basic = Buffer.from(`${env.paypal.clientId}:${env.paypal.secret}`).toString('base64');
  const res = await request('/v1/oauth2/token', {
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    raw: true,
  });
  cachedToken = { value: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 };
  return cachedToken.value;
}

async function request(path, { method = 'POST', headers = {}, body, raw = false, requestId } = {}) {
  if (!env.paypal.clientId || !env.paypal.secret) {
    throw new HttpError(503, 'PayPal is not set up yet. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to the .env file.');
  }
  const auth = raw ? {} : { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' };
  let res;
  try {
    res = await fetch(`${env.paypal.baseUrl}${path}`, {
      method,
      headers: {
        ...auth,
        ...headers,
        // The same request id makes PayPal treat a retry as the same request, so nobody is charged twice.
        ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
        Prefer: 'return=representation',
      },
      body: raw ? body : body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new HttpError(502, "Couldn't reach PayPal. Please try again in a moment.");
  }
  if (res.status === 204) return {};
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const issue = data.details?.[0]?.issue || data.name || data.error || res.status;
    console.error(`PayPal ${method} ${path} failed: ${issue} ${data.message || data.error_description || ''}`);
    const err = new HttpError(res.status >= 500 ? 502 : 400, paypalMessage(issue));
    err.issue = issue;
    throw err;
  }
  return data;
}

const MESSAGES = {
  ORDER_NOT_APPROVED: 'The PayPal payment was not approved yet. Please finish it in the PayPal window.',
  INSTRUMENT_DECLINED: 'PayPal declined that payment method. Please try another one.',
  AUTHORIZATION_EXPIRED: 'The PayPal hold has expired.',
  AUTHORIZATION_VOIDED: 'The PayPal hold was already released.',
  AUTHORIZATION_ALREADY_CAPTURED: 'This payment was already completed.',
  DECIMAL_PRECISION: 'That amount is not valid.',
  CAPTURE_FULLY_REFUNDED: 'This purchase was already refunded.',
  REFUND_TIME_LIMIT_EXCEEDED: 'It is too late to refund this purchase through PayPal.',
};
const paypalMessage = (issue) => MESSAGES[issue] || 'PayPal could not complete that step. Please try again.';

const money = (value) => ({ currency_code: env.paypal.currency, value: Number(value).toFixed(2) });

/** Step 1: an order that will hold up to `amount` once the buyer approves it. */
async function createHoldOrder({ wishId, amount, description }) {
  const order = await request('/v2/checkout/orders', {
    body: {
      intent: 'AUTHORIZE',
      purchase_units: [
        {
          reference_id: String(wishId),
          custom_id: String(wishId),
          description: description.slice(0, 127),
          amount: money(amount),
        },
      ],
      application_context: { brand_name: 'WaitForIt', user_action: 'CONTINUE' },
    },
    requestId: `order-${wishId}-${Date.now()}`,
  });
  return { orderId: order.id };
}

/** Step 2: after the buyer approves, turn the order into a hold on their account. */
async function authorizeOrder(orderId) {
  const order = await request(`/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, { body: {}, requestId: `auth-${orderId}` });
  const unit = order.purchase_units?.[0] ?? {};
  const auth = unit.payments?.authorizations?.[0];
  if (!auth?.id) throw new HttpError(502, 'PayPal did not confirm the hold. Please try again.');
  const address = unit.shipping?.address;
  return {
    authorizationId: auth.id,
    held: Number(auth.amount?.value),
    status: auth.status,
    expiresAt: auth.expiration_time ? new Date(auth.expiration_time) : null,
    shipTo: address ? [address.admin_area_2, address.admin_area_1].filter(Boolean).join(', ') : '',
    referenceId: unit.reference_id,
  };
}

/** Step 3: take only the real price. final_capture releases whatever is left of the hold. */
async function captureHold({ authorizationId, amount, wishId, note }) {
  const capture = await request(`/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`, {
    body: { amount: money(amount), final_capture: true, invoice_id: `waitforit-${wishId}`, note_to_payer: note.slice(0, 255) },
    requestId: `capture-${wishId}`,
  });
  return { captureId: capture.id, status: capture.status };
}

/** Cancel: release the whole hold. */
async function voidHold(authorizationId) {
  await request(`/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`, { requestId: `void-${authorizationId}` });
}

/** Undo: refund the full captured amount back to the buyer. */
async function refundCapture({ captureId, wishId, note }) {
  const refund = await request(`/v2/payments/captures/${encodeURIComponent(captureId)}/refund`, {
    body: { note_to_payer: note.slice(0, 255) },
    requestId: `refund-${wishId}`,
  });
  return { refundId: refund.id, status: refund.status };
}

const configured = () => Boolean(env.paypal.clientId && env.paypal.secret);

module.exports = { createHoldOrder, authorizeOrder, captureHold, voidHold, refundCapture, configured, _reset: () => (cachedToken = null) };
