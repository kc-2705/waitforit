const bcrypt = require('bcryptjs');
const { z } = require('zod');
const User = require('../models/User');
const Wish = require('../models/Wish');
const paypal = require('../services/paypal');
const { signToken, forgetUser } = require('../middleware/auth');
const { HttpError } = require('../middleware/errors');

// Trim first: emails pasted from elsewhere often carry a stray space.
const email = z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.email('Enter a valid email address.'));
const password = z.string().min(8, 'Password must be at least 8 characters.').max(100);

const registerSchema = z.object({ name: z.string().trim().min(1, 'Name is required.').max(60), email, password });
const loginSchema = z.object({ email, password: z.string().min(1, 'Password is required.') });

const session = (user) => ({ token: signToken(user._id), user: user.toPublic() });

async function register(req, res) {
  const data = registerSchema.parse(req.body);
  if (await User.exists({ email: data.email })) throw new HttpError(409, 'An account with this email already exists.');
  const user = await User.create({ name: data.name, email: data.email, passwordHash: await bcrypt.hash(data.password, 12) });
  res.status(201).json(session(user));
}

async function login(req, res) {
  const data = loginSchema.parse(req.body);
  const user = await User.findOne({ email: data.email }).select('+passwordHash');
  // Same message for unknown email and wrong password, so attackers can't find out which emails exist.
  if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
    throw new HttpError(401, 'Email or password is incorrect.');
  }
  res.json(session(user));
}

async function me(req, res) {
  const user = await User.findById(req.userId);
  if (!user) throw new HttpError(401, 'Please log in.');
  res.json({ user: user.toPublic() });
}

async function deleteAccount(req, res) {
  // Release any PayPal holds first, so deleting an account never leaves money tied up.
  const held = await Wish.find({ user: req.userId, 'payment.status': 'held', 'payment.sample': { $ne: true } }).select('payment');
  for (const w of held) await paypal.voidHold(w.payment.authorizationId).catch((err) => console.error(`Void failed: ${err.message}`));
  await Promise.all([Wish.deleteMany({ user: req.userId }), User.deleteOne({ _id: req.userId })]);
  forgetUser(req.userId);
  res.status(204).end();
}

module.exports = { register, login, me, deleteAccount };
