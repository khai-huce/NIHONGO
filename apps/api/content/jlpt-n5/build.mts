import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { units } from './grammar.mjs';
import { readings } from './readings.mjs';
import { grammarDraftSchema } from '../../src/modules/grammar/grammar.schema.js';
import { curriculumDraftSchema } from '../../src/modules/curriculum/curriculum.schema.js';
import { parseJlptDraft } from '../../src/modules/jlpt/jlpt.schema.js';
import { makeReadingContent } from '../../src/modules/reading/reading-content.js';
import { contentSourceSchema } from '../../src/modules/content/content.schema.js';
import { tokenizeSentence } from '../../src/modules/sentence-analysis/sentence-tokenizer.js';

const json = async (relative: string) => JSON.parse(await readFile(new URL(relative, import.meta.url), 'utf8'));
export const id = (key: string) => { const bytes = createHash('sha256').update(`nihongo-n5-20261025:${key}`).digest(); bytes[6] = (bytes[6] & 15) | 80; bytes[8] = (bytes[8] & 63) | 128; const h = bytes.toString('hex').slice(0,32); return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`; };
const sourceId = 'nihongo-n5-original-20261025';
const originalSource = contentSourceSchema.parse({id:sourceId,name:'NIHONGO N5 — Giáo án, ngữ pháp và bài đọc nguyên bản',url:'urn:nihongo:curriculum:n5:20261025',license:'Nội dung NIHONGO biên soạn theo yêu cầu chủ dự án',licenseUrl:'urn:nihongo:authorization:20261025',version:'2026-10-25-v1',checksum:'',attribution:'NIHONGO — nội dung nguyên bản có AI hỗ trợ biên soạn; người dùng duyệt biên soạn, nhập và xuất bản ngày25/10/2026.',notes:'Không sao chép Tango/Minna hoặc đề JLPT. Không phải danh mục hay đề thi chính thức. Từ vựng và Kanji có nguồn/giấy phép riêng tại kho gốc. MP3 luyện nghe tạo bằng Microsoft Edge TTS, không phải bản thu người bản ngữ. Nội dung cần được rà soát tiếp khi có phản hồi của người học.'});
const vocab = curriculumDraftSchema.parse(await json('../../../../docs/data/tu-vung-n5/tu-vung-n5.json'));
const vocabularySource = contentSourceSchema.parse({...await json('../../../../docs/data/tu-vung-n5/source.json'), id:'openjlpt-n5-c42fd9fa-vi-v2', name:'Từ vựng N5 — OpenJLPT / NIHONGO tiếng Việt',version:'c42fd9fa3777bfc1775446f7c418d549dfd6e4cf / NIHONGO vi-v2',attribution:'OpenJLPT; Jonathan Waller (Tanos); JMdict/EDICT — James William Breen và EDRDG. Chuyển đổi và nghĩa Việt: NIHONGO, AI hỗ trợ. Dữ liệu dẫn xuất CC BY-SA4.0; giữ thông báo nguồn tại docs/data/tu-vung-n5/.',notes:'662 mục tham khảo, không phải danh sách JLPT hiện hành chính thức. AI rà soát bản nghĩa Việt và cách viết phổ thông ngày25/10/2026, không khẳng định đã có biên tập viên bản ngữ kiểm duyệt. Giữ UUID/mapping nguồn, sửa4 cách viết phổ thông trong build.mts; không cung cấp Hán Việt, từ loại hay ví dụ khi chưa biên soạn. Người dùng đã duyệt nhập/xuất bản lộ trình.'});
vocab.sourceId=vocabularySource.id;vocab.subtitle='662 mục từ · OpenJLPT · Nghĩa Việt do NIHONGO biên soạn';
vocab.description='Từ vựng N5 tham khảo của cộng đồng, không phải danh mục thi chính thức. Chia theo hàng kana để dễ tra và phân phối31bài trong lộ trình NIHONGO. Nghĩa Việt có AI hỗ trợ, đã rà soát nội bộ; tiếp nhận sửa lỗi qua quản trị. Nguồn OpenJLPT / Tanos / JMdict-EDICT (EDRDG), CC BY-SA4.0. Xem nguồn bên dưới.';
const spelling:Record<string,string>={'さ来年':'再来年','曲る':'曲がる','終る':'終わる','明い':'明るい'};
const spellingChanges:object[]=[];
for(const topic of vocab.topics) for(const lesson of topic.lessons) for(const word of lesson.words) if(spelling[word.word]) { const before=word.word;word.word=spelling[before];word.ruby=[{text:word.word,reading:word.reading}];spellingChanges.push({id:word.id,before,after:word.word,reason:'Cách viết phổ thông; giữ cách đọc, nghĩa và UUID nguồn.'}); }
const lessons=vocab.topics.flatMap(t=>t.lessons);
const rawCatalog=await json('../catalog-initial.json');
const selected=await json('../../../../docs/data/kanji-n5-vietnamese-draft.json');
const selectedIds=new Set(selected.entries.map((k:{id:string})=>k.id));
const kanji=rawCatalog.kanji.filter((k:{data:{id:string}})=>selectedIds.has(k.data.id)).map((k:{data:Record<string,any>})=>k.data);
const priority=Array.from('一二三四五六七八九十百千万日月火水木金土年時分半人男女子父母友学先生本語読書聞話行来帰食飲見買休会大中小上下左右前後東西南北山川田天気雨電車駅国外名何今午毎週間');
kanji.sort((a:any,b:any)=>{const ai=priority.indexOf(a.kanji),bi=priority.indexOf(b.kanji);return (ai<0?999:ai)-(bi<0?999:bi)||a.kanji.localeCompare(b.kanji,'ja');});
const rubyCache=new Map<string,Array<{text:string;reading?:string}>>();
async function ruby(text:string) { if(rubyCache.has(text))return rubyCache.get(text)!; const result=(await tokenizeSentence(text)).tokens.map(t=>({text:t.text,...(/\p{Script=Han}/u.test(t.text)&&t.reading?{reading:t.reading}:{})}));rubyCache.set(text,result);return result; }
let rotation=0;
function question(key:string,prompt:string,options:string[],explanation:string,passage='') { if(options.length!==4||new Set(options).size!==4)throw new Error(`Ambiguous options ${key}`);const shift=rotation++%4;return {id:id(`q:${key}`),prompt,passage,options:[...options.slice(shift),...options.slice(0,shift)],correctIndex:(4-shift)%4,explanation}; }
const grammarLessons=[];
const articles=[];
const unitExams:any[][]=[];
const kanjiGroups:any[][]=[];let ki=0;
for(let i=0;i<units.length;i++) {
  const unit=units[i];const patterns=[];const exams=[];
  for(let pi=0;pi<unit.patterns.length;pi++) {
    const p=unit.patterns[pi],key=`u${i+1}:p${pi+1}`,jp=p.pieces.join('');
    if(p.pieces.length!==4)throw new Error(`Arrange pieces ${key}`);
    const shuffled=[p.pieces[2],p.pieces[0],p.pieces[3],p.pieces[1]];
    patterns.push({id:id(`pattern:${key}`),pattern:p.pattern,meaning:p.meaning,structure:p.structure,explanation:p.explanation,usage:p.usage,notes:p.notes,relatedIds:[],examples:[{id:id(`example:${key}:1`),japanese:jp,vietnamese:p.vietnamese,ruby:await ruby(jp)},{id:id(`example:${key}:2`),japanese:p.other,vietnamese:p.otherVi,ruby:await ruby(p.other)}],exercises:[
      {id:id(`exercise:${key}:vi-ja`),kind:'vi-ja',prompt:p.vietnamese,answers:[jp],hint:p.structure,explanation:p.explanation},
      {id:id(`exercise:${key}:ja-vi`),kind:'ja-vi',prompt:p.other,ruby:await ruby(p.other),answers:[p.otherVi],hint:p.meaning,explanation:p.explanation},
      {id:id(`exercise:${key}:arrange`),kind:'arrange',prompt:'Sắp xếp bốn mảnh thành câu hoàn chỉnh.',tokens:shuffled,correctOrder:[1,3,0,2],starIndex:2,translation:p.vietnamese,hint:p.structure,explanation:p.explanation},
    ]});
    exams.push(question(`${key}:grammar`,p.prompt,p.options,`${p.options[0]} là đáp án phù hợp. ${p.explanation}`));
  }
  grammarLessons.push({id:id(`grammar-lesson:${i+1}`),title:`Bài ${i+1} — ${unit.title}`,japanese:'',patterns});
  const reading=readings[i];
  const readingQuestions=reading.questions.map((q:any,qi:number)=>question(`u${i+1}:reading:${qi}`,q.prompt,q.options,q.explanation,reading.sentences.map((s:string[])=>s[0]).join('\n')));
  exams.push(...readingQuestions);
  const annotations=await Promise.all(reading.sentences.map(async(s:string[],si:number)=>({sentenceId:`p${si+1}-s1`,japanese:s[0],translation:s[1],ruby:await ruby(s[0])})));
  const content=makeReadingContent({title:`N5 · ${String(i+1).padStart(2,'0')} · ${reading.title}`,subtitle:'NIHONGO · Đọc và nghe · Nội dung nguyên bản có AI hỗ trợ; audio Microsoft Edge TTS',text:reading.sentences.map((s:string[])=>s[0]).join('\n'),annotations,vocabList:[],grammarList:patterns.map(p=>({pattern:p.pattern,jlptLevel:'N5',meaning:p.meaning,exampleJp:p.examples[0].japanese,exampleVi:p.examples[0].vietnamese})),quizList:readingQuestions.map((q:any,qi:number)=>({id:qi+1,question:q.prompt,options:q.options,correctIndex:q.correctIndex,explanation:q.explanation}))},true);
  articles.push({id:id(`reading:${i+1}`),sourceId,content});
  // These questions cite the curated dictionary sense, without inventing alternate readings.
  const words=lessons[i].words;
  for(let wi=0;wi<4;wi++){const w=words[Math.floor(wi*words.length/4)];const alternatives=[...new Set(words.filter(x=>x.id!==w.id&&x.meaning!==w.meaning).map(x=>x.meaning))].slice(wi).concat(words.filter(x=>x.meaning!==w.meaning).map(x=>x.meaning));const options=[w.meaning,...[...new Set(alternatives)].slice(0,3)];exams.push(question(`u${i+1}:word:${w.id}`,`Theo bài từ vựng, “${w.word}（${w.reading}）” có nghĩa nào?`,options,`${w.word}（${w.reading}）: ${w.meaning}. Nguồn từ vựng OpenJLPT / NIHONGO.`));}
  const group=kanji.slice(ki,ki+(i<10?4:3));ki+=group.length;kanjiGroups.push(group);
  for(const k of group){const others=kanji.filter((x:any)=>x.hanViet!==k.hanViet);exams.push(question(`u${i+1}:kanji:${k.id}`,`Âm Hán Việt của chữ ${k.kanji} trong kho Kanji là gì?`,[k.hanViet,...[...new Set(others.map((x:any)=>x.hanViet))].slice(i,i+3)] as string[],`${k.kanji} — ${k.hanViet}: ${k.meaning}.`));}
  unitExams.push(exams);
}
const grammar=grammarDraftSchema.parse({title:'Ngữ pháp N5 — NIHONGO',subtitle:'31bài · 62mẫu · Ví dụ và ba dạng bài tập',description:'Giáo trình nguyên bản do NIHONGO biên soạn có AI hỗ trợ, phục vụ lộ trình N5. Từ câu danh từ đến động từ, tính từ, thểて/ない/た, thời gian và hội thoại. Không phải danh sách ngữ pháp chính thức của JLPT. Đối chiếu đáp án mẫu có thể không chấp nhận mọi cách dịch đúng; chức năng Gemini chấm theo cấu hình hiện có.',level:'N5',sourceId,lessons:grammarLessons});
const sessions:any[]=[];
const addSession=(key:string,title:string,description:string,minutes:number,targets:Array<[string,string]>,questions:any[])=>{
  const unique=[...new Map(targets.map(t=>[t.join(':'),t])).values()];
  sessions.push({id:id(`session:${key}`),title,description,estimatedMinutes:minutes,resources:unique.map(([kind,targetId])=>({id:id(`resource:${key}:${kind}:${targetId}`),kind,targetId})),questions:questions.map((q,qi)=>({...q,id:id(`session-question:${key}:${qi}`)}))});
};
const hira=[['あ','a','i','u','e'],['き','ki','ka','ku','ke'],['し','shi','chi','tsu','su'],['つ','tsu','su','shi','te'],['ふ','fu','ho','he','ha'],['ん','n','m','nu','mu'],['が','ga','ka','za','da'],['ぱ','pa','ba','ha','ma'],['きゃ','kya','kiya','ka','cha'],['ちょ','cho','chiyo','sho','cha']];
const kata=[['ア','a','i','u','e'],['カ','ka','ga','ki','ku'],['シ','shi','tsu','so','n'],['ツ','tsu','shi','n','so'],['ソ','so','n','shi','tsu'],['ン','n','so','no','nu'],['ガ','ga','ka','za','da'],['パ','pa','ba','ha','ma'],['キャ','kya','kiya','ka','cha'],['チョ','cho','chiyo','sho','cha']];
for(const [i,table] of [hira,kata].entries()) addSession(`kana${i}`,i?'Katakana — đọc từ mượn':'Hiragana — nền tảng đọc tiếng Nhật','Học bảng chữ, âm đục, âm bán đục, âm ghép; phân biệt chữ gần giống. Luyện phát âm và viết từng chữ. Âm ngắtっ/ッ và âm dài làm thay đổi nghĩa; đọc theo từng mora.',90,[['kana',i?'katakana':'hiragana']],table.map((row,qi)=>question(`kana${i}:${qi}`,`Chọn cách đọc của ${row[0]}.`,row.slice(1),`${row[0]} đọc là ${row[1]}.`)));
let completedUnits=0;
for(let position=3;position<=36;position++){
  if([10,20,30].includes(position)){
    const start=Math.max(0,completedUnits-9), indices=Array.from({length:completedUnits-start},(_,n)=>start+n);
    addSession(`checkpoint${position}`,`Ôn chặng ${position/10} — củng cố kiến thức`,`Ôn lại các bài ${start+1}–${completedUnits}. Tự giải thích đáp án sai, nghe lại bài đọc và luyện các từ chưa nhớ trước khi kiểm tra.`,90,indices.flatMap(i=>[['vocabulary',lessons[i].id],['reading',articles[i].id]] as Array<[string,string]>),indices.flatMap(i=>unitExams[i].slice(0,2)).slice(0,20));continue;
  }
  const i=completedUnits++;
  addSession(`unit${i+1}`,`${String(position).padStart(2,'0')} · ${units[i].title}`,`Học hai mẫu ngữ pháp; ${lessons[i].words.length} từ (${lessons[i].title}); ${kanjiGroups[i].length} Kanji. Đọc hiểu, nghe không nhìn văn bản rồi đối chiếu bản chép và dịch. Bài kiểm tra hoàn thành buổi không yêu cầu tự đánh dấu từng tài liệu.`,90,[['vocabulary',lessons[i].id],...grammar.lessons[i].patterns.map(p=>['grammar',p.id] as [string,string]),...kanjiGroups[i].map((k:any)=>['kanji',k.id] as [string,string]),['reading',articles[i].id]],unitExams[i]);
}
addSession('review-reading','37 · Đọc hiểu tổng hợp','Đọc các thông báo, kế hoạch và câu chuyện. Xác định ai, ở đâu, khi nào, vì sao; dựa bằng chứng trong bài thay vì đoán theo một từ.',120,[24,26,27,28,30].map(i=>['reading',articles[i].id]),[20,22,24,26,27,28,30].flatMap(i=>unitExams[i].slice(2,4)));
addSession('review-listening','38 · Nghe và phản xạ thông tin','Mở từng bài, ẩn bản dịch và nghe audio trước khi đọc. Ghi lại thời gian, người, địa điểm, hành động; nghe lại từng câu rồi đối chiếu. Audio TTS luyện nghe, không phải audio đề thi JLPT. Bài kiểm tra dưới đây kiểm tra hiểu thông tin bằng văn bản.',120,[5,7,17,22,27,28].map(i=>['reading',articles[i].id]),[5,7,17,22,27,28].flatMap(i=>unitExams[i].slice(2,4)));
addSession('review-vocabulary','39 · Tổng ôn từ vựng và Kanji','Dùng Review trong giáo trình để gộp các bài cần ôn; chọn Flashcard, Trắc nghiệm hoặc Nhồi nhét. Tự gắn sao những mục muốn đưa vào lịch ôn. Tổng kiểm tra chỉ dùng kiến thức đã học.',120,lessons.map(l=>['vocabulary',l.id]),unitExams.flatMap(q=>q.slice(4,5)).filter((_,i)=>i%2===0).concat(unitExams.filter((_,i)=>i%3===0).map(q=>q[8])));
addSession('final','40 · Tổng kiểm tra NIHONGO N5','Kiểm tra tổng hợp từ vựng, Kanji, ngữ pháp và đọc hiểu của giáo trình. Đây là bài tổng kết nội bộ, không phải đề mô phỏng chuẩn hóa hay chứng nhận đạt JLPT. Sau khi làm, ôn theo phần giải thích và luyện nghe lại các bài.',120,[['vocabulary',lessons[30].id],['reading',articles[30].id],['grammar',grammar.lessons[30].patterns[1].id]],unitExams.map((q,i)=>q[i%q.length]).concat(unitExams.filter((_,i)=>i%3===0).map(q=>q[3])));
const roadmap=parseJlptDraft({title:'NIHONGO N5 — Từ nền tảng đến tổng ôn',description:'40buổi · 662từ tham khảo OpenJLPT · 103Kanji KANJIDIC2 · 62mẫu ngữ pháp · 31bài đọc/nghe có dịch và Edge TTS. Học khoảng60–120phút/buổi, có thể chia nhiều ngày. Giáo trình NIHONGO có AI hỗ trợ, không phải danh mục JLPT chính thức. Đạt kiểm tra cuối buổi để mở tiếp; xem tài liệu không tự hoàn thành.',sourceId,passPercent:80,sessions});
if(units.length!==31||readings.length!==31||lessons.length!==31||kanji.length!==103||ki!==103||sessions.length!==40)throw new Error('Coverage mismatch');
const bundle={schemaVersion:1,edition:'2026-10-25-v1',sources:[originalSource,vocabularySource],vocabulary:{id:id('vocabulary-course'),slug:'tu-vung-n5-openjlpt',draft:vocab},grammar:{id:id('grammar-course'),slug:'ngu-phap-n5-nihongo',draft:grammar},articles,roadmap:{id:id('roadmap'),level:'N5',draft:roadmap}};
const output=JSON.stringify(bundle,null,2)+'\n';
await writeFile(new URL('bundle.json',import.meta.url),output,'utf8');
const report={sha256:createHash('sha256').update(output).digest('hex'),sessions:sessions.length,words:lessons.reduce((n,l)=>n+l.words.length,0),kanji:kanji.length,patterns:62,grammarExercises:grammar.lessons.flatMap(l=>l.patterns).reduce((n,p)=>n+p.exercises.length,0),readingArticles:articles.length,readingSentences:articles.reduce((n,a)=>n+a.content.paragraphs.flatMap(p=>p.sentences).length,0),examQuestions:sessions.reduce((n,s)=>n+s.questions.length,0),spellingChanges,editorialStatus:'AI-assisted internal review; not native-editor certified',databaseWrites:0,coverage:sessions.map((s,i)=>({session:i+1,title:s.title,resources:s.resources.length,questions:s.questions.length}))};
await writeFile(new URL('validation.json',import.meta.url),JSON.stringify(report,null,2)+'\n','utf8');
console.log(report);

