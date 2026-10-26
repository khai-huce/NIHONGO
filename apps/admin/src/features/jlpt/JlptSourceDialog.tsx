import { useEffect, useRef, useState } from 'react';
import type { AdminRequest, ContentSource } from '../../shared/types';
import { AdminDialog } from '../../shared/ui/AdminDialog';
import { input, primary } from './ui';

const blank: ContentSource = { id: '', name: '', url: '', license: '', licenseUrl: '', version: '', checksum: '', attribution: '', notes: '' };
const labels: Record<keyof ContentSource, string> = { id: 'Mã nguồn', name: 'Tên nguồn', url: 'URL / URI nguồn', license: 'Quyền sử dụng', licenseUrl: 'URL / URI điều khoản', version: 'Phiên bản / ngày', checksum: 'Checksum (nếu có)', attribution: 'Ghi công', notes: 'Ghi chú' };
export function JlptSourceDialog({ request, onClose, onAdded }: { request: AdminRequest; onClose: () => void; onAdded: (source: ContentSource) => void }) {
  const [draft, setDraft] = useState<ContentSource>({ ...blank }), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false), mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  return <AdminDialog title="Thêm nguồn lộ trình" busy={busy} onClose={onClose}>
    <p className="mb-4 text-sm leading-6 text-slate-600">Ghi xuất xứ và quyền sử dụng của phần biên soạn lộ trình. Từng nội dung được liên kết vẫn giữ nguồn riêng trong kho gốc. Metadata nguồn không đổi sau khi tạo.</p>
    <form onSubmit={async event => {
      event.preventDefault(); if (locked.current) return; locked.current = true; setBusy(true); setError('');
      try { const result = await request<{ source: ContentSource }>('/admin/content/sources', { body: { source: draft } }); if (mounted.current) onAdded(result.source); }
      catch (caught) { if (mounted.current) setError(caught instanceof Error ? caught.message : 'Chưa tạo được nguồn.'); }
      finally { locked.current = false; if (mounted.current) setBusy(false); }
    }}>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">{Object.entries(labels).map(([key, label]) => <label key={key} className="text-sm">{label}<input className={input} value={draft[key as keyof ContentSource]} required={['id', 'name', 'url', 'license', 'licenseUrl', 'version', 'attribution'].includes(key)} pattern={key === 'id' ? '[a-z0-9-]+' : undefined} onChange={event => setDraft(value => ({ ...value, [key]: event.target.value }))} />{key === 'id' && <span className="mt-1 block text-xs text-slate-500">Chữ thường, số, dấu gạch nối; ví dụ lo-trinh-n5-tu-bien-soan.</span>}</label>)}</fieldset>
      {error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}
      <button className={`${primary} mt-5`} disabled={busy}>Tạo nguồn</button>
    </form>
  </AdminDialog>;
}
