const express = require('express');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const { requireAuth } = require('./middleware/auth');
const auth = require('./controllers/authController');
const wishes = require('./controllers/wishController');

const router = express.Router();

const limiter = (limit, message) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: env.isTest ? 1000 : limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => req.userId ?? rateLimit.ipKeyGenerator(req.ip),
    message: { message },
  });

// Slows down password guessing.
const authLimiter = limiter(30, 'Too many attempts. Please wait a few minutes and try again.');
// Each new wish uses one product search from a shared free monthly quota.
const searchLimiter = limiter(15, 'You have made a lot of wishes in a short time. Please wait a few minutes.');
const agentLimiter = limiter(60, 'You have asked the agent a lot in a short time. Please wait a few minutes.');

router.get('/health', (req, res) => res.json({ ok: true }));

// Public settings the website needs: the PayPal client id is meant to be public.
router.get('/config', (req, res) =>
  res.json({ paypalClientId: env.paypal.clientId, currency: env.paypal.currency, demoTools: env.demoTools }),
);

router.post('/auth/register', authLimiter, auth.register);
router.post('/auth/login', authLimiter, auth.login);

// Everything below needs a signed-in user.
router.use(requireAuth);

router.get('/auth/me', auth.me);
router.delete('/auth/me', auth.deleteAccount);

router.get('/wishes', wishes.list);
router.get('/wishes/stats', wishes.stats);
router.post('/wishes', searchLimiter, wishes.create);
router.get('/wishes/:id', wishes.get);
router.delete('/wishes/:id', wishes.remove);
router.post('/wishes/:id/choose', wishes.choose);
router.post('/wishes/:id/paypal/order', wishes.createOrder);
router.post('/wishes/:id/paypal/authorize', agentLimiter, wishes.authorize);
router.post('/wishes/:id/check', agentLimiter, wishes.check);
router.post('/wishes/:id/simulate-drop', agentLimiter, wishes.simulateDrop);
router.post('/wishes/:id/cancel', wishes.cancel);

module.exports = router;
