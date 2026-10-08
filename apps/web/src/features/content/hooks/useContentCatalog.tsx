import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '@nihongo/client/api';
import type { KanjiItem } from '@nihongo/shared/contracts/core';
import { validateContentCatalog, type ContentCatalog } from '../lib/content-catalog';
export type { RoadmapDefinition } from '../lib/content-catalog';

type Catalog = ContentCatalog;
type Context = Catalog & {
  allKanji: KanjiItem[];
  pairs: [string, string][];
  activePairs: [string, string][];
  byCharacter: Map<string, KanjiItem>;
  loaded: boolean;
  error: string;
  reload: () => Promise<void>;
};
const ContentContext = createContext<Context | null>(null);
const empty: Catalog = { kanji: [], archivedKanji: [], radicals: [], roadmaps: [] };

export function ContentCatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<Catalog>(empty);
  const [loaded, setLoaded] = useState(false), [error, setError] = useState('');
  const mounted = useRef(false), pending = useRef(false);
  const reload = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      const next = validateContentCatalog(await api<unknown>('/content/catalog'));
      if (!mounted.current) return;
      setCatalog(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
      setLoaded(true); setError('');
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : 'Chưa tải được kho nội dung.');
    } finally { pending.current = false; }
  }, []);
  useEffect(() => {
    mounted.current = true; void reload();
    const refresh = () => { if (!document.hidden) void reload(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { mounted.current = false; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [reload]);
  const value = useMemo(() => {
    const allKanji = [...catalog.kanji, ...catalog.archivedKanji];
    return { ...catalog, allKanji, loaded, error, reload,
      pairs: allKanji.map(item => [item.id, item.kanji] as [string, string]),
      activePairs: catalog.kanji.map(item => [item.id, item.kanji] as [string, string]),
      byCharacter: new Map(allKanji.map(item => [item.kanji, item])),
    };
  }, [catalog, loaded, error, reload]);
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

export function useContentCatalog() {
  const value = useContext(ContentContext);
  if (!value) throw new Error('ContentCatalogProvider is required.');
  return value;
}

export function CatalogGate({ children, roadmap = false }: { children: ReactNode; roadmap?: boolean }) {
  const catalog = useContentCatalog();
  const missing = roadmap && !catalog.roadmaps.some(item => item.id === 'n5-v1');
  if (!catalog.loaded || missing) return <div className="p-6 text-sm" role={catalog.error || missing ? 'alert' : 'status'}>
    {catalog.error || (catalog.loaded && missing ? 'Lộ trình chưa được xuất bản.' : 'Đang tải kho nội dung…')}
    {(catalog.error || missing) && <button className="ml-2 underline font-bold" onClick={() => void catalog.reload()}>Tải lại</button>}
  </div>;
  return <>{catalog.error && <div role="alert" className="px-4 py-2 text-sm bg-amber-50 text-amber-900">{catalog.error} <button className="underline" onClick={() => void catalog.reload()}>Tải lại</button></div>}{children}</>;
}
