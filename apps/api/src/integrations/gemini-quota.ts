import type { Prisma } from '@prisma/client';
import type { Config } from '../config/env.js';
import { HttpError } from '../common/errors.js';

export async function lockGeminiQuota(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(261003, 3)`;
}

/** Called under lockGeminiQuota, in the same transaction as reserving a request. */
export async function assertGeminiQuota(tx: Prisma.TransactionClient, config: Config, userId: string) {
  const since = new Date(Date.now() - 86400000);
  const [personalGrammar, totalGrammar, personalSentence, totalSentence, personalShadowing, totalShadowing] = await Promise.all([
    tx.grammarAiRequest.count({ where: { userId, createdAt: { gte: since } } }),
    tx.grammarAiRequest.count({ where: { createdAt: { gte: since } } }),
    tx.sentenceAnalysisRequest.count({ where: { userId, createdAt: { gte: since } } }),
    tx.sentenceAnalysisRequest.count({ where: { createdAt: { gte: since } } }),
    tx.shadowingAiRequest.count({ where: { userId, createdAt: { gte: since } } }),
    tx.shadowingAiRequest.count({ where: { createdAt: { gte: since } } }),
  ]);
  if (personalGrammar + personalSentence + personalShadowing >= (config.GEMINI_DAILY_LIMIT ?? 20)
    || totalGrammar + totalSentence + totalShadowing >= (config.GEMINI_GLOBAL_DAILY_LIMIT ?? 100)) {
    throw new HttpError(429, 'AI_QUOTA', 'Đã đạt hạn mức Gemini trong 24 giờ của ứng dụng. Hãy thử lại sau; các chức năng không dùng AI vẫn hoạt động.');
  }
}

/** Reserve one video request under the common quota lock; its clips are one job. */
export async function assertShadowingQuota(tx: Prisma.TransactionClient, config: Config, userId: string) {
  await assertGeminiQuota(tx, config, userId);
  const since = new Date(Date.now() - 86400000);
  const [personal, global] = await Promise.all([
    tx.shadowingAiRequest.count({ where: { userId, createdAt: { gte: since } } }),
    tx.shadowingAiRequest.count({ where: { createdAt: { gte: since } } }),
  ]);
  if (personal >= 3 || global >= 10) {
    throw new HttpError(429, 'SHADOWING_AI_QUOTA', 'Đã đạt hạn mức tạo phụ đề: 3 video mỗi tài khoản và 10 video toàn ứng dụng trong 24 giờ. Hãy thử lại sau.');
  }
}
