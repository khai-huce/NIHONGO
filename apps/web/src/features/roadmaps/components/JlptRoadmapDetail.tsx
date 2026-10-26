import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Clock, FileText, Flame, Languages, Play } from 'lucide-react';
import type { JlptLevel, JlptRoadmapView, JlptSessionView, JlptStudy, JlptStudySession } from '@nihongo/shared/contracts/jlpt';
import { RoughCard } from '../../../shared/ui/RoughCard';
import { DartboardCrowMascot } from '../../../shared/study/components/StudyMascots';
import { formatJlptMinutes, JLPT_LEVEL_PRESENTATION, JLPT_RESOURCE_LABELS, jlptResourceHref, sourceWebUrl } from '../utils/jlpt-catalog';

function TestButton({ onClick, disabled, count }: { onClick: () => void; disabled: boolean; count: number }) {
  return <button type="button" onClick={onClick} disabled={disabled || count < 5} className="text-xs text-blue-600 font-bold disabled:text-stone-400 disabled:cursor-not-allowed"><FileText className="mr-1 inline w-4 h-4" />{count >= 5 ? 'Làm bài kiểm tra ngay' : 'Chưa có đề kiểm tra'}</button>;
}

function SessionCard({ session, number, expanded, onToggle, state, busy, onOpen, onTest, onHistory }: { session: JlptSessionView; number: number; expanded: boolean; onToggle: () => void; state?: JlptStudySession; busy: boolean; onOpen: (id: string, href?: string) => void; onTest: (id: string) => void; onHistory: (id: string) => void }) {
  const firstLink = session.resources.map(jlptResourceHref).find(Boolean);
  const unlocked = state?.unlocked === true;
  return <RoughCard fill="#ffffff" stroke="#292524" borderRadius={14} roughness={0.7} className={`p-4 md:p-5 shadow-sketch transition-all ${expanded ? 'ring-2 ring-[#0094ff]/30' : ''}`}>
    <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={`jlpt-session-${session.id}`} className="flex w-full items-start justify-between gap-2 text-left">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-stone-100 border-sketch-subtle flex items-center justify-center shrink-0"><Languages className="w-4 h-4 text-slate-700" /></div>
        <div className="min-w-0"><h3 className="text-xs md:text-sm font-black text-[#292524] break-words">{session.title}</h3><p className="text-[11px] font-bold text-slate-500 break-words">{session.description}</p></div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className="px-2 py-0.5 rounded-full border-sketch-pill text-[10px] font-bold text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /><span>{formatJlptMinutes(session.estimatedMinutes)}</span></span>
        <span className="flex items-center gap-1.5"><span className="px-2 py-0.5 rounded-full border-sketch-pill text-[10px] font-black text-slate-700 bg-stone-50">BUỔI {number}</span>{expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}</span>
      </div>
    </button>
    <div className="flex items-center gap-2 pt-3"><div aria-hidden="true" className="relative flex-1 h-2 border-sketch-subtle rounded-full bg-slate-100 overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: state?.completedAt ? '100%' : '0%' }} /></div><span className="text-[10px] font-bold text-slate-400">{state?.completedAt ? 'Đã đạt' : unlocked ? 'Đang mở' : 'Chưa mở'}{state?.bestScore != null ? ` · Cao nhất ${state.bestScore.toFixed(1)}%` : ''}</span></div>
    {expanded && <div id={`jlpt-session-${session.id}`} className="mt-3 pt-3 space-y-3 border-t border-slate-200">
      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">NỘI DUNG BUỔI HỌC</span>
      {session.resources.map(resource => {
        const href = jlptResourceHref(resource);
        const content = <><BookOpen className="w-4 h-4 shrink-0 mt-0.5" /><div className="min-w-0"><h4 className="text-xs font-black break-words">{resource.title}</h4><p className="text-[11px] font-medium text-slate-500 break-words">{JLPT_RESOURCE_LABELS[resource.kind]}{resource.subtitle ? ` · ${resource.subtitle}` : ''}</p>{!href && <p className="mt-1 text-[11px] text-amber-700">Nội dung hiện chưa khả dụng.</p>}</div></>;
        return href && unlocked ? <button type="button" disabled={busy} key={resource.id} onClick={() => onOpen(session.id, href)} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-stone-50 border-sketch-subtle text-[#292524] hover:bg-blue-50 focus-visible:outline-blue-500 text-left w-full">{content}</button> : <div key={resource.id} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-stone-50 border-sketch-subtle text-stone-400">{content}</div>;
      })}
      {firstLink && unlocked ? <button disabled={busy} onClick={() => onOpen(session.id, firstLink)} className="block w-full"><RoughCard fill="#0094ff" stroke="#0284c7" borderRadius={8} roughness={0.7} className="p-2.5 text-white font-black text-xs shadow-xs"><span className="flex items-center justify-center gap-1.5"><Play className="w-3.5 h-3.5 fill-white" />Vào học buổi {number}</span></RoughCard></button> : <p className="text-xs text-amber-700">{unlocked ? 'Buổi này chưa có nội dung khả dụng để mở.' : 'Đăng nhập và đạt các buổi trước để mở buổi này.'}</p>}
      <div className="flex flex-wrap justify-center gap-3"><TestButton count={session.questionCount} disabled={!unlocked || busy} onClick={() => onTest(session.id)} />{state && state.attempts > 0 && <button className="text-xs underline" onClick={() => onHistory(session.id)}>Lịch sử ({state.attempts})</button>}</div>
    </div>}
  </RoughCard>;
}

export function JlptRoadmapDetail({ level, roadmap, study, busy, onOpen, onTest, onHistory, selectedSession }: { level: JlptLevel; roadmap: JlptRoadmapView; study: JlptStudy | null; busy: boolean; onOpen: (id: string, href?: string) => void; onTest: (id: string) => void; onHistory: (id: string) => void; selectedSession: string | null }) {
  const presentation = JLPT_LEVEL_PRESENTATION.find(item => item.id === level)!;
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(selectedSession ?? study?.resumeSessionId ?? roadmap.sessions[0]?.id ?? null);
  const firstSession = roadmap.sessions.find(s => s.id === study?.resumeSessionId) ?? roadmap.sessions[0];
  const firstNumber = roadmap.sessions.findIndex(s => s.id === firstSession?.id) + 1;
  const firstLink = firstSession?.resources.map(jlptResourceHref).find(Boolean);
  const sourceHref = sourceWebUrl(roadmap.source.url), licenseHref = sourceWebUrl(roadmap.source.licenseUrl);
  return <>
    <div className="space-y-1">
      <div className="flex items-center gap-2.5"><h1 className="text-2xl md:text-3xl font-black text-[#292524] font-sketch tracking-tight">Lộ trình học</h1><span className={`px-2 py-0.5 text-xs font-black text-white rounded-md ${presentation.badgeBg}`}>{level}</span></div>
      <p className="text-xs md:text-sm font-bold text-[#78716c] leading-relaxed">{roadmap.title} — {roadmap.sessionCount} buổi theo lộ trình.</p>
      {roadmap.description && <p className="text-xs text-slate-500 leading-relaxed">{roadmap.description}</p>}
    </div>
    <RoughCard fill="#ffffff" stroke="#292524" borderRadius={14} roughness={0.7} className="p-5 md:p-6 shadow-sketch">
      <div className="flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="flex items-center gap-5 w-full md:w-auto min-w-0">
          <div title="Tiến độ theo buổi đạt kiểm tra" className="relative w-20 h-20 md:w-24 md:h-24 rounded-full border-4 border-slate-200 flex flex-col items-center justify-center shrink-0"><span className="text-lg md:text-xl font-black text-[#292524]">{study ? `${study.percent}%` : '—'}</span><span className="text-[9px] font-bold text-slate-400 tracking-wider">LỘ TRÌNH</span></div>
          <div className="space-y-1.5 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-black text-[#0094ff]"><Play className="w-3.5 h-3.5 fill-current" /><span>BUỔI HỌC TIẾP THEO</span></div>
            <h2 className="text-lg md:text-xl font-black text-[#292524] font-sketch break-words">{firstSession?.title ?? 'Chưa có buổi học'}</h2>
            <p className="text-xs font-bold text-slate-500 break-words">{firstSession?.description}</p>
            <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px] font-bold text-slate-500"><span className={`px-1.5 py-0.5 rounded ${presentation.badgeBg} text-white text-[10px] font-black`}>{level}</span><span>Buổi {firstSession ? firstNumber : '—'} / {roadmap.sessionCount}</span><span>·</span><span>Đạt {study?.completedCount ?? '—'} buổi</span>{firstSession && <><span>·</span><span>Buổi này ≈ {formatJlptMinutes(firstSession.estimatedMinutes)}</span></>}</div>
          </div>
        </div>
        <div className="flex flex-col items-end w-full md:w-auto shrink-0 space-y-2">
          <div className="hidden sm:block"><DartboardCrowMascot className="w-16 h-16" /></div>
          {firstLink ? <button disabled={busy} onClick={() => onOpen(firstSession.id, firstLink)} className="w-full md:w-auto"><RoughCard fill="#0094ff" stroke="#0284c7" borderRadius={8} roughness={0.7} className="text-white px-5 py-2.5 text-xs font-black shadow-xs"><span className="flex items-center justify-center gap-1.5"><Play className="w-3.5 h-3.5 fill-white" />Vào học buổi {firstNumber}</span></RoughCard></button> : <span className="text-xs text-amber-700">Chưa có nội dung khả dụng</span>}
          <TestButton count={firstSession?.questionCount ?? 0} disabled={busy} onClick={() => firstSession && onTest(firstSession.id)} />
        </div>
      </div>
    </RoughCard>
    <p className="text-xs text-stone-500 leading-relaxed">Đạt từ {roadmap.passPercent}% bài kiểm tra để hoàn thành buổi và mở buổi tiếp theo. Học lại giữ mốc đã đạt. Chỉ mở nội dung không tính hoàn thành.</p>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
      <StatCard label="TIẾN ĐỘ TỔNG"><div className="text-xl font-black text-[#292524]">{study ? `${study.percent}%` : '—'}</div><p className="text-[10px] font-bold text-slate-400">Dự kiến: {formatJlptMinutes(roadmap.estimatedMinutes)}</p></StatCard>
      <StatCard label="BUỔI ĐÃ ĐẠT"><div className="text-xl font-black text-[#292524]">{study?.completedCount ?? '—'} / {roadmap.sessionCount}</div></StatCard>
      <StatCard label="KANJI ĐÃ HỌC"><div className="text-xl font-black text-[#292524]">{study?.kanjiLearned ?? '—'} / {roadmap.kanjiCount}</div></StatCard>
      <StatCard label="STREAK"><div className="text-xl font-black text-orange-600 flex items-center gap-1"><span>{study?.streak ?? '—'} ngày</span><Flame className="w-4 h-4 fill-orange-500 text-orange-500" /></div></StatCard>
    </div>
    <div className="pt-2 flex flex-col items-center"><div className="flex items-center gap-2.5 px-5 py-2 rounded-full border-sketch-blue bg-white shadow-sketch"><div className={`w-6 h-6 rounded-md ${presentation.badgeBg} text-white flex items-center justify-center font-black text-xs font-sketch`}>{level}</div><div><h2 className="text-xs md:text-sm font-black text-[#292524] font-sketch leading-tight">{level} · {presentation.name}</h2><p className="text-[10px] font-bold text-slate-500">{roadmap.sessionCount} buổi · {formatJlptMinutes(roadmap.estimatedMinutes)} dự kiến</p></div></div></div>
    <div className="relative py-4">
      <div aria-hidden="true" className="hidden md:block absolute left-1/2 top-0 bottom-6 w-0.5 bg-slate-300 -translate-x-1/2 z-0" />
      <div className="space-y-6 relative z-10">{roadmap.sessions.map((session, index) => {
        const even = (index + 1) % 2 === 0;
        return <div key={session.id} className="grid grid-cols-1 md:grid-cols-[1fr_48px_1fr] items-start gap-4">
          {even && <div className="hidden md:block" />}
          {!even && <div className="relative"><div aria-hidden="true" className="hidden md:block absolute right-[-24px] top-6 w-6 h-0.5 bg-slate-300 z-0" /><SessionCard session={session} number={index + 1} expanded={expandedSessionId === session.id} state={study?.sessions.find(s => s.id === session.id)} busy={busy} onOpen={onOpen} onTest={onTest} onHistory={onHistory} onToggle={() => setExpandedSessionId(old => old === session.id ? null : session.id)} /></div>}
          <div aria-hidden="true" className="hidden md:flex flex-col items-center justify-start pt-5"><div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sketch border-sketch-blue text-[#0094ff]"><Languages className="w-4 h-4" /></div></div>
          {even ? <div className="relative"><div aria-hidden="true" className="hidden md:block absolute left-[-24px] top-6 w-6 h-0.5 bg-slate-300 z-0" /><SessionCard session={session} number={index + 1} expanded={expandedSessionId === session.id} state={study?.sessions.find(s => s.id === session.id)} busy={busy} onOpen={onOpen} onTest={onTest} onHistory={onHistory} onToggle={() => setExpandedSessionId(old => old === session.id ? null : session.id)} /></div> : <div className="hidden md:block" />}
        </div>;
      })}</div>
    </div>
    <div className="border-t border-stone-200 pt-4 text-xs text-stone-500 space-y-1"><p>Nguồn lộ trình: {sourceHref ? <a className="underline" href={sourceHref} target="_blank" rel="noreferrer">{roadmap.source.name}</a> : roadmap.source.name}</p><p>{licenseHref ? <a className="underline" href={licenseHref} target="_blank" rel="noreferrer">{roadmap.source.license}</a> : roadmap.source.license}</p>{roadmap.source.attribution && <p>{roadmap.source.attribution}</p>}</div>
  </>;
}

function StatCard({ label, children }: { label: string; children: React.ReactNode }) {
  return <RoughCard fill="#ffffff" stroke="#292524" borderRadius={10} roughness={0.7} className="p-3.5 space-y-1 shadow-sketch"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">{label}</span>{children}</RoughCard>;
}

