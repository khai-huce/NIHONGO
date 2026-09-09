import express from 'express';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import type { Config } from './config.js';
import { errorHandler, HttpError } from './errors.js';
import { createSession } from './session.js';
import { authRoutes } from './auth.routes.js';
import { progressRoutes } from './progress.routes.js';
import { reviewRoutes } from './review.routes.js';

export function createApp(config: Config) {
  const db = new PrismaClient({ datasources: { db: { url: config.DATABASE_URL } } });
  const pool = new pg.Pool({ connectionString: config.DATABASE_URL, max: 5, connectionTimeoutMillis: 5000 });
  pool.on('error', () => console.error('PostgreSQL pool unavailable'));
  const { middleware, store } = createSession(config, pool);
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.get('/api/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('origin') !== config.APP_ORIGIN) throw new HttpError(403, 'INVALID_ORIGIN', 'Nguồn yêu cầu không được phép.');
      if (!req.is('application/json')) throw new HttpError(415, 'JSON_REQUIRED', 'API yêu cầu application/json.');
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/auth', middleware, authRoutes(config, db, pool));
  app.use('/api/progress', middleware, progressRoutes(db));
  app.use('/api/review', middleware, reviewRoutes(db));
  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'API không tồn tại.')));
  app.use(errorHandler);

  return {
    app, db, pool,
    async close() { store.close(); await Promise.all([db.$disconnect(), pool.end()]); },
  };
}
