const env = require('../config/env');
const { HttpError } = require('../middleware/errors');

// Channel3: one API for products and live prices across many stores.
// Search costs one credit (1,000 free a month). Looking up a product by id is free,
// which is what the price watcher uses.

async function call(path, { method = 'GET', body } = {}) {
  if (!env.channel3.apiKey) throw new HttpError(503, 'Product search is not set up yet. Add CHANNEL3_API_KEY to the .env file.');
  let res;
  try {
    res = await fetch(`${env.channel3.baseUrl}${path}`, {
      method,
      headers: { 'x-api-key': env.channel3.apiKey, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(env.channel3.timeoutMs),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError') throw new HttpError(504, 'The product search took too long. Please try again.');
    throw new HttpError(502, "Couldn't reach the product search. Please try again in a moment.");
  }
  if (res.status === 404) return null;
  if (res.status === 429) throw new HttpError(429, 'Product search is busy right now. Please wait a minute and try again.');
  if (!res.ok) {
    console.error(`Channel3 error ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`);
    throw new HttpError(502, 'The product search returned an error. Please try again.');
  }
  return res.json();
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** Channel3 offers, flattened. Price may be { price } or { amount } depending on the endpoint. */
function toOffer(o = {}) {
  const p = o.price ?? {};
  return {
    domain: o.domain || '',
    url: o.url || '',
    price: num(typeof p === 'object' ? (p.price ?? p.amount) : p),
    compareAt: num(p.compare_at_price),
    currency: (p.currency || 'USD').toUpperCase(),
    availability: o.availability || 'InStock',
    condition: o.condition || null,
  };
}

const IN_STOCK = new Set(['InStock', 'LimitedAvailability']);

/** Offers the agent is allowed to buy from: priced in dollars, in stock, and new when the wish asks for new. */
function eligibleOffers(offers, condition = 'new') {
  return offers.filter(
    (o) =>
      o.price > 0 &&
      o.currency === env.paypal.currency &&
      IN_STOCK.has(o.availability) &&
      (condition === 'any' || !o.condition || o.condition === 'new'),
  );
}

const cheapest = (offers) => offers.reduce((best, o) => (!best || o.price < best.price ? o : best), null);

function toProduct(p, condition) {
  const offers = (p.offers ?? []).map(toOffer);
  const image = (p.images ?? []).find((i) => i.is_main_image) ?? p.images?.[0];
  return {
    productId: p.id,
    title: p.title,
    brand: p.brands?.[0]?.name ?? p.brand_name ?? '',
    image: image ? image.cleaned_url || image.url : null,
    description: (p.description || '').slice(0, 300),
    features: (p.key_features ?? []).slice(0, 5),
    offers,
    bestOffer: cheapest(eligibleOffers(offers, condition)),
    offerCount: offers.length,
  };
}

/** Searches for products a little above the target price, so there is something worth waiting on. */
async function search(query, { maxPrice, condition = 'new', limit = 12 } = {}) {
  const data = await call('/v1/search', {
    method: 'POST',
    body: {
      query,
      limit,
      filters: {
        availability: ['InStock', 'LimitedAvailability'],
        ...(maxPrice ? { price: { max_price: Math.ceil(maxPrice * 1.6) } } : {}),
      },
    },
  });
  return (data?.products ?? []).map((p) => toProduct(p, condition)).filter((p) => p.productId && p.bestOffer);
}

/** Fresh offers for one product (free). Returns null if the product is gone. */
async function product(productId, condition = 'new') {
  const data = await call(`/v1/products/${encodeURIComponent(productId)}`);
  return data ? toProduct(data, condition) : null;
}

module.exports = { search, product, eligibleOffers, cheapest, toProduct };
