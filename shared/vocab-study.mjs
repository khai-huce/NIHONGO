// Pure rules shared by the browser and Express; no storage or browser APIs here.
const ROMAJI = {
  a:'あ',i:'い',u:'う',e:'え',o:'お',
  ka:'か',ki:'き',ku:'く',ke:'け',ko:'こ',kya:'きゃ',kyu:'きゅ',kyo:'きょ',
  sa:'さ',shi:'し',si:'し',su:'す',se:'せ',so:'そ',sha:'しゃ',shu:'しゅ',sho:'しょ',
  ta:'た',chi:'ち',ti:'ち',tsu:'つ',tu:'つ',te:'て',to:'と',cha:'ちゃ',chu:'ちゅ',cho:'ちょ',
  na:'な',ni:'に',nu:'ぬ',ne:'ね',no:'の',nya:'にゃ',nyu:'にゅ',nyo:'にょ',
  ha:'は',hi:'ひ',fu:'ふ',hu:'ふ',he:'へ',ho:'ほ',hya:'ひゃ',hyu:'ひゅ',hyo:'ひょ',
  ma:'ま',mi:'み',mu:'む',me:'め',mo:'も',mya:'みゃ',myu:'みゅ',myo:'みょ',
  ya:'や',yu:'ゆ',yo:'よ',ra:'ら',ri:'り',ru:'る',re:'れ',ro:'ろ',rya:'りゃ',ryu:'りゅ',ryo:'りょ',
  wa:'わ',wo:'を',ga:'が',gi:'ぎ',gu:'ぐ',ge:'げ',go:'ご',gya:'ぎゃ',gyu:'ぎゅ',gyo:'ぎょ',
  za:'ざ',ji:'じ',zi:'じ',zu:'ず',ze:'ぜ',zo:'ぞ',ja:'じゃ',ju:'じゅ',jo:'じょ',
  da:'だ',di:'ぢ',du:'づ',de:'で',do:'ど',ba:'ば',bi:'び',bu:'ぶ',be:'べ',bo:'ぼ',
  bya:'びゃ',byu:'びゅ',byo:'びょ',pa:'ぱ',pi:'ぴ',pu:'ぷ',pe:'ぺ',po:'ぽ',
  pya:'ぴゃ',pyu:'ぴゅ',pyo:'ぴょ',fa:'ふぁ',fi:'ふぃ',fe:'ふぇ',fo:'ふぉ',
};

export function romajiToHiragana(input) {
  const text = input.normalize('NFKC').toLowerCase();
  let result = '';
  for (let i = 0; i < text.length;) {
    if (text[i] === 'n') {
      if (text[i + 1] === "'") { result += 'ん'; i += 2; continue; }
      if (text[i + 1] === 'n') {
        result += 'ん';
        i += /[aiueoy]/.test(text[i + 2] ?? '') ? 1 : 2;
        continue;
      }
      if (!text[i + 1] || !/[aiueoy]/.test(text[i + 1])) { result += 'ん'; i++; continue; }
    }
    if (text[i] === text[i + 1] && /[bcdfghjklmpqrstvwxyz]/.test(text[i])) {
      result += 'っ'; i++; continue;
    }
    let found = false;
    for (const length of [3, 2, 1]) {
      const part = text.slice(i, i + length);
      if (Object.hasOwn(ROMAJI, part)) { result += ROMAJI[part]; i += length; found = true; break; }
    }
    if (!found) { result += text[i]; i++; }
  }
  return result;
}

export const normalizeVietnamese = text => text.normalize('NFC').toLowerCase().replace(/\s+/gu, ' ').trim();
export const normalizeText = text => text.normalize('NFD').toLowerCase()
  .replace(/[\u0300-\u036f]/gu, '').replace(/đ/gu, 'd').replace(/[\s\-_.,/()[\]]/gu, '').trim();

const meaningful = text => typeof text === 'string' && /[\p{L}\p{N}]/u.test(text);
const exact = text => text.normalize('NFKC').trim();
// Preserve Japanese voicing marks. Folding NFD accents globally would make ば and は equal.
const kana = text => text.normalize('NFKC').toLowerCase()
  .replace(/[ァ-ヶ]/gu, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
  .replace(/\s+/gu, '');

export function getStudyTarget(word, kind, mode) {
  if (kind === 'quiz' && (mode === 'kanji' || mode === 'meaning')) return word.word.trim();
  if (mode === 'reading') return word.reading.trim();
  if (kind === 'cram' && mode === 'hanViet') return word.hanViet.trim();
  return '';
}

export function eligibleWords(words, kind, mode) {
  if (!(kind === 'quiz' ? ['reading','kanji','meaning'] : kind === 'cram' ? ['reading','hanViet'] : []).includes(mode)) return [];
  return words.filter(word => meaningful(word.word) && meaningful(word.meaning) && meaningful(getStudyTarget(word, kind, mode)) &&
    (!(kind === 'quiz' && mode === 'kanji') || meaningful(word.reading)));
}

export function isStudyAnswerCorrect(word, kind, mode, answer) {
  if (!meaningful(answer) || !eligibleWords([word], kind, mode).length) return false;
  const target = getStudyTarget(word, kind, mode);
  if (kind === 'quiz') return exact(answer) === exact(target);
  if (mode === 'hanViet') {
    const expected = normalizeText(target), actual = normalizeText(answer);
    return !!expected && !!actual && expected === actual;
  }
  const expected = kana(target), actual = kana(answer);
  // Romaji is optional input; kana and half-width katakana remain valid too.
  return expected === actual || expected === kana(romajiToHiragana(answer).replace(/-/gu, 'ー'));
}

export function shuffleStudyWords(words) {
  const shuffled = [...words];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getQuizOptions(word, words, mode) {
  const target = getStudyTarget(word, 'quiz', mode);
  if (!target) return [];
  const distractors = [];
  const seen = new Set([exact(target)]);
  const add = text => {
    if (distractors.length >= 3 || !meaningful(text) || seen.has(exact(text))) return;
    seen.add(exact(text)); distractors.push(text.trim());
  };
  for (const other of shuffleStudyWords(eligibleWords(words, 'quiz', mode))) {
    if (other.id !== word.id) add(getStudyTarget(other, 'quiz', mode));
  }
  // A small local question filler, not added lesson content; reading options stay kana.
  const fallback = mode === 'reading'
    ? ['がっこう','せんせい','がくせい','ともだち','にほん','ほん','くるま','みず']
    : ['学校','先生','学生','友達','日本','本','車','水'];
  fallback.forEach(add);
  return shuffleStudyWords([{id:'correct', text:target, isCorrect:true},
    ...distractors.map((text, i) => ({id:`distractor-${i}`, text, isCorrect:false}))]);
}
