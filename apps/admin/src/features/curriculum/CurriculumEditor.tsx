import { useToastFeedback } from '@nihongo/client/toast';
import { useEffect, useRef, useState } from 'react';
import type { AdminRequest, ContentSource } from '../../shared/types';
import { AdminApiError } from '../../shared/api';
import { AdminDialog } from '../../shared/ui/AdminDialog';
import { curriculumCounts, curriculumDraftCopy, curriculumRemoved, curriculumStatus, parseCurriculumJson } from '@nihongo/shared/curriculum/editor-data';
import { emptyCurriculumWord, type CurriculumDraft, type CurriculumRecord, type CurriculumWord } from '@nihongo/shared/contracts/curriculum';

const input='mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100';
const button='rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed';
const primary=`${button} !bg-blue-600 !border-blue-600 !text-white`;
type Props={course:CurriculumRecord|null;sources:ContentSource[];request:AdminRequest;onSaved:(course:CurriculumRecord)=>void;onClose:()=>void;onSourceAdded:(source:ContentSource)=>void;onDirtyChange:(dirty:boolean)=>void};
type Topic=CurriculumDraft['topics'][number];
type Lesson=Topic['lessons'][number];
const emptySource:ContentSource={id:'',name:'',url:'',license:'',licenseUrl:'',version:'',checksum:'',attribution:'',notes:''};
const sourceLabels:Record<keyof ContentSource,string>={id:'Mã nguồn',name:'Tên nguồn',url:'URL / URI nguồn',license:'Quyền sử dụng',licenseUrl:'URL / URI điều khoản',version:'Phiên bản / ngày',checksum:'Checksum (nếu có)',attribution:'Ghi công',notes:'Ghi chú'};
const copy=<T,>(value:T):T=>structuredClone(value);

export function CurriculumEditor({course,sources,request,onSaved,onClose,onSourceAdded,onDirtyChange}:Props){
  const [saved,setSaved]=useState(course),[draft,setDraft]=useState(()=>curriculumDraftCopy(course)),[slug,setSlug]=useState(course?.slug??'');
  const [baseline,setBaseline]=useState(()=>JSON.stringify({draft:curriculumDraftCopy(course),slug:course?.slug??''}));
  const [pending,setPending]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[conflict,setConflict]=useState(false);
  useToastFeedback({ success: notice, error });
  const [dialog,setDialog]=useState<'publish'|'archive'|'restore'|'reload'|'close'|'import'|'source'|'preview'|null>(null);
  const [selection,setSelection]=useState<{topicId:string;lessonId:string}|null>(null);
  const [removal,setRemoval]=useState<{title:string;apply:()=>void}|null>(null);
  const [jsonText,setJsonText]=useState(''),[importDraft,setImportDraft]=useState<CurriculumDraft|null>(null),[importError,setImportError]=useState('');
  const parsed=useRef<{text:string;value:unknown}|null>(null);
  const [sourceDraft,setSourceDraft]=useState<ContentSource>({...emptySource}),[sourceError,setSourceError]=useState('');
  const id=useRef(course?.id??crypto.randomUUID()),mounted=useRef(false),locked=useRef(false);
  const dirty=JSON.stringify({draft,slug})!==baseline;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const auxiliaryDirty=(dialog==='import'&&!!jsonText.trim())||(dialog==='source'&&JSON.stringify(sourceDraft)!==JSON.stringify(emptySource));
  useEffect(()=>{onDirtyChange(dirty||auxiliaryDirty||!!pending);return()=>onDirtyChange(false);},[dirty,auxiliaryDirty,pending,onDirtyChange]);
  const run=async(kind:string,action:()=>Promise<void>)=>{
    if(locked.current)return;locked.current=true;setPending(kind);setError('');setNotice('');
    try{await action();}catch(caught){if(mounted.current){setError(caught instanceof AdminApiError&&caught.issues.length?caught.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join('\n'):caught instanceof Error?caught.message:'Chưa thực hiện được.');if(caught instanceof AdminApiError&&['CURRICULUM_CHANGED','CURRICULUM_ARCHIVED','ACCOUNT_CHANGED'].includes(caught.code))setConflict(true);}}
    finally{locked.current=false;if(mounted.current)setPending('');}
  };
  const accept=(next:CurriculumRecord)=>{setSaved(next);setDraft(copy(next.draft));setSlug(next.slug);setBaseline(JSON.stringify({draft:next.draft,slug:next.slug}));setConflict(false);onSaved(next);};
  const save=()=>run('save',async()=>{
    const result=await request<{course:CurriculumRecord}>(saved?`/admin/curriculum/courses/${saved.id}`:'/admin/curriculum/courses',{method:saved?'PATCH':'POST',body:saved?{version:saved.version,draft}:{id:id.current,slug,draft}});
    if(mounted.current){accept(result.course);setNotice('Đã lưu bản nháp. Trang học chỉ thay đổi khi xuất bản.');}
  });
  const status=(action:'publish'|'archive'|'restore')=>run(action,async()=>{
    if(!saved)return;
    const result=await request<{course:CurriculumRecord}>(`/admin/curriculum/courses/${saved.id}/${action}`,{body:{version:saved.version}});
    if(mounted.current){accept(result.course);setDialog(null);setNotice(action==='publish'?'Đã xuất bản giáo trình.':action==='archive'?'Đã lưu trữ; lịch sử và thẻ ôn được giữ.':'Đã khôi phục về bản nháp, chưa hiển thị trên trang học.');}
  });
  const reload=()=>run('reload',async()=>{
    const result=await request<{course:CurriculumRecord}>(`/admin/curriculum/courses/${saved!.id}`);
    if(mounted.current){accept(result.course);setDialog(null);setSelection(null);}
  });
  const patchTopic=(topicId:string,change:(topic:Topic)=>Topic)=>setDraft(old=>({...old,topics:old.topics.map(topic=>topic.id===topicId?change(topic):topic)}));
  const patchLesson=(topicId:string,lessonId:string,change:(lesson:Lesson)=>Lesson)=>patchTopic(topicId,topic=>({...topic,lessons:topic.lessons.map(lesson=>lesson.id===lessonId?change(lesson):lesson)}));
  const selectedTopic=draft.topics.find(topic=>topic.id===selection?.topicId),selectedLesson=selectedTopic?.lessons.find(lesson=>lesson.id===selection?.lessonId);
  const source=sources.find(item=>item.id===draft.sourceId),counts=curriculumCounts(draft);
  const canPublish=!!saved&&!dirty&&!pending&&!conflict&&!saved.archivedAt&&!!source&&counts.topics>0&&draft.topics.every(topic=>topic.lessons.length>0&&topic.lessons.every(lesson=>lesson.words.length>0));
  const downloadDraft=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=`${slug.replace(/[^a-z0-9-]/gi,'-')||'giao-trinh'}.json`;link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const previewImport=()=>run('import',async()=>{
    setImportError('');setImportDraft(null);
    try{
      if(new TextEncoder().encode(jsonText).byteLength>4*1024*1024)throw new Error('JSON vượt giới hạn 4 MB.');
      if(parsed.current?.text!==jsonText)parsed.current={text:jsonText,value:parseCurriculumJson(jsonText)};
      const result=await request<{draft:CurriculumDraft}>('/admin/curriculum/courses/preview',{body:{draft:parsed.current.value}});
      if(mounted.current)setImportDraft(result.draft);
    }catch(caught){if(mounted.current)setImportError(caught instanceof AdminApiError&&caught.issues.length?caught.issues.map(issue=>`${issue.path.join('.')}: ${issue.message}`).join('\n'):caught instanceof Error?caught.message:'JSON không hợp lệ.');}
  });
  const createSource=()=>run('source',async()=>{
    setSourceError('');
    try{
      const result=await request<{source:ContentSource}>('/admin/content/sources',{body:{source:sourceDraft}});
      if(mounted.current){onSourceAdded(result.source);setDraft(old=>({...old,sourceId:result.source.id}));setDialog(null);}
    }catch(caught){if(mounted.current)setSourceError(caught instanceof Error?caught.message:'Chưa tạo được nguồn.');}
  });
  const move=<T,>(items:T[],index:number,offset:number)=>{const next=[...items];if(index+offset<0||index+offset>=items.length)return next;[next[index],next[index+offset]]=[next[index+offset],next[index]];return next;};
  return <section>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">{saved?'Biên tập giáo trình':'Thêm giáo trình'}</h1><p className="mt-1 text-sm text-slate-500">{saved?`Phiên bản ${saved.version} · ${curriculumStatus(saved)}`:'Bản nháp mới'}{dirty?' · Chưa lưu':''}</p></div><button className={button} disabled={!!pending} onClick={()=>dirty?setDialog('close'):onClose()}>Về danh sách</button></div>
    {error&&<div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}{conflict&&saved&&<button className="ml-2 font-semibold underline" onClick={()=>setDialog('reload')}>Tải bản mới nhất</button>}</div>}
    {notice&&<p role="status" className="mb-4 rounded bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {saved?.archivedAt&&<p className="mb-4 rounded bg-amber-50 p-3 text-sm text-amber-800">Giáo trình đã lưu trữ. Khôi phục về nháp để chỉnh sửa.</p>}
    <fieldset disabled={!!pending||!!saved?.archivedAt} className="space-y-5">
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
        <label className="text-sm font-medium">Tên giáo trình *<input className={input} maxLength={100} value={draft.title} onChange={event=>setDraft(old=>({...old,title:event.target.value}))}/></label>
        <label className="text-sm font-medium">Đường dẫn *<input className={input} disabled={!!saved} maxLength={80} placeholder="vi-du: nihongo-n5" value={slug} onChange={event=>setSlug(event.target.value)}/><span className="mt-1 block text-xs font-normal text-slate-500">Chữ thường, số, dấu gạch nối. Không đổi sau khi tạo.</span></label>
        <label className="text-sm font-medium">Mô tả ngắn<input className={input} maxLength={200} value={draft.subtitle} onChange={event=>setDraft(old=>({...old,subtitle:event.target.value}))}/></label>
        <label className="text-sm font-medium">Trình độ<select className={input} value={draft.level} onChange={event=>setDraft(old=>({...old,level:event.target.value as CurriculumDraft['level']}))}>{['N5','N4','N3','N2','N1','SE'].map(level=><option key={level}>{level}</option>)}</select></label>
        <label className="text-sm font-medium">Mẫu bìa<select className={input} value={draft.style} onChange={event=>setDraft(old=>({...old,style:event.target.value as CurriculumDraft['style']}))}>{[['custom','Mặc định'],['tango','Bìa màu theo trình độ'],['minna','Minna'],['mimikara','Mimikara'],['tettei','Tettei'],['it','IT']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label className="text-sm font-medium">Nguồn nội dung<select className={input} value={draft.sourceId??''} onChange={event=>setDraft(old=>({...old,sourceId:event.target.value||null}))}><option value="">Chưa chọn (chỉ lưu nháp)</option>{sources.map(item=><option key={item.id} value={item.id}>{item.name} · {item.version}</option>)}</select></label>
        <label className="text-sm font-medium sm:col-span-2">Giới thiệu<textarea className={input} rows={2} maxLength={2000} value={draft.description} onChange={event=>setDraft(old=>({...old,description:event.target.value}))}/></label>
        <div className="text-xs leading-6 text-slate-500 sm:col-span-2">{source&&<><p>{source.license} · {source.attribution}</p><p className="break-all">{source.url}</p></>}<button type="button" className={button} onClick={()=>{setSourceDraft({...emptySource});setSourceError('');setDialog('source');}}>Thêm nguồn</button></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Chủ đề và bài học</h2><div className="flex flex-wrap gap-2"><button className={button} onClick={downloadDraft}>Tải JSON bản đang sửa</button><button className={button} onClick={()=>{setImportDraft(null);setImportError('');setDialog('import');}}>Nhập JSON</button><button className={button} disabled={draft.topics.length>=100} onClick={()=>setDraft(old=>({...old,topics:[...old.topics,{id:crypto.randomUUID(),title:'Chủ đề mới',japanese:'',lessons:[]}]}))}>Thêm chủ đề</button></div></div>
      <p className="text-xs text-slate-500">{counts.topics} chủ đề · {counts.lessons} bài · {counts.words} từ. Thứ tự bên dưới là thứ tự hiển thị trên trang học.</p>
      {!draft.topics.length&&<p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Chưa có chủ đề. Thêm chủ đề hoặc nhập JSON của bạn.</p>}
      {draft.topics.map((topic,topicIndex)=><section key={topic.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-end gap-3"><label className="min-w-40 flex-1 text-sm font-medium">Tên chủ đề {topicIndex+1}<input className={input} maxLength={100} value={topic.title} onChange={event=>patchTopic(topic.id,old=>({...old,title:event.target.value}))}/></label><label className="min-w-40 flex-1 text-sm font-medium">Tên tiếng Nhật<input className={input} maxLength={200} value={topic.japanese} onChange={event=>patchTopic(topic.id,old=>({...old,japanese:event.target.value}))}/></label><div className="flex gap-1"><button className={button} aria-label={`Đưa chủ đề ${topicIndex+1} lên`} disabled={topicIndex===0} onClick={()=>setDraft(old=>({...old,topics:move(old.topics,topicIndex,-1)}))}>↑</button><button className={button} aria-label={`Đưa chủ đề ${topicIndex+1} xuống`} disabled={topicIndex===draft.topics.length-1} onClick={()=>setDraft(old=>({...old,topics:move(old.topics,topicIndex,1)}))}>↓</button><button className={`${button} text-red-700`} onClick={()=>setRemoval({title:`Bỏ chủ đề “${topic.title}” cùng ${topic.lessons.length} bài khỏi bản nháp?`,apply:()=>{setDraft(old=>({...old,topics:old.topics.filter(item=>item.id!==topic.id)}));setSelection(null);}})}>Bỏ chủ đề</button></div></div>
        <div className="mt-4 space-y-2">{topic.lessons.map((lesson,lessonIndex)=><div key={lesson.id} className={`flex flex-wrap items-center gap-2 rounded-lg border p-3 ${selection?.lessonId===lesson.id?'border-blue-300 bg-blue-50':'border-slate-200 bg-slate-50'}`}><label className="min-w-32 flex-1"><span className="sr-only">Tên bài {lessonIndex+1} trong {topic.title}</span><input className={`${input} !mt-0`} maxLength={100} value={lesson.title} onChange={event=>patchLesson(topic.id,lesson.id,old=>({...old,title:event.target.value}))}/></label><span className="text-xs text-slate-500">{lesson.words.length} từ</span><button className={button} onClick={()=>setSelection({topicId:topic.id,lessonId:lesson.id})}>Biên tập từ</button><button className={button} aria-label={`Đưa bài ${lessonIndex+1} lên`} disabled={lessonIndex===0} onClick={()=>patchTopic(topic.id,old=>({...old,lessons:move(old.lessons,lessonIndex,-1)}))}>↑</button><button className={button} aria-label={`Đưa bài ${lessonIndex+1} xuống`} disabled={lessonIndex===topic.lessons.length-1} onClick={()=>patchTopic(topic.id,old=>({...old,lessons:move(old.lessons,lessonIndex,1)}))}>↓</button><button className={`${button} text-red-700`} onClick={()=>setRemoval({title:`Bỏ “${lesson.title}” cùng ${lesson.words.length} từ khỏi bản nháp?`,apply:()=>{patchTopic(topic.id,old=>({...old,lessons:old.lessons.filter(item=>item.id!==lesson.id)}));setSelection(null);}})}>Bỏ bài</button></div>)}</div><button className={`${button} mt-3`} disabled={counts.lessons>=500} onClick={()=>{const lesson={id:crypto.randomUUID(),title:`Bài ${topic.lessons.length+1}`,words:[]};patchTopic(topic.id,old=>({...old,lessons:[...old.lessons,lesson]}));setSelection({topicId:topic.id,lessonId:lesson.id});}}>Thêm bài vào chủ đề</button>
      </section>)}
      {selectedTopic&&selectedLesson&&<section className="rounded-xl border border-blue-200 bg-white p-5"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{selectedLesson.title}</h2><p className="text-xs text-slate-500">{selectedTopic.title} · {selectedLesson.words.length}/500 từ</p></div><button className={button} disabled={selectedLesson.words.length>=500||counts.words>=5000} onClick={()=>patchLesson(selectedTopic.id,selectedLesson.id,old=>({...old,words:[...old.words,emptyCurriculumWord()]}))}>Thêm từ</button></div>
        <div className="space-y-4">{selectedLesson.words.map((word,index)=><WordEditor key={word.id} word={word} index={index} update={next=>patchLesson(selectedTopic.id,selectedLesson.id,old=>({...old,words:old.words.map(item=>item.id===word.id?next:item)}))} remove={()=>setRemoval({title:`Bỏ từ “${word.word||'chưa nhập'}” khỏi bản nháp?`,apply:()=>patchLesson(selectedTopic.id,selectedLesson.id,old=>({...old,words:old.words.filter(item=>item.id!==word.id)}))})} />)}</div>
      </section>}
    </fieldset>
    <div className="sticky bottom-0 z-10 mt-6 flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50/95 py-4"><button className={primary} disabled={!!pending||!dirty||!!saved?.archivedAt||conflict} onClick={()=>void save()}>{pending==='save'?'Đang lưu…':'Lưu bản nháp'}</button><button className={button} disabled={!!pending} onClick={()=>setDialog('preview')}>Xem trước nội dung</button><button className={primary} disabled={!canPublish} onClick={()=>setDialog('publish')}>Xuất bản…</button>{saved&&<button className={button} disabled={!!pending||dirty||conflict} onClick={()=>setDialog(saved.archivedAt?'restore':'archive')}>{saved.archivedAt?'Khôi phục về nháp…':'Lưu trữ…'}</button>}<span className="text-xs text-slate-500">Lưu nháp → kiểm tra → xuất bản.</span></div>
    {dialog==='preview'&&<AdminDialog title="Xem trước nội dung giáo trình" onClose={()=>setDialog(null)}><h3 className="text-xl font-semibold">{draft.title||'Chưa nhập tên'}</h3><p className="my-3 text-sm text-slate-500">{counts.topics} chủ đề · {counts.lessons} bài · {counts.words} từ</p><DraftPreview draft={draft}/></AdminDialog>}
    {dialog==='import'&&<AdminDialog title="Nhập giáo trình từ JSON" busy={!!pending} onClose={()=>setDialog(null)}><p className="mb-3 text-sm text-slate-600">Nhập bản nháp gồm title, level, sourceId và topics. ID có sẵn được giữ; mục thiếu ID được cấp mới. Xác nhận chỉ thay nội dung trong trình sửa, cần Lưu bản nháp để ghi database.</p><label className="text-sm font-medium">Chọn file JSON<input type="file" accept=".json,application/json" disabled={!!pending} className="my-2 block text-sm" onChange={event=>{const file=event.target.files?.[0];if(!file)return;if(file.size>4*1024*1024){setImportError('File vượt 4 MB.');return;}void file.text().then(text=>{if(mounted.current){setJsonText(text);setImportDraft(null);setImportError('');}}).catch(()=>setImportError('Không đọc được file.'));}}/></label><label className="text-sm font-medium">Nội dung JSON<textarea className={`${input} font-mono text-xs`} rows={10} value={jsonText} disabled={!!pending} onChange={event=>{setJsonText(event.target.value);setImportDraft(null);setImportError('');}}/></label>{importError&&<pre role="alert" className="my-3 whitespace-pre-wrap rounded bg-red-50 p-3 text-xs text-red-700">{importError}</pre>}<button className={`${button} my-3`} disabled={!!pending||!jsonText.trim()} onClick={()=>void previewImport()}>Kiểm tra và xem trước</button>{importDraft&&<><div className="my-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm"><p>{curriculumCounts(importDraft).topics} chủ đề · {curriculumCounts(importDraft).lessons} bài · {curriculumCounts(importDraft).words} từ hợp lệ.</p><p>Bản đang sửa sẽ thay bằng dữ liệu này. Bỏ {curriculumRemoved(draft,importDraft).topics} chủ đề, {curriculumRemoved(draft,importDraft).lessons} bài, {curriculumRemoved(draft,importDraft).words} từ khỏi bản nháp; lịch sử đã lưu được giữ.</p></div><DraftPreview draft={importDraft}/><button className={`${primary} mt-4`} disabled={!!pending} onClick={()=>{setDraft(copy(importDraft));setSelection(null);setDialog(null);setNotice('Đã áp dụng bản xem trước. Hãy lưu bản nháp để ghi dữ liệu.');}}>Xác nhận dùng bản nhập</button></>}</AdminDialog>}
    {dialog==='source'&&<AdminDialog title="Thêm nguồn nội dung" busy={!!pending} onClose={()=>setDialog(null)}><p className="mb-4 text-sm text-slate-600">Ghi nguồn và quyền sử dụng thực tế. Metadata nguồn không thay đổi sau khi tạo.</p><form onSubmit={event=>{event.preventDefault();void createSource();}}><fieldset disabled={!!pending} className="grid gap-3 sm:grid-cols-2">{(Object.keys(emptySource) as (keyof ContentSource)[]).map(key=><label key={key} className="text-sm font-medium">{sourceLabels[key]}<input className={input} required={!['checksum','notes'].includes(key)} value={sourceDraft[key]} onChange={event=>setSourceDraft(old=>({...old,[key]:event.target.value}))}/></label>)}</fieldset>{sourceError&&<p role="alert" className="my-3 text-sm text-red-700">{sourceError}</p>}<button className={`${primary} mt-4`} disabled={!!pending}>Tạo nguồn</button></form></AdminDialog>}
    {dialog&&['publish','archive','restore','reload','close'].includes(dialog)&&<AdminDialog title={dialog==='publish'?'Xuất bản giáo trình':dialog==='archive'?'Lưu trữ giáo trình':dialog==='restore'?'Khôi phục giáo trình':dialog==='reload'?'Tải bản mới nhất':'Thay đổi chưa lưu'} busy={!!pending} onClose={()=>setDialog(null)}><p className="text-sm leading-6 text-slate-600">{dialog==='publish'?`Xuất bản ${counts.topics} chủ đề, ${counts.lessons} bài và ${counts.words} từ? Nội dung mới sẽ xuất hiện trên trang học; thẻ ôn hiện có cập nhật nội dung và giữ lịch.`:dialog==='archive'?'Ẩn giáo trình khỏi trang học. Bài, tiến độ, kết quả và thẻ ôn vẫn được giữ.':dialog==='restore'?'Khôi phục về bản nháp. Bạn cần xuất bản lại để hiển thị trên trang học.':'Bỏ các thay đổi chưa lưu trong trình sửa? Dữ liệu đã lưu trên máy chủ vẫn được giữ.'}</p>{error&&<p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button className={button} disabled={!!pending} onClick={()=>setDialog(null)}>Hủy</button><button className={primary} disabled={!!pending} onClick={()=>{if(dialog==='reload')void reload();else if(dialog==='close')onClose();else void status(dialog as 'publish'|'archive'|'restore');}}>{dialog==='publish'?'Xác nhận xuất bản':dialog==='archive'?'Xác nhận lưu trữ':dialog==='restore'?'Khôi phục về nháp':dialog==='reload'?'Tải lại và bỏ thay đổi':'Bỏ thay đổi và đóng'}</button></div></AdminDialog>}
    {removal&&<AdminDialog title="Bỏ nội dung khỏi bản nháp" onClose={()=>setRemoval(null)}><p>{removal.title}</p><p className="mt-2 text-sm text-slate-500">Thay đổi có hiệu lực trên trang học sau khi lưu và xuất bản. Tiến độ đã lưu, kết quả và thẻ ôn được giữ.</p><div className="mt-5 flex justify-end gap-2"><button className={button} onClick={()=>setRemoval(null)}>Hủy</button><button className={primary} onClick={()=>{removal.apply();setRemoval(null);}}>Bỏ khỏi bản nháp</button></div></AdminDialog>}
  </section>;
}

function WordEditor({word,index,update,remove}:{word:CurriculumWord;index:number;update:(word:CurriculumWord)=>void;remove:()=>void}){
  const patchRuby = (index:number, field:'text'|'reading', value:string) => update({...word,ruby:word.ruby.map((part,i)=>i===index ? {...part,[field]:field==='reading'&&!value ? undefined : value} : part)});
  return <details open className="rounded-lg border border-slate-200 p-4">
    <summary className="cursor-pointer text-sm font-semibold">Từ {index+1}{word.word?` — ${word.word}`:''}</summary>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {([['word','Từ tiếng Nhật *',500],['reading','Cách đọc',500],['hanViet','Hán Việt',200],['meaning','Nghĩa tiếng Việt *',2000],['romaji','Romaji (nếu có)',500],['exampleJp','Câu ví dụ tiếng Nhật',2000],['exampleVi','Dịch câu ví dụ',2000]] as const).map(([key,label,max])=><label key={key} className="text-sm">{label}<input className={input} maxLength={max} value={word[key]} onChange={event=>update({...word,[key]:event.target.value})}/></label>)}
      <label className="text-sm">Từ loại (ngăn bằng dấu phẩy)<input className={input} value={word.partOfSpeech.join(',')} onChange={event=>update({...word,partOfSpeech:event.target.value ? event.target.value.split(',') : []})}/></label>
      <div className="sm:col-span-2">
        <p className="mb-2 text-sm">Furigana (tùy chọn)</p>
        {word.ruby.map((part,i)=><div key={i} className="mb-2 flex flex-wrap items-end gap-2">
          <label className="min-w-24 flex-1 text-xs">Chữ gốc {i+1}<input className={input} maxLength={500} value={part.text} onChange={event=>patchRuby(i,'text',event.target.value)}/></label>
          <label className="min-w-24 flex-1 text-xs">Kana {i+1}<input className={input} maxLength={500} value={part.reading??''} onChange={event=>patchRuby(i,'reading',event.target.value)}/></label>
          <button className={button} aria-label={`Bỏ đoạn Furigana ${i+1}`} onClick={()=>update({...word,ruby:word.ruby.filter((_,position)=>position!==i)})}>Bỏ</button>
        </div>)}
        <button className={button} disabled={word.ruby.length>=500} onClick={()=>update({...word,ruby:[...word.ruby,{text:''}]})}>Thêm đoạn Furigana</button>
        <p className="mt-2 text-xs text-slate-500">Ghép các chữ gốc theo thứ tự phải đúng từ tiếng Nhật. Kana để trống nếu đoạn đó không cần chú thích.</p>
      </div>
    </div>
    <div className="mt-3 flex items-center justify-between gap-3"><span className="break-all text-[10px] text-slate-400">ID: {word.id}</span><button className={`${button} text-red-700`} onClick={remove}>Bỏ từ</button></div>
  </details>;
}

function DraftPreview({draft}:{draft:CurriculumDraft}){
  return <div className="max-h-[45vh] space-y-3 overflow-y-auto">{draft.topics.map(topic=><details key={topic.id} open className="rounded border border-slate-200 p-3"><summary className="font-medium">{topic.japanese} {topic.title} · {topic.lessons.length} bài</summary>{topic.lessons.map(lesson=><details key={lesson.id} className="ml-3 mt-2 border-l border-slate-200 pl-3"><summary className="cursor-pointer text-sm">{lesson.title} · {lesson.words.length} từ</summary><ul className="mt-2 space-y-1 text-sm text-slate-600">{lesson.words.map(word=><li key={word.id}>{word.word} {word.reading&&`(${word.reading})`} — {word.meaning}</li>)}</ul></details>)}</details>)}</div>;
}
