import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYouTubeUrl, parseSubtitleTimestamp, parseShadowingSubtitles, validateShadowingCues,
  ShadowingMediaError, SHADOWING_MAX_CUES, SHADOWING_MAX_DURATION_MS,
} from '../src/study/shadowing-media.mjs';

const videoId = 'aB_1-cD2eF3';
const validCue = { id: '1', startMs: 0, endMs: 1500, text: 'こんにちは。' };
function errorCode(callback, code, line) {
  assert.throws(callback, error => error instanceof ShadowingMediaError && error.code === code
    && (line === undefined || error.line === line));
}
const srt = (text = 'こんにちは。') => `1\n00:00:00,000 --> 00:00:01,500\n${text}`;

test('YouTube watch, short, embed and mobile links yield only canonical video links', () => {
  const links = [
    `https://youtube.com/watch?v=${videoId}`,
    ` https://www.youtube.com/watch?v=${videoId}&list=ignored#t=9 `,
    `http://m.youtube.com/watch?feature=share&v=${videoId}`,
    `https://youtu.be/${videoId}?si=ignored&t=12`,
    `https://www.youtube.com/shorts/${videoId}`,
    `https://www.youtube.com/embed/${videoId}/`,
  ];
  for (const link of links) assert.deepEqual(parseYouTubeUrl(link), { videoId, url: `https://www.youtube.com/watch?v=${videoId}` });
});

test('YouTube parser rejects arbitrary hosts, userinfo, ports and unsupported protocols', () => {
  for (const link of [
    `https://youtube.com.evil.example/watch?v=${videoId}`, `https://www.youtu.be/${videoId}`,
    `https://youtube.com@evil.example/watch?v=${videoId}`, `https://evil@youtube.com/watch?v=${videoId}`,
    `https://youtube.com:8080/watch?v=${videoId}`, `ftp://youtube.com/watch?v=${videoId}`,
    `javascript:alert(1)`, `file:///youtube.com/watch?v=${videoId}`, `//youtube.com/watch?v=${videoId}`,
    `https://127.0.0.1/watch?v=${videoId}`, `https://youtube.com\\@evil.example/watch?v=${videoId}`,
    `https://you\ntube.com/watch?v=${videoId}`, `\u0000https://youtube.com/watch?v=${videoId}`,
  ]) assert.throws(() => parseYouTubeUrl(link), ShadowingMediaError, link);
});

test('YouTube parser requires one valid video ID and supported route', () => {
  for (const link of [
    '', videoId, `https://youtube.com/watch?v=short`, `https://youtu.be/${videoId}extra`,
    `https://youtube.com/watch?v=${videoId}&v=${videoId}`, `https://youtube.com/playlist?list=x`,
    `https://youtube.com/unknown/${videoId}`, `https://youtube.com/watch?v=aB_1-cD2e!3`,
    `https://youtu.be/${videoId}/extra`, `https://youtube.com/watch?v=${'x'.repeat(2100)}`,
  ]) assert.throws(() => parseYouTubeUrl(link), ShadowingMediaError, link);
  assert.throws(() => parseYouTubeUrl(null), ShadowingMediaError);
});

test('timestamps are exact milliseconds with correct SRT and VTT separators', () => {
  assert.equal(parseSubtitleTimestamp('00:01:02,345', 'srt'), 62345);
  assert.equal(parseSubtitleTimestamp('01:02.345'), 62345);
  assert.equal(parseSubtitleTimestamp('00:01:02.345', 'vtt'), 62345);
  assert.equal(parseSubtitleTimestamp('00:30:00,000', 'srt'), SHADOWING_MAX_DURATION_MS);
  for (const value of ['0:01.000', '01:60.000', '60:00.000', '01:02.34', '01:02,345', '-01:02.345', '01:02.345x', ' 01:02.345']) {
    errorCode(() => parseSubtitleTimestamp(value, 'vtt'), 'INVALID_TIMESTAMP');
  }
  errorCode(() => parseSubtitleTimestamp('00:01.500', 'srt'), 'INVALID_TIMESTAMP');
  errorCode(() => parseSubtitleTimestamp('00:30:00.001'), 'SUBTITLE_TOO_LONG');
  errorCode(() => parseSubtitleTimestamp('99:00:00.000'), 'SUBTITLE_TOO_LONG');
  errorCode(() => parseSubtitleTimestamp('00:01.000', 'invalid'), 'UNSUPPORTED_SUBTITLE_FORMAT');
});

test('SRT preserves explicit ID, punctuation, internal spaces/newlines and normalizes NFC/line endings', () => {
  const result = parseShadowingSubtitles('\uFEFF001\r\n00:00:00,000 --> 00:00:01,500\r\n 「か\u3099」  と、\r\n日本語！ \r\n\r\n2\r\n00:00:01,500 --> 00:00:03,000\r\n次です。\r\n');
  assert.deepEqual(result, { format: 'srt', cues: [
    { id: '001', startMs: 0, endMs: 1500, text: '「が」  と、\n日本語！' },
    { id: '2', startMs: 1500, endMs: 3000, text: '次です。' },
  ], endMs: 3000 });
});

test('VTT allows optional identifiers and comments, while retaining actual gaps', () => {
  const result = parseShadowingSubtitles('WEBVTT 日本語\n\nNOTE source comment\nignored comment\n\nintro\n00:00.000 --> 00:01.000\nこんにちは。\n\n00:02.500 --> 00:03.000\nまた！');
  assert.deepEqual(result, { format: 'vtt', cues: [
    { id: 'intro', startMs: 0, endMs: 1000, text: 'こんにちは。' },
    { id: 'cue-2', startMs: 2500, endMs: 3000, text: 'また！' },
  ], endMs: 3000 });
});

test('empty files, cue payloads and mismatched formats are explicit errors', () => {
  errorCode(() => parseShadowingSubtitles(''), 'EMPTY_SUBTITLES');
  errorCode(() => parseShadowingSubtitles('WEBVTT\n\nNOTE comment'), 'EMPTY_SUBTITLES');
  errorCode(() => parseShadowingSubtitles(srt('')), 'EMPTY_CUE', 1);
  errorCode(() => parseShadowingSubtitles(srt(), 'vtt'), 'INVALID_VTT_HEADER', 1);
  errorCode(() => parseShadowingSubtitles('WEBVTT\n\n00:00.000 --> 00:01.000\nあ', 'srt'), 'SUBTITLE_FORMAT_MISMATCH', 1);
  errorCode(() => parseShadowingSubtitles(null), 'INVALID_SUBTITLES');
});

test('malformed or missing timing and missing blank separators never produce partial success', () => {
  errorCode(() => parseShadowingSubtitles('1\n00:00:00,000 -> 00:00:01,000\nあ'), 'INVALID_TIMESTAMP', 2);
  errorCode(() => parseShadowingSubtitles('1\n00:00:00,000 --> 00:00:60,000\nあ'), 'INVALID_TIMESTAMP', 2);
  errorCode(() => parseShadowingSubtitles('1'), 'INVALID_TIMESTAMP', 2);
  errorCode(() => parseShadowingSubtitles(`${srt()}\n2\n00:00:02,000 --> 00:00:03,000\nい`), 'INVALID_CUE_SEPARATOR', 1);
  errorCode(() => parseShadowingSubtitles('wrong\n00:00:00,000 --> 00:00:01,000\nあ'), 'INVALID_CUE_ID', 1);
});

test('duplicate IDs, overlaps and unsorted cues are rejected with source locations', () => {
  errorCode(() => parseShadowingSubtitles(`${srt()}\n\n1\n00:00:02,000 --> 00:00:03,000\nい`), 'DUPLICATE_CUE_ID', 5);
  errorCode(() => parseShadowingSubtitles(`${srt()}\n\n2\n00:00:01,499 --> 00:00:03,000\nい`), 'OVERLAPPING_CUES', 5);
  errorCode(() => parseShadowingSubtitles('WEBVTT\n\n00:02.000 --> 00:03.000\nあ\n\n00:00.000 --> 00:01.000\nい'), 'OVERLAPPING_CUES', 6);
  errorCode(() => parseShadowingSubtitles('WEBVTT\n\ncue-2\n00:00.000 --> 00:01.000\nあ\n\n00:02.000 --> 00:03.000\nい'), 'DUPLICATE_CUE_ID', 7);
});

test('markup, ruby, inline timestamps and VTT layout metadata fail explicitly rather than silently stripped', () => {
  for (const text of ['<b>日本</b>', '<ruby>日本<rt>にほん</rt></ruby>', '<script>alert(1)</script>', '<00:00.500>あ', '<c.color>あ</c>']) {
    errorCode(() => parseShadowingSubtitles(srt(text)), 'UNSUPPORTED_CUE_MARKUP', 1);
  }
  errorCode(() => parseShadowingSubtitles('WEBVTT\nLanguage: ja\n\n'), 'UNSUPPORTED_VTT_HEADER', 2);
  errorCode(() => parseShadowingSubtitles('WEBVTT\n\nSTYLE\n::cue {color:red}'), 'UNSUPPORTED_VTT_BLOCK', 3);
  errorCode(() => parseShadowingSubtitles('WEBVTT\n\nREGION\nid:one'), 'UNSUPPORTED_VTT_BLOCK', 3);
  errorCode(() => parseShadowingSubtitles('WEBVTT\n\n00:00.000 --> 00:01.000 align:start\nあ'), 'UNSUPPORTED_CUE_SETTINGS', 3);
  // Entities stay ordinary text; neither decoded nor sent through an HTML renderer.
  assert.equal(parseShadowingSubtitles(srt('&lt;日本&gt;')).cues[0].text, '&lt;日本&gt;');
});

test('subtitle limits bound UTF-8 bytes, Unicode cue length and cue count independently', () => {
  errorCode(() => parseShadowingSubtitles('あ'.repeat(350000)), 'SUBTITLE_FILE_TOO_LARGE');
  errorCode(() => parseShadowingSubtitles('a'.repeat(1048577)), 'SUBTITLE_FILE_TOO_LARGE');
  errorCode(() => parseShadowingSubtitles(srt('あ'.repeat(301))), 'CUE_TOO_LONG', 1);
  assert.equal(Array.from(parseShadowingSubtitles(srt('😀'.repeat(300))).cues[0].text).length, 300);
  const cues = Array.from({ length: SHADOWING_MAX_CUES }, (_, index) => ({ ...validCue, id: String(index + 1), startMs: index * 1000, endMs: (index + 1) * 1000 }));
  assert.equal(validateShadowingCues(cues).length, SHADOWING_MAX_CUES);
  errorCode(() => validateShadowingCues([...cues, { ...validCue, id: '501', startMs: 500000, endMs: 501000 }]), 'TOO_MANY_CUES');
});

test('JSON cue validation shares time/text limits, returns fresh data and preserves exact end boundary', () => {
  const input = [{ ...validCue, text: '  か\u3099\r\n日本。  ', extra: 'not returned' }];
  assert.deepEqual(validateShadowingCues(input), [{ ...validCue, text: 'が\n日本。' }]);
  assert.equal(input[0].text, '  か\u3099\r\n日本。  ');
  assert.deepEqual(validateShadowingCues([{ ...validCue, startMs: 1799999, endMs: 1800000 }])[0].endMs, 1800000);
  for (const timing of [{ startMs: -1 }, { endMs: 0 }, { startMs: 1.1 }, { endMs: Infinity }, { endMs: '1500' }]) {
    errorCode(() => validateShadowingCues([{ ...validCue, ...timing }]), 'INVALID_CUE_TIMING');
  }
  errorCode(() => validateShadowingCues([{ ...validCue, endMs: 1800001 }]), 'SUBTITLE_TOO_LONG');
  errorCode(() => validateShadowingCues([{ ...validCue, id: 'bad\nid' }]), 'INVALID_CUE_ID');
  errorCode(() => validateShadowingCues([{ ...validCue, text: 'あ\u0000い' }]), 'INVALID_CUE_TEXT');
  errorCode(() => validateShadowingCues([]), 'EMPTY_SUBTITLES');
});
