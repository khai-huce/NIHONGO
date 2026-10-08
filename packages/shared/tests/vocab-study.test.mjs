import test from 'node:test';
import assert from 'node:assert/strict';
import {eligibleWords, getStudyTarget, isStudyAnswerCorrect, getQuizOptions, romajiToHiragana, shuffleStudyWords} from '../src/study/vocab-study.mjs';

const school = {id:'school', word:'学校', reading:'がっこう', hanViet:'HỌC HIỆU', meaning:'Trường học'};
const shop = {id:'shop', word:'コンビニ', reading:'コンビニ', hanViet:'', meaning:'Cửa hàng'};
const noReading = {id:'blank', word:'猫', reading:'  ', hanViet:'MIÊU', meaning:'Mèo'};

test('eligible questions depend on the selected mode, without falling back to the visible answer', () => {
  const words=[school,shop,noReading];
  assert.deepEqual(eligibleWords(words,'quiz','meaning'),words);
  assert.deepEqual(eligibleWords(words,'quiz','kanji'),[school,shop]);
  assert.deepEqual(eligibleWords(words,'quiz','reading'),[school,shop]);
  assert.deepEqual(eligibleWords(words,'cram','reading'),[school,shop]);
  assert.deepEqual(eligibleWords(words,'cram','hanViet'),[school,noReading]);
  assert.deepEqual(eligibleWords(words,'cram','meaning'),[]);
  assert.equal(getStudyTarget(noReading,'cram','reading'),'');
});

test('blank or punctuation-only prompts/targets cannot form valid questions', () => {
  for(const field of ['word','meaning','reading']) {
    assert.equal(eligibleWords([{...school,[field]:' / _ . '}],'quiz','kanji').length,0);
  }
  assert.equal(eligibleWords([{...school,hanViet:' / '}],'cram','hanViet').length,0);
  assert.equal(isStudyAnswerCorrect(shop,'cram','hanViet','/'),false);
  assert.equal(isStudyAnswerCorrect(school,'cram','reading',''),false);
  assert.equal(isStudyAnswerCorrect(school,'quiz','meaning',null),false);
});

test('each quiz mode grades the field represented by its choices', () => {
  assert.equal(isStudyAnswerCorrect(school,'quiz','meaning','学校'),true);
  assert.equal(isStudyAnswerCorrect(school,'quiz','meaning','Trường học'),false);
  assert.equal(isStudyAnswerCorrect(school,'quiz','kanji','学校'),true);
  assert.equal(isStudyAnswerCorrect(school,'quiz','reading','がっこう'),true);
  assert.equal(isStudyAnswerCorrect(school,'quiz','reading','学校'),false);
  assert.equal(isStudyAnswerCorrect(school,'quiz','reading','gakkou'),false);
});

test('romaji handles double consonants, contextual n and complete pasted answers', () => {
  for(const [input,target] of [['gakkou','がっこう'],['konnichiwa','こんにちわ'],['konnichiha','こんにちは'],
    ['shinbun','しんぶん'],['nihonn','にほん'],["kan'i",'かんい'],['kanpai','かんぱい'],['sensei','せんせい']]) {
    assert.equal(romajiToHiragana(input),target,input);
    assert.equal(isStudyAnswerCorrect({...school,reading:target},'cram','reading',input),true,input);
  }
});

test('reading accepts supported input scripts without erasing voicing or small kana', () => {
  assert.equal(isStudyAnswerCorrect(school,'cram','reading','ＧＡＫＫＯＵ'),true);
  assert.equal(isStudyAnswerCorrect(school,'cram','reading','ガッコウ'),true);
  assert.equal(isStudyAnswerCorrect(shop,'cram','reading','konbini'),true);
  assert.equal(isStudyAnswerCorrect(shop,'cram','reading','ｺﾝﾋﾞﾆ'),true);
  for(const reading of ['ば','ぱ']) assert.equal(isStudyAnswerCorrect({...school,reading},'cram','reading','は'),false);
  assert.equal(isStudyAnswerCorrect({...school,reading:'きゃ'},'cram','reading','きや'),false);
  assert.equal(isStudyAnswerCorrect({...school,reading:'コーヒー'},'cram','reading','ko-hi-'),true);
});

test('Han Viet tolerates case, spacing and accent variations but never empty answers', () => {
  for(const answer of ['học hiệu','HOC HIEU',' học   HIỆU ']) assert.equal(isStudyAnswerCorrect(school,'cram','hanViet',answer),true);
  assert.equal(isStudyAnswerCorrect({...school,hanViet:'ĐIỂU'},'cram','hanViet','dieu'),true);
  assert.equal(isStudyAnswerCorrect(school,'cram','hanViet','học sinh'),false);
  assert.equal(isStudyAnswerCorrect(school,'cram','hanViet','/'),false);
});

test('short lessons get four unique choices of the correct type and one correct answer', () => {
  for(const mode of ['reading','kanji','meaning']) {
    const options=getQuizOptions(school,[school],mode);
    assert.equal(options.length,4);
    assert.equal(options.filter(option=>option.isCorrect).length,1);
    assert.equal(new Set(options.map(option=>option.text)).size,4);
    assert.equal(options.find(option=>option.isCorrect).text,getStudyTarget(school,'quiz',mode));
    if(mode==='reading') assert.ok(options.every(option=>/^[\p{Script=Hiragana}ー]+$/u.test(option.text)));
  }
});

test('duplicate answers from other words do not create multiple correct-looking options', () => {
  const repeated=[school,{...school,id:'same-reading'},{...school,id:'whitespace',reading:' がっこう '}];
  const options=getQuizOptions(school,repeated,'reading');
  assert.equal(options.length,4);
  assert.equal(options.filter(option=>option.text==='がっこう').length,1);
});

test('eligibility and shuffle preserve source contents and separate word IDs', () => {
  const words=[school,{...school,id:'another-school'},shop];
  const before=JSON.stringify(words);
  const shuffled=shuffleStudyWords(words);
  assert.notEqual(shuffled,words);
  assert.deepEqual(shuffled.map(word=>word.id).sort(),words.map(word=>word.id).sort());
  assert.equal(eligibleWords(words,'quiz','meaning').length,3);
  assert.equal(JSON.stringify(words),before);
});
