import { Star } from 'lucide-react';
import { useReview, type ReviewSource } from '../hooks/useReview';

export function ReviewStar({ source }: { source: ReviewSource }) {
  const review = useReview();
  const selected = review.cards.some(card => card.category === source.category && card.sourceId === source.sourceId && card.active);
  const label = selected ? 'Bỏ khỏi ôn tập (giữ lịch sử)' : 'Thêm vào ôn tập';
  return <button type="button" aria-label={label} title={label} aria-pressed={selected} disabled={review.busy}
    onClick={event => { event.stopPropagation(); void review.toggle(source); }} className={`inline-flex items-center justify-center p-2 rounded-lg border border-current/30 disabled:opacity-40 ${selected ? 'text-amber-500' : 'text-stone-400'} hover:text-amber-500`}><Star size={18} fill={selected ? 'currentColor' : 'none'} /></button>;
}
