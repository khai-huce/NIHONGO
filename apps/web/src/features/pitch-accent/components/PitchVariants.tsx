import type { PitchVariant } from '@nihongo/shared/contracts/pitch-accent';
import { getPitchContour } from '@nihongo/shared/study/pitch-accent';

const typeNames = { heiban: '平板 · Heiban', atamadaka: '頭高 · Atamadaka', nakadaka: '中高 · Nakadaka', odaka: '尾高 · Odaka' };

function PitchMoraDisplay({ reading, accent }: { reading: string; accent: number }) {
  let contour;
  try { contour = getPitchContour(reading, accent); }
  catch { return <span className="text-xs text-[#78716c]">Chưa có biểu đồ trọng âm hợp lệ.</span>; }
  const description = `${reading}, trọng âm ${accent}, ${typeNames[contour.type]}, cao độ ${contour.moras.map(mora => mora.high ? 'cao' : 'thấp').join('–')}, trợ từ theo sau ${contour.particleHigh ? 'cao' : 'thấp'}`;
  return <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
    <div role="img" aria-label={description} className="max-w-full overflow-x-auto pb-1">
      <div aria-hidden="true" className="inline-flex items-center text-xl md:text-2xl font-kanji leading-none whitespace-nowrap">
        {contour.moras.map((mora, index) => <span key={index} className={`relative px-1 pt-1.5 pb-1 border-t-2 border-r-2 ${mora.high ? 'border-t-[#0094ff]' : 'border-t-transparent'} ${mora.drop ? 'border-r-[#0094ff]' : 'border-r-transparent'} text-[#292524]`}>{mora.text}</span>)}
      </div>
    </div>
    <span className="text-[11px] font-bold text-[#57534e]" title={`Trợ từ theo sau: ${contour.particleHigh ? 'cao' : 'thấp'}`}>[{accent}] {typeNames[contour.type]}</span>
  </div>;
}

export function PitchVariants({ reading, variants }: { reading: string; variants: PitchVariant[] }) {
  return <div className="space-y-2 min-w-0 max-w-full">
    {variants.map((variant, index) => <div key={`${variant.accent}-${index}`} className="space-y-0.5 min-w-0">
      <PitchMoraDisplay reading={reading} accent={variant.accent} />
      {variant.labels.length > 0 && <p className="text-[10px] text-[#78716c] font-kanji break-words">{variant.labels.join(' · ')}</p>}
    </div>)}
  </div>;
}
