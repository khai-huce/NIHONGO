import React from 'react';
import { Crown, Check } from 'lucide-react';

export const UpgradePage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header */}
      <div className="text-center space-y-3 max-w-xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-bold shadow-xs">
          <Crown className="w-4 h-4 fill-amber-500 text-amber-500 animate-bounce" />
          NIHONGO · Thông tin nâng cấp
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
          Nâng cấp NIHONGO
        </h1>
        <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
          NIHONGO chưa mở bán gói nâng cấp. Giá, quyền lợi và thời hạn sử dụng chưa được công bố; hiện chưa hỗ trợ thanh toán.
        </p>
      </div>

      {/* Pricing Card Banner */}
      <div className="relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-8 border border-slate-700 shadow-2xl overflow-hidden max-w-2xl mx-auto">
        <div className="relative z-10 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                Trạng thái hiện tại
              </span>
              <h2 className="text-2xl font-black mt-1">
                Gói nâng cấp NIHONGO
              </h2>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-slate-400 text-sm">Chưa công bố giá</span>
              <div className="text-3xl font-black text-amber-400">
                Chưa mở bán
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-700/80 text-sm">
            <p className="text-slate-300">Các chức năng hiện có trên NIHONGO, không phải quyền lợi của gói nâng cấp:</p>
            {[
              'Tra cứu Kanji trong kho đã xuất bản',
              'Luyện viết tự do trên bảng viết',
              'Học từ vựng bằng Flashcard, Trắc nghiệm và Nhồi nhét',
              'Tra trọng âm và học mẫu ngữ pháp đã xuất bản',
              'Đọc hiểu và luyện nghe Shadowing',
              'Lưu bài học, lịch ôn và tiến độ được hỗ trợ theo tài khoản',
              'Các tính năng AI yêu cầu đăng nhập và có hạn mức'
            ].map((perk, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{perk}</span>
              </div>
            ))}
          </div>

          <button
            type="button" disabled
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white font-extrabold text-base shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Crown className="w-5 h-5 fill-white" />
            Chưa hỗ trợ thanh toán
          </button>
        </div>
      </div>

    </div>
  );
};
