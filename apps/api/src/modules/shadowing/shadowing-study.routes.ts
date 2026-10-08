import type { Router } from 'express';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { HttpError } from '../../common/errors.js';
import { gradeShadowing, hash, uuid } from './shadowing-content.js';
import { changed, contentOf, lockStudy, lockVideo, readable, readStudy, studyChanged, versionOf, writeStudy } from './shadowing-store.js';
import { confirmShadowingAccount, shadowingAccount, shadowingUser, versionFields } from './shadowing.routes.js';

export function installShadowingStudy(router: Router, db: PrismaClient) {
  router.post('/:id/study', async (req, res) => {
    const userId = shadowingAccount(req, res), videoId = uuid.parse(req.params.id);
    const input = z.object({ ...versionFields, videoVersion: z.number().int().nonnegative(),
      currentSentenceId: uuid.nullable().optional(), positionMs: z.number().int().nonnegative().optional(),
      bookmark: z.object({ sentenceId: uuid, active: z.boolean() }).strict().optional(),
      replay: z.object({ sentenceId: uuid, requestId: uuid }).strict().optional(),
    }).strict().refine(value => value.currentSentenceId !== undefined || value.positionMs !== undefined || value.bookmark !== undefined || value.replay !== undefined, 'Chưa có thay đổi tiến độ.').parse(req.body);
    const requestHash = hash(input);
    await confirmShadowingAccount(req, res, db, userId);
    const result = await db.$transaction(async tx => {
      await lockVideo(tx, videoId);
      const video = await readable(tx, videoId, userId);
      await lockStudy(tx, userId, videoId);
      if (input.replay) {
        const prior = await tx.shadowingAttempt.findUnique({ where: { id: input.replay.requestId } });
        if (prior) {
          if (prior.userId !== userId || prior.videoId !== videoId || prior.action !== 'replay' || prior.requestHash !== requestHash) throw changed();
          return { userId, study: await readStudy(tx, userId, videoId) };
        }
      }
      if (versionOf(video) !== input.videoVersion) throw changed();
      const content = contentOf(video), sentenceIds = new Set(content.sentences.map(sentence => sentence.id));
      const referenced = [input.currentSentenceId, input.bookmark?.sentenceId, input.replay?.sentenceId].filter((id): id is string => !!id);
      if (referenced.some(id => !sentenceIds.has(id)) || (input.positionMs !== undefined && input.positionMs > content.durationMs)) {
        throw new HttpError(400, 'SHADOWING_POSITION', 'Câu hoặc thời điểm học không thuộc video hiện tại.');
      }
      const study = await readStudy(tx, userId, videoId);
      if (study.version !== input.version) throw studyChanged();
      if (input.currentSentenceId !== undefined) study.currentSentenceId = input.currentSentenceId;
      if (input.positionMs !== undefined) study.positionMs = input.positionMs;
      if (input.bookmark) {
        const bookmarks = new Set(study.bookmarks);
        if (input.bookmark.active) bookmarks.add(input.bookmark.sentenceId); else bookmarks.delete(input.bookmark.sentenceId);
        study.bookmarks = [...bookmarks];
      }
      if (input.replay) study.replayCounts[input.replay.sentenceId] = (study.replayCounts[input.replay.sentenceId] ?? 0) + 1;
      await writeStudy(tx, userId, videoId, study);
      const result = { userId, study: await readStudy(tx, userId, videoId) };
      if (input.replay) await tx.shadowingAttempt.create({ data: { id: input.replay.requestId, userId, videoId, action: 'replay', requestHash, result: { counted: true } } });
      return result;
    });
    res.json(result);
  });

  router.post('/:id/check', async (req, res) => {
    const user = shadowingUser(res), videoId = uuid.parse(req.params.id);
    if (user || req.body?.expectedUserId) shadowingAccount(req, res);
    const input = z.object({ expectedUserId: uuid.nullable().optional(), videoVersion: z.number().int().nonnegative(), requestId: uuid,
      sentenceId: uuid, mode: z.enum(['puzzle', 'typing']), answer: z.union([z.string().max(2000), z.array(z.number().int().nonnegative()).max(1000)]), hintsUsed: z.boolean(),
    }).strict().parse(req.body);
    const requestHash = hash(input);
    if (!user) {
      const video = await readable(db, videoId, null);
      if (versionOf(video) !== input.videoVersion) throw changed();
      const sentence = contentOf(video).sentences.find(sentence => sentence.id === input.sentenceId);
      if (!sentence) throw changed();
      res.json({ userId: null, study: null, grade: gradeShadowing(sentence, input.mode, input.answer, input.hintsUsed), firstGrade: false });
      return;
    }
    const userId = user.id;
    await confirmShadowingAccount(req, res, db, userId);
    const result = await db.$transaction(async tx => {
      await lockVideo(tx, videoId);
      const video = await readable(tx, videoId, userId);
      await lockStudy(tx, userId, videoId);
      const prior = await tx.shadowingAttempt.findUnique({ where: { id: input.requestId } });
      if (prior) {
        if (prior.userId !== userId || prior.videoId !== videoId || prior.action !== 'check' || prior.requestHash !== requestHash) throw changed();
        return { userId, study: await readStudy(tx, userId, videoId), ...(prior.result as Record<string, unknown>) };
      }
      if (versionOf(video) !== input.videoVersion) throw changed();
      const sentence = contentOf(video).sentences.find(sentence => sentence.id === input.sentenceId);
      if (!sentence) throw changed();
      const grade = gradeShadowing(sentence, input.mode, input.answer, input.hintsUsed);
      const created = await tx.shadowingGrade.createMany({ data: [{ userId, videoId, sentenceId: sentence.id, contentHash: grade.contentHash,
        mode: input.mode, result: grade as unknown as Prisma.InputJsonValue }], skipDuplicates: true });
      const study = await readStudy(tx, userId, videoId);
      study.currentSentenceId = sentence.id;
      await writeStudy(tx, userId, videoId, study);
      const result = { userId, study: await readStudy(tx, userId, videoId), grade, firstGrade: created.count > 0 };
      await tx.shadowingAttempt.create({ data: { id: input.requestId, userId, videoId, action: 'check', requestHash, result: { grade, firstGrade: result.firstGrade } as unknown as Prisma.InputJsonValue } });
      return result;
    });
    res.json(result);
  });
}
