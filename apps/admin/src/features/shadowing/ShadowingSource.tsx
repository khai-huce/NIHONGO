import { useRef, useState } from 'react';
import type { AdminRequest, ContentSource } from '../../shared/types';
import { AdminDialog } from '../../shared/ui/AdminDialog';

const blank: ContentSource = { id: '', name: '', url: '', license: '', licenseUrl: '', version: '', checksum: '', attribution: '', notes: '' };
const labels: Record<keyof ContentSource, string> = { id: 'Mã nguồn', name: 'Tên nguồn', url: 'URL / URI nguồn', license: 'Quyền sử dụng', licenseUrl: 'URL / URI điều khoản', version: 'Phiên bản / ngày', checksum: 'Checksum (nếu có)', attribution: 'Ghi công', notes: 'Ghi chú' };
export function ShadowingSource({ request, onClose, onAdded }: { request: AdminRequest; onClose: () => void; onAdded: (source: ContentSource) => void }) {
  const [draft, setDraft] = useState<ContentSource>({ ...blank }), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const locked = useRef(false);
  return <AdminDialog title="Thêm nguồn nội dung" busy={busy} onClose={onClose}><p className="mb-4 text-sm text-slate-600">Ghi xuất xứ và quyền sử dụng thực tế của video, phụ đề và bản dịch. Metadata nguồn không thay đổi sau khi tạo.</p><form onSubmit={async event => {
    event.preventDefault(); if (locked.current) return; locked.current = true; setBusy(true); setError('');
    try { const result = await request<{ source: ContentSource }>('/admin/content/sources', { method: 'POST', body: { source: draft } }); onAdded(result.source); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Chưa tạo được nguồn.'); }
    finally { locked.current = false; setBusy(false); }
  }}><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">{Object.entries(labels).map(([key, label]) => <label key={key} className="text-sm">{label}<input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" value={draft[key as keyof ContentSource]} required={['id', 'name', 'url', 'license', 'licenseUrl', 'version', 'attribution'].includes(key)} pattern={key === 'id' ? '[a-z0-9-]+' : undefined} onChange={event => setDraft(value => ({ ...value, [key]: event.target.value }))} />{key === 'id' && <span className="mt-1 block text-xs text-slate-500">Chữ thường, số, dấu gạch nối; ví dụ shadowing-thu-vien.</span>}</label>)}</fieldset>{error && <p role="alert" className="my-3 text-sm text-red-700">{error}</p>}<button className="mt-5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={busy}>Tạo nguồn</button></form></AdminDialog>;
}
