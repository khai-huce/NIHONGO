import { Prisma, type PrismaClient } from '@prisma/client';
import { xpStudyDate } from '../leaderboard/leaderboard.service.js';
import type { AssistantSource } from './assistant-knowledge.js';

type Scope = 'review' | 'lessons' | 'roadmaps' | 'jlpt' | 'grammar' | 'curriculum' | 'kana' | 'reading' | 'shadowing' | 'xp';
const allScopes: Scope[] = ['review', 'lessons', 'roadmaps', 'jlpt', 'grammar', 'curriculum', 'kana', 'reading', 'shadowing', 'xp'];
const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

/** Current, explicit requests only. History/page never silently grants account access. */
export function assistantPersonalScopes(question: string): Scope[] {
  const q = normalize(question);
  const mine = /\b(cua (toi|minh|em|to)|tai khoan (toi|minh|em|nay)|my (progress|lessons|study|reviews|xp))\b/.test(q);
  const selfActivity = /\b(toi|minh|em|to)\b.*\b(da hoc|dang hoc|can on|phai on|con bao nhieu|duoc bao nhieu|hoc den dau|co bao nhieu|tien do|ket qua|xp)\b/.test(q);
  const dueQuestion = /\b(hom nay|bay gio)\b.*\b(can on|phai on|con.*the)\b|\b(can on|phai on)\b.*\b(hom nay|bay gio)\b/.test(q);
  // A how-to question is not a request to transmit lesson/progress data.
  if (/\b(cach|lam sao|huong dan|how (to|do)|tao.*nhu the nao)\b/.test(q) && !/\b(bao nhieu|hoc den dau|tom tat|thong ke|tong quan)\b/.test(q)) return [];
  // A direct request for today's study plan needs only review and JLPT summaries.
  const plan = /^(?:(?:hom nay|nay|bay gio) )?(?:toi|minh|em|to) (?:(?:chi )?co \d{1,3} phut[, ]+)?(?:nen hoc gi|nen on gi|hoc gi tiep|nen hoc bai nao|hoc tiep o dau)(?: (?:hom nay|bay gio|tiep theo|bay gio nhi|nhi|a))?[?!. ]*$/.test(q.trim());
  if (plan) return ['review', 'jlpt'];
  if (!mine && !selfActivity && !dueQuestion) return [];
  const scopes: Scope[] = [];
  if (/\b(on tap|can on|phai on|the|srs|review|ghi nho)\b/.test(q)) scopes.push('review');
  if (/\b(chu dong|so tay|bai rieng|tu vung|bai cua)\b/.test(q) && !/\b(giao trinh)\b/.test(q)) scopes.push('lessons');
  if (/\b(jlpt|buoi|n[1-5])\b/.test(q)) scopes.push('jlpt');
  if (/\b(lo trinh|kanji|han tu)\b/.test(q) && !scopes.includes('jlpt')) scopes.push('roadmaps');
  if (/\b(ngu phap|mau cau|grammar)\b/.test(q)) scopes.push('grammar');
  if (/\b(giao trinh)\b/.test(q) && !scopes.includes('grammar')) scopes.push('curriculum');
  if (/\b(kana|hiragana|katakana|bang chu cai)\b/.test(q)) scopes.push('kana');
  if (/\b(doc hieu|bai doc)\b/.test(q)) scopes.push('reading');
  if (/\b(shadowing|video|chep chinh ta)\b/.test(q)) scopes.push('shadowing');
  if (/\b(xp|xep hang|diem kinh nghiem)\b/.test(q)) scopes.push('xp');
  if (!scopes.length && /\b(tien do|thong ke|tong quan|tom tat|tinh hinh hoc|ket qua hoc|study progress)\b/.test(q)) return allScopes;
  return [...new Set(scopes)].slice(0, 6);
}

const headings: Record<Scope, [string, string]> = {
  review: ['Thẻ ôn của bạn', '/ca-nhan/on-tap'], lessons: ['Bài Chủ động của bạn', '/ca-nhan/chu-dong'],
  roadmaps: ['Lộ trình Kanji của bạn', '/ca-nhan/lo-trinh'], jlpt: ['Tiến độ JLPT của bạn', '/tron-doi/jlpt'],
  grammar: ['Tiến độ ngữ pháp của bạn', '/ngu-phap'], curriculum: ['Tiến độ giáo trình từ vựng của bạn', '/tu-vung/giao-trinh'],
  kana: ['Kết quả bảng chữ cái của bạn', '/tu-vung/bang-chu-cai'], reading: ['Bài đọc cá nhân của bạn', '/tron-doi/doc-hieu'],
  shadowing: ['Shadowing của bạn', '/tron-doi/shadowing'], xp: ['XP đã ghi nhận của bạn', '/xep-hang'],
};

export async function getAssistantPersonal(db: PrismaClient, userId: string, input: { question: string }): Promise<{ sources: AssistantSource[]; requested: boolean }> {
  const scopes = assistantPersonalScopes(input.question);
  if (!scopes.length) return { sources: [], requested: false };
  const now = new Date(), day = xpStudyDate(now);
  const sources = await db.$transaction(async tx => {
    const output: AssistantSource[] = [];
    for (const scope of scopes) {
      let data: unknown;
      if (scope === 'review') {
        const active = await tx.reviewCard.groupBy({ by: ['category'], where: { userId, active: true }, _count: true, orderBy: { category: 'asc' } });
        const due = await tx.reviewCard.groupBy({ by: ['category'], where: { userId, active: true, dueAt: { lte: now } }, _count: true, orderBy: { category: 'asc' } });
        const next = await tx.reviewCard.findFirst({ where: { userId, active: true, dueAt: { gt: now } }, orderBy: [{ dueAt: 'asc' }, { id: 'asc' }], select: { dueAt: true } });
        data = { ngayVietNam: day, dangGanSao: active.map(row => ({ loai: row.category, soThe: row._count })), denHan: due.map(row => ({ loai: row.category, soThe: row._count })), hanTiepTheo: next?.dueAt.toISOString() ?? null, luuY: 'Danh sách rỗng nghĩa là 0. Chỉ thẻ đang gắn sao mới được tính; không có dữ liệu mặt thẻ.' };
      } else if (scope === 'lessons') {
        const totals = await tx.$queryRaw<Array<{ lessons: bigint; words: bigint }>>`SELECT count(*) AS lessons, coalesce(sum(jsonb_array_length(words)),0)::bigint AS words FROM vocab_lessons WHERE user_id=${userId}::uuid`;
        const recent = await tx.$queryRaw<Array<{ name: string; words: number }>>`SELECT name,jsonb_array_length(words) AS words FROM vocab_lessons WHERE user_id=${userId}::uuid ORDER BY updated_at DESC,id LIMIT 10`;
        const assessed = await tx.vocabProgress.groupBy({ by: ['memorized'], where: { userId }, _count: true, orderBy: { memorized: 'asc' } });
        data = { tongBai: Number(totals[0].lessons), tongTu: Number(totals[0].words), toiDa10BaiMoiCapNhat: recent, flashcard: assessed.map(row => ({ daThuoc: row.memorized, soTu: row._count })), luuY: 'Chỉ thống kê và tên bài, không gửi toàn bộ từ hoặc kết quả quiz.' };
      } else if (scope === 'roadmaps') {
        const total = await tx.personalRoadmap.count({ where: { userId } });
        const roadmaps = await tx.personalRoadmap.findMany({ where: { userId }, take: 10, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], select: { name: true, kanjiList: true, perDay: true, completedDays: true, startedAt: true } });
        const defaults = await tx.defaultRoadmapProgress.findMany({ where: { userId }, select: { catalogId: true, completedDays: true }, orderBy: { catalogId: 'asc' } });
        data = { tongLoTrinhRieng: total, toiDa10LoTrinh: roadmaps.map(row => ({ ten: row.name, tongChu: row.kanjiList.length, chuMoiNgay: row.perDay, tongNgay: Math.ceil(row.kanjiList.length / row.perDay), ngayHoanThanh: row.completedDays.length, daBatDau: !!row.startedAt })), loTrinhMacDinh: defaults.map(row => ({ catalog: row.catalogId, ngayHoanThanh: row.completedDays.length })), luuY: 'Đây là ngày học trong lộ trình, không phải số ngày trên lịch. Không suy ra streak hoặc tổng thời gian.' };
      } else if (scope === 'jlpt') {
        const enrollment = await tx.jlptEnrollment.findMany({ where: { userId }, take: 5, orderBy: { roadmap: { level: 'asc' } }, select: { roadmapId: true, roadmap: { select: { level: true, archivedAt: true, publishedVersion: true } } } });
        const entries = [];
        for (const row of enrollment) {
          const completed = await tx.jlptSessionProgress.count({ where: { userId, completedAt: { not: null }, session: { roadmapId: row.roadmapId } } });
          const best = await tx.jlptSessionProgress.aggregate({ where: { userId, session: { roadmapId: row.roadmapId } }, _max: { bestScore: true }, _sum: { attempts: true } });
          entries.push({ trinhDo: row.roadmap.level, buoiDaDatLuuTru: completed, soLanThi: best._sum.attempts ?? 0, diemCaoNhatTrongCacBuoi: best._max.bestScore, khoDangMo: row.roadmap.archivedAt === null && row.roadmap.publishedVersion !== null });
        }
        data = { loTrinhDaThamGia: entries, luuY: 'Mốc đạt được giữ khi sửa giáo án. Đây là mốc lưu trữ, không tự suy ra phần trăm hay buổi đang mở khóa; xem trang JLPT để lấy đề hiện tại. Không gửi đáp án đề thi.' };
      } else if (scope === 'grammar' || scope === 'curriculum') {
        // Keep the two generated Prisma delegates separate for type-safe predicates.
        const started = scope === 'grammar' ? await tx.grammarProgress.count({ where: { userId } }) : await tx.curriculumProgress.count({ where: { userId } });
        const completed = scope === 'grammar' ? await tx.grammarProgress.count({ where: { userId, completedAt: { not: null } } }) : await tx.curriculumProgress.count({ where: { userId, completedAt: { not: null } } });
        data = { daCoTienDo: started, daHoanThanh: completed, donVi: scope === 'grammar' ? 'mẫu ngữ pháp' : 'bài giáo trình từ vựng', luuY: 'Mốc đã lưu, có thể gồm nội dung sau đó lưu trữ; không phải toàn bộ số bài của kho.' };
      } else if (scope === 'kana') {
        const results = await tx.kanaQuizResult.findMany({ where: { userId }, take: 3, orderBy: [{ completedAt: 'desc' }, { id: 'asc' }], select: { mode: true, total: true, correct: true, completedAt: true } });
        data = { toiDa3LuotHoanThanhMoiNhat: results, luuY: 'Không có bản lưu lượt quiz dở hoặc tiến độ flashcard/luyện viết Kana.' };
      } else if (scope === 'reading') {
        const total = await tx.readingArticle.count({ where: { userId, scope: 'personal', archivedAt: null } });
        const titles = await tx.$queryRaw<Array<{ title: string }>>`SELECT content->>'title' AS title FROM reading_articles WHERE user_id=${userId}::uuid AND scope='personal' AND archived_at IS NULL ORDER BY updated_at DESC,id LIMIT 10`;
        data = { tongBaiCaNhan: total, toiDa10TieuDeMoiNhat: titles.map(row => row.title?.slice(0, 200) ?? ''), luuY: 'Chỉ đọc tên và số bài, không gửi văn bản bài hoặc suy ra đã đọc xong.' };
      } else if (scope === 'shadowing') {
        const total = await tx.shadowingVideo.count({ where: { ownerId: userId, scope: 'personal', archivedAt: null } });
        const studied = await tx.shadowingStudy.count({ where: { userId } });
        const graded = await tx.shadowingGrade.count({ where: { userId } });
        data = { videoCaNhanDangCo: total, videoCoTrangThaiHoc: studied, ketQuaCauDaLuu: graded, luuY: 'Có trạng thái học không có nghĩa đã hoàn thành video; kết quả có thể gồm các phiên bản câu khác nhau. Không gửi phụ đề hay bookmark.' };
      } else if (scope === 'xp') {
        const total = await tx.xpEvent.aggregate({ where: { userId }, _sum: { points: true } });
        const today = await tx.xpEvent.aggregate({ where: { userId, studyDate: new Date(`${day}T00:00:00.000Z`) }, _sum: { points: true } });
        const month = await tx.xpEvent.aggregate({ where: { userId, studyDate: { gte: new Date(`${day.slice(0, 7)}-01T00:00:00.000Z`), lte: new Date(`${day}T00:00:00.000Z`) } }, _sum: { points: true } });
        data = { ngayVietNam: day, tongXP: total._sum.points ?? 0, xpHomNay: today._sum.points ?? 0, xpThangNay: month._sum.points ?? 0, luuY: 'Điểm đã được server ghi nhận. Không suy ra thứ hạng từ riêng số XP; bảng xếp hạng là nguồn thứ hạng hiện tại.' };
      }
      const [title, url] = headings[scope];
      output.push({ id: `personal:${scope}`, title, url, content: `Dữ liệu riêng của tài khoản đang đăng nhập, chỉ đọc để trả lời câu hỏi hiện tại. ${JSON.stringify(data)}` });
    }
    return output;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  if (sources.length > 6) {
    const full = sources.map(source => `${source.title}: ${source.content}`).join('\n');
    const content = full.length > 10000 ? `${full.slice(0, 10000)}\nDữ liệu tổng quan đã rút gọn; phần không có trong nguồn này chưa được cung cấp, không được xem là 0.` : full;
    return { requested: true, sources: [{ id: 'personal:overview', title: 'Tổng quan học tập của bạn', url: '/ca-nhan/on-tap', content }] };
  }
  return { requested: true, sources };
}
