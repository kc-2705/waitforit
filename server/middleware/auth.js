const jwt = require('jsonwebtoken');
const env = require('../config/env');
const User = require('../models/User');
const { HttpError } = require('./errors');
const { TtlCache } = require('../services/cache');

const knownUsers = new TtlCache({ ttlMs: 60_000, max: 5000 });
const forgetUser = (userId) => knownUsers.delete(String(userId));

function signToken(userId) {
  return jwt.sign({ sub: userId.toString() }, env.jwtSecret(), { expiresIn: env.jwtExpiresIn });
}

// Every data route goes through this. The user id comes from the signed token,
// never from the request body, so nobody can read or change another user's data.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please log in.');
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret());
  } catch {
    throw new HttpError(401, 'Your session has expired. Please log in again.');
  }
  // A token outlives a deleted account, so check the account still exists. The answer is remembered
  // for a minute (and forgotten at once when the account is deleted), which halves database reads.
  const exists = knownUsers.get(payload.sub) ?? Boolean(await User.exists({ _id: payload.sub }));
  if (!exists) throw new HttpError(401, 'Please log in.');
  knownUsers.set(payload.sub, true);
  req.userId = payload.sub;
  next();
}

module.exports = { signToken, requireAuth, forgetUser };
