type ProgressWord = { id: string };

/** Only current word IDs contribute to this lesson's progress. False is a saved rating too. */
export function keepVocabProgress(words: readonly ProgressWord[], progress: Record<string, boolean>) {
  return Object.fromEntries(words
    .filter(word => Object.prototype.hasOwnProperty.call(progress, word.id) && typeof progress[word.id] === 'boolean')
    .map(word => [word.id, progress[word.id]])) as Record<string, boolean>;
}

export function summarizeVocabProgress(words: readonly ProgressWord[], progress: Record<string, boolean>) {
  let known = 0;
  let unknown = 0;
  let firstUnratedIndex = -1;
  words.forEach((word, index) => {
    const rated = Object.prototype.hasOwnProperty.call(progress, word.id) && typeof progress[word.id] === 'boolean';
    if (!rated) {
      if (firstUnratedIndex === -1) firstUnratedIndex = index;
    } else if (progress[word.id]) known += 1;
    else unknown += 1;
  });
  return { known, unknown, rated: known + unknown, firstUnratedIndex };
}

/** Continue through skipped cards after reaching the end, without re-rating saved words. */
export function nextUnratedIndex(words: readonly ProgressWord[], progress: Record<string, boolean>, afterIndex = -1) {
  if (words.length === 0) return -1;
  const start = Math.min(Math.max(Math.trunc(afterIndex), -1), words.length - 1);
  for (let offset = 1; offset <= words.length; offset += 1) {
    const index = (start + offset) % words.length;
    const id = words[index].id;
    if (!Object.prototype.hasOwnProperty.call(progress, id) || typeof progress[id] !== 'boolean') return index;
  }
  return -1;
}
