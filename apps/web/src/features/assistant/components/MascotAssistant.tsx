import React, { useEffect, useRef, useState } from 'react';
import { X, Send, RotateCcw } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAssistantChat } from '../hooks/useAssistantChat';
import { ASSISTANT_MESSAGE_LIMIT, canSubmitAssistantOnEnter, isInternalAssistantUrl } from '../lib/assistant-chat';

type Props = { userId: string | null; authBusy: boolean; onLogin: () => void };

export const MascotAssistant: React.FC<Props> = ({ userId, authBusy, onLogin }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const [groqOwner, setGroqOwner] = useState<string | null>(null);
  useEffect(() => setGroqOwner(null), [userId]);
  const chat = useAssistantChat(userId, authBusy, location.pathname, onLogin, !!userId && groqOwner === userId);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (isOpen && userId) inputRef.current?.focus(); }, [isOpen, userId]);
  useEffect(() => {
    if (isOpen && messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [isOpen, chat.turns, chat.busy, chat.inputError]);
  const close = () => {
    setIsOpen(false);
    launcherRef.current?.focus();
  };

  return (
    <>
      {/* Floating Button */}
      <button
        ref={launcherRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed z-50 flex items-center justify-center outline-none transition-transform hover:scale-110 active:scale-95"
        style={{ bottom: '90px', right: '15px' }}
        title="Trợ lý NIHONGO"
        aria-label={isOpen ? 'Đóng trợ lý NIHONGO' : 'Mở trợ lý NIHONGO'}
        aria-expanded={isOpen}
        aria-controls="nihongo-assistant-popup"
      >
        <div className="relative h-14 w-14 md:h-16 md:w-16 rounded-full bg-gradient-to-tr from-amber-400 via-orange-400 to-rose-500 p-0.5 shadow-xl shadow-orange-500/25 flex items-center justify-center">
          <div className="w-full h-full bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-2xl">
            🌸
          </div>
        </div>
      </button>

      {/* Chat Popup */}
      {isOpen && (
        <div 
          id="nihongo-assistant-popup"
          role="dialog"
          aria-labelledby="nihongo-assistant-title"
          className="fixed z-50 bottom-28 right-4 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col h-96 max-h-[calc(100dvh-8rem)] animate-in fade-in slide-in-from-bottom-5 duration-200"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); } }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌸</span>
              <div>
                <h4 id="nihongo-assistant-title" className="font-extrabold text-xs text-slate-900 dark:text-white">
                  Trợ lý NIHONGO
                </h4>
              </div>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Đóng trò chuyện"
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages body */}
          <div ref={messagesRef} role="log" aria-label="Cuộc trò chuyện với trợ lý NIHONGO" aria-live="polite" aria-relevant="additions text" className="flex-1 min-h-0 overflow-y-auto space-y-2 p-1 text-xs overscroll-contain select-text">
            <div className="p-2.5 rounded-2xl max-w-[95%] leading-relaxed bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none">
              Mình có thể hướng dẫn sử dụng NIHONGO, hỗ trợ học tiếng Nhật và xem tiến độ của bạn khi bạn hỏi. Ví dụ: “Tôi cần ôn gì hôm nay?”
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">AI có thể trả lời chưa chính xác. Cuộc trò chuyện chỉ giữ trong lần mở trang này; tải lại trang sẽ xóa.</p>
            </div>
            {!userId && <div className="p-2.5 rounded-2xl bg-blue-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
              <p>Đăng nhập để trò chuyện với trợ lý.</p>
              <button type="button" disabled={authBusy} onClick={onLogin} className="mt-2 font-bold text-blue-600 underline disabled:opacity-50">Đăng nhập</button>
            </div>}
            {chat.earlierTurnsHidden && <p className="text-[11px] text-slate-500">Đang hiển thị 10 lượt trao đổi gần nhất.</p>}
            {chat.turns.map((turn, index) => <React.Fragment key={turn.id}>
              <div className="flex justify-end">
                <div className="p-2.5 rounded-2xl max-w-[85%] leading-relaxed bg-blue-600 text-white rounded-br-none whitespace-pre-wrap break-words">{turn.request.message}</div>
              </div>
              {turn.state === 'done' && turn.reply && <div className="flex justify-start">
                <div className="p-2.5 rounded-2xl max-w-[95%] leading-relaxed bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none min-w-0">
                  <p className="whitespace-pre-wrap break-words">{turn.reply.text}</p>
                  {turn.reply.sources.length > 0 && <ul aria-label="Nội dung liên quan" className="mt-2 space-y-1 border-t border-slate-200 dark:border-slate-700 pt-2">
                    {turn.reply.sources.filter(source => isInternalAssistantUrl(source.url)).map((source, sourceIndex) => <li key={`${source.id}:${sourceIndex}`}><Link to={source.url} className="text-blue-600 dark:text-blue-400 underline break-words">{source.title}</Link></li>)}
                  </ul>}
                </div>
              </div>}
              {turn.state === 'pending' && <p role="status" className="p-2 text-slate-500 dark:text-slate-400">Trợ lý đang trả lời…</p>}
              {turn.state === 'failed' && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-slate-800 p-2 text-rose-700 dark:text-rose-300">
                <p className="break-words">{turn.error}</p>
                {index === chat.turns.length - 1 && <button type="button" disabled={chat.busy || authBusy || !userId} onClick={() => chat.retry(turn.id)} className="mt-1 inline-flex items-center gap-1 font-bold underline disabled:opacity-50"><RotateCcw className="h-3 w-3" />Thử lại</button>}
              </div>}
            </React.Fragment>)}
          </div>

          {/* Input field */}
          {chat.inputError && <p role="alert" className="text-xs text-rose-700 py-1">{chat.inputError}</p>}
          {userId && <label className="text-xs text-slate-500"><input type="checkbox" checked={groqOwner === userId} disabled={chat.busy} onChange={event => setGroqOwner(event.target.checked ? userId : null)} /> Cho gửi lịch sử chat và tiến độ liên quan tới Groq khi Gemini quá tải</label>}
          <form onSubmit={event => { event.preventDefault(); chat.send(); }} className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <input
              ref={inputRef}
              type="text"
              value={chat.input}
              onChange={event => chat.setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key !== 'Enter') return;
                if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) { event.preventDefault(); return; }
                event.preventDefault();
                if (canSubmitAssistantOnEnter({ key: event.key, isComposing: event.nativeEvent.isComposing, keyCode: event.nativeEvent.keyCode, shiftKey: event.shiftKey })) chat.send();
              }}
              maxLength={ASSISTANT_MESSAGE_LIMIT}
              disabled={!userId}
              aria-label="Câu hỏi cho trợ lý NIHONGO"
              placeholder={userId ? 'Hỏi về NIHONGO hoặc tiếng Nhật…' : 'Đăng nhập để đặt câu hỏi…'}
              className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!userId || authBusy || chat.busy || !chat.input.trim()}
              aria-label="Gửi câu hỏi"
              className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
