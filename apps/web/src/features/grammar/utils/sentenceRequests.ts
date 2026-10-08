/** Request identity belongs to the exact input and account currently on screen. */
export function createSentenceRequestSession() {
  let context = '', revision = 0, mounted = true;
  const pending = new Set<'analyze' | 'ai'>();
  let aiRequest: { context: string; id: string } | null = null;
  return {
    sync(next: string) {
      if (next !== context) {
        context = next; revision++; pending.clear(); aiRequest = null;
      }
      return revision;
    },
    mount() { mounted = true; },
    unmount() { mounted = false; revision++; pending.clear(); },
    begin(kind: 'analyze' | 'ai') {
      if (!mounted || pending.size > 0) return null;
      pending.add(kind);
      const requestRevision = revision, requestContext = context;
      const current = () => mounted && revision === requestRevision && context === requestContext;
      return { current, finish: () => { if (current()) pending.delete(kind); } };
    },
    aiId() {
      if (!aiRequest || aiRequest.context !== context) aiRequest = { context, id: crypto.randomUUID() };
      return aiRequest.id;
    },
    retryAi(code: string) {
      // These provider errors are terminal on the server. Uncertain outcomes keep
      // their ID so a retry can recover a response without charging twice.
      if (['AI_RETRY_NEW', 'AI_UNAVAILABLE', 'AI_INVALID_RESPONSE', 'AI_QUOTA'].includes(code)) aiRequest = null;
    },
  };
}

export const normalizeSentenceInput = (input: string) => input.normalize('NFC').trim();
