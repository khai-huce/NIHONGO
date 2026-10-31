import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { KanjiItem } from '@nihongo/shared/contracts/core';
import { RoughCard } from '../../../shared/ui/RoughCard';

export function KanjiSearch({ items, onSelect }: { items: KanjiItem[]; onSelect: (item: KanjiItem) => void }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return q ? items.filter(item => [item.kanji, item.hanViet, item.meaning, ...item.onyomi, ...item.kunyomi]
      .some(value => value.toLocaleLowerCase().includes(q))) : [];
  }, [items, query]);
  const expanded = open && !!query.trim();
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  useEffect(() => {
    if (expanded) list.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, expanded, query]);

  const select = (item: KanjiItem) => { setOpen(false); onSelect(item); };
  return <div ref={root} className="relative" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={10} roughness={0.7}>
      <div className="flex items-center p-1">
        <Search aria-hidden="true" className="ml-3 w-4 h-4 shrink-0 text-[#78716c]" />
        <input type="text" role="combobox" aria-label="Tìm kiếm Kanji" aria-autocomplete="list"
          aria-expanded={expanded} aria-controls={`${id}-results`}
          aria-activedescendant={expanded && results.length ? `${id}-option-${activeIndex}` : undefined}
          value={query} autoComplete="off" placeholder="Nhập kanji hoặc âm hán việt..."
          onFocus={() => setOpen(true)}
          onChange={event => { setQuery(event.target.value); setActive(0); setOpen(true); }}
          onKeyDown={event => {
            if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
            if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
            else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault(); setOpen(true);
              if (results.length) setActive(!expanded ? 0 : (activeIndex + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
            } else if (event.key === 'Enter' && expanded && results[activeIndex]) {
              event.preventDefault(); select(results[activeIndex]);
            }
          }}
          className="min-w-0 w-full bg-transparent px-3 py-1.5 text-sm text-[#292524] focus:outline-none font-sketch font-bold" />
      </div>
    </RoughCard>
    {expanded && <div className="absolute inset-x-0 top-full z-30 -mt-0.5 shadow-lg">
      <RoughCard fill="#faf8f1" stroke="#78716c" borderRadius={5} roughness={0.7}>
        <div ref={list} id={`${id}-results`} role="listbox" aria-label="Kết quả tìm kiếm Kanji"
          className="max-h-[340px] overflow-y-auto overscroll-contain p-0.5">
          {results.map((item, index) => <button key={item.id} id={`${id}-option-${index}`} type="button"
            role="option" aria-selected={index === activeIndex} tabIndex={-1}
            onMouseDown={event => event.preventDefault()} onClick={() => select(item)} onMouseMove={() => setActive(index)}
            className={`flex w-full items-center gap-3 border-b border-[#78716c] px-3 py-2 text-left last:border-b-0 ${index === activeIndex ? 'bg-[#ede7d3]' : 'bg-[#faf8f1]'}`}>
            <span className="font-kanji text-3xl font-bold text-[#292524] shrink-0">{item.kanji}</span>
            <span className="min-w-0 text-sm leading-snug">
              <span className="block font-kanji text-[#57534e] break-words">{(item.kunyomi.length ? item.kunyomi : item.onyomi).join('、')}</span>
              <span className="block font-sketch font-bold text-[#0094ff]">{item.hanViet}</span>
              <span className="block font-sketch text-[#292524] break-words">{item.meaning}</span>
            </span>
          </button>)}
        </div>
        {!results.length && <p role="status" className="px-4 py-3 text-sm text-[#57534e]">Không tìm thấy Kanji phù hợp.</p>}
      </RoughCard>
    </div>}
  </div>;
}
