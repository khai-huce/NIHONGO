import { notificationRoutes } from './modules/notifications/notifications.routes.js';
import express from 'express';
import helmet from 'helmet';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';
import type { Config } from './config/env.js';
import { errorHandler, HttpError } from './common/errors.js';
import { createSession } from './modules/auth/session.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { progressRoutes } from './modules/kanji/progress.routes.js';
import { reviewRoutes } from './modules/review/review.routes.js';
import { lessonRoutes } from './modules/vocabulary/lessons.routes.js';
import { vocabAiRoutes } from './modules/vocabulary/vocab-ai.routes.js';
import { vocabProgressRoutes } from './modules/vocabulary/vocab-progress.routes.js';
import { vocabResultsRoutes } from './modules/vocabulary/vocab-results.routes.js';
import { roadmapRoutes } from './modules/roadmaps/roadmaps.routes.js';
import { defaultRoadmapRoutes } from './modules/roadmaps/default-roadmaps.routes.js';
import { kanaResultsRoutes } from './modules/kana/kana-results.routes.js';
import { contentRoutes } from './modules/content/content.routes.js';
import { adminContentRoutes } from './modules/content/admin.content.routes.js';
import { readingRoutes } from './modules/reading/reading.routes.js';
import { readingAnalysisRoutes } from './modules/reading/reading-analysis.routes.js';
import { readingSupplementRoutes } from './modules/reading/reading-supplements.routes.js';
import { curriculumStudyRoutes } from './modules/curriculum/curriculum-study.routes.js';
import { curriculumRoutes } from './modules/curriculum/curriculum.routes.js';
import { grammarRoutes } from './modules/grammar/grammar.routes.js';
import { grammarStudyRoutes } from './modules/grammar/grammar-study.routes.js';
import { curriculumReviewRoutes, curriculumReviewPreviewRoutes } from './modules/curriculum/curriculum-review.routes.js';
import { leaderboardRoutes } from './modules/leaderboard/leaderboard.routes.js';
import { sentenceAnalysisRoutes } from './modules/sentence-analysis/sentence-analysis.routes.js';
import { pitchAccentRoutes } from './modules/pitch-accent/pitch.routes.js';
import { shadowingRoutes } from './modules/shadowing/shadowing.routes.js';
import { shadowingAiRoutes } from './modules/shadowing/shadowing-ai.routes.js';
import { jlptRoutes } from './modules/jlpt/jlpt.routes.js';
import { jlptStudyRoutes } from './modules/jlpt/jlpt-study.routes.js';
import { handwritingRoutes } from './modules/handwriting/handwriting.routes.js';
import { assistantRoutes } from './modules/assistant/assistant.routes.js';

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
      const origins = [config.APP_ORIGIN, config.ADMIN_ORIGIN].filter(Boolean);
      if (!origins.includes(req.get('origin'))) throw new HttpError(403, 'INVALID_ORIGIN', 'Nguồn yêu cầu không được phép.');
      if (!req.is('application/json')) throw new HttpError(415, 'JSON_REQUIRED', 'API yêu cầu application/json.');
    }
    next();
  });
  app.use('/api/vocab/lessons', middleware, lessonRoutes(db));
  app.use('/api/vocab/ai-format', middleware, vocabAiRoutes(db, config));
  const assistant = assistantRoutes(db, config);
  app.use('/api/assistant', middleware, assistant.router);
  app.use('/api/vocab/results', middleware, vocabResultsRoutes(db));
  app.use('/api/kana/results', middleware, kanaResultsRoutes(db));
  app.use('/api/content', contentRoutes(db));
  app.use('/api/handwriting', handwritingRoutes(db));
  app.use('/api/pitch-accent', pitchAccentRoutes(db));
  const shadowing = shadowingRoutes(db, config);
  const shadowingAi = shadowingAiRoutes(db, config);
  app.use('/api/shadowing/videos', middleware, shadowing.public);
  app.use('/api/admin/shadowing/videos', middleware, shadowing.admin);
  app.use('/api/shadowing/ai', middleware, shadowingAi.router);
  app.use('/api/admin/content', middleware, adminContentRoutes(db));
  const jlpt = jlptRoutes(db);
  app.use('/api/jlpt', jlpt.public);
  app.use('/api/jlpt/study', middleware, jlptStudyRoutes(db));
  app.use('/api/admin/jlpt', middleware, jlpt.admin);
  const reading = readingRoutes(db, { python: config.TTS_PYTHON, storageDir: config.TTS_STORAGE_DIR });
  app.use('/api/reading/articles', middleware, readingAnalysisRoutes(db, config));
  app.use('/api/reading/articles', middleware, readingSupplementRoutes(db, config));
  app.use('/api/reading/articles', middleware, reading.public);
  app.use('/api/admin/reading/articles', middleware, reading.admin);
  const curriculum = curriculumRoutes(db);
  app.use('/api/curriculum/courses', middleware, curriculumReviewPreviewRoutes(db));
  app.use('/api/curriculum/courses', middleware, curriculum.public);
  app.use('/api/admin/curriculum/courses', middleware, curriculum.admin);
  app.use('/api/curriculum/review-sets', middleware, curriculumReviewRoutes(db));
  app.use('/api/curriculum', middleware, curriculumStudyRoutes(db));
  const grammar = grammarRoutes(db);
  app.use('/api/grammar', middleware, grammar.public);
  app.use('/api/admin/grammar/courses', middleware, grammar.admin);
  app.use('/api/grammar', middleware, grammarStudyRoutes(db, config));
  app.use(express.json({ limit: '16kb' }));
  app.use('/api/auth', middleware, authRoutes(config, db, pool));
  app.use('/api/leaderboard', middleware, leaderboardRoutes(db));
  app.use('/api/sentence-analysis', middleware, sentenceAnalysisRoutes(db, config));
  app.use('/api/progress', middleware, progressRoutes(db));
  app.use('/api/vocab/progress', middleware, vocabProgressRoutes(db));
  app.use('/api/review', middleware, reviewRoutes(db));
  app.use('/api/notifications', middleware, notificationRoutes(db));
  app.use('/api/roadmaps/default', middleware, defaultRoadmapRoutes(db));
  app.use('/api/roadmaps', middleware, roadmapRoutes(db));
  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'API không tồn tại.')));
  app.use(errorHandler);

  return {
    app, db, pool,
    async close() { store.close(); assistant.close(); await shadowingAi.close(); await Promise.all([db.$disconnect(), pool.end()]); },
  };
}
