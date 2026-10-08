import type { Prisma, PrismaClient, ShadowingVideo } from '@prisma/client';
import type { ShadowingContent, ShadowingGrade, ShadowingStudy, ShadowingVideo as VideoDto } from '@nihongo/shared/contracts/shadowing';
import { HttpError } from '../../common/errors.js';

export type Client = PrismaClient | Prisma.TransactionClient;
export const missing = () => new HttpError(404, 'SHADOWING_NOT_FOUND', 'Không tìm thấy video học này.');
export const changed = () => new HttpError(409, 'SHADOWING_CHANGED', 'Video đã thay đổi. Vui lòng tải lại trước khi tiếp tục.');
export const studyChanged = () => new HttpError(409, 'SHADOWING_STUDY_CHANGED', 'Tiến độ đã thay đổi ở trang khác. Vui lòng tải lại.');
export const emptyStudy = (): ShadowingStudy => ({ version: 0, currentSentenceId: null, positionMs: 0, bookmarks: [], replayCounts: {}, grades: [] });
export const contentOf = (video: ShadowingVideo, admin = false) => (video.scope === 'library' && !admin ? video.publishedContent : video.content) as unknown as ShadowingContent;
export const versionOf = (video: ShadowingVideo, admin = false) => video.scope === 'library' && !admin ? video.publishedVersion! : video.version;
export function videoDto(video: ShadowingVideo, admin = false): VideoDto {
  const content = contentOf(video, admin);
  return { id: video.id, title: content.title, channel: content.channel, youtubeId: content.youtubeId, durationMs: content.durationMs,
    level: content.level, description: content.description, sentenceCount: content.sentences.length, scope: video.scope as 'library' | 'personal',
    status: video.archivedAt ? 'archived' : video.scope === 'personal' || video.publishedVersion !== null ? 'published' : 'draft',
    version: versionOf(video, admin), content, sourceId: video.scope === 'library' && !admin ? video.publishedSourceId : video.sourceId,
    publishedVersion: video.publishedVersion };
}
export async function readable(db: Client, id: string, userId: string | null): Promise<ShadowingVideo> {
  const video = await db.shadowingVideo.findUnique({ where: { id } });
  if (!video || video.archivedAt || (video.scope === 'personal' ? video.ownerId !== userId : video.publishedVersion === null || video.publishedContent === null)) throw missing();
  return video;
}
export async function readStudy(db: Client, userId: string, videoId: string): Promise<ShadowingStudy> {
  const [study, grades] = await Promise.all([
    db.shadowingStudy.findUnique({ where: { userId_videoId: { userId, videoId } } }),
    db.shadowingGrade.findMany({ where: { userId, videoId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }),
  ]);
  return { ...emptyStudy(), ...(study?.data as Record<string, unknown> ?? {}), version: study?.version ?? 0,
    grades: grades.map(grade => grade.result as unknown as ShadowingGrade) };
}
export async function lockStudy(tx: Prisma.TransactionClient, userId: string, videoId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`shadowing:${userId}:${videoId}`}, 0))`;
}
export async function lockVideo(tx: Prisma.TransactionClient, videoId: string) {
  // Publishers and learners share this row lock; stale transcript writes cannot cross publication.
  await tx.$queryRaw`SELECT id FROM shadowing_videos WHERE id = ${videoId}::uuid FOR UPDATE`;
}
export async function writeStudy(tx: Prisma.TransactionClient, userId: string, videoId: string, study: ShadowingStudy): Promise<void> {
  const { grades: _grades, version: _version, ...data } = study;
  await tx.shadowingStudy.upsert({ where: { userId_videoId: { userId, videoId } }, create: { userId, videoId, version: 1, data: data as Prisma.InputJsonValue },
    update: { version: { increment: 1 }, data: data as Prisma.InputJsonValue } });
}
