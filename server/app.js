const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
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
  app.use(express.json({ limit: '100kb' }));
  if (!env.isTest) app.use(morgan(env.isProd ? 'combined' : 'dev'));

  app.use('/api/v1', routes);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
