import { Router, json } from 'express';
import type { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { rateLimit } from 'express-rate-limit';
import { HttpError } from './errors.js';
import { grammarPatternSchema } from './grammar.schema.js';
import { lockPublishedGrammarPattern } from './grammar.service.js';
import { grammarAnswer, grammarRequestHash } from './grammar-study.engine.js';
import { evaluateGrammarAi, type GrammarFeedback } from './grammar-ai.js';
import type { Config } from './config.js';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const inputSchema = z.object({
  id: uuid, expectedUserId: uuid.nullable(), patternVersion: z.number().int().nonnegative(),
  progressVersion: z.number().int().nonnegative(), exerciseId: uuid,
  answer: z.union([z.string().trim().max(2000), z.array(z.number().int().min(0).max(3)).max(4)]),
}).strict();
const emptyProgress = () => ({ version: 0, completedAt: null, answers: {} });
const changed = () => new HttpError(409, 'GRAMMAR_CHANGED', 'Nội dung hoặc tiến độ đã đổi ở tab khác. Hãy tải lại trước khi tiếp tục.');
type Answer = Omit<ReturnType<typeof grammarAnswer>, 'action'> & { action: 'check' | 'reveal' | 'ai'; ai?: GrammarFeedback };
export function grammarStudyRoutes(db: PrismaClient, config: Config) {
  const router = Router();
  router.use(json({ limit: '16kb' }));
  router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.use(rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMITED', message: 'Bạn thao tác quá nhanh. Vui lòng đợi một phút.' } } }));
  const currentUser = async (id?: string) => id && await db.user.findUnique({ where: { id }, select: { id: true } }) ? id : null;
  router.get('/progress', async (req, res) => {
    const userId = await currentUser(req.session.userId);
    const rows = userId ? await db.grammarProgress.findMany({ where: { userId, completedAt: { not: null }, pattern: { active: true, lesson: { active: true, course: { archivedAt: null, publishedVersion: { not: null } } } } }, select: { patternId: true } }) : [];
    res.json({ userId, completedPatternIds: rows.map(row => row.patternId) });
  });
  router.get('/patterns/:id/progress', async (req, res) => {
    const id = uuid.parse(req.params.id), userId = await currentUser(req.session.userId);
    const progress = await db.$transaction(async tx => {
      await lockPublishedGrammarPattern(tx, id);
      return userId ? await tx.grammarProgress.findUnique({ where: { userId_patternId: { userId, patternId: id } } }) : null;
    });
    res.json({ userId, progress: progress ? { version: progress.version, completedAt: progress.completedAt, answers: progress.answers } : emptyProgress() });
  });
  for (const action of ['check', 'reveal', 'ai'] as const) router.post(`/patterns/:id/${action}`, async (req, res) => {
    const patternId = uuid.parse(req.params.id), input = inputSchema.parse(req.body), userId = await currentUser(req.session.userId);
    if (userId !== input.expectedUserId) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Vui lòng tải lại trang.');
    const hash = grammarRequestHash({ patternId, action, patternVersion: input.patternVersion, exerciseId: input.exerciseId, answer: input.answer });
    let ai: GrammarFeedback | undefined;
    if (action === 'ai') {
      if (!userId) throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để dùng Gemini.');
      const completed = await db.grammarAttempt.findUnique({ where: { id: input.id } });
      if (!completed) {
        const content = await db.$transaction(async tx => {
          const { pattern } = await lockPublishedGrammarPattern(tx, patternId);
          if (pattern.version !== input.patternVersion) throw changed();
          const progress = await tx.grammarProgress.findUnique({ where: { userId_patternId: { userId, patternId } } });
          if ((progress?.version ?? 0) !== input.progressVersion) throw changed();
          return grammarPatternSchema.parse(pattern.content);
        });
        const exercise = content.exercises.find(item => item.id === input.exerciseId);
        if (!exercise || exercise.kind === 'arrange') throw new HttpError(400, 'AI_EXERCISE_INVALID', 'Gemini chỉ chấm hai dạng dịch của mẫu câu này.');
        if (typeof input.answer !== 'string' || !input.answer.trim()) throw new HttpError(400, 'ANSWER_REQUIRED', 'Hãy nhập bản dịch trước khi nhờ Gemini chấm.');
        ai = await evaluateGrammarAi(db, config, { id: input.id, userId, patternId, exerciseId: input.exerciseId, patternVersion: input.patternVersion, requestHash: hash }, content, exercise, input.answer);
        // Network calls are outside transactions. Recheck the session before saving.
        await new Promise<void>((resolve, reject) => req.session.reload(error => error ? reject(new HttpError(401, 'UNAUTHENTICATED', 'Phiên đăng nhập đã kết thúc. Chưa lưu điểm.')) : resolve()));
        if (req.session.userId !== userId) throw new HttpError(409, 'ACCOUNT_CHANGED', 'Tài khoản đã đổi. Chưa lưu điểm.');
      }
    }
    const output = await db.$transaction(async tx => {
      const { pattern } = await lockPublishedGrammarPattern(tx, patternId);
      // Serialize all attempts for one account/pattern, including the first insert.
      if (userId) await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${userId + ':' + patternId}, 0))`;
      if (userId) {
        const previous = await tx.grammarAttempt.findUnique({ where: { id: input.id } });
        if (previous) {
          if (previous.userId !== userId || previous.patternId !== patternId || previous.requestHash !== hash) throw new HttpError(409, 'GRAMMAR_REQUEST_REUSED', 'Mã lần gửi đã được sử dụng cho nội dung khác.');
          const progress = await tx.grammarProgress.findUniqueOrThrow({ where: { userId_patternId: { userId, patternId } } });
          return { result: previous.result, progress: { version: progress.version, completedAt: progress.completedAt, answers: progress.answers } };
        }
      }
      if (pattern.version !== input.patternVersion) throw changed();
      const content = grammarPatternSchema.parse(pattern.content);
      const exercise = content.exercises.find(item => item.id === input.exerciseId);
      if (!exercise) throw new HttpError(404, 'EXERCISE_NOT_FOUND', 'Không tìm thấy bài tập trong mẫu câu này.');
      if (action !== 'reveal') {
        if (exercise.kind === 'arrange' ? !Array.isArray(input.answer) || input.answer.length !== 4 || new Set(input.answer).size !== 4 : typeof input.answer !== 'string' || !input.answer.trim()) {
          throw new HttpError(400, 'ANSWER_REQUIRED', exercise.kind === 'arrange' ? 'Hãy chọn đủ bốn cụm từ theo thứ tự.' : 'Hãy nhập bản dịch trước khi kiểm tra.');
        }
      }
      const result: Answer = grammarAnswer(exercise, input.answer, action === 'reveal' ? 'reveal' : 'check', pattern.version);
      if (action === 'ai') {
        if (!ai) throw new HttpError(502, 'AI_INVALID_RESPONSE', 'Chưa có kết quả Gemini hợp lệ.');
        result.action = 'ai'; result.correct = ai.verdict === 'correct'; result.ai = ai;
      }
      if (!userId) return { result, progress: emptyProgress() };
      const where = { userId_patternId: { userId, patternId } };
      const previous = await tx.grammarProgress.findUnique({ where });
      if ((previous?.version ?? 0) !== input.progressVersion) throw changed();
      const answers = { ...(previous?.answers as Record<string, Answer> ?? {}) };
      // The first checked or revealed answer is the score; later attempts are practice.
      if (!answers[exercise.id]) answers[exercise.id] = result;
      const completedAt = previous?.completedAt ?? (content.exercises.length > 0 && content.exercises.every(item => !!answers[item.id]) ? new Date() : null);
      const progress = await tx.grammarProgress.upsert({ where,
        create: { userId, patternId, version: 1, completedAt, answers: answers as Prisma.InputJsonValue },
        update: { version: { increment: 1 }, completedAt, answers: answers as Prisma.InputJsonValue },
      });
      await tx.grammarAttempt.create({ data: { id: input.id, userId, patternId, exerciseId: exercise.id, patternVersion: pattern.version, action, requestHash: hash, result } });
      return { result, progress: { version: progress.version, completedAt: progress.completedAt, answers: progress.answers } };
    });
    res.json({ userId, ...output });
  });
  return router;
}
