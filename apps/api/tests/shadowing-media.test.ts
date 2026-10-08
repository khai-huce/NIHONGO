import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import type { Config } from '../src/config/env.js';
import { assertGeminiQuota, assertShadowingQuota } from '../src/integrations/gemini-quota.js';
import { requestGeminiJson } from '../src/integrations/gemini.js';
import { decodeShadowingClip, generateShadowingTranscript, inspectYouTube, parseYouTubeDuration, parseYouTubeUrl, validateShadowingClip } from '../src/integrations/shadowing-media.js';

const config: Config = {
  NODE_ENV: 'test', PORT: 3001, APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: 'postgresql://localhost/unused_test',
  SESSION_SECRET: 'test-only-secret-at-least-thirty-two-characters', GOOGLE_CLIENT_ID: '',
  GEMINI_API_KEY: 'fake-gemini-key', GEMINI_MODEL: 'gemini-test', YOUTUBE_API_KEY: 'fake-youtube-key',
};
const videoId = 'abcdefghijk';
const url = `https://www.youtube.com/watch?v=${videoId}`;
const metadata = { youtubeId: videoId, url, title: '動画', channel: '作者', durationMs: 65000 };
const cue = { startMs: 1000, endMs: 2000, text: '日本語を勉強します。', translationVi: 'Tôi học tiếng Nhật.' };
const clip = { language: 'ja', cues: [cue] };
const video = { id: videoId, snippet: { title: '動画', channelTitle: '作者', liveBroadcastContent: 'none' },
  contentDetails: { duration: 'PT1M5S' }, status: { privacyStatus: 'public', embeddable: true, uploadStatus: 'processed' } };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const timeText = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`;
const providerClip = (value: { language: string; cues: typeof cue[] }) => ({ ...value, cues: value.cues.map(({ startMs, endMs, ...item }) => ({ ...item, startTime: timeText(startMs), endTime: timeText(endMs) })) });
const gemini = (value: { language: string; cues: typeof cue[] }, finishReason = 'STOP') => json({ status: finishReason === 'STOP' ? 'completed' : 'incomplete', steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(providerClip(value)) }] }] });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Shadowing provider metadata', () => {
  it('canonicalizes allowed video URLs and rejects credentials, wrong hosts and malformed IDs without requests', () => {
    for (const link of [url, `https://youtu.be/${videoId}?t=4`, `https://m.youtube.com/shorts/${videoId}`, `https://youtube.com/embed/${videoId}`]) {
      expect(parseYouTubeUrl(link)).toEqual({ youtubeId: videoId, url });
    }
    for (const link of ['file:///etc/passwd', 'https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://user:pass@youtube.com/watch?v=abcdefghijk',
      'https://youtube.com:444/watch?v=abcdefghijk', 'https://youtube.com/watch?v=abcdefghijk&v=abcdefghijk', 'https://youtu.be/nope', 'https://youtube.com/playlist?list=abc']) {
      expect(() => parseYouTubeUrl(link)).toThrow();
    }
  });
  it('uses fixed provider host, a bounded request and actual public embeddable metadata', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ items: [video] })); vi.stubGlobal('fetch', fetcher);
    expect(await inspectYouTube(config, `https://youtu.be/${videoId}`)).toEqual(metadata);
    const [endpoint, options] = fetcher.mock.calls[0];
    expect(new URL(endpoint).origin).toBe('https://www.googleapis.com');
    expect(new URL(endpoint).searchParams.get('id')).toBe(videoId);
    expect(options.redirect).toBe('error'); expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it.each([
    { ...video, contentDetails: { duration: 'PT30M' } }, { ...video, contentDetails: { duration: 'PT0S' } },
    { ...video, status: { ...video.status, privacyStatus: 'unlisted' } },
    { ...video, status: { ...video.status, embeddable: false } },
    { ...video, snippet: { ...video.snippet, liveBroadcastContent: 'live' } },
    { ...video, id: 'wrongwrong1' },
  ])('rejects unsupported real metadata (%#)', async item => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ items: [item] })));
    await expect(inspectYouTube(config, url)).rejects.toMatchObject({ status: 400 });
  });
  it('does not call providers without key and never leaks provider response errors', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(inspectYouTube({ ...config, YOUTUBE_API_KEY: undefined }, url)).rejects.toMatchObject({ code: 'YOUTUBE_NOT_CONFIGURED' });
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockRejectedValue(new Error('fake-youtube-key timeout detail'));
    await expect(inspectYouTube(config, url)).rejects.toMatchObject({ code: 'YOUTUBE_UNAVAILABLE' });
    fetcher.mockResolvedValue(json({ secret: 'fake-youtube-key' }, 403));
    await expect(inspectYouTube(config, url)).rejects.not.toThrow('fake-youtube-key');
  });
  it('rejects oversized or incomplete metadata and parses duration precisely', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x'.repeat(512001))));
    await expect(inspectYouTube(config, url)).rejects.toMatchObject({ code: 'YOUTUBE_INVALID_RESPONSE' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ items: [{ id: videoId }] })));
    await expect(inspectYouTube(config, url)).rejects.toMatchObject({ code: 'YOUTUBE_INVALID_RESPONSE' });
    expect(parseYouTubeDuration('PT29M59.9S')).toBe(1799900);
    expect(parseYouTubeDuration('P1DT1H')).toBe(90000000);
    expect(parseYouTubeDuration('nonsense')).toBe(0);
  });
});

describe('Shadowing AI transcript', () => {
  it('passes canonical YouTube media and clip boundaries to Gemini; no URL scraping or download', async () => {
    const fetcher = vi.fn().mockResolvedValue(gemini(clip)); vi.stubGlobal('fetch', fetcher);
    expect(await generateShadowingTranscript(config, metadata)).toEqual([cue]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [endpoint, options] = fetcher.mock.calls[0], body = JSON.parse(options.body);
    expect(new URL(endpoint).origin).toBe('https://generativelanguage.googleapis.com');
    expect(new URL(endpoint).pathname).toBe('/v1beta/interactions');
    expect(body.input[0]).toEqual({ type: 'video', uri: url, processing: { type: 'static', start_offset: '0s', end_offset: '65s' } });
    expect(body.store).toBe(false);
    expect(body.response_format.mime_type).toBe('application/json');
    expect(JSON.stringify(body.response_format.schema)).not.toMatch(/maxLength|maxItems|minimum|additionalProperties/);
    expect(body.generation_config).not.toHaveProperty('temperature');
    expect(body.model).toBe(config.GEMINI_MODEL);
  });
  it('uses an explicit Shadowing model without changing the shared text model', async () => {
    const chosen = { ...config, SHADOWING_GEMINI_MODEL: 'gemini-video-test' };
    const fetcher = vi.fn().mockResolvedValueOnce(gemini(clip)).mockResolvedValueOnce(json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }] }));
    vi.stubGlobal('fetch', fetcher);
    await expect(generateShadowingTranscript(chosen, metadata)).resolves.toEqual([cue]);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).model).toBe('gemini-video-test');
    await expect(requestGeminiJson(chosen, { instruction: 'Test', data: {}, schema: {}, maxOutputTokens: 128, timeoutMs: 1000 })).resolves.toEqual({});
    expect(String(fetcher.mock.calls[1][0])).toContain(`/models/${config.GEMINI_MODEL}:generateContent`);
    expect(chosen.GEMINI_MODEL).toBe(config.GEMINI_MODEL);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('allows an explicitly configured video model when the shared text model is absent', async () => {
    const fetcher = vi.fn().mockResolvedValue(gemini(clip)); vi.stubGlobal('fetch', fetcher);
    await expect(generateShadowingTranscript({ ...config, GEMINI_MODEL: undefined, SHADOWING_GEMINI_MODEL: 'gemini-video-test' }, metadata)).resolves.toEqual([cue]);
    expect(JSON.parse(fetcher.mock.calls[0][1].body).model).toBe('gemini-video-test');
  });
  it('reads only model output text when thoughts and other steps appear in a completed interaction', async () => {
    const text = JSON.stringify(providerClip(clip)), splitAt = Math.floor(text.length / 2);
    const fetcher = vi.fn().mockResolvedValue(json({ status: 'completed', steps: [
      { type: 'thought', content: [{ type: 'text', text: 'This is reasoning, not the transcript JSON.' }] },
      { type: 'user_input', content: [{ type: 'text', text: 'Do not parse this input.' }] },
      { type: 'model_output', content: [
        { type: 'text', text: text.slice(0, splitAt) },
        { type: 'audio', data: 'not-json' },
        { type: 'text', text: text.slice(splitAt) },
      ] },
    ] }));
    vi.stubGlobal('fetch', fetcher);
    await expect(generateShadowingTranscript(config, metadata)).resolves.toEqual([cue]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects a completed interaction without model output text', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ status: 'completed', steps: [
      { type: 'thought', content: [{ type: 'text', text: JSON.stringify(clip) }] },
      { type: 'model_output', content: [{ type: 'audio', data: 'not-a-transcript' }] },
    ] }));
    vi.stubGlobal('fetch', fetcher);
    await expect(generateShadowingTranscript(config, metadata)).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('reports provider overload without retrying or exposing the provider response', async () => {
    const fetcher = vi.fn().mockResolvedValue(json({ error: { code: 'service_unavailable', message: 'fake-gemini-key internal details' } }, 503));
    vi.stubGlobal('fetch', fetcher);
    await expect(generateShadowingTranscript(config, metadata)).rejects.toMatchObject({
      status: 503, code: 'AI_UNAVAILABLE', message: 'Gemini đang quá tải hoặc tạm ngừng phục vụ (503). Vui lòng thử lại sau.',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    [400, 502, 'AI_REQUEST_REJECTED'], [401, 503, 'AI_ACCESS_DENIED'],
    [402, 503, 'AI_BILLING_REQUIRED'], [403, 503, 'AI_ACCESS_DENIED'],
    [404, 503, 'AI_MODEL_UNAVAILABLE'], [416, 502, 'AI_REQUEST_REJECTED'],
    [422, 502, 'AI_REQUEST_REJECTED'], [429, 429, 'AI_QUOTA'],
    [500, 503, 'AI_UNAVAILABLE'],
  ])('distinguishes provider HTTP %i without leaking its body or retrying', async (upstream, status, code) => {
    const fetcher = vi.fn().mockResolvedValue(json({ error: { message: 'fake-gemini-key private provider body' } }, upstream as number));
    vi.stubGlobal('fetch', fetcher);
    const error = await generateShadowingTranscript(config, metadata).catch(error => error);
    expect(error).toMatchObject({ status, code });
    expect(error.message).not.toMatch(/fake-gemini-key|private provider body/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('splits up to three clips in order with absolute timings and rejects incomplete chunks without returning partial results', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(gemini(clip))
      .mockResolvedValueOnce(gemini({ language: 'ja', cues: [{ ...cue, startMs: 601000, endMs: 602000 }] }))
      .mockResolvedValueOnce(gemini({ language: 'ja', cues: [{ ...cue, startMs: 1201000, endMs: 1202000 }] }));
    vi.stubGlobal('fetch', fetcher);
    const result = await generateShadowingTranscript(config, { ...metadata, durationMs: 1203000 });
    expect(result.map(value => value.startMs)).toEqual([1000, 601000, 1201000]);
    expect(fetcher.mock.calls.map(([, options]) => JSON.parse(options.body).input[0].processing)).toEqual([
      { type: 'static', start_offset: '0s', end_offset: '600s' }, { type: 'static', start_offset: '600s', end_offset: '1200s' }, { type: 'static', start_offset: '1200s', end_offset: '1203s' },
    ]);
    fetcher.mockReset().mockResolvedValueOnce(gemini(clip)).mockResolvedValueOnce(gemini(clip, 'MAX_TOKENS'));
    await expect(generateShadowingTranscript(config, { ...metadata, durationMs: 601000 })).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects overlap, out-of-clip/relative offsets, missing translation, wrong language and invented non-Japanese text', () => {
    for (const value of [
      { ...clip, cues: [cue, { ...cue, startMs: 1500, endMs: 2200 }] },
      { ...clip, cues: [{ ...cue, endMs: 90000 }] },
      { ...clip, cues: [{ ...cue, translationVi: '' }] },
      { ...clip, cues: [{ ...cue, text: 'I speak English.' }] },
      { ...clip, cues: [{ ...cue, text: 'あ'.repeat(301) }] },
      { ...clip, cues: [{ ...cue, translationVi: 'a'.repeat(2001) }] },
      { ...clip, cues: [{ ...cue, startMs: -1 }] },
      { ...clip, cues: [{ ...cue, extra: 'not allowed' }] },
      { ...clip, cues: Array.from({ length: 501 }, (_, i) => ({ ...cue, startMs: i * 10, endMs: i * 10 + 5 })) },
      { language: 'ja', cues: [] }, { language: 'none', cues: [cue] },
    ]) expect(() => validateShadowingClip(value, 0, 65000)).toThrow();
    expect(() => validateShadowingClip(clip, 600000, 650000)).toThrow();
    expect(() => validateShadowingClip({ ...clip, language: 'other' }, 0, 65000)).toThrow();
    expect(validateShadowingClip({ language: 'none', cues: [] }, 0, 65000)).toEqual([]);
  });
  it('converts explicit minute/second timestamps and never repairs ambiguous or invalid times', () => {
    const timed = { language: 'ja', cues: [{ text: cue.text, translationVi: cue.translationVi, startTime: '01:12.101', endTime: '01:16.491' }] };
    expect(decodeShadowingClip(timed, 60000, 90000)).toEqual([{ ...cue, startMs: 72101, endMs: 76491 }]);
    for (const startTime of ['07:98.483', '1:12.101', '01:12', '01:12.1', '112101', 112101, '30:00.000']) {
      expect(() => decodeShadowingClip({ ...timed, cues: [{ ...timed.cues[0], startTime }] }, 0, 552000)).toThrow();
    }
    expect(() => decodeShadowingClip(clip, 0, 65000)).toThrow();
    expect(() => decodeShadowingClip(timed, 0, 65000)).toThrow();
    expect(() => decodeShadowingClip({ ...timed, cues: [{ ...timed.cues[0], endTime: '01:10.000' }] }, 0, 90000)).toThrow();
  });
  it('handles no speech, no key, timeout, quota and oversized responses without paid fallback/retry', async () => {
    const fetcher = vi.fn().mockResolvedValue(gemini({ language: 'none', cues: [] })); vi.stubGlobal('fetch', fetcher);
    await expect(generateShadowingTranscript(config, metadata)).rejects.toMatchObject({ code: 'SHADOWING_NO_SPEECH' });
    fetcher.mockReset();
    await expect(generateShadowingTranscript({ ...config, GEMINI_API_KEY: undefined }, metadata)).rejects.toMatchObject({ code: 'AI_NOT_CONFIGURED' });
    expect(fetcher).not.toHaveBeenCalled();
    fetcher.mockRejectedValue(new Error('timeout'));
    await expect(generateShadowingTranscript(config, metadata)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockReset().mockResolvedValue(json({}, 429));
    await expect(generateShadowingTranscript(config, metadata)).rejects.toMatchObject({ code: 'AI_QUOTA' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockReset().mockResolvedValue(new Response('x'.repeat(1000001)));
    await expect(generateShadowingTranscript(config, metadata)).rejects.toMatchObject({ code: 'AI_INVALID_RESPONSE' });
  });
});

describe('Shadowing shares Gemini quota', () => {
  function transaction(counts: { grammar?: [number, number]; sentence?: [number, number]; shadowing?: [number, number] }) {
    const count = (values: [number, number] = [0, 0]) => vi.fn().mockImplementation(async ({ where }) => where.userId ? values[0] : values[1]);
    return { grammarAiRequest: { count: count(counts.grammar) }, sentenceAnalysisRequest: { count: count(counts.sentence) }, shadowingAiRequest: { count: count(counts.shadowing) } } as unknown as Prisma.TransactionClient;
  }
  it('counts Shadowing claims against common account/global caps, including other feature calls', async () => {
    await expect(assertGeminiQuota(transaction({ grammar: [10, 50], sentence: [8, 30], shadowing: [2, 10] }), config, 'user')).rejects.toMatchObject({ code: 'AI_QUOTA' });
    await expect(assertGeminiQuota(transaction({ grammar: [0, 70], sentence: [0, 20], shadowing: [0, 10] }), config, 'user')).rejects.toMatchObject({ code: 'AI_QUOTA' });
    await expect(assertGeminiQuota(transaction({ shadowing: [2, 9] }), config, 'user')).resolves.toBeUndefined();
  });
  it('enforces 3 per account, 10 globally in rolling 24h independent of shared caps', async () => {
    await expect(assertShadowingQuota(transaction({ shadowing: [3, 3] }), config, 'user')).rejects.toMatchObject({ code: 'SHADOWING_AI_QUOTA' });
    await expect(assertShadowingQuota(transaction({ shadowing: [0, 10] }), config, 'user')).rejects.toMatchObject({ code: 'SHADOWING_AI_QUOTA' });
    const tx = transaction({ shadowing: [2, 9] });
    const before = Date.now(); await expect(assertShadowingQuota(tx, config, 'user')).resolves.toBeUndefined();
    const since = vi.mocked(tx.shadowingAiRequest.count).mock.calls[0]?.[0]?.where?.createdAt as { gte: Date };
    expect(since.gte.getTime()).toBeGreaterThanOrEqual(before - 86400000);
    expect(since.gte.getTime()).toBeLessThanOrEqual(Date.now() - 86400000);
  });
});
