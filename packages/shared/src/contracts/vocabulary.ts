export type VocabWord = {
  id: string;
  word: string;
  reading: string;
  hanViet: string;
  meaning: string;
};
export type VocabLesson = { id: string; name: string; words: VocabWord[]; version?: number };
