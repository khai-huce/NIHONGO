import { useState } from 'react';
import { Layers, Play, Plus, Sparkles, Youtube } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { ShadowingListResponse } from '@nihongo/shared/contracts/shadowing';
import { parseYouTubeUrl } from '@nihongo/shared/study/shadowing-media';
import { useAccountResource } from '../../../shared/hooks/useAccountResource';
import { RoughCard } from '../../../shared/ui/RoughCard';
import { formatShadowingTime } from '../lib/shadowing-api';
import { ShadowingImportDialog } from './ShadowingImportDialog';

export function ShadowingLibrary({ userId, authBusy, onLogin }: { userId: string | null; authBusy: boolean; onLogin: () => void }) {
  const resource = useAccountResource<ShadowingListResponse>('/shadowing/videos', userId, authBusy);
  const [level, setLevel] = useState(''), [url, setUrl] = useState(''), [error, setError] = useState(''), [adding, setAdding] = useState(false);
  const navigate = useNavigate();
  const items = (resource.data?.items ?? []).filter(item => !level || item.level === level);
  const add = () => {
    if (!userId) { onLogin(); return; }
    try { parseYouTubeUrl(url); setError(''); setAdding(true); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Liên kết chưa hợp lệ.'); }
  };
  return <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 space-y-8">
    <header className="flex gap-4 items-center"><span className="rounded-full bg-white border-2 border-stone-700 shadow-sketch p-3 font-black text-blue-500 text-xl">P))</span><div><h1 className="font-black text-3xl">Shadowing & Chép chính tả</h1><p className="mt-1">Chọn video để luyện nghe, bắt chước phát âm hoặc viết chính tả theo cấp độ JLPT.</p></div></header>
    <section><div className="flex gap-3 flex-wrap items-center"><h2 className="font-black text-lg">Video của tôi</h2><span className="text-xs text-amber-700 rounded-full border border-stone-600 bg-white px-3 py-1 flex items-center gap-1"><Sparkles size={13} />AI tạo phụ đề + dịch</span><span className="text-xs text-amber-700 rounded-full border border-stone-600 bg-white px-3 py-1">Cần đăng nhập</span></div>
      <p className="text-stone-500 text-sm my-3">Dán link YouTube tiếng Nhật công khai (dưới 30 phút) — tạo phụ đề bằng AI hoặc nhập phụ đề, rà soát rồi lưu để luyện shadowing.</p>
      <form onSubmit={event => { event.preventDefault(); add(); }} className="flex flex-col sm:flex-row gap-3"><div className="flex-1 flex gap-3 items-center rounded-2xl border-2 border-stone-700 bg-white shadow-sketch px-4"><Youtube className="text-red-600 shrink-0" size={22} /><input aria-label="Liên kết YouTube" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." className="w-full py-3 bg-transparent outline-none" /></div><button disabled={authBusy} className="rounded-2xl border-2 border-stone-700 shadow-sketch bg-sky-400 text-white font-black px-5 py-3 flex items-center justify-center gap-2"><Plus size={20} />Thêm video</button></form>
      {error && <p role="alert" className="text-red-700 mt-2">{error}</p>}
    </section>
    <div className="border-b border-stone-300 pb-4 flex items-center gap-2 flex-wrap">{['', 'N5', 'N4', 'N3', 'N2', 'N1'].map(value => <button key={value} onClick={() => setLevel(value)} className={`rounded-full border border-stone-700 px-4 py-2 text-sm font-bold ${level === value ? 'bg-stone-800 text-white' : 'bg-white'}`}>{value || 'Tất cả cấp độ'}</button>)}<span className="ml-auto text-xs text-stone-500">{items.length} video có sẵn</span></div>
    {resource.loading && <p role="status">Đang tải video…</p>}
    {resource.error && <p role="alert" className="text-red-700">{resource.error} <button className="underline" onClick={() => void resource.reload()}>Thử lại</button></p>}
    {!resource.loading && !resource.error && !items.length && <RoughCard fill="#ffffff" className="p-8 text-center"><p>Chưa có video{level ? ` ${level}` : ''} trong thư viện.</p><p className="text-sm text-stone-500 mt-2">Bạn có thể thêm video cá nhân ở phía trên; video thư viện sẽ xuất hiện sau khi admin xuất bản.</p></RoughCard>}
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">{items.map(item => <RoughCard key={item.id} fill="#ffffff" borderRadius={14} className="p-3 flex flex-col"><button onClick={() => navigate(`/tron-doi/shadowing/${item.id}`)} className="relative bg-stone-800 rounded-xl overflow-hidden aspect-video block w-full" aria-label={`Vào luyện: ${item.title}`}><img src={`https://i.ytimg.com/vi/${item.youtubeId}/hqdefault.jpg`} alt="" className="w-full h-full object-cover" onError={event => { event.currentTarget.style.visibility = 'hidden'; }} />{item.level && <span className="absolute left-2 top-2 bg-blue-600 text-white text-xs px-2 py-1 rounded font-bold">{item.level}</span>}<span className="absolute inset-0 flex items-center justify-center"><span className="rounded-full bg-blue-600 text-white p-3"><Play fill="currentColor" /></span></span><span className="absolute bottom-2 right-2 text-white bg-black/80 px-2 py-1 text-xs rounded">{formatShadowingTime(item.durationMs)}</span></button><h3 className="font-black mt-3">{item.title}</h3><p className="text-xs text-stone-500 mt-1">{item.channel}{item.scope === 'personal' ? ' · Video của tôi' : ''}</p><p className="text-sm mt-2 flex-1">{item.description}</p><button onClick={() => navigate(`/tron-doi/shadowing/${item.id}`)} className="mt-3 pt-3 border-t border-stone-200 text-blue-600 flex justify-between text-xs font-bold"><span className="flex gap-1"><Layers size={15} />{item.sentenceCount} câu luyện tập</span><span>Vào luyện ngay →</span></button></RoughCard>)}</div>
    {adding && userId && !authBusy && <ShadowingImportDialog userId={userId} url={url} onClose={() => setAdding(false)} onSaved={detail => navigate(`/tron-doi/shadowing/${detail.video.id}`)} />}
  </div>;
}
