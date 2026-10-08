import { createHash } from 'node:crypto';
import type { GrammarExerciseContent as GrammarExercise } from './grammar.schema.js';

// Only spacing, case and basic sentence punctuation are ignored. Accents,
// particles, kana/kanji variants and word order still need accepted answers.
export function normalizeGrammarAnswer(answer: string) {
  return answer.normalize('NFKC').toLocaleLowerCase('vi').replace(/[\s。、，,.!?！？「」『』"“”]+/gu, '');
}
export function gradeGrammar(exercise: GrammarExercise, answer: string | number[]) {
  if (exercise.kind === 'arrange') {
    return Array.isArray(answer) && answer.length === 4 && answer.every((token, index) => token === exercise.correctOrder[index]);
  }
  return typeof answer === 'string' && !!normalizeGrammarAnswer(answer) && exercise.answers.some(item => normalizeGrammarAnswer(item) === normalizeGrammarAnswer(answer));
}
export function grammarRequestHash(input: unknown) { return createHash('sha256').update(JSON.stringify(input)).digest('hex'); }
export function grammarAnswer(exercise: GrammarExercise, answer: string | number[], action: 'check' | 'reveal', patternVersion: number) {
  return {
    exerciseId: exercise.id, patternVersion, action, answer, correct: action === 'check' && gradeGrammar(exercise, answer),
    modelAnswer: exercise.kind === 'arrange' ? exercise.prefix + exercise.correctOrder.map(index => exercise.tokens[index]).join('') + exercise.suffix : exercise.answers[0],
    explanation: exercise.explanation, translation: exercise.translation,
    correctOrder: exercise.kind === 'arrange' ? exercise.correctOrder : [],
    starAnswer: exercise.kind === 'arrange' ? exercise.correctOrder[exercise.starIndex] + 1 : null,
    checkedAt: new Date().toISOString(),
  };
}
