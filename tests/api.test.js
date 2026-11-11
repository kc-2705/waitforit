process.env.JWT_SECRET = 'test-secret';
process.env.NODE_ENV = 'test';
process.env.GROQ_API_KEY = 'test-key';
process.env.CHANNEL3_API_KEY = 'test-key';
process.env.PAYPAL_CLIENT_ID = 'test-client';
process.env.PAYPAL_CLIENT_SECRET = 'test-secret';

const { describe, test, before, after, beforeEach } = require('node:test');
const { expect } = require('expect');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { createApp } = require('../server/app');
const { connectDb, disconnectDb } = require('../server/config/db');
const { toProduct } = require('../server/services/channel3');
const Wish = require('../server/models/Wish');

// ---------------------------------------------------------------- Fakes for the three outside services

const realFetch = global.fetch;
const world = {};

function resetWorld() {
  Object.assign(world, {
    plan: { query: 'noise cancelling headphones', summary: 'Noise-cancelling headphones from Sony.', maxPrice: 150, brands: ['Sony'], mustHave: [], avoid: [], condition: 'new', isProduct: true },
    // Product in the catalog: its lowest new, in-stock price is what the agent watches.
    products: {
      sony: { id: 'sony', title: 'Sony WH-1000XM5', brands: [{ name: 'Sony' }], images: [{ url: 'https://img/sony.png', is_main_image: true }], key_features: ['ANC'], offers: [offer('bestbuy.com', 179), offer('resale.com', 120, { condition: 'used' })] },
      case: { id: 'case', title: 'Hard case for Sony WH-1000XM5', brands: [{ name: 'Generic' }], images: [], offers: [offer('cases.com', 19)] },
    },
    decision: { action: 'buy', reason: 'Same headphones, new and in stock.' },
    advice: { verdict: 'stretch', suggestedPrice: 160, message: 'The lowest price is $179; $150 needs a bigger sale than usual.' },
    captureFails: false,
    expires: undefined,
    calls: { ai: [], search: 0, product: 0, paypal: [] },
  });
}

function offer(domain, price, extra = {}) {
  return { domain, url: `https://${domain}/item`, price: { price, currency: 'USD' }, availability: 'InStock', condition: 'new', ...extra };
}

const json = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));

function fakeFetch(url, options = {}) {
  url = String(url);
  const body = options.body && typeof options.body === 'string' && options.body.startsWith('{') ? JSON.parse(options.body) : null;

  if (url.includes('/chat/completions')) {
    const name = body.response_format.json_schema.name;
    world.calls.ai.push(name);
    let content;
    if (name === 'wish_plan') content = world.plan;
    else if (name === 'ranking') {
      world.rankPrompt = body.messages[1].content;
      const lines = body.messages[1].content.split('Products:\n')[1].split('\n');
      content = { items: lines.map((l, index) => ({ index, fit: /case/i.test(l) ? 5 : 92, reason: /case/i.test(l) ? 'An accessory, not headphones.' : 'The model you asked for.' })) };
    } else if (name === 'price_advice') content = world.advice;
    else content = world.decision;
    return json({ choices: [{ message: { content: JSON.stringify(content) } }] });
  }

  if (url.includes('trychannel3.com/v1/search')) {
    world.calls.search++;
    return json({ products: Object.values(world.products) });
  }
  const productMatch = url.match(/trychannel3\.com\/v1\/products\/([^?]+)/);
  if (productMatch) {
    world.calls.product++;
    const p = world.products[decodeURIComponent(productMatch[1])];
    return p ? json(p) : json({ detail: 'not found' }, 404);
  }

  if (url.includes('paypal.com')) {
    const path = new URL(url).pathname;
    world.calls.paypal.push({ path, body, requestId: options.headers?.['PayPal-Request-Id'] });
    if (path === '/v1/oauth2/token') return json({ access_token: 'tok', expires_in: 3600 });
    if (path === '/v2/checkout/orders') return json({ id: `ORDER-${world.calls.paypal.length}`, status: 'CREATED' }, 201);
    const auth = path.match(/^\/v2\/checkout\/orders\/([^/]+)\/authorize$/);
    if (auth) {
      const created = world.calls.paypal.find((c) => c.path === '/v2/checkout/orders');
      return json({
        id: auth[1],
        status: 'COMPLETED',
        purchase_units: [{ reference_id: created.body.purchase_units[0].reference_id, shipping: { address: { admin_area_2: 'Austin', admin_area_1: 'TX' } }, payments: { authorizations: [{ id: 'AUTH-1', status: 'CREATED', amount: created.body.purchase_units[0].amount, expiration_time: world.expires ?? new Date(Date.now() + 29 * 864e5).toISOString() }] } }],
      }, 201);
    }
    if (/\/capture$/.test(path)) {
      if (world.captureFails) return json({ name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'AUTHORIZATION_EXPIRED' }] }, 422);
      return json({ id: 'CAPTURE-1', status: 'COMPLETED' }, 201);
    }
    if (/\/void$/.test(path)) return Promise.resolve(new Response(null, { status: 204 }));
    if (/\/captures\/[^/]+\/refund$/.test(path)) return json({ id: 'REFUND-1', status: 'COMPLETED' }, 201);
  }
  return realFetch(url, options);
}

// ---------------------------------------------------------------- Helpers

let mongo;
let app;
let token;

const auth = (r, t = token) => r.set('Authorization', `Bearer ${t}`);
async function signUp(email = 'shopper@example.com') {
  const res = await request(app).post('/api/v1/auth/register').send({ name: 'Shopper', email, password: 'password123' });
  return res.body.token;
}
const paypalCalls = (re) => world.calls.paypal.filter((c) => re.test(c.path));

/** Wish → choose Sony → PayPal hold approved. Returns the watched wish. */
async function watchedWish({ text = 'Sony noise cancelling headphones under $150', mode } = {}) {
  const created = await auth(request(app).post('/api/v1/wishes')).send({ text, mode }).expect(201);
  const id = created.body.wish._id;
  await auth(request(app).post(`/api/v1/wishes/${id}/choose`)).send({ productId: 'sony' }).expect(200);
  const { orderId } = (await auth(request(app).post(`/api/v1/wishes/${id}/paypal/order`)).expect(200)).body;
  const res = await auth(request(app).post(`/api/v1/wishes/${id}/paypal/authorize`)).send({ orderId }).expect(200);
  return res.body.wish;
}

before(async () => {
  global.fetch = fakeFetch;
  mongo = await MongoMemoryServer.create();
  await connectDb(mongo.getUri());
  app = createApp();
});

after(async () => {
  global.fetch = realFetch;
  await disconnectDb();
  await mongo.stop();
});

beforeEach(async () => {
  resetWorld();
  require('../server/services/paypal')._reset();
  await mongoose.connection.db.dropDatabase();
  token = await signUp();
});

// ---------------------------------------------------------------- Tests

describe('making a wish', () => {
  test('the AI reads the wish, searches once and drops accessories from the results', async () => {
    const res = await auth(request(app).post('/api/v1/wishes')).send({ text: 'Sony noise cancelling headphones under $150' });
    expect(res.status).toBe(201);
    expect(res.body.wish.maxPrice).toBe(150);
    expect(res.body.wish.status).toBe('choosing');
    expect(res.body.wish.candidates.map((c) => c.productId)).toEqual(['sony']);
    // The used $120 listing doesn't count when the wish asks for new.
    expect(res.body.wish.candidates[0].bestOffer.price).toBe(179);
    expect(world.calls.search).toBe(1);
    // Price is hidden from the ranking step, so waiting-for-a-drop products aren't marked down.
    expect(world.rankPrompt).not.toMatch(/\$\d/);
  });

  test('a price typed in the box wins over the one in the text', async () => {
    const res = await auth(request(app).post('/api/v1/wishes')).send({ text: 'Sony headphones under $150', maxPrice: 130 });
    expect(res.body.wish.maxPrice).toBe(130);
  });

  test('no price anywhere asks for one, and nothing is searched', async () => {
    world.plan.maxPrice = null;
    const res = await auth(request(app).post('/api/v1/wishes')).send({ text: 'Sony headphones' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/most you would pay/i);
    expect(world.calls.search).toBe(0);
  });

  test('things that are not products are refused politely', async () => {
    world.plan.isProduct = false;
    const res = await auth(request(app).post('/api/v1/wishes')).send({ text: 'a plumber for tomorrow under $100' });
    expect(res.status).toBe(422);
  });

  test('no search results is a clear message, and no empty wish is saved', async () => {
    world.products = {};
    const res = await auth(request(app).post('/api/v1/wishes')).send({ text: 'Sony headphones under $150' });
    expect(res.status).toBe(422);
    expect(await Wish.countDocuments()).toBe(0);
  });

  test('bad input is a 400', async () => {
    expect((await auth(request(app).post('/api/v1/wishes')).send({ text: 'x' })).status).toBe(400);
    expect((await auth(request(app).post('/api/v1/wishes')).send({ text: 'Sony headphones', maxPrice: -5 })).status).toBe(400);
    expect((await auth(request(app).post('/api/v1/wishes')).send({ text: 'Sony headphones', maxPrice: 50000 })).status).toBe(400);
    // A huge price inside the text is caught too, with a clear message.
    world.plan.maxPrice = 99999;
    const huge = await auth(request(app).post('/api/v1/wishes')).send({ text: 'iPhone case under $99999' });
    expect(huge.status).toBe(400);
    expect(huge.body.message).toMatch(/10,000/);
  });
});

describe('PayPal hold and buying', () => {
  test('full flow: hold $150, wait while it is $179, buy at $129, charge only $129', async () => {
    const wish = await watchedWish();
    expect(wish.status).toBe('watching');
    expect(wish.payment).toMatchObject({ status: 'held', held: 150, authorizationId: 'AUTH-1', shipTo: 'Austin, TX' });
    // The order asked PayPal to hold exactly the max price.
    expect(paypalCalls(/\/v2\/checkout\/orders$/)[0].body).toMatchObject({ intent: 'AUTHORIZE', purchase_units: [{ amount: { value: '150.00', currency_code: 'USD' } }] });
    // First look happened right away; $179 is above the hold, so no AI decision and no charge.
    expect(world.calls.ai).not.toContain('buy_decision');
    expect(paypalCalls(/capture$/)).toHaveLength(0);

    const res = await auth(request(app).post(`/api/v1/wishes/${wish._id}/simulate-drop`)).send({ price: 129 });
    expect(res.status).toBe(200);
    expect(res.body.wish.status).toBe('bought');
    expect(res.body.wish.payment).toMatchObject({ status: 'captured', paid: 129, released: 21 });
    expect(res.body.wish.purchase).toMatchObject({ price: 129, saved: 50, domain: 'bestbuy.com', simulated: true });

    const [capture] = paypalCalls(/capture$/);
    expect(capture.body).toMatchObject({ amount: { value: '129.00' }, final_capture: true });
    expect(capture.requestId).toBe(`capture-${wish._id}`);
  });

  test('if the AI sees a problem with the listing, it waits and charges nothing', async () => {
    const wish = await watchedWish();
    world.decision = { action: 'wait', reason: 'That listing looks like a different model.' };
    const res = await auth(request(app).post(`/api/v1/wishes/${wish._id}/simulate-drop`)).send({ price: 99 });
    expect(res.body.wish.status).toBe('watching');
    expect(res.body.wish.journal.at(-1).message).toMatch(/different model/);
    expect(paypalCalls(/capture$/)).toHaveLength(0);
  });

  test('a drop that is still above the hold is logged but nothing is bought', async () => {
    const wish = await watchedWish();
    const res = await auth(request(app).post(`/api/v1/wishes/${wish._id}/simulate-drop`)).send({ price: 160 });
    expect(res.body.wish.status).toBe('watching');
    expect(res.body.wish.journal.at(-1).message).toMatch(/\$160.*still above/i);
    expect(world.calls.ai).not.toContain('buy_decision');
  });

  test('if it is already a deal when the hold is approved, it buys right away', async () => {
    world.products.sony.offers = [offer('target.com', 140)];
    const wish = await watchedWish();
    expect(wish.status).toBe('bought');
    expect(wish.payment.paid).toBe(140);
  });

  test('two checks at the same moment can only buy once', async () => {
    const wish = await watchedWish();
    const results = await Promise.all([
      auth(request(app).post(`/api/v1/wishes/${wish._id}/simulate-drop`)).send({ price: 129 }),
      auth(request(app).post(`/api/v1/wishes/${wish._id}/simulate-drop`)).send({ price: 128 }),
    ]);
    expect(results.filter((r) => r.status === 200 && r.body.wish.status === 'bought').length).toBe(1);
    expect(paypalCalls(/capture$/)).toHaveLength(1);
  });

  test('if PayPal refuses the capture, the wish goes back to watching and says why', async () => {
    const wish = await watchedWish();
    world.captureFails = true;
    const res = await auth(request(app).post(`/api/v1/wishes/${wish._id}/simulate-drop`)).send({ price: 129 });
    expect(res.status).toBe(400);
    const saved = await Wish.findById(wish._id);
    expect(saved.status).toBe('watching');
    expect(saved.journal.at(-1).kind).toBe('error');
  });

  test('an expired hold stops the wish without charging', async () => {
    world.expires = new Date(Date.now() - 1000).toISOString();
    const wish = await watchedWish();
    expect(wish.status).toBe('expired');
    expect(paypalCalls(/capture$/)).toHaveLength(0);
  });

  test('a PayPal order from another wish cannot be used', async () => {
    const a = await auth(request(app).post('/api/v1/wishes')).send({ text: 'Sony headphones under $150' });
    await auth(request(app).post(`/api/v1/wishes/${a.body.wish._id}/choose`)).send({ productId: 'sony' });
    const res = await auth(request(app).post(`/api/v1/wishes/${a.body.wish._id}/paypal/authorize`)).send({ orderId: 'SOMEONE-ELSES' });
    expect(res.status).toBe(409);
  });

  test('a simulated "drop" must be lower than the current price', async () => {
    const wish = await watchedWish();
    expect((await auth(request(app).post(`/api/v1/wishes/${wish._id}/simulate-drop`)).send({ price: 500 })).status).toBe(400);
  });
});

describe('stopping and privacy', () => {
  test('cancel releases the PayPal hold; deleting while watching is refused', async () => {
    const wish = await watchedWish();
    expect((await auth(request(app).delete(`/api/v1/wishes/${wish._id}`))).status).toBe(409);
    const res = await auth(request(app).post(`/api/v1/wishes/${wish._id}/cancel`));
    expect(res.body.wish.status).toBe('cancelled');
    expect(res.body.wish.payment.status).toBe('voided');
    expect(paypalCalls(/AUTH-1\/void$/)).toHaveLength(1);
    expect((await auth(request(app).delete(`/api/v1/wishes/${wish._id}`))).status).toBe(204);
  });

  test("other users can't see or touch your wishes", async () => {
    const wish = await watchedWish();
    const other = await signUp('other@example.com');
    expect((await auth(request(app).get(`/api/v1/wishes/${wish._id}`), other)).status).toBe(404);
    expect((await auth(request(app).post(`/api/v1/wishes/${wish._id}/cancel`), other)).status).toBe(404);
    expect((await auth(request(app).get('/api/v1/wishes'), other)).body.wishes).toHaveLength(0);
  });

  test('deleting your account releases any PayPal holds first', async () => {
    await watchedWish();
    expect((await auth(request(app).delete('/api/v1/auth/me'))).status).toBe(204);
    expect(paypalCalls(/void$/)).toHaveLength(1);
    expect(await Wish.countDocuments()).toBe(0);
  });

  test('stats add up holds and savings', async () => {
    const w = await watchedWish();
    let stats = (await auth(request(app).get('/api/v1/wishes/stats'))).body;
    expect(stats).toMatchObject({ watching: 1, held: 150, bought: 0 });
    await auth(request(app).post(`/api/v1/wishes/${w._id}/simulate-drop`)).send({ price: 129 });
    stats = (await auth(request(app).get('/api/v1/wishes/stats'))).body;
    expect(stats).toMatchObject({ watching: 0, held: 0, bought: 1, saved: 50 });
  });

  test('wish routes need a login, and the public config has no secrets', async () => {
    expect((await request(app).get('/api/v1/wishes')).status).toBe(401);
    const config = (await request(app).get('/api/v1/config')).body;
    expect(config).toEqual({ paypalClientId: 'test-client', currency: 'USD', demoTools: true });
  });
});

describe('fair-price advice', () => {
  test('a new wish says whether the limit is realistic, using prices across stores', async () => {
    const res = await auth(request(app).post('/api/v1/wishes')).send({ text: 'Sony headphones under $150' });
    expect(res.body.wish.advice).toMatchObject({ verdict: 'stretch', suggestedPrice: 160, low: 179 });
    expect(res.body.wish.journal.map((e) => e.message)).toContain(world.advice.message);
  });

  test('when something already costs less than the limit, no AI call is needed', async () => {
    const res = await auth(request(app).post('/api/v1/wishes')).send({ text: 'Sony headphones under $200', maxPrice: 200 });
    expect(res.body.wish.advice.verdict).toBe('already_met');
    expect(world.calls.ai).not.toContain('price_advice');
  });

  test('if the advice answer is unusable, the wish still works without it', async () => {
    world.advice = { verdict: 'maybe', suggestedPrice: -1, message: '' };
    const res = await auth(request(app).post('/api/v1/wishes')).send({ text: 'Sony headphones under $150' });
    expect(res.status).toBe(201);
    expect(res.body.wish.advice?.verdict).toBeUndefined();
  });
});

describe('ask me first', () => {
  test('the agent finds the deal, waits for OK, and only charges after approval', async () => {
    const wish = await watchedWish({ mode: 'ask' });
    const found = await auth(request(app).post(`/api/v1/wishes/${wish._id}/simulate-drop`)).send({ price: 129 });
    expect(found.body.wish.status).toBe('awaiting_approval');
    expect(found.body.wish.pending).toMatchObject({ price: 129, domain: 'bestbuy.com' });
    expect(paypalCalls(/capture$/)).toHaveLength(0);

    const res = await auth(request(app).post(`/api/v1/wishes/${wish._id}/approve`));
    expect(res.status).toBe(200);
    expect(res.body.wish.status).toBe('bought');
    expect(res.body.wish.payment.paid).toBe(129);
    expect(paypalCalls(/capture$/)).toHaveLength(1);
  });

  test('saying no keeps watching, and approving twice is impossible', async () => {
    const wish = await watchedWish({ mode: 'ask' });
    await auth(request(app).post(`/api/v1/wishes/${wish._id}/simulate-drop`)).send({ price: 129 });
    const no = await auth(request(app).post(`/api/v1/wishes/${wish._id}/decline`));
    expect(no.body.wish.status).toBe('watching');
    expect((await auth(request(app).post(`/api/v1/wishes/${wish._id}/approve`))).status).toBe(409);
    expect(paypalCalls(/capture$/)).toHaveLength(0);
  });

  test('a waiting deal can be cancelled, which releases the hold', async () => {
    const wish = await watchedWish({ mode: 'ask' });
    await auth(request(app).post(`/api/v1/wishes/${wish._id}/simulate-drop`)).send({ price: 129 });
    const res = await auth(request(app).post(`/api/v1/wishes/${wish._id}/cancel`));
    expect(res.body.wish.status).toBe('cancelled');
    expect(paypalCalls(/void$/)).toHaveLength(1);
  });

  test('the mode can be switched while shopping, but not after buying', async () => {
    const wish = await watchedWish();
    const res = await auth(request(app).patch(`/api/v1/wishes/${wish._id}/mode`)).send({ mode: 'ask' });
    expect(res.body.wish.mode).toBe('ask');
    expect((await auth(request(app).patch(`/api/v1/wishes/${wish._id}/mode`)).send({ mode: 'sometimes' })).status).toBe(400);
    await auth(request(app).patch(`/api/v1/wishes/${wish._id}/mode`)).send({ mode: 'auto' });
    await auth(request(app).post(`/api/v1/wishes/${wish._id}/simulate-drop`)).send({ price: 129 });
    expect((await auth(request(app).patch(`/api/v1/wishes/${wish._id}/mode`)).send({ mode: 'ask' })).status).toBe(409);
  });
});

describe('undo a purchase', () => {
  async function boughtWish() {
    const wish = await watchedWish();
    return (await auth(request(app).post(`/api/v1/wishes/${wish._id}/simulate-drop`)).send({ price: 129 })).body.wish;
  }

  test('refunds the full amount through PayPal, once', async () => {
    const wish = await boughtWish();
    const res = await auth(request(app).post(`/api/v1/wishes/${wish._id}/refund`));
    expect(res.status).toBe(200);
    expect(res.body.wish.status).toBe('refunded');
    expect(res.body.wish.payment).toMatchObject({ status: 'refunded', refundId: 'REFUND-1' });
    const [call] = paypalCalls(/CAPTURE-1\/refund$/);
    expect(call.requestId).toBe(`refund-${wish._id}`);
    expect((await auth(request(app).post(`/api/v1/wishes/${wish._id}/refund`))).status).toBe(409);
    // A refunded purchase no longer counts as savings.
    expect((await auth(request(app).get('/api/v1/wishes/stats'))).body).toMatchObject({ bought: 0, saved: 0 });
  });

  test('undo is only offered for 24 hours', async () => {
    const wish = await boughtWish();
    await Wish.updateOne({ _id: wish._id }, { 'purchase.at': new Date(Date.now() - 25 * 3600_000) });
    const res = await auth(request(app).post(`/api/v1/wishes/${wish._id}/refund`));
    expect(res.status).toBe(409);
    expect(paypalCalls(/refund$/)).toHaveLength(0);
  });

  test('a wish that was never bought cannot be refunded', async () => {
    const wish = await watchedWish();
    expect((await auth(request(app).post(`/api/v1/wishes/${wish._id}/refund`))).status).toBe(409);
  });
});

describe('reading store data', () => {
  test('handles both price shapes and skips out-of-stock, used and foreign-currency listings', () => {
    const p = toProduct(
      {
        id: 'x',
        title: 'X',
        offers: [
          { domain: 'a.com', price: { amount: 90, currency: 'USD' }, availability: 'OutOfStock' },
          { domain: 'b.com', price: { price: 95, currency: 'EUR' }, availability: 'InStock' },
          { domain: 'c.com', price: { price: 80, currency: 'USD' }, availability: 'InStock', condition: 'refurbished' },
          { domain: 'd.com', price: { amount: '99.5', currency: 'usd' }, availability: 'InStock' },
        ],
      },
      'new',
    );
    expect(p.bestOffer).toMatchObject({ domain: 'd.com', price: 99.5 });
    expect(toProduct({ id: 'x', offers: [{ domain: 'c.com', price: { price: 80, currency: 'USD' }, availability: 'InStock', condition: 'refurbished' }] }, 'any').bestOffer.price).toBe(80);
  });
});
