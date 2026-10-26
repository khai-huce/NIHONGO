import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { curriculumDraftSchema } from '../src/modules/curriculum/curriculum.schema.js';
import { grammarDraftSchema } from '../src/modules/grammar/grammar.schema.js';
import { parseJlptDraft } from '../src/modules/jlpt/jlpt.schema.js';
const bundle=JSON.parse(readFileSync(new URL('../content/jlpt-n5/bundle.json',import.meta.url),'utf8'));
const vocabulary=curriculumDraftSchema.parse(bundle.vocabulary.draft),grammar=grammarDraftSchema.parse(bundle.grammar.draft),roadmap=parseJlptDraft(bundle.roadmap.draft);
describe('NIHONGO N5 authored edition coverage',()=>{
  it('preserves all662 OpenJLPT word IDs and covers every published lesson, pattern and reading',()=>{
    const original=curriculumDraftSchema.parse(JSON.parse(readFileSync(new URL('../../../docs/data/tu-vung-n5/tu-vung-n5.json',import.meta.url),'utf8')));
    const words=(v:typeof vocabulary)=>v.topics.flatMap(t=>t.lessons.flatMap(l=>l.words.map(w=>w.id))).sort();
    expect(words(vocabulary)).toEqual(words(original));expect(words(vocabulary)).toHaveLength(662);
    const resources=roadmap.sessions.flatMap(s=>s.resources);
    for(const lesson of vocabulary.topics.flatMap(t=>t.lessons))expect(resources.some(r=>r.kind==='vocabulary'&&r.targetId===lesson.id)).toBe(true);
    for(const pattern of grammar.lessons.flatMap(l=>l.patterns))expect(resources.some(r=>r.kind==='grammar'&&r.targetId===pattern.id)).toBe(true);
    for(const reading of bundle.articles)expect(resources.some(r=>r.kind==='reading'&&r.targetId===reading.id)).toBe(true);
    expect(new Set(resources.filter(r=>r.kind==='kanji').map(r=>r.targetId)).size).toBe(103);
  });
  it('gives every session a nonempty unique exam and real resources',()=>{
    expect(roadmap.sessions).toHaveLength(40);const ids=new Set<string>();
    for(const session of roadmap.sessions){expect(session.resources.length).toBeGreaterThan(0);expect(session.questions!.length).toBeGreaterThanOrEqual(5);
      for(const q of session.questions!){expect(ids.has(q.id)).toBe(false);ids.add(q.id);expect(new Set(q.options).size).toBe(4);expect(q.options[q.correctIndex]).toBeTruthy();expect(q.explanation).toBeTruthy();expect(q.prompt).not.toMatch(/kiểm thử|test fixture|lorem/i);}}
  });
  it('keeps translations, ruby and arrangement answers tied to the exact Japanese text',()=>{
    for(const article of bundle.articles){const sentences=article.content.paragraphs.flatMap((p:{sentences:unknown[]})=>p.sentences);expect(sentences.length).toBeGreaterThanOrEqual(5);
      for(const s of sentences){expect(s.translation).toBeTruthy();expect(s.ruby.map((r:{text:string})=>r.text).join('')).toBe(s.japanese);}}
    for(const p of grammar.lessons.flatMap(l=>l.patterns)){expect(new Set(p.exercises.map(e=>e.kind))).toEqual(new Set(['vi-ja','ja-vi','arrange']));const arrange=p.exercises.find(e=>e.kind==='arrange')!;expect(arrange.correctOrder.map(i=>arrange.tokens[i]).join('')).toBe(p.examples[0].japanese);}
  });
});
