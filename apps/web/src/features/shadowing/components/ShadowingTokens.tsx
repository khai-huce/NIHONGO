import type { ShadowingToken } from '@nihongo/shared/contracts/shadowing';
export function ShadowingTokens({ tokens, furigana, chips = false, activeIndex = -1 }: { tokens: ShadowingToken[]; furigana: 'always' | 'never' | 'hover'; chips?: boolean; activeIndex?: number }) {
  return <span data-furigana={furigana} className="font-kanji inline-flex flex-wrap items-end gap-x-1.5 gap-y-3">
    {tokens.map((token, index) => <span key={index} aria-current={index === activeIndex ? 'true' : undefined} data-furigana-token tabIndex={furigana === 'hover' && token.reading && token.reading !== token.text ? 0 : undefined}
      onPointerDown={event => { if (furigana === 'hover') event.currentTarget.focus(); }}
      className={`inline-flex flex-col items-center whitespace-pre-wrap ${chips ? 'border border-stone-400 rounded px-2 py-1 ' : 'border-b-2 border-stone-500 pb-1'} ${index === activeIndex ? 'bg-blue-100 text-blue-700 ring-2 ring-blue-500 rounded' : chips ? 'bg-white' : ''}`}>
      {token.reading && token.reading !== token.text && <span data-furigana-reading className="text-[11px] font-normal leading-none text-stone-500 mb-1">{token.reading}</span>}
      <span>{token.text}</span>
    </span>)}
  </span>;
}
