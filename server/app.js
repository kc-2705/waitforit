const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errors');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || env.clientOrigins.includes(origin)),
    }),
  );
  // Gzip JSON responses (a wish with its candidates and journal shrinks to about a quarter).
  app.use(compression());
  app.use(express.json({ limit: '100kb' }));
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));
  // API answers are personal data: never stored by browsers or proxies. Public routes opt in to caching.
  app.use((req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    next();
  });

  app.use('/api/v1', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
