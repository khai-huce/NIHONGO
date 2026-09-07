import React, { useState } from 'react';
import { X, Send } from 'lucide-react';

export const MascotAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Array<{ role: 'ai' | 'user'; text: string }>>([
    { role: 'ai', text: 'Konnichiwa! Mình là trợ lý Nhài Kanji 🌸. Bạn cần mình giải nghĩa hoặc kể câu chuyện chiết tự cho chữ Kanji nào?' }
  ]);
  const [inputVal, setInputVal] = useState('');

  const handleSend = () => {
    if (!inputVal.trim()) return;
    const userMsg = inputVal.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInputVal('');

    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          role: 'ai',
          text: `Chữ bạn vừa hỏi rất hay! Trong phương pháp Chiết tự Nhài Kanji, chúng ta bóc tách các bộ thủ cấu thành để tạo nên câu chuyện hình tượng sinh động. Hãy tra cứu trực tiếp trên thanh tìm kiếm hoặc bảng viết tay nhé!`
        }
      ]);
    }, 600);
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed z-50 flex items-center justify-center outline-none transition-transform hover:scale-110 active:scale-95"
        style={{ bottom: '90px', right: '15px' }}
        title="Trợ lý học Kanji"
      >
        <div className="relative h-14 w-14 md:h-16 md:w-16 rounded-full bg-gradient-to-tr from-amber-400 via-orange-400 to-rose-500 p-0.5 shadow-xl shadow-orange-500/25 flex items-center justify-center">
          <div className="w-full h-full bg-white dark:bg-slate-900 rounded-full flex items-center justify-center text-2xl">
            🌸
          </div>
          <span className="absolute top-0 right-0 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
          </span>
        </div>
      </button>

      {/* Chat Popup */}
      {isOpen && (
        <div 
          className="fixed z-50 bottom-28 right-4 w-80 sm:w-96 bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col h-96 animate-in fade-in slide-in-from-bottom-5 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">🌸</span>
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 dark:text-white">
                  Trợ lý Chiết tự Nhài Kanji
                </h4>
                <span className="text-[10px] text-emerald-600 font-semibold">Đang online</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages body */}
          <div className="flex-1 overflow-y-auto space-y-2 p-1 text-xs">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`p-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input field */}
          <div className="flex items-center gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Hỏi về chữ Kanji..."
              className="flex-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              onClick={handleSend}
              className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
