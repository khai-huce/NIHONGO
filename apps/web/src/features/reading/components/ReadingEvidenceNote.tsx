import type { ReadingEvidence } from '@nihongo/shared/contracts/reading-supplements';
export function ReadingEvidenceNote({ evidence }: { evidence?: ReadingEvidence[] }) {
  if (!evidence?.length) return null;
  return <details className="text-[11px] text-stone-500 pt-1">
    <summary className="cursor-pointer">AI hỗ trợ · xem căn cứ trong bài</summary>
    <p className="py-1">Nội dung cần được rà soát, không phải tài liệu đã được biên tập viên xác minh.</p>
    {evidence.map((item, index) => <p key={index} className="font-kanji whitespace-pre-wrap break-words leading-relaxed">{item.quote}</p>)}
  </details>;
}
