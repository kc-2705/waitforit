/**
 * Creates (or resets) the demo account with one finished example, so the dashboard isn't empty.
 *   node scripts/seed.js
 * The example is marked as a sample: it never touches PayPal.
 */
const bcrypt = require('bcryptjs');
const User = require('../server/models/User');
const Wish = require('../server/models/Wish');

const DEMO = { name: 'Demo Shopper', email: 'demo@waitforit.app', password: 'demo12345' };

const daysAgo = (d, h = 0) => new Date(Date.now() - (d * 24 + h) * 3600_000);

async function seedDemo() {
  let user = await User.findOne({ email: DEMO.email });
  if (!user) user = await User.create({ name: DEMO.name, email: DEMO.email, passwordHash: await bcrypt.hash(DEMO.password, 12) });
  await Wish.deleteMany({ user: user._id });

  const chosen = {
    productId: 'sample-kettle',
    title: 'Fellow Stagg EKG Electric Pour-Over Kettle',
    brand: 'Fellow',
    image: null,
    features: ['Variable temperature', '0.9 L', 'Hold mode for 60 minutes'],
    bestOffer: { domain: 'example-store.com', url: '', price: 165, currency: 'USD', availability: 'InStock', condition: 'new' },
    fit: 96,
    reason: 'Exactly the kettle you asked for, with temperature control.',
  };
  const prices = [165, 165, 159, 159, 149, 139].map((price, i) => ({ at: daysAgo(12 - i * 2), price, domain: 'example-store.com' }));

  await Wish.create({
    user: user._id,
    text: 'A gooseneck electric kettle with temperature control for pour-over coffee, under $140',
    plan: {
      query: 'gooseneck electric kettle temperature control',
      summary: 'A gooseneck electric kettle with temperature control for pour-over coffee.',
      brands: [],
      mustHave: ['gooseneck spout', 'temperature control'],
      avoid: [],
      condition: 'new',
    },
    maxPrice: 140,
    status: 'bought',
    candidates: [chosen],
    chosen,
    prices,
    payment: { orderId: 'SAMPLE', authorizationId: 'SAMPLE', held: 140, paid: 139, released: 1, captureId: 'SAMPLE', status: 'captured', sample: true },
    purchase: { at: daysAgo(2), price: 139, domain: 'example-store.com', url: '', saved: 26, reason: 'Same kettle you chose, new and in stock, at its lowest price in two weeks.' },
    lastCheckedAt: daysAgo(2),
    journal: [
      { at: daysAgo(12, 1), kind: 'think', message: 'Understood: A gooseneck electric kettle with temperature control for pour-over coffee.' },
      { at: daysAgo(12, 1), kind: 'search', message: 'Searched stores, looked at 12 products and kept the 4 best matches.' },
      { at: daysAgo(12), kind: 'pay', message: 'PayPal is holding $140. Nothing is charged until I find a deal.' },
      { at: daysAgo(8), kind: 'check', message: 'Lowest price is $159 at example-store.com. Still above your $140, so I’m waiting.' },
      { at: daysAgo(4), kind: 'check', message: 'Lowest price is $149 at example-store.com. Still above your $140, so I’m waiting.' },
      { at: daysAgo(2), kind: 'drop', message: 'Price dropped to $139 at example-store.com. Checking it’s the right item…' },
      { at: daysAgo(2), kind: 'buy', message: 'Bought it for $139. Same kettle you chose, new and in stock, at its lowest price in two weeks.' },
      { at: daysAgo(2), kind: 'pay', message: 'PayPal charged $139 and released the other $1 of your hold.' },
    ],
  });
  return user;
}

module.exports = { seedDemo, DEMO };

if (require.main === module) {
  const env = require('../server/config/env');
  const { connectDb, disconnectDb } = require('../server/config/db');
  connectDb(env.mongoUrl())
    .then(seedDemo)
    .then(() => console.log(`Demo account ready: ${DEMO.email} / ${DEMO.password}`))
    .catch((err) => console.error(err.message))
    .finally(disconnectDb);
}
