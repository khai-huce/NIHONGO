import type { useVocabStudy } from '../hooks/useVocabStudy';

export function StudyStatus({study}:{study:ReturnType<typeof useVocabStudy>}) {
  const status = study.error || (study.loading ? 'Đang tải lượt học…' : study.saving ? 'Đang lưu kết quả…' :
    study.loaded && !study.finished && study.skipped > 0 ? `Bỏ qua ${study.skipped} từ thiếu dữ liệu cho chế độ này.` : '');
  if (!status) return null;
  const newRound = ['LESSON_CHANGED', 'RESULT_CONFLICT', 'INCOMPLETE_RESULT'].includes(study.errorCode);
  return <div role={study.error ? 'alert' : 'status'} className="relative z-10 mx-5 my-2 rounded-lg bg-[#182035] px-3 py-2 text-xs text-slate-200">
    {status}
    {study.error && <button disabled={study.loading || study.saving} className="ml-3 underline font-bold"
      onClick={() => {
        if (newRound) {
          if (window.confirm('Kết quả hiện tại chưa lưu được. Bắt đầu lượt mới từ nội dung bài hiện tại?')) void study.start();
        } else void study.retry();
      }}>{newRound ? 'Bắt đầu lượt mới' : study.completionPending ? 'Thử lưu lại' : 'Tải lại lượt học'}</button>}
  </div>;
}
