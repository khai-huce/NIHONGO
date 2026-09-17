import React, { useState, useRef } from 'react';
import { 
  MapPin, 
  Compass, 
  Edit3,
  Plus,
  Route,
  X,
  Trash2
} from 'lucide-react';
import { RoughCard, RoughButton } from '../components/RoughCard';
import { usePersonalRoadmaps, type PersonalRoadmap } from '../hooks/usePersonalRoadmaps';
import { analyzeRoadmapKanji, MAX_ROADMAP_TEXT, ROADMAP_PER_DAY } from '../../shared/roadmap.mjs';
import { DefaultRoadmapView } from '../components/DefaultRoadmapView';
import { RoadmapDeleteDialog } from '../components/RoadmapDeleteDialog';
import { PersonalRoadmapStudy } from '../components/PersonalRoadmapStudy';
import { useSearchParams } from 'react-router-dom';
import type { KanjiItem } from '../types';

export const PersonalRoadmapPage: React.FC<{userId:string|null; authBusy:boolean; onLogin:()=>void; onDetail:(item:KanjiItem)=>void}> = ({userId, authBusy, onLogin, onDetail}) => {
  const [search, setSearch] = useSearchParams();
  const selectedId = search.get('roadmap');
  const activeRoadmap = selectedId || search.get('tab') === 'my' ? 'my' : 'default';
  const setActiveRoadmap = (tab: 'default' | 'my') => setSearch(tab === 'my' ? {tab: 'my'} : {});

  const studyPlans = usePersonalRoadmaps(userId, authBusy);
  const customRoadmaps = studyPlans.roadmaps;
  const selectedRoadmap = customRoadmaps.find(item => item.id === selectedId);
  const requestedDay = Number(search.get('day'));
  const selectedDay = selectedRoadmap && Number.isInteger(requestedDay) && requestedDay >= 1 && requestedDay <= selectedRoadmap.totalDays ? requestedDay : selectedRoadmap?.currentDay ?? 1;
  const openStudy = (roadmap: PersonalRoadmap) => setSearch({tab: 'my', roadmap: roadmap.id, day: String(roadmap.currentDay)});

  // Create Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newRoadmapName, setNewRoadmapName] = useState('');
  const [newRoadmapKanjiText, setNewRoadmapKanjiText] = useState('');
  const [newRoadmapPerDay, setNewRoadmapPerDay] = useState<number>(10);
  const [editingRoadmap, setEditingRoadmap] = useState<PersonalRoadmap|null>(null);
  const [deletingRoadmap, setDeletingRoadmap] = useState<PersonalRoadmap|null>(null);
  const [formError, setFormError] = useState('');
  const draftId = useRef('');
  const actionPending = useRef(false);
  const {kanjiList:extractedKanji, unsupported} = analyzeRoadmapKanji(newRoadmapKanjiText);
  const perDayLocked = !!editingRoadmap && (!!editingRoadmap.startedAt || editingRoadmap.currentDay > 1);

  const openCreate = () => {
    if (studyPlans.busy || actionPending.current) return;
    draftId.current = crypto.randomUUID();
    setEditingRoadmap(null);
    setFormError('');
    setNewRoadmapName('');
    setNewRoadmapKanjiText('');
    setNewRoadmapPerDay(10);
    setIsCreateModalOpen(true);
  };
  const openEdit = (roadmap:PersonalRoadmap) => {
    if (studyPlans.busy || actionPending.current) return;
    setEditingRoadmap(roadmap);
    setFormError('');
    setNewRoadmapName(roadmap.name);
    setNewRoadmapKanjiText(roadmap.rawKanji);
    setNewRoadmapPerDay(roadmap.perDay);
    setIsCreateModalOpen(true);
  };
  const closeEditor = () => {
    if (!studyPlans.saving && !actionPending.current) setIsCreateModalOpen(false);
  };
  const handleSaveRoadmap = async () => {
    if (studyPlans.busy || actionPending.current) return;
    if (!newRoadmapName.trim()) { setFormError('Vui lòng nhập tên lộ trình!'); return; }
    if (!editingRoadmap && !extractedKanji.length) { setFormError('Vui lòng nhập hoặc dán ít nhất 1 chữ Kanji!'); return; }
    if (!editingRoadmap && unsupported.length) { setFormError('Hãy loại bỏ các chữ chưa có dữ liệu trước khi lưu.'); return; }
    actionPending.current = true;
    setFormError('');
    try {
      const saved = editingRoadmap
        ? await studyPlans.update(editingRoadmap, {name:newRoadmapName, perDay:newRoadmapPerDay})
        : await studyPlans.create(draftId.current, newRoadmapName, newRoadmapKanjiText, newRoadmapPerDay);
      if (saved) setIsCreateModalOpen(false);
    } finally { actionPending.current = false; }
  };

  const handleDeleteRoadmap = (roadmap: PersonalRoadmap, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.detail > 1 || studyPlans.busy || actionPending.current) return;
    setDeletingRoadmap(roadmap);
  };
  const confirmDelete = async () => {
    if (!deletingRoadmap || studyPlans.busy || actionPending.current) return;
    actionPending.current = true;
    try { if (await studyPlans.remove(deletingRoadmap)) setDeletingRoadmap(null); }
    finally { actionPending.current = false; }
  };

  const openLatest = async () => {
    if (studyPlans.loading || studyPlans.saving || actionPending.current) return;
    const latest = await studyPlans.reload();
    if (!latest || !editingRoadmap) return;
    const roadmap = latest.find(item => item.id === editingRoadmap.id);
    if (roadmap) {
      setEditingRoadmap(roadmap);
      setNewRoadmapName(roadmap.name);
      setNewRoadmapKanjiText(roadmap.rawKanji);
      setNewRoadmapPerDay(roadmap.perDay);
      setFormError('');
    } else setFormError('Lộ trình này đã bị xóa. Nội dung đang nhập vẫn được giữ để bạn sao chép.');
  };
  const status = (inEditor=false) => {
    const message = studyPlans.error || (studyPlans.loading ? 'Đang tải lộ trình…' : studyPlans.saving ? 'Đang lưu lộ trình…' : '');
    if (!message) return null;
    return <div role={studyPlans.error ? 'alert' : 'status'} className="text-xs text-amber-900 bg-amber-50 rounded-lg px-3 py-2">
      {message}
      {studyPlans.error && <>
        {inEditor && editingRoadmap && <span> Mở bản mới sẽ thay nội dung đang nhập bằng bản đã lưu.</span>}
        <button type="button" disabled={authBusy || studyPlans.loading || studyPlans.saving} className="ml-2 underline font-bold"
          onClick={() => { void (inEditor && editingRoadmap ? openLatest() : studyPlans.reload()); }}>
          {inEditor && editingRoadmap ? 'Mở bản mới' : 'Tải lại lộ trình'}
        </button>
      </>}
    </div>;
  };


  return (
    <div className="w-full min-h-[calc(100vh-48px)] bg-sketch-paper p-4 md:p-8 space-y-5 max-w-5xl mx-auto overflow-y-auto select-none">
      
      {/* Top Toggle: Lộ trình mặc định / Lộ trình của tôi */}
      <RoughCard fill="#ffffff" stroke="#292524" borderRadius={12} roughness={0.7} className="p-1 shadow-sketch">
        <div className="flex items-center justify-between gap-1">
          <button
            onClick={() => setActiveRoadmap('default')}
            className={`flex-1 py-2 px-4 flex items-center justify-center gap-2 font-bold text-sm transition-all rounded-lg cursor-pointer ${
              activeRoadmap === 'default'
                ? 'bg-[#0094ff] text-white shadow-xs'
                : 'text-[#57534e] hover:bg-[#f6f2e9]'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Lộ trình mặc định</span>
          </button>

          <button
            onClick={() => setActiveRoadmap('my')}
            className={`flex-1 py-2 px-4 flex items-center justify-center gap-2 font-bold text-sm transition-all rounded-lg cursor-pointer ${
              activeRoadmap === 'my'
                ? 'bg-[#ea580c] text-white shadow-xs'
                : 'text-[#57534e] hover:bg-[#f6f2e9]'
            }`}
          >
            <MapPin className="w-4 h-4" />
            <span>Lộ trình của tôi</span>
          </button>
        </div>
      </RoughCard>

      {/* ============================================================ */}
      {/* 1. VIEW: LỘ TRÌNH CỦA TÔI (MY CUSTOM ROADMAP - Images 1 & 2) */}
      {/* ============================================================ */}
      {activeRoadmap === 'my' && selectedId ? (
        selectedRoadmap ? <PersonalRoadmapStudy key={selectedRoadmap.id} roadmap={selectedRoadmap} day={selectedDay} plans={studyPlans}
          userId={userId} authBusy={authBusy} onLogin={onLogin} onDetail={onDetail}
          onBack={() => setActiveRoadmap('my')} onDay={day => setSearch({tab: 'my', roadmap: selectedId, day: String(day)}, {replace: true})} />
          : <div className="space-y-4">{status()}
            {studyPlans.loaded && <p role="status" className="text-xs text-[#78716c]">Không tìm thấy lộ trình trong tài khoản hoặc dữ liệu khách hiện tại.</p>}
            <button type="button" onClick={() => setActiveRoadmap('my')} className="text-xs font-bold text-[#57534e] underline">Quay lại danh sách</button>
          </div>
      ) : activeRoadmap === 'my' ? (
        <div className="space-y-4">
          
          {/* Subheader & Action Button */}
          <div className="flex items-center justify-between">
            <p className="text-xs md:text-sm font-bold text-[#57534e]">
              Tự tạo lộ trình học với danh sách kanji của riêng bạn
            </p>

            <RoughButton
              onClick={openCreate}
              disabled={studyPlans.busy}
              fill="#ea580c"
              stroke="#9a3412"
              borderRadius={8}
              roughness={0.7}
              className="text-white px-4 py-2 text-xs font-bold cursor-pointer shadow-xs"
            >
              <div className="flex items-center gap-1.5">
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Tạo lộ trình</span>
              </div>
            </RoughButton>
          </div>

          {!isCreateModalOpen && !deletingRoadmap && status()}
          {/* Main Content Area */}
          {!studyPlans.loaded ? null : customRoadmaps.length === 0 ? (
            /* Empty State Container matching media_1788169823651.png */
            <RoughCard
              fill="#ffffff"
              stroke="#292524"
              borderRadius={14}
              roughness={0.7}
              className="p-8 md:p-16 shadow-sketch min-h-[360px]"
            >
              <div className="w-full h-full flex flex-col items-center justify-center text-center space-y-4 py-4">
                {/* S-curve flow icon */}
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-slate-300 mx-auto">
                  <Route className="w-14 h-14 stroke-[1.5]" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-base md:text-lg font-black text-[#292524] font-sketch">
                    Bạn chưa có lộ trình nào
                  </h3>
                  <p className="text-xs font-bold text-[#78716c]">
                    Tạo lộ trình đầu tiên để bắt đầu!
                  </p>
                </div>

                <div className="pt-2 flex justify-center">
                  <RoughButton
                    onClick={openCreate}
                    disabled={studyPlans.busy}
                    fill="#ea580c"
                    stroke="#9a3412"
                    borderRadius={8}
                    roughness={0.7}
                    className="text-white px-6 py-2.5 text-xs font-black cursor-pointer shadow-xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>Tạo lộ trình đầu tiên</span>
                    </div>
                  </RoughButton>
                </div>
              </div>
            </RoughCard>
          ) : (
            /* List of User Custom Roadmaps */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {customRoadmaps.map((r) => (
                <RoughCard
                  key={r.id}
                  fill="#ffffff"
                  stroke="#292524"
                  borderRadius={12}
                  roughness={0.7}
                  className="p-5 space-y-3 shadow-sketch"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-base font-black text-[#292524] font-sketch">
                        {r.name}
                      </h4>
                      <p className="text-[11px] font-bold text-[#78716c]">
                        {r.kanjiList.length} chữ · {r.perDay} chữ/ngày · {r.totalDays} ngày
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                    <button type="button" disabled={studyPlans.busy} onClick={() => openEdit(r)}
                      className="p-1.5 rounded-lg text-[#78716c] hover:bg-slate-100 cursor-pointer"
                      title="Sửa lộ trình" aria-label={`Sửa lộ trình ${r.name}`}>
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      disabled={studyPlans.busy}
                      onClick={(e) => { void handleDeleteRoadmap(r, e); }}
                      className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                      title="Xóa lộ trình"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    </div>
                  </div>

                  {/* Sample Kanji preview */}
                  <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                    {r.kanjiList.slice(0, 8).map((k, kIdx) => (
                      <span key={kIdx} className="w-8 h-8 rounded-lg bg-[#fdfbf7] border-sketch-subtle flex items-center justify-center font-kanji font-bold text-sm text-[#047857]">
                        {k}
                      </span>
                    ))}
                    {r.kanjiList.length > 8 && (
                      <span className="text-[10px] font-bold text-[#78716c]">+{r.kanjiList.length - 8}</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#78716c]/20">
                    <span className="text-xs font-bold text-[#ea580c]">
                      Ngày {r.currentDay}/{r.totalDays}
                    </span>

                    <RoughButton
                      onClick={() => openStudy(r)}
                      disabled={studyPlans.busy}
                      fill="#ea580c"
                      stroke="#9a3412"
                      borderRadius={6}
                      roughness={0.7}
                      className="text-white px-3.5 py-1.5 text-xs font-bold cursor-pointer"
                    >
                      <span>Học ngay</span>
                    </RoughButton>
                  </div>
                </RoughCard>
              ))}
            </div>
          )}

        </div>
      ) : (
        /* ============================================================ */
        /* 2. VIEW: LỘ TRÌNH MẶC ĐỊNH (DEFAULT ROADMAP) */
        /* ============================================================ */
        <DefaultRoadmapView userId={userId} authBusy={authBusy} onLogin={onLogin} onDetail={onDetail} />
      )}

      {/* ============================================================ */}
      {/* MODAL: TẠO LỘ TRÌNH MỚI (Matching media_1788169839805.png) */}
      {/* ============================================================ */}
      {isCreateModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={closeEditor}
        >
          <div 
            className="w-full max-w-lg"
            role="dialog" aria-modal="true" aria-labelledby="roadmap-editor-title"
            onClick={(e) => e.stopPropagation()}
          >
            <RoughCard
              fill="#ffffff"
              stroke="#292524"
              borderRadius={16}
              roughness={0.7}
              className="p-6 md:p-7 space-y-4 shadow-sketch bg-white"
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <h3 id="roadmap-editor-title" className="text-base font-black text-[#292524] font-sketch">
                  {editingRoadmap ? 'Sửa lộ trình' : 'Tạo lộ trình mới'}
                </h3>
                <button
                  onClick={closeEditor}
                  disabled={studyPlans.saving}
                  aria-label="Đóng hộp lộ trình"
                  className="p-1 rounded-lg text-[#78716c] hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {status(true)}
              {formError && <p role="alert" className="text-xs text-rose-600">{formError}</p>}
              {/* Field 1: Tên lộ trình */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#292524]">
                  Tên lộ trình
                </label>
                <input
                  type="text"
                  aria-label="Tên lộ trình"
                  maxLength={100}
                  disabled={studyPlans.busy}
                  value={newRoadmapName}
                  onChange={(e) => setNewRoadmapName(e.target.value)}
                  placeholder="VD: Kanji cần ôn, Luyện N3 sprint..."
                  className="w-full bg-[#fdfbf7] border-sketch-subtle rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#292524] focus:outline-none"
                />
              </div>

              {/* Field 2: Danh sách Kanji */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#292524]">
                  Danh sách Kanji
                </label>
                <textarea
                  aria-label="Danh sách Kanji"
                  maxLength={MAX_ROADMAP_TEXT}
                  readOnly={!!editingRoadmap}
                  disabled={studyPlans.busy}
                  value={newRoadmapKanjiText}
                  onChange={(e) => setNewRoadmapKanjiText(e.target.value)}
                  placeholder="Nhập hoặc dán kanji vào đây..."
                  rows={4}
                  className="w-full bg-[#fdfbf7] border-sketch-subtle rounded-xl p-3 text-xs font-kanji font-bold text-[#292524] focus:outline-none resize-none"
                />
                <div className="text-[11px] font-bold text-[#78716c]">
                  {extractedKanji.length === 0 ? 'Chưa có kanji' : `Đã nhận diện: ${extractedKanji.length} chữ Kanji`}
                </div>
                {!editingRoadmap && unsupported.length > 0 && <p role="alert" className="text-xs text-rose-600 break-words">
                  Chưa có dữ liệu: {unsupported.join(' ')}. Hãy loại bỏ các chữ này trước khi lưu.
                </p>}
              </div>

              {/* Field 3: Số kanji mỗi ngày */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-[#292524]">
                  Số kanji mỗi ngày
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {ROADMAP_PER_DAY.map((num) => {
                    const isSelected = newRoadmapPerDay === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        disabled={studyPlans.busy || perDayLocked}
                        onClick={() => setNewRoadmapPerDay(num)}
                        className={`py-1.5 px-2 rounded-full text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-sketch-orange bg-amber-50 text-[#ea580c] shadow-sketch font-black'
                            : 'border-sketch-subtle bg-white text-[#57534e] hover:bg-slate-50'
                        }`}
                      >
                        {num}/ngày
                      </button>
                    );
                  })}
                </div>
                {perDayLocked && <p className="text-xs text-[#78716c]">Lộ trình đã bắt đầu học nên số chữ/ngày được giữ cố định.</p>}
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <RoughButton
                  onClick={() => { void handleSaveRoadmap(); }}
                  disabled={studyPlans.busy || (!editingRoadmap && unsupported.length > 0)}
                  fill="#fbbf24"
                  stroke="#d97706"
                  borderRadius={10}
                  roughness={0.7}
                  className="w-full text-white py-2.5 text-xs font-black shadow-xs cursor-pointer"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    {editingRoadmap ? <Edit3 className="w-4 h-4 stroke-[3]" /> : <Plus className="w-4 h-4 stroke-[3]" />}
                    <span>{editingRoadmap ? 'Lưu thay đổi' : 'Tạo lộ trình'}</span>
                  </div>
                </RoughButton>
              </div>

            </RoughCard>
          </div>
        </div>
      )}

      {deletingRoadmap && <RoadmapDeleteDialog name={deletingRoadmap.name} busy={studyPlans.busy} error={studyPlans.error}
        onCancel={() => { if (!actionPending.current) setDeletingRoadmap(null); }} onConfirm={() => { void confirmDelete(); }} />}


    </div>
  );
};
