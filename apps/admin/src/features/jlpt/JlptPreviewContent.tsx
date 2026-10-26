import type { JlptLevel, JlptPreview, JlptQuestion } from '@nihongo/shared/contracts/jlpt';
import { jlptPreviewSections, resourceLabels } from './jlpt-editor-data';

function QuestionPreview({ question, index }: { question: JlptQuestion; index: number }) {
  const selected = Number.isInteger(question.correctIndex) && question.correctIndex >= 0 && question.correctIndex < question.options.length;
  return <li className="rounded-lg border border-slate-200 bg-white p-4">
    <p className="mb-2 text-xs font-semibold text-slate-500">Câu {index + 1}</p>
    {question.passage && <p className="mb-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-7 text-slate-700">{question.passage}</p>}
    <p className="whitespace-pre-wrap text-sm font-medium leading-6">{question.prompt || 'Chưa nhập câu hỏi.'}</p>
    <ol className="my-3 grid gap-2 text-sm sm:grid-cols-2">{question.options.map((option, optionIndex) => <li key={optionIndex} className={`rounded-md border p-2 ${selected && optionIndex === question.correctIndex ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-slate-200 text-slate-700'}`}>
      <span className="font-medium">{optionIndex + 1}.</span> <span className="whitespace-pre-wrap">{option || 'Chưa nhập lựa chọn.'}</span>{selected && optionIndex === question.correctIndex && <span className="ml-2 text-xs font-semibold">(Đáp án đúng)</span>}
    </li>)}</ol>
    {!selected && <p className="mb-2 text-sm text-amber-800">Chưa có đáp án đúng hợp lệ.</p>}
    <p className="whitespace-pre-wrap text-sm leading-6 text-slate-600"><span className="font-medium">Giải thích:</span> {question.explanation || 'Chưa nhập giải thích.'}</p>
  </li>;
}

export function JlptPreviewContent({ preview, level, savedVersion, dirty }: { preview: JlptPreview; level: JlptLevel; savedVersion: number | null; dirty: boolean }) {
  const sessions = jlptPreviewSections(preview), questionCount = sessions.reduce((total, session) => total + session.questions.length, 0);
  return <div>
    <p className="text-xl font-semibold">{preview.draft.title}</p><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{preview.draft.description}</p>
    <p className="mt-3 text-xs text-slate-500">{dirty || savedVersion === null ? 'Bản xem trước có nội dung chưa lưu.' : `Bản đã lưu · Phiên bản ${savedVersion}`}</p>
    <p className="my-4 text-sm text-slate-600">{level} · {preview.sessionCount} buổi · {preview.resourceCount} liên kết · {preview.kanjiCount} Kanji · {preview.estimatedMinutes} phút dự kiến</p>
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900"><p className="font-semibold">Điểm đạt bài kiểm tra: {preview.draft.passPercent ?? 80}%</p><p>{questionCount} câu hỏi trong {sessions.length} buổi. Đạt mức yêu cầu để hoàn thành buổi và mở buổi tiếp theo.</p><p className="mt-1 text-xs">Đáp án và giải thích bên dưới dành cho quản trị viên rà soát. Người học chỉ nhận đáp án sau khi nộp bài.</p></div>
    {preview.issues.length > 0 && <div role="alert" className="mb-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900"><p className="font-semibold">Cần hoàn thiện trước khi xuất bản:</p><ul className="mt-2 list-disc space-y-1 pl-5">{preview.issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}
    <div className="space-y-4">{sessions.map((session, index) => <section key={session.id} className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-semibold">{index + 1}. {session.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">{session.description}</p><p className="my-2 text-xs text-slate-500">{session.estimatedMinutes} phút dự kiến</p>
      <ol className="space-y-2">{session.resources.map(resource => <li key={resource.id} className={`rounded p-2 text-sm ${resource.available ? 'bg-slate-50' : 'bg-amber-50 text-amber-900'}`}><span className="font-medium">{resource.title}</span><span className="mt-1 block text-xs">{resourceLabels[resource.kind]}{resource.subtitle ? ` · ${resource.subtitle}` : ''}{resource.available ? '' : ' · Không còn sẵn có'}</span></li>)}</ol>
      <details className="mt-4 border-t border-slate-200 pt-3"><summary className="cursor-pointer text-sm font-semibold">Đề kiểm tra cuối buổi · {session.questions.length} câu · Xem đề và đáp án</summary>{session.questions.length ? <ol className="mt-3 space-y-3">{session.questions.map((question, questionIndex) => <QuestionPreview key={question.id} question={question} index={questionIndex} />)}</ol> : <p className="mt-3 text-sm text-amber-800">Chưa có câu hỏi cho buổi này.</p>}</details>
    </section>)}</div>
  </div>;
}
