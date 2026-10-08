import type { ShadowingGrade, ShadowingMode, ShadowingSentence } from '@nihongo/shared/contracts/shadowing';

export function matchingGrade(grades: ShadowingGrade[], sentence: ShadowingSentence, mode: ShadowingMode) {
  return grades.find(grade => grade.sentenceId === sentence.id && grade.mode === mode && grade.sentence.text === sentence.text
    && JSON.stringify(grade.sentence.tokens.map(token => token.text)) === JSON.stringify(sentence.tokens.map(token => token.text)));
}

/** Keep the latest pause/leave position while a periodic checkpoint is in flight. */
export function createShadowingCheckpoint<T>(save: (value: T) => Promise<void>) {
  type Waiter = { resolve: () => void; reject: (cause: unknown) => void };
  let pending: { value: T; waiters: Waiter[] } | null = null, running = false;
  const drain = async () => {
    if (running) return;
    running = true;
    try {
      while (pending) {
        const next = pending; pending = null;
        try { await save(next.value); next.waiters.forEach(waiter => waiter.resolve()); }
        catch (cause) {
          next.waiters.forEach(waiter => waiter.reject(cause));
          // Do not retry a failed checkpoint automatically. A new action may retry.
          const remaining = pending as { value: T; waiters: Waiter[] } | null;
          remaining?.waiters.forEach(waiter => waiter.reject(cause)); pending = null;
        }
      }
    } finally { running = false; }
  };
  return (value: T) => new Promise<void>((resolve, reject) => {
    pending = { value, waiters: [...(pending?.waiters ?? []), { resolve, reject }] };
    void drain();
  });
}

/** One account/video lifetime; serialize revisions without reviving work after remount. */
export function createShadowingQueue() {
  let generation = 0, mounted = false, queue: Promise<unknown> = Promise.resolve();
  return {
    mount() { mounted = true; generation++; },
    unmount() { mounted = false; generation++; },
    enqueue<T>(work: (current: () => boolean) => Promise<T>): Promise<T> {
      const ticket = generation, current = () => mounted && ticket === generation;
      const next = queue.catch(() => {}).then(async () => {
        if (!current()) throw new Error('Màn học đã thay đổi.');
        return work(current);
      });
      queue = next.catch(() => {});
      return next;
    },
  };
}
