const mongoose = require('mongoose');
const { z } = require('zod');
const Wish = require('../models/Wish');
const agent = require('../services/agent');
const paypal = require('../services/paypal');
const env = require('../config/env');
const { HttpError } = require('../middleware/errors');

const price = z.coerce.number('Enter a price.').positive('Price must be more than $0.').max(10000, 'The most a wish can hold is $10,000.');

const createSchema = z.object({
  text: z.string().trim().min(3, 'Tell me what you want to buy.').max(500, 'Please keep it under 500 characters.'),
  maxPrice: price.optional().nullable(),
});

async function findOwn(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(400, 'Invalid id.');
  const wish = await Wish.findOne({ _id: req.params.id, user: req.userId });
  if (!wish) throw new HttpError(404, 'Wish not found.');
  return wish;
}

async function list(req, res) {
  const wishes = await Wish.find({ user: req.userId }).sort({ updatedAt: -1 }).select('-candidates -journal').lean();
  res.json({ wishes });
}

async function stats(req, res) {
  const wishes = await Wish.find({ user: req.userId }).select('status payment purchase').lean();
  res.json({
    watching: wishes.filter((w) => w.status === 'watching').length,
    held: wishes.filter((w) => w.status === 'watching').reduce((s, w) => s + (w.payment?.held ?? 0), 0),
    bought: wishes.filter((w) => w.status === 'bought').length,
    saved: wishes.reduce((s, w) => s + (w.purchase?.saved ?? 0), 0),
  });
}

async function get(req, res) {
  res.json({ wish: await findOwn(req) });
}

async function create(req, res) {
  const { text, maxPrice } = createSchema.parse(req.body);
  const wish = await agent.startWish(req.userId, text, maxPrice ?? null);
  res.status(201).json({ wish });
}

async function choose(req, res) {
  const { productId } = z.object({ productId: z.string().min(1) }).parse(req.body);
  const wish = await findOwn(req);
  if (!['choosing', 'needs_payment'].includes(wish.status)) throw new HttpError(409, 'You can only change the product before the PayPal hold.');
  const pick = wish.candidates.find((c) => c.productId === productId);
  if (!pick) throw new HttpError(400, 'Pick one of the products I found.');
  wish.chosen = pick;
  wish.prices = [{ price: pick.bestOffer.price, domain: pick.bestOffer.domain }];
  wish.status = 'needs_payment';
  wish.payment = { status: 'none' };
  wish.log('think', `You picked ${pick.title}. Right now the lowest price is ${agent.usd(pick.bestOffer.price)} at ${pick.bestOffer.domain}.`);
  await wish.save();
  res.json({ wish });
}

async function createOrder(req, res) {
  const wish = await findOwn(req);
  if (wish.status !== 'needs_payment') throw new HttpError(409, 'Pick a product first.');
  const { orderId } = await paypal.createHoldOrder({
    wishId: wish._id,
    amount: wish.maxPrice,
    description: `WaitForIt hold: ${wish.chosen.title}`,
  });
  wish.payment = { orderId, held: wish.maxPrice, status: 'created' };
  await wish.save();
  res.json({ orderId });
}

async function authorize(req, res) {
  const { orderId } = z.object({ orderId: z.string().min(1) }).parse(req.body);
  const wish = await findOwn(req);
  if (wish.status !== 'needs_payment' || wish.payment.orderId !== orderId) throw new HttpError(409, 'That PayPal order does not belong to this wish.');
  const hold = await paypal.authorizeOrder(orderId);
  if (hold.referenceId && hold.referenceId !== String(wish._id)) throw new HttpError(409, 'That PayPal order does not belong to this wish.');
  Object.assign(wish.payment, { ...hold, status: 'held' });
  wish.status = 'watching';
  wish.log('pay', `PayPal is holding ${agent.usd(hold.held)}. Nothing is charged until I find a deal, and I can never spend more than that.`);
  await wish.save();

  // Maybe it's already a deal: look once right away.
  let result = wish;
  try {
    result = await agent.check(wish);
  } catch (err) {
    console.error(`First check failed: ${err.message}`);
  }
  res.json({ wish: result });
}

async function check(req, res) {
  const wish = await findOwn(req);
  res.json({ wish: await agent.check(wish) });
}

async function simulateDrop(req, res) {
  if (!env.demoTools) throw new HttpError(404, 'Demo tools are turned off.');
  const wish = await findOwn(req);
  const current = wish.prices.at(-1)?.price;
  const { price: newPrice } = z.object({ price }).parse(req.body);
  if (current && newPrice >= current) throw new HttpError(400, `A drop has to be lower than the current ${agent.usd(current)}.`);
  res.json({ wish: await agent.check(wish, { simulatedPrice: Math.round(newPrice * 100) / 100 }) });
}

async function cancel(req, res) {
  const wish = await findOwn(req);
  if (['bought', 'buying'].includes(wish.status)) throw new HttpError(409, 'This wish was already bought.');
  if (['cancelled', 'expired'].includes(wish.status)) return res.json({ wish });
  if (wish.payment.status === 'held' && !wish.payment.sample) {
    await paypal.voidHold(wish.payment.authorizationId);
    wish.payment.status = 'voided';
    wish.log('cancel', `Stopped watching and released your ${agent.usd(wish.payment.held)} PayPal hold. Nothing was charged.`);
  } else {
    wish.log('cancel', 'Stopped. Nothing was charged.');
  }
  wish.status = 'cancelled';
  await wish.save();
  res.json({ wish });
}

async function remove(req, res) {
  const wish = await findOwn(req);
  if (['watching', 'buying'].includes(wish.status)) throw new HttpError(409, 'Stop watching first, so your PayPal hold is released.');
  await wish.deleteOne();
  res.status(204).end();
}

module.exports = { list, stats, get, create, choose, createOrder, authorize, check, simulateDrop, cancel, remove };
