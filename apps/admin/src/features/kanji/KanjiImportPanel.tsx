import { useToast } from '@nihongo/client/toast';
import { useEffect, useRef, useState } from 'react';
import type { AdminRequest, ContentSource, ImportPreview, KanjiImport } from '../../shared/types';
import { createKanjiImportTemplate, importErrorDetails, importFieldPath, MAX_IMPORT_BYTES, parseKanjiImport } from './import-json';

interface KanjiImportPanelProps {
  request: AdminRequest;
  sources: ContentSource[];
  onImported: () => void;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

type ErrorDetails = ReturnType<typeof importErrorDetails>;
type PreviewState = { input: KanjiImport; result: ImportPreview; revision: number };
type Pending = 'file' | 'preview' | 'commit' | null;

const actions: Record<ImportPreview['rows'][number]['action'], string> = {
  source_missing: 'Không tìm thấy nguồn',
  identity_conflict: 'Xung đột ID hoặc chữ Kanji',
  unchanged: 'Giữ nguyên',
  version_conflict: 'Phiên bản đã thay đổi',
  update_draft: 'Cập nhật bản nháp',
  create_draft: 'Tạo bản nháp',
};
const blockedActions = new Set(['source_missing', 'identity_conflict', 'version_conflict']);
const buttonClass = 'rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';
const primaryClass = 'rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';

export function KanjiImportPanel({ request, sources, onImported, onClose, onDirtyChange }: KanjiImportPanelProps) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [savedText, setSavedText] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [error, setError] = useState<ErrorDetails | null>(null);
  const [success, setSuccess] = useState<{ changed: number; unchanged: number } | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const revision = useRef(0);
  const busy = useRef<Pending>(null);
  const mounted = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const selectedSource = sources.some(source => source.id === sourceId) ? sourceId : sources[0]?.id ?? '';

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      revision.current += 1;
      controller.current?.abort();
    };
  }, []);

  useEffect(() => {
    // A new request function can represent an account or session change.
    revision.current += 1;
    controller.current?.abort();
    busy.current = null;
    setPending(null);
    setPreview(null);
  }, [request]);

  useEffect(() => {
    onDirtyChange?.((text.length > 0 && text !== savedText) || pending === 'commit');
  }, [text, savedText, pending, onDirtyChange]);

  const clearPreview = () => {
    revision.current += 1;
    controller.current?.abort();
    busy.current = null;
    setPending(null);
    setPreview(null);
    setError(null);
    setSuccess(null);
  };

  const changeText = (value: string) => {
    if (busy.current === 'commit') return;
    clearPreview();
    setText(value);
  };

  const readFile = async (file: File | undefined) => {
    if (!file || busy.current === 'commit') return;
    clearPreview();
    if (file.size > MAX_IMPORT_BYTES) {
      setError({ message: 'Tệp vượt giới hạn 1,5 MiB. Hãy chia thành tệp nhỏ hơn.', issues: [] });
      return;
    }
    const currentRevision = revision.current;
    busy.current = 'file';
    setPending('file');
    try {
      const value = await file.text();
      if (!mounted.current || revision.current !== currentRevision) return;
      setText(value);
    } catch {
      if (mounted.current && revision.current === currentRevision) {
        setError({ message: 'Không thể đọc tệp. Chọn lại tệp hoặc dán JSON vào ô bên dưới.', issues: [] });
      }
    } finally {
      if (mounted.current && revision.current === currentRevision) {
        busy.current = null;
        setPending(null);
      }
    }
  };

  const loadPreview = async () => {
    if (busy.current) return;
    setError(null);
    setSuccess(null);
    setPreview(null);
    let input: KanjiImport;
    try {
      input = parseKanjiImport(text);
    } catch (caught) {
      setError(importErrorDetails(caught));
      return;
    }
    const currentRevision = ++revision.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    busy.current = 'preview';
    setPending('preview');
    try {
      const result = await request<ImportPreview>('/admin/content/imports/preview', {
        method: 'POST', body: { input }, signal: abort.signal,
      });
      if (mounted.current && revision.current === currentRevision) {
        setPreview({ input, result, revision: currentRevision });
      }
    } catch (caught) {
      if (mounted.current && revision.current === currentRevision && !abort.signal.aborted) {
        setError(importErrorDetails(caught));
      }
    } finally {
      if (mounted.current && revision.current === currentRevision) {
        busy.current = null;
        setPending(null);
      }
    }
  };

  const commit = async () => {
    if (busy.current || !preview?.result.canCommit || preview.revision !== revision.current) return;
    const currentRevision = revision.current;
    const currentText = text;
    const abort = new AbortController();
    controller.current = abort;
    busy.current = 'commit';
    setPending('commit');
    setError(null);
    setSuccess(null);
    try {
      const result = await request<{ changed: number; unchanged: number }>('/admin/content/imports/commit', {
        method: 'POST', body: { input: preview.input, previewHash: preview.result.previewHash }, signal: abort.signal,
      });
      if (!mounted.current || revision.current !== currentRevision) return;
      setSuccess(result);
      toast.success('Đã nhập Kanji vào bản nháp. Rà soát trước khi xuất bản.');
      setPreview(null);
      setSavedText(currentText);
      onImported();
    } catch (caught) {
      if (mounted.current && revision.current === currentRevision && !abort.signal.aborted) {
        setError(importErrorDetails(caught));
        setPreview(null);
      }
    } finally {
      if (mounted.current && revision.current === currentRevision) {
        busy.current = null;
        setPending(null);
      }
    }
  };

  const downloadTemplate = () => {
    if (!selectedSource) return;
    const url = URL.createObjectURL(new Blob([createKanjiImportTemplate(selectedSource)], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kanji-import-template.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 text-slate-900 sm:p-6" aria-labelledby="kanji-import-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="kanji-import-title" className="text-xl font-bold">Nhập Kanji từ JSON</h2>
          <p className="mt-1 text-sm text-slate-600">Xem trước từng mục rồi xác nhận lưu vào bản nháp. Tối đa 200 mục và 1,5 MiB mỗi lần.</p>
        </div>
        <button type="button" className={buttonClass} onClick={onClose} disabled={pending === 'commit'}>Đóng nhập JSON</button>
      </div>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-medium" htmlFor="kanji-template-source">
            Nguồn cho JSON mẫu
            <select id="kanji-template-source" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={selectedSource} onChange={event => setSourceId(event.target.value)} disabled={!sources.length || pending === 'commit'}>
              {!sources.length && <option value="">Chưa có nguồn nội dung</option>}
              {sources.map(source => <option key={source.id} value={source.id}>{source.name} ({source.id})</option>)}
            </select>
          </label>
          <button type="button" className={buttonClass} onClick={downloadTemplate} disabled={!selectedSource}>Tải JSON mẫu</button>
        </div>
        <p className="text-sm text-slate-600">Mẫu để trống nội dung: điền ID, chữ Kanji, Hán Việt, nghĩa, cấp N5–N1 và số nét; bổ sung các trường còn lại theo nguồn đã duyệt. Chọn nguồn ở đây chỉ áp dụng khi tải mẫu.</p>
        <p className="text-sm text-slate-600"><code className="font-mono">expectedVersion: null</code> cho mục mới; khi cập nhật, dùng số phiên bản hiện tại từ danh sách quản trị. Giữ nguyên ID và chữ Kanji của mục đã có. Chỉ dùng <code className="font-mono">sourceId</code> đã tồn tại.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="kanji-import-file" className="block text-sm font-semibold">Chọn tệp JSON</label>
        <input id="kanji-import-file" type="file" accept=".json,application/json" className="block max-w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-300 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700" disabled={pending === 'commit'} onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = '';
          void readFile(file);
        }} />
      </div>

      <div className="space-y-2">
        <label htmlFor="kanji-import-json" className="block text-sm font-semibold">Hoặc dán và sửa JSON</label>
        <textarea id="kanji-import-json" value={text} onChange={event => changeText(event.target.value)} disabled={pending === 'commit'} spellCheck={false} rows={14} className="w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-sm leading-relaxed focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50" placeholder={'{\n  "kind": "kanji",\n  "entries": [...]\n}'} aria-describedby="kanji-import-help" />
        <p id="kanji-import-help" className="text-xs text-slate-500">Sửa JSON sẽ hủy bản xem trước. Máy chủ kiểm tra nội dung, nguồn và phiên bản trước khi cho phép lưu.</p>
      </div>

      {error && <div role="alert" className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">{error.message}</p>
        {error.issues.length > 0 && <ul className="max-h-60 list-disc space-y-1 overflow-y-auto pl-5">{error.issues.map((issue, index) => <li key={index}><code className="break-all font-mono">{importFieldPath(issue.path)}</code>: {issue.message}</li>)}</ul>}
        <p>Dữ liệu trong ô nhập được giữ lại để sửa và xem trước lại.</p>
      </div>}

      {success && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        Đã lưu {success.changed} mục thay đổi vào bản nháp; {success.unchanged} mục giữ nguyên. Nội dung mới chưa được xuất bản.
      </div>}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={primaryClass} onClick={() => void loadPreview()} disabled={pending !== null || !text.trim()}>{pending === 'preview' ? 'Đang kiểm tra…' : 'Xem trước'}</button>
        {pending === 'file' && <span role="status" className="text-sm text-slate-600">Đang đọc tệp…</span>}
      </div>

      {preview && <div className="space-y-3" aria-live="polite">
        <h3 className="text-base font-semibold">Xem trước {preview.result.rows.length} mục</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 font-semibold">Chữ</th><th className="px-4 py-3 font-semibold">ID</th><th className="px-4 py-3 font-semibold">Thao tác</th><th className="px-4 py-3 font-semibold">Phiên bản hiện tại</th></tr></thead>
            <tbody className="divide-y divide-slate-200">{preview.result.rows.map((row, index) => <tr key={`${row.id}-${index}`}>
              <td className="px-4 py-3 text-2xl">{preview.input.entries.find(entry => entry.data.id === row.id)?.data.kanji ?? '—'}</td>
              <td className="px-4 py-3 font-mono text-xs">{row.id}</td>
              <td className={`px-4 py-3 ${blockedActions.has(row.action) ? 'font-semibold text-red-700' : 'text-slate-700'}`}>{actions[row.action]}</td>
              <td className="px-4 py-3">{row.version ?? 'Chưa có'}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {!preview.result.canCommit && <p role="alert" className="text-sm font-medium text-red-700">Chưa thể lưu. Sửa các mục có lỗi nguồn, ID/chữ hoặc phiên bản rồi xem trước lại.</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={primaryClass} disabled={!preview.result.canCommit || pending !== null} onClick={() => void commit()}>{pending === 'commit' ? 'Đang lưu bản nháp…' : 'Xác nhận nhập bản nháp'}</button>
          <p className="text-sm text-slate-500">Toàn bộ lượt nhập được lưu cùng nhau. Xuất bản là bước riêng.</p>
        </div>
      </div>}
    </section>
  );
}
