export type StudyWord = { id:string; word:string; reading:string; hanViet:string; meaning:string };
export type StudyKind = 'quiz' | 'cram';
export type StudyMode = 'reading' | 'kanji' | 'meaning' | 'hanViet';
export type StudyAnswer = { wordId:string; answer:string|null; correct:boolean };
export type StudyResult = {
  id:string; lessonId:string; lessonName:string; lessonVersion:number;
  kind:StudyKind; mode:StudyMode; total:number; correct:number; completedAt:string; answers:StudyAnswer[];
};
export function romajiToHiragana(input:string):string;
export function normalizeVietnamese(text:string):string;
export function normalizeText(text:string):string;
export function getStudyTarget(word:StudyWord, kind:StudyKind, mode:StudyMode):string;
export function eligibleWords<T extends StudyWord>(words:T[], kind:StudyKind, mode:StudyMode):T[];
export function isStudyAnswerCorrect(word:StudyWord, kind:StudyKind, mode:StudyMode, answer:string|null):boolean;
export function shuffleStudyWords<T>(words:T[]):T[];
export function getQuizOptions(word:StudyWord, words:StudyWord[], mode:StudyMode):{id:string;text:string;isCorrect:boolean}[];
