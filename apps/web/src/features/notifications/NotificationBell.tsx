import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useReview } from '../review/hooks/useReview';
import { api } from '@nihongo/client/api';
type Category='kanji'|'vocab'|'grammar';
type Feed={userId:string;day:string;serverNow:string;nextDueAt:string|null;items:{category:Category;label:string;count:number;read:boolean}[]};
type Props={userId:string|null;authBusy:boolean;onLogin:()=>void};
export function NotificationBell(props:Props){return <BellPanel key={props.userId??'guest'} {...props}/>;}
function BellPanel({userId,authBusy,onLogin}:Props){
 const review=useReview(),navigate=useNavigate();
 const [open,setOpen]=useState(false),[data,setData]=useState<Feed|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[saving,setSaving]=useState(false);
 const root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),alive=useRef(false),generation=useRef(0),pending=useRef(false);
 const refresh=useCallback(async()=>{
  if(!userId||document.hidden||authBusy||pending.current)return;
  const token=++generation.current;setLoading(true);
  try{
   const result=await api<Feed>(`/notifications?expectedUserId=${encodeURIComponent(userId)}`);
   if(!alive.current||token!==generation.current)return;
   if(result.userId!==userId)throw new Error('Tài khoản đã đổi. Vui lòng tải lại trang.');
   setData(result);setError('');
  }catch(e){if(alive.current&&token===generation.current)setError(e instanceof Error?e.message:'Chưa tải được thông báo.');}
  finally{if(alive.current&&token===generation.current)setLoading(false);}
 },[userId,authBusy]);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;generation.current++;};},[refresh]);
 useEffect(()=>{void refresh();},[review.cards,refresh]);
 useEffect(()=>{
  if(!userId||authBusy)return;
  const now=data?Date.parse(data.serverNow):Date.now();
  const midnight=data?Date.parse(`${data.day}T00:00:00+07:00`)+86400000:Infinity;
  const due=data?.nextDueAt?Date.parse(data.nextDueAt):Infinity;
  const delay=Math.max(1000,Math.min(60000,midnight-now+100,due-now+100));
  const timer=window.setTimeout(()=>void refresh(),delay);
  return()=>window.clearTimeout(timer);
 },[data,error,userId,authBusy,refresh,loading]);
 useEffect(()=>{
  const visible=()=>{if(!document.hidden)void refresh();};
  window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);
  return()=>{window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
 },[refresh]);
 useEffect(()=>{
  if(!open)return;
  const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))setOpen(false);};
  const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);button.current?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 async function mark(categories:Category[],destination?:Category){
  if(!userId||!data||pending.current||authBusy)return;
  pending.current=true;generation.current++;setSaving(true);setError('');
  let succeeded=false;
  try{
   const result=await api<{userId:string;day:string}>('/notifications/read',{expectedUserId:userId,day:data.day,categories});
   if(!alive.current)return;
   if(result.userId!==userId)throw new Error('Tài khoản đã đổi. Vui lòng tải lại trang.');
   succeeded=true;
   setData(previous=>previous?{...previous,items:previous.items.map(item=>({...item,read:item.read||categories.includes(item.category)}))}:previous);
   if(destination){setOpen(false);navigate(`/ca-nhan/on-tap?type=${destination}`);}
  }catch(e){if(alive.current)setError(e instanceof Error?e.message:'Chưa lưu được trạng thái đã đọc.');}
  finally{pending.current=false;if(alive.current){setSaving(false);setLoading(false);if(succeeded)void refresh();}}
 }
 const unread=data?.items.filter(i=>!i.read).length??0;
 return <div ref={root} className="relative">
  <button ref={button} aria-label={unread?`Thông báo, ${unread} chưa đọc`:'Thông báo'} aria-expanded={open} aria-controls="notification-panel" title="Thông báo" disabled={authBusy} onClick={()=>{setOpen(v=>!v);if(!open)void refresh();}} className="relative p-1.5 rounded-full hover:bg-[#eae3d5] dark:hover:bg-[#292524] text-[#292524] dark:text-[#d6d3d1] transition-colors">
   <Bell className="w-4 h-4"/>{!!unread&&<span aria-hidden="true" className="absolute right-1 top-0.5 h-2 w-2 rounded-full bg-rose-500 border border-white"/>}
  </button>
  {open&&<section id="notification-panel" aria-label="Thông báo ôn tập" className="fixed top-14 right-3 w-[calc(100vw-1.5rem)] max-w-sm max-h-[75dvh] overflow-y-auto rounded-xl border-2 border-[#292524] bg-[#fcf9f2] text-[#292524] shadow-sketch p-3 sm:absolute sm:top-full sm:right-0 sm:mt-2 sm:w-80 z-50">
   <div className="flex items-center justify-between gap-2 mb-2"><h2 className="font-bold">Thông báo</h2><button aria-label="Đóng thông báo" className="p-1 rounded hover:bg-stone-200" onClick={()=>{setOpen(false);button.current?.focus();}}><X size={18}/></button></div>
   {!userId?<div className="text-sm"><p>Đăng nhập để nhận nhắc ôn tập của bạn.</p><button className="mt-3 font-bold text-blue-600" onClick={()=>{setOpen(false);onLogin();}}>Đăng nhập</button></div>:<>
    {error&&<div role="alert" className="text-sm text-red-700 mb-2">{error} <button disabled={loading||saving} className="underline" onClick={()=>void refresh()}>Thử lại</button></div>}
    {loading&&!data&&<p role="status" className="text-sm py-3">Đang tải thông báo…</p>}
    {data&&!data.items.length&&!error&&<p className="py-3 text-sm text-stone-600">Bạn chưa có thẻ đến hạn ôn.</p>}
    {!!data?.items.length&&<ul className="space-y-2">{data.items.map(item=><li key={item.category}><button disabled={saving||authBusy} onClick={()=>void mark([item.category],item.category)} className={`w-full text-left rounded-lg border p-3 text-sm disabled:opacity-50 ${item.read?'border-stone-200 bg-white':'border-blue-200 bg-blue-50'}`}><span className="block font-bold">{item.label}: {item.count} thẻ cần ôn</span><span className="block mt-1 text-xs text-stone-500">{item.read?'Đã đọc':'Chưa đọc'} · Mở Ôn tập</span></button></li>)}</ul>}
    {!!unread&&<button disabled={saving||loading||authBusy} onClick={()=>void mark(data!.items.filter(i=>!i.read).map(i=>i.category))} className="mt-3 text-xs font-bold text-blue-600 disabled:opacity-50">{saving?'Đang lưu…':'Đánh dấu tất cả đã đọc'}</button>}
   </>}
  </section>}
 </div>;
}
