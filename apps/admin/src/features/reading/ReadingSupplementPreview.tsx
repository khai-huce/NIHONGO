import type { ReadingContent } from './reading-editor-data';

const card = 'rounded-lg border border-slate-200 p-4';

export function ReadingSupplementPreview({ content }: { content: ReadingContent }) {
  return <div className="space-y-6 border-t border-slate-200 pt-5">
    <section className="space-y-3"><h3 className="font-semibold">Từ vựng ({content.vocabList.length})</h3>
      {!content.vocabList.length && <p className="text-sm text-slate-500">Chưa có từ vựng bổ trợ.</p>}
      {content.vocabList.map((word, index) => <div key={index} className={card}>
        <p className="break-words font-japanese text-lg font-semibold">{word.word} {word.reading && <span className="text-sm font-normal text-slate-600">【{word.reading}】</span>}</p>
        {word.hanViet && <p className="mt-1 break-words text-xs text-slate-500">Hán Việt: {word.hanViet}</p>}
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{word.meaning || 'Chưa có nghĩa.'}</p>
      </div>)}
    </section>
    <section className="space-y-3"><h3 className="font-semibold">Ngữ pháp ({content.grammarList.length})</h3>
      {!content.grammarList.length && <p className="text-sm text-slate-500">Chưa có mẫu ngữ pháp bổ trợ.</p>}
      {content.grammarList.map((grammar, index) => <div key={index} className={card}>
        <div className="flex flex-wrap items-center gap-2"><p className="break-words font-japanese text-lg font-semibold">{grammar.pattern}</p>{grammar.jlptLevel && <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">{grammar.jlptLevel}</span>}</div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm">{grammar.meaning || 'Chưa có giải nghĩa.'}</p>
        {grammar.exampleJp && <p className="mt-3 whitespace-pre-wrap break-words font-japanese leading-7">{grammar.exampleJp}</p>}
        {grammar.exampleVi && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{grammar.exampleVi}</p>}
      </div>)}
    </section>
    <section className="space-y-3"><h3 className="font-semibold">Câu hỏi ({content.quizList.length})</h3>
      <p className="text-xs text-slate-500">Bản xem trước cho quản trị viên hiển thị đáp án và giải thích để rà soát trước khi xuất bản.</p>
      {!content.quizList.length && <p className="text-sm text-slate-500">Chưa có câu hỏi.</p>}
      {content.quizList.map((quiz, index) => <div key={quiz.id} className={`${card} space-y-3`}>
        <h4 className="whitespace-pre-wrap break-words font-medium">{index + 1}. {quiz.question}</h4>
        <ol className="space-y-2">{quiz.options.map((option, optionIndex) => <li key={optionIndex} className={`rounded-lg border p-3 text-sm ${quiz.correctIndex === optionIndex ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}><p className="whitespace-pre-wrap break-words">{optionIndex + 1}. {option}</p>{quiz.correctIndex === optionIndex && <span className="mt-1 block text-xs font-medium text-emerald-700">Đáp án đúng</span>}</li>)}</ol>
        {(quiz.correctIndex < 0 || quiz.correctIndex >= quiz.options.length) && <p className="text-sm text-red-700">Chưa chọn đáp án đúng.</p>}
        <p className="whitespace-pre-wrap break-words text-sm text-slate-600"><span className="font-medium">Giải thích: </span>{quiz.explanation || 'Chưa có giải thích.'}</p>
      </div>)}
    </section>
  </div>;
}
