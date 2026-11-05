import type { ReadingSentence } from '@nihongo/client/reading';
import type { ReadingContent } from './reading-editor-data';
import { moveReadingQuizOption, nextReadingQuizId, removeReadingQuizOption } from './reading-supplement-data';

const input = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100';
const button = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';
const panel = 'space-y-3 rounded-lg border border-slate-200 p-4';
type Ruby = NonNullable<ReadingSentence['ruby']>;

function moved<T>(items: T[], index: number, delta: number): T[] {
  const next = [...items], target = index + delta;
  if (target < 0 || target >= items.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function ItemActions({ label, index, count, onMove, onRemove }: {
  label: string; index: number; count: number; onMove: (delta: number) => void; onRemove: () => void;
}) {
  return <div className="flex flex-wrap gap-2">
    <button type="button" className={button} aria-label={`Đưa ${label} lên`} disabled={index === 0} onClick={() => onMove(-1)}>Lên</button>
    <button type="button" className={button} aria-label={`Đưa ${label} xuống`} disabled={index === count - 1} onClick={() => onMove(1)}>Xuống</button>
    <button type="button" className={`${button} text-red-700`} aria-label={`Xóa ${label}`} onClick={onRemove}>Xóa</button>
  </div>;
}

export function SentenceRubyEditor({ sentence, onChange }: { sentence: ReadingSentence; onChange: (ruby: Ruby) => void }) {
  const parts = sentence.ruby ?? [];
  const matches = parts.length === 0 || parts.map(part => part.text).join('') === sentence.japanese;
  const update = (index: number, patch: Partial<Ruby[number]>) => onChange(parts.map((part, position) => position === index ? { ...part, ...patch } : part));
  return <div className="mt-4 space-y-3 border-t border-slate-200 pt-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-medium">Furigana câu {sentence.id}</h3>
      {parts.length > 0 && <button type="button" className={button} onClick={() => onChange([])} aria-label={`Bỏ furigana câu ${sentence.id}`}>Bỏ furigana</button>}
    </div>
    <p className="text-xs leading-5 text-slate-500">Chia nguyên văn thành các đoạn liên tiếp; nhập cách đọc cho đoạn cần chú thích, để trống với kana và dấu câu. Ghép các đoạn phải giữ đúng câu gốc, kể cả khoảng trắng.</p>
    {parts.length === 0 ? <button type="button" className={button} onClick={() => onChange([{ text: sentence.japanese }])} aria-label={`Nhập furigana câu ${sentence.id}`}>Nhập furigana</button>
      : <>
        {parts.map((part, index) => <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium">Nguyên văn đoạn {index + 1} · câu {sentence.id}<textarea className={`${input} font-japanese`} rows={2} maxLength={3000} value={part.text} onChange={event => update(index, { text: event.target.value })} /></label>
            <label className="block text-xs font-medium">Cách đọc đoạn {index + 1} · câu {sentence.id}<input className={`${input} font-japanese`} maxLength={300} value={part.reading ?? ''} onChange={event => update(index, { reading: event.target.value || undefined })} /></label>
          </div>
          <div className="mt-2"><ItemActions label={`đoạn ${index + 1} câu ${sentence.id}`} index={index} count={parts.length} onMove={delta => onChange(moved(parts, index, delta))} onRemove={() => onChange(parts.filter((_, position) => position !== index))} /></div>
        </div>)}
        <button type="button" className={button} disabled={parts.length >= 500} onClick={() => onChange([...parts, { text: '' }])} aria-label={`Thêm đoạn furigana câu ${sentence.id}`}>Thêm đoạn</button>
        {!matches && <p role="alert" className="text-xs text-red-700">Các đoạn chưa ghép đúng nguyên văn câu {sentence.id}. Hãy sửa trước khi lưu hoặc xem trước.</p>}
        {parts.some(part => part.text.length === 0) && <p role="alert" className="text-xs text-red-700">Mỗi đoạn furigana cần có văn bản. Nhập nội dung hoặc xóa đoạn trống.</p>}
        {matches && parts.every(part => part.text.length > 0) && <div className="rounded-lg bg-slate-50 p-3"><p className="mb-1 text-xs text-slate-500">Xem furigana trong câu</p><p className="whitespace-pre-wrap font-japanese leading-9">{parts.map((part, index) => part.reading ? <ruby key={index}>{part.text}<rt>{part.reading}</rt></ruby> : <span key={index}>{part.text}</span>)}</p></div>}
      </>}
  </div>;
}

export function ReadingSupplementEditor({ content, onChange }: { content: ReadingContent; onChange: (content: ReadingContent) => void }) {
  const updateVocab = (index: number, patch: Partial<ReadingContent['vocabList'][number]>) => onChange({ ...content, vocabList: content.vocabList.map((word, position) => position === index ? { ...word, ...patch } : word) });
  const updateGrammar = (index: number, patch: Partial<ReadingContent['grammarList'][number]>) => onChange({ ...content, grammarList: content.grammarList.map((pattern, position) => position === index ? { ...pattern, ...patch } : pattern) });
  const updateQuiz = (index: number, patch: Partial<ReadingContent['quizList'][number]>) => onChange({ ...content, quizList: content.quizList.map((quiz, position) => position === index ? { ...quiz, ...patch } : quiz) });
  return <div className="space-y-6">
    <p className="text-xs leading-5 text-slate-500">Nhập nội dung liên quan đến bài đọc; các mục bên dưới dùng nguồn nội dung và quyền sử dụng của bài. Để trống danh sách nếu chưa có nội dung biên tập.</p>
    <section className="space-y-3" aria-label="Biên tập từ vựng">
      <h2 className="font-semibold">Từ vựng ({content.vocabList.length}/100)</h2>
      {content.vocabList.length === 0 && <p className="text-sm text-slate-500">Chưa có từ vựng bổ trợ.</p>}
      {content.vocabList.map((word, index) => <div key={index} className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Từ {index + 1}</h3><ItemActions label={`từ ${index + 1}`} index={index} count={content.vocabList.length} onMove={delta => onChange({ ...content, vocabList: moved(content.vocabList, index, delta) })} onRemove={() => onChange({ ...content, vocabList: content.vocabList.filter((_, position) => position !== index) })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">Từ tiếng Nhật {index + 1} *<input className={`${input} font-japanese`} maxLength={200} value={word.word} onChange={event => updateVocab(index, { word: event.target.value })} /></label>
          <label className="block text-sm">Cách đọc từ {index + 1}<input className={`${input} font-japanese`} maxLength={200} value={word.reading} onChange={event => updateVocab(index, { reading: event.target.value })} /></label>
          <label className="block text-sm">Hán Việt từ {index + 1}<input className={input} maxLength={200} value={word.hanViet} onChange={event => updateVocab(index, { hanViet: event.target.value })} /></label>
          <label className="block text-sm">Nghĩa từ {index + 1}<textarea className={input} rows={2} maxLength={1000} value={word.meaning} onChange={event => updateVocab(index, { meaning: event.target.value })} /></label>
        </div>
      </div>)}
      <button type="button" className={button} disabled={content.vocabList.length >= 100} onClick={() => onChange({ ...content, vocabList: [...content.vocabList, { word: '', reading: '', hanViet: '', meaning: '' }] })}>Thêm từ vựng</button>
    </section>
    <section className="space-y-3" aria-label="Biên tập ngữ pháp">
      <h2 className="font-semibold">Ngữ pháp ({content.grammarList.length}/100)</h2>
      {content.grammarList.length === 0 && <p className="text-sm text-slate-500">Chưa có mẫu ngữ pháp bổ trợ.</p>}
      {content.grammarList.map((grammar, index) => <div key={index} className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Mẫu {index + 1}</h3><ItemActions label={`mẫu ngữ pháp ${index + 1}`} index={index} count={content.grammarList.length} onMove={delta => onChange({ ...content, grammarList: moved(content.grammarList, index, delta) })} onRemove={() => onChange({ ...content, grammarList: content.grammarList.filter((_, position) => position !== index) })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">Mẫu ngữ pháp {index + 1} *<input className={`${input} font-japanese`} maxLength={200} value={grammar.pattern} onChange={event => updateGrammar(index, { pattern: event.target.value })} /></label>
          <label className="block text-sm">Trình độ mẫu {index + 1}<select className={input} value={grammar.jlptLevel} onChange={event => updateGrammar(index, { jlptLevel: event.target.value })}><option value="">Chưa phân loại</option>{['N5', 'N4', 'N3', 'N2', 'N1'].map(level => <option key={level} value={level}>{level}</option>)}{grammar.jlptLevel && !['N5', 'N4', 'N3', 'N2', 'N1'].includes(grammar.jlptLevel) && <option value={grammar.jlptLevel}>{grammar.jlptLevel} (đã lưu)</option>}</select></label>
          <label className="block text-sm sm:col-span-2">Ý nghĩa mẫu {index + 1}<textarea className={input} rows={2} maxLength={1000} value={grammar.meaning} onChange={event => updateGrammar(index, { meaning: event.target.value })} /></label>
          <label className="block text-sm">Ví dụ tiếng Nhật mẫu {index + 1}<textarea className={`${input} font-japanese`} rows={2} maxLength={1000} value={grammar.exampleJp} onChange={event => updateGrammar(index, { exampleJp: event.target.value })} /></label>
          <label className="block text-sm">Dịch ví dụ mẫu {index + 1}<textarea className={input} rows={2} maxLength={1000} value={grammar.exampleVi} onChange={event => updateGrammar(index, { exampleVi: event.target.value })} /></label>
        </div>
      </div>)}
      <button type="button" className={button} disabled={content.grammarList.length >= 100} onClick={() => onChange({ ...content, grammarList: [...content.grammarList, { pattern: '', jlptLevel: '', meaning: '', exampleJp: '', exampleVi: '' }] })}>Thêm mẫu ngữ pháp</button>
    </section>
    <section className="space-y-3" aria-label="Biên tập câu hỏi">
      <h2 className="font-semibold">Câu hỏi ({content.quizList.length}/100)</h2>
      <p className="text-xs text-slate-500">Mỗi câu có 2–6 lựa chọn và một đáp án đúng. Nhập giải thích để người học đối chiếu với bài đọc.</p>
      {content.quizList.length === 0 && <p className="text-sm text-slate-500">Chưa có câu hỏi cho bài đọc.</p>}
      {content.quizList.map((quiz, index) => <div key={quiz.id} className={panel}>
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Câu hỏi {index + 1}</h3><ItemActions label={`câu hỏi ${index + 1}`} index={index} count={content.quizList.length} onMove={delta => onChange({ ...content, quizList: moved(content.quizList, index, delta) })} onRemove={() => onChange({ ...content, quizList: content.quizList.filter((_, position) => position !== index) })} /></div>
        <label className="block text-sm">Nội dung câu hỏi {index + 1} *<textarea className={input} rows={2} maxLength={1000} value={quiz.question} onChange={event => updateQuiz(index, { question: event.target.value })} /></label>
        <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">Các lựa chọn câu {index + 1} — chọn một đáp án đúng *</legend>
          {quiz.options.map((option, optionIndex) => <div key={optionIndex} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <label className="block text-sm">Lựa chọn {optionIndex + 1} · câu {index + 1} *<textarea className={input} rows={2} maxLength={500} value={option} onChange={event => updateQuiz(index, { options: quiz.options.map((value, position) => position === optionIndex ? event.target.value : value) })} /></label>
            <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="radio" name={`reading-answer-${quiz.id}`} checked={quiz.correctIndex === optionIndex} onChange={() => updateQuiz(index, { correctIndex: optionIndex })} />Đáp án đúng: lựa chọn {optionIndex + 1}, câu {index + 1}</label>
              <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={optionIndex === 0} aria-label={`Đưa lựa chọn ${optionIndex + 1} câu ${index + 1} lên`} onClick={() => updateQuiz(index, moveReadingQuizOption(quiz, optionIndex, -1))}>Lên</button><button type="button" className={button} disabled={optionIndex === quiz.options.length - 1} aria-label={`Đưa lựa chọn ${optionIndex + 1} câu ${index + 1} xuống`} onClick={() => updateQuiz(index, moveReadingQuizOption(quiz, optionIndex, 1))}>Xuống</button><button type="button" className={`${button} text-red-700`} disabled={quiz.options.length <= 2} aria-label={`Xóa lựa chọn ${optionIndex + 1} câu ${index + 1}`} onClick={() => updateQuiz(index, removeReadingQuizOption(quiz, optionIndex))}>Xóa</button></div>
            </div>
          </div>)}
        </fieldset>
        <button type="button" className={button} disabled={quiz.options.length >= 6} aria-label={`Thêm lựa chọn câu ${index + 1}`} onClick={() => updateQuiz(index, { options: [...quiz.options, ''] })}>Thêm lựa chọn</button>
        <label className="block text-sm">Giải thích câu {index + 1}<textarea className={input} rows={3} maxLength={2000} value={quiz.explanation} onChange={event => updateQuiz(index, { explanation: event.target.value })} /></label>
      </div>)}
      <button type="button" className={button} disabled={content.quizList.length >= 100} onClick={() => {
        const id = nextReadingQuizId(content.quizList);
        onChange({ ...content, quizList: [...content.quizList, { id, question: '', options: ['', ''], correctIndex: -1, explanation: '' }] });
      }}>Thêm câu hỏi</button>
    </section>
  </div>;
}
