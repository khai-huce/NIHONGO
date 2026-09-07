import React from 'react';
import { Crown, Check } from 'lucide-react';

export const UpgradePage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-bold shadow-xs">
          <Crown className="w-4 h-4 fill-amber-500 text-amber-500 animate-bounce" />
          Gói VIP Trọn Đời - Không Giới Hạn
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          Nâng cấp VIP
        </h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
          Mở khóa toàn bộ 2,136 chữ Kanji chuẩn JLPT N5 đến N1 kèm phân tích Chiết tự chi tiết, giọng đọc AI bản xứ và phòng luyện viết vô hạn.
        </p>
      </div>

      {/* Pricing Card Banner */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-8 border border-slate-700 shadow-2xl overflow-hidden max-w-2xl mx-auto">
        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                Ưu đãi đặc biệt
              </span>
              <h2 className="text-2xl font-black mt-1">
                Tài Khoản Trọn Đời (Lifetime)
              </h2>
            </div>
            <div className="text-right">
              <span className="line-through text-slate-400 text-sm">499.000 đ</span>
              <div className="text-3xl font-black text-amber-400">
                199.000 đ
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-700/80 text-sm">
            {[
              'Toàn quyền tra cứu 2,136 Kanji N5 - N1 kèm sơ đồ Chiết tự',
              'Không giới hạn bài luyện viết Kanji trên ô chữ điền',
              'Kho từ vựng & âm thanh phát âm người bản xứ chất lượng cao',
              'Từ điển Trọng âm (Pitch Accent) & Ngữ pháp nâng cao',
              'Tải file PDF vở tập viết Kanji độc quyền in sẵn nét mờ',
              'Đồng bộ dữ liệu học tập và Flashcards trên mọi thiết bị',
              'Hỗ trợ cập nhật tính năng mới trọn đời miễn phí'
            ].map((perk, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{perk}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => alert('Cảm ơn bạn đã quan tâm! Đây là giao diện clone mẫu nhaikanji.com.')}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 hover:from-amber-500 hover:to-rose-600 text-white font-extrabold text-base shadow-lg shadow-orange-500/25 active:scale-98 transition-all flex items-center justify-center gap-2"
          >
            <Crown className="w-5 h-5 fill-white" />
            Nâng cấp VIP ngay (Chỉ 199k)
          </button>
        </div>
      </div>

    </div>
  );
};
