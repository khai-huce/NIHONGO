import { afterEach, expect, it, vi } from 'vitest';
import type { Config } from '../src/config/env.js';
import { requestGeminiJson } from '../src/integrations/gemini.js';
import { groqTranscript } from '../src/integrations/groq.js';

const config = { GEMINI_API_KEY: 'test', GEMINI_MODEL: 'test', GROQ_API_KEY: 'test' } as Config;
const input = { instruction: 'Answer', data: {}, schema: {}, timeoutMs: 5000, maxOutputTokens: 128 };
const completion = (value: unknown) => Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });
afterEach(() => vi.unstubAllGlobals());

it('sends one fallback on Gemini overload', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(completion({ ok: true }));
  vi.stubGlobal('fetch', fetcher);
  expect(await requestGeminiJson(config, input)).toEqual({ ok: true });
  expect(fetcher.mock.calls[1][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
});
it('respects restricted context', async () => {
  const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(requestGeminiJson(config, { ...input, allowGroq: false })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('preserves Whisper timestamps through translation', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(Response.json({ language: 'japanese', segments: [{ start: 1, end: 2.5, text: 'こんにちは' }] }))
    .mockResolvedValueOnce(completion({ translations: ['Xin chào'] })));
  expect(await groqTranscript('test', 'YWJj')).toEqual([{ startMs: 1000, endMs: 2500, text: 'こんにちは', translationVi: 'Xin chào' }]);
});
