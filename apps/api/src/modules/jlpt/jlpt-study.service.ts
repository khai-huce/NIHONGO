import type { Prisma, PrismaClient, JlptAttempt } from '@prisma/client';
import { studyStreak, vietnamStudyDate } from '@nihongo/shared/study/default-roadmap';
import type { JlptAttemptView, JlptLevel, JlptQuestion, JlptRoadmapView, JlptStudy } from '@nihongo/shared/contracts/jlpt';
import { HttpError } from '../../common/errors.js';
import { publicJlpt, sessionsFor, jlptTransactionOptions } from './jlpt.service.js';

const missing = () => new HttpError(404, 'JLPT_ATTEMPT_NOT_FOUND', 'Không tìm thấy lượt kiểm tra.');
const changed = () => new HttpError(409, 'JLPT_STUDY_CHANGED', 'Đề hoặc tiến độ đã thay đổi. Vui lòng tải lại; đáp án đang nhập được giữ.');
export async function accountLock(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtextextended(${`jlpt-study:${userId}`}, 0))`;
  if (!await tx.user.findUnique({ where: { id: userId }, select: { id: true } })) throw new HttpError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập lại.');
}
async function access(tx: Prisma.TransactionClient, userId: string, level: JlptLevel, sessionId: string, publishedVersion: number) {
  const roadmap = await publicJlpt(tx, level);
  if (roadmap.publishedVersion !== publishedVersion) throw changed();
  const index = roadmap.sessions.findIndex(s => s.id === sessionId);
  if (index < 0) throw missing();
  const completed = await tx.jlptSessionProgress.findMany({ where: { userId, sessionId: { in: roadmap.sessions.map(s => s.id) }, completedAt: { not: null } } });
  const done = new Set(completed.map(p => p.sessionId));
  // A preserved completion stays accessible after editorial reordering. Other sessions require every predecessor.
  if (!done.has(sessionId) && roadmap.sessions.slice(0, index).some(s => !done.has(s.id))) throw new HttpError(403, 'JLPT_LOCKED', 'Hãy đạt bài kiểm tra của các buổi trước để mở buổi này.');
  return roadmap;
}
async function remember(tx: Prisma.TransactionClient, userId: string, roadmapId: string, sessionId: string) {
  await tx.jlptEnrollment.upsert({ where: { userId_roadmapId: { userId, roadmapId } }, create: { userId, roadmapId, lastSessionId: sessionId }, update: { lastSessionId: sessionId } });
}
export async function jlptStudy(tx: Prisma.TransactionClient, userId: string, roadmap: JlptRoadmapView): Promise<JlptStudy> {
  const [progress, enrollment, attempts, known] = await Promise.all([
    tx.jlptSessionProgress.findMany({ where: { userId, session: { roadmapId: roadmap.id } } }),
    tx.jlptEnrollment.findUnique({ where: { userId_roadmapId: { userId, roadmapId: roadmap.id } } }),
    tx.jlptAttempt.findMany({ where: { userId, roadmapId: roadmap.id }, orderBy: { startedAt: 'desc' }, select: { id: true, sessionId: true, submittedAt: true, publishedVersion: true } }),
    tx.kanjiProgress.count({ where: { userId, kanjiId: { in: [...new Set(roadmap.sessions.flatMap(s => s.resources.filter(r => r.kind === 'kanji').map(r => r.targetId)))] } } }),
  ]);
  const byId = new Map(progress.map(p => [p.sessionId, p])); let previousDone = true;
  const sessions = roadmap.sessions.map(s => {
    const p = byId.get(s.id), completed = !!p?.completedAt, unlocked = previousDone || completed;
    previousDone = previousDone && completed;
    return { id: s.id, unlocked, completedAt: p?.completedAt?.toISOString() ?? null, bestScore: p?.bestScore ?? null, attempts: p?.attempts ?? 0,
      activeAttemptId: attempts.find(a => a.sessionId === s.id && !a.submittedAt && a.publishedVersion === roadmap.publishedVersion)?.id ?? null,
      latestAttemptId: attempts.find(a => a.sessionId === s.id && a.submittedAt)?.id ?? null };
  });
  const completedCount = sessions.filter(s => s.completedAt).length;
  return { userId, roadmapId: roadmap.id, lastSessionId: enrollment?.lastSessionId ?? null,
    resumeSessionId: sessions.find(s => s.unlocked && !s.completedAt)?.id ?? sessions.at(-1)?.id ?? null,
    completedCount, percent: roadmap.sessionCount ? Math.round(completedCount * 100 / roadmap.sessionCount) : 0, kanjiLearned: known,
    streak: studyStreak([...new Set(attempts.filter(a => a.submittedAt).map(a => vietnamStudyDate(a.submittedAt!)))], new Date()), sessions };
}
export function attemptView(row: JlptAttempt): JlptAttemptView {
  const questions = row.questions as unknown as JlptQuestion[];
  return { id: row.id, sessionId: row.sessionId, sessionTitle: row.sessionTitle, level: row.level as JlptLevel, publishedVersion: row.publishedVersion,
    version: row.version, passPercent: row.passPercent, questions: questions.map(q => row.submittedAt ? q : { id: q.id, prompt: q.prompt, passage: q.passage, options: q.options }),
    answers: row.answers as Record<string, number>, startedAt: row.startedAt.toISOString(), submittedAt: row.submittedAt?.toISOString() ?? null,
    correctCount: row.correctCount, score: row.score, passed: row.passed };
}
export async function openJlptSession(db: PrismaClient, userId: string, level: JlptLevel, sessionId: string, version: number) {
  return db.$transaction(async tx => { await accountLock(tx, userId); const roadmap = await access(tx, userId, level, sessionId, version);
    await remember(tx, userId, roadmap.id, sessionId); return jlptStudy(tx, userId, roadmap); }, jlptTransactionOptions);
}
export async function startJlptAttempt(db: PrismaClient, userId: string, level: JlptLevel, sessionId: string, version: number, id: string) {
  return db.$transaction(async tx => {
    await accountLock(tx, userId); const roadmap = await access(tx, userId, level, sessionId, version);
    const existing = await tx.jlptAttempt.findUnique({ where: { id } });
    if (existing) { if (existing.userId !== userId || existing.sessionId !== sessionId) throw missing(); if (existing.publishedVersion !== version) throw changed(); return attemptView(existing); }
    const active = await tx.jlptAttempt.findFirst({ where: { userId, sessionId, publishedVersion: version, submittedAt: null }, orderBy: { startedAt: 'desc' } });
    if (active) return attemptView(active);
    const session = (await sessionsFor(tx, roadmap.id, 'published')).find(s => s.id === sessionId)!;
    if (!session.questions || session.questions.length < 5) throw new HttpError(409, 'JLPT_TEST_MISSING', 'Buổi này chưa có đề kiểm tra được xuất bản.');
    await remember(tx, userId, roadmap.id, sessionId);
    await tx.jlptAttempt.createMany({ data: [{ id, userId, sessionId, roadmapId: roadmap.id, sessionTitle: session.title, level,
      publishedVersion: version, passPercent: roadmap.passPercent, questions: session.questions as unknown as Prisma.InputJsonArray }], skipDuplicates: true });
    const row = await tx.jlptAttempt.findUniqueOrThrow({ where: { id } });
    if (row.userId !== userId || row.sessionId !== sessionId) throw missing();
    if (row.publishedVersion !== version) throw changed();
    return attemptView(row);
  }, jlptTransactionOptions);
}
export async function writeJlptAttempt(db: PrismaClient, userId: string, id: string, version: number, answers: Record<string, number>, submit: boolean) {
  return db.$transaction(async tx => {
    await accountLock(tx, userId);
    const row = await tx.jlptAttempt.findUnique({ where: { id } });
    if (!row || row.userId !== userId) throw missing();
    const questions = row.questions as unknown as JlptQuestion[];
    const ids = new Set(questions.map(q => q.id));
    if (Object.keys(answers).some(key => !ids.has(key))) throw new HttpError(400, 'JLPT_ANSWERS_INVALID', 'Câu trả lời không thuộc lượt kiểm tra.');
    const sameAnswers = (a: Record<string, number>, b: Record<string, number>) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(key => a[key] === b[key]);
    if (row.submittedAt) {
      if (sameAnswers(answers, row.answers as Record<string, number>)) return attemptView(row);
      throw changed();
    }
    const roadmap = await access(tx, userId, row.level as JlptLevel, row.sessionId, row.publishedVersion);
    if (row.version !== version) {
      if (!submit && sameAnswers(answers, row.answers as Record<string, number>)) return attemptView(row);
      throw changed();
    }
    if (submit && questions.some(q => answers[q.id] === undefined)) throw new HttpError(400, 'JLPT_INCOMPLETE', 'Hãy trả lời đủ câu hỏi trước khi nộp.');
    const correct = questions.filter(q => answers[q.id] === q.correctIndex).length;
    const score = correct * 100 / questions.length, passed = correct * 100 >= row.passPercent * questions.length;
    const now = new Date();
    const saved = await tx.jlptAttempt.update({ where: { id }, data: { answers, version: { increment: 1 },
      ...(submit ? { submittedAt: now, correctCount: correct, score, passed } : {}) } });
    if (submit) {
      const before = await tx.jlptSessionProgress.findUnique({ where: { userId_sessionId: { userId, sessionId: row.sessionId } } });
      await tx.jlptSessionProgress.upsert({ where: { userId_sessionId: { userId, sessionId: row.sessionId } },
        create: { userId, sessionId: row.sessionId, bestScore: score, attempts: 1, completedAt: passed ? now : null },
        update: { bestScore: Math.max(before?.bestScore ?? 0, score), attempts: { increment: 1 }, completedAt: before?.completedAt ?? (passed ? now : null) } });
      await remember(tx, userId, roadmap.id, row.sessionId);
    }
    return attemptView(saved);
  }, jlptTransactionOptions);
}
