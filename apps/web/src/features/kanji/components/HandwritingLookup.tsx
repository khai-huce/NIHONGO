import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { Search, RotateCcw, Undo2 } from 'lucide-react';
import type { KanjiItem } from '@nihongo/shared/contracts/core';
import { RoughCard, RoughButton } from '../../../shared/ui/RoughCard';
type Point=[number,number];
type Candidate={character:string;item:KanjiItem|null};
export function HandwritingLookup({onSelectKanji}:{onSelectKanji:(item:KanjiItem)=>void}) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const strokes=useRef<Point[][]>([]);
  const pointer=useRef<number|null>(null);
  const frame=useRef({width:1,height:1});
  const request=useRef<AbortController|null>(null);
  const revision=useRef(0);
  const [count,setCount]=useState(0);
  const [busy,setBusy]=useState(false);
  const [candidates,setCandidates]=useState<Candidate[]>([]);
  const [message,setMessage]=useState('');
  const invalidate=()=>{revision.current++;request.current?.abort();request.current=null;setBusy(false);setCandidates([]);setMessage('');};
  const redraw=()=>{
    const el=canvas.current, ctx=el?.getContext('2d'); if(!el||!ctx)return;
    const rect=el.getBoundingClientRect(), dpr=window.devicePixelRatio||1;
    el.width=Math.round(rect.width*dpr);el.height=Math.round(rect.height*dpr);
    ctx.scale(dpr,dpr);ctx.strokeStyle='#44403c';ctx.fillStyle='#44403c';ctx.lineWidth=4;ctx.lineCap='round';ctx.lineJoin='round';
    const scale=Math.min(rect.width/frame.current.width,rect.height/frame.current.height);
    ctx.translate((rect.width-frame.current.width*scale)/2,(rect.height-frame.current.height*scale)/2);
    for(const stroke of strokes.current){
      ctx.beginPath();stroke.forEach(([x,y],i)=>i?ctx.lineTo(x*scale,y*scale):ctx.moveTo(x*scale,y*scale));ctx.stroke();
      if(stroke.length===1){ctx.beginPath();ctx.arc(stroke[0][0]*scale,stroke[0][1]*scale,2,0,Math.PI*2);ctx.fill();}
    }
  };
  useEffect(()=>{
    const observer=new ResizeObserver(redraw);if(canvas.current)observer.observe(canvas.current);
    const hide=()=>{pointer.current=null;};window.addEventListener('blur',hide);
    return()=>{observer.disconnect();window.removeEventListener('blur',hide);revision.current++;request.current?.abort();};
  },[]);
  const point=(e:PointerEvent<HTMLCanvasElement>):Point=>{
    const r=e.currentTarget.getBoundingClientRect(),scale=Math.min(r.width/frame.current.width,r.height/frame.current.height);
    const x=(e.clientX-r.left-(r.width-frame.current.width*scale)/2)/scale,y=(e.clientY-r.top-(r.height-frame.current.height*scale)/2)/scale;
    return [Math.max(0,Math.min(frame.current.width,x)),Math.max(0,Math.min(frame.current.height,y))];
  };
  const start=(e:PointerEvent<HTMLCanvasElement>)=>{
    if(!e.isPrimary||e.button!==0||pointer.current!==null)return;
    invalidate();
    if(strokes.current.length>=40){setMessage('Tối đa 40 nét cho một chữ. Hãy xóa và viết lại.');return;}
    if(!strokes.current.length){const r=e.currentTarget.getBoundingClientRect(),size=Math.max(r.width,r.height);frame.current={width:r.width/size,height:r.height/size};}
    pointer.current=e.pointerId;e.currentTarget.setPointerCapture(e.pointerId);
    strokes.current.push([point(e)]);setCount(strokes.current.length);redraw();
  };
  const move=(e:PointerEvent<HTMLCanvasElement>)=>{
    if(pointer.current!==e.pointerId)return;
    const stroke=strokes.current[strokes.current.length-1],p=point(e),last=stroke[stroke.length-1];
    if(Math.hypot(p[0]-last[0],p[1]-last[1])<0.003)return;
    if(stroke.length>=512||strokes.current.reduce((n,s)=>n+s.length,0)>=4096){setMessage('Đã đạt giới hạn điểm vẽ. Bạn có thể tra chữ hoặc xóa để viết lại.');return;}
    stroke.push(p);redraw();
  };
  const finish=(e:PointerEvent<HTMLCanvasElement>)=>{if(pointer.current===e.pointerId){pointer.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}};
  const edit=(clear:boolean)=>{invalidate();pointer.current=null;if(clear)strokes.current=[];else strokes.current.pop();setCount(strokes.current.length);redraw();};
  const lookup=async()=>{
    if(!strokes.current.length||busy)return;
    invalidate();const version=revision.current,controller=new AbortController();request.current=controller;setBusy(true);
    const timeout=window.setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch('/api/handwriting/recognize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({strokes:strokes.current}),signal:controller.signal});
      const data=await response.json();
      if(!response.ok)throw new Error(data?.error?.message||'Không thể tra chữ. Vui lòng thử lại.');
      if(version!==revision.current)return;
      setCandidates(data.candidates);if(!data.candidates.length)setMessage('Chưa tìm được chữ phù hợp. Hãy viết lại một chữ rõ hơn.');
    }catch(error){if(version===revision.current)setMessage(controller.signal.aborted?'Tra chữ quá lâu. Vui lòng thử lại.':error instanceof Error?error.message:'Không kết nối được máy chủ.');}
    finally{window.clearTimeout(timeout);if(version===revision.current){setBusy(false);request.current=null;}}
  };
  return <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-2"><h2 className="text-base font-black text-[#292524] font-sketch">Hoặc vẽ Kanji</h2>
      <div className="flex gap-3"><button onClick={()=>edit(false)} disabled={!count} className="flex items-center gap-1 text-xs font-bold text-stone-600 disabled:opacity-40"><Undo2 size={13}/>Hoàn tác</button><button onClick={()=>edit(true)} disabled={!count} className="flex items-center gap-1 text-xs font-bold text-rose-600 disabled:opacity-40"><RotateCcw size={13}/>Xóa nét</button></div>
    </div>
    <RoughCard fill="#ffffff" stroke="#78716c" borderRadius={12} roughness={0.7} className="h-[270px] overflow-hidden">
      <div className="relative h-full w-full"><div className="pointer-events-none absolute z-10 h-full border-l border-dashed border-[#78643c]/30 left-1/2"/><div className="pointer-events-none absolute z-10 w-full border-t border-dashed border-[#78643c]/30 top-1/2"/>
        <canvas ref={canvas} aria-label="Vẽ một chữ Kanji để tra cứu" onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} className="relative w-full h-full cursor-crosshair touch-none"/>
      </div>
    </RoughCard>
    <div className="flex items-center justify-between gap-2 pt-1"><span className="text-xs text-stone-500">Viết một chữ · {count} nét</span><RoughButton onClick={lookup} disabled={!count||busy} fill="#bae6fd" className="px-4 py-2 text-sm font-bold disabled:opacity-50"><Search size={16} className="mr-1"/>{busy?'Đang nhận diện…':'Tra chữ'}</RoughButton></div>
    <div aria-live="polite">
      {message&&<p className="py-2 text-sm text-amber-800" role="status">{message}</p>}
      {!!candidates.length&&<><p className="pt-2 text-xs text-stone-500">Chọn chữ phù hợp. Gợi ý nhận diện có thể chưa chính xác.</p><div className="flex flex-wrap gap-2 py-2">{candidates.map(c=><button key={c.character} onClick={()=>c.item?onSelectKanji(c.item):setMessage(`Chữ ${c.character} chưa có nội dung đã xuất bản trong kho.`)} aria-label={`${c.character}${c.item?' — Mở chi tiết':' — Chưa có trong kho'}`} title={c.item?.meaning||'Chưa có trong kho'} className={`rounded-lg border px-3 py-2 font-kanji text-2xl ${c.item?'border-blue-400 bg-blue-50 text-blue-900':'border-stone-300 text-stone-500'}`}>{c.character}</button>)}</div></>}
    </div>
    <p className="text-[10px] text-stone-500">Nhận diện: <a className="underline" href="https://github.com/dariyooo/DaKanji-Single-Kanji-Recognition" target="_blank" rel="noreferrer">DaKanji · CaptainDario (DaAppLab), MIT</a>. Không chấm thứ tự nét.</p>
  </div>;
}
