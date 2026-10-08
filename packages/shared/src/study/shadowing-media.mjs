export const SHADOWING_MAX_DURATION_MS = 30 * 60 * 1000;
export const SHADOWING_MAX_CUES = 500;
const MAX_SUBTITLE_BYTES = 1024 * 1024;
const MAX_CUE_TEXT_LENGTH = 300;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u;

export class ShadowingMediaError extends Error {
  constructor(code, message, line) {
    super(message);
    this.name = 'ShadowingMediaError';
    this.code = code;
    if (line !== undefined) this.line = line;
  }
}

function fail(code, message, line) { throw new ShadowingMediaError(code, message, line); }

/** Parse only supported YouTube links; the canonical result is never an arbitrary fetch URL. */
export function parseYouTubeUrl(input) {
  if (typeof input !== 'string' || input.length > 2048) fail('INVALID_YOUTUBE_URL', 'Link YouTube không hợp lệ.');
  const value = input.trim();
  if (!value || /[\s\\]/u.test(value) || CONTROL.test(value)) fail('INVALID_YOUTUBE_URL', 'Link YouTube không được chứa khoảng trắng, ký tự điều khiển hoặc dấu gạch chéo ngược.');
  let url;
  try { url = new URL(value); } catch { fail('INVALID_YOUTUBE_URL', 'Vui lòng nhập link YouTube đầy đủ.'); }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) {
    fail('INVALID_YOUTUBE_URL', 'Link phải dùng HTTP/HTTPS, không chứa tài khoản hoặc cổng riêng.');
  }
  if (!['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname)) {
    fail('INVALID_YOUTUBE_HOST', 'Chỉ hỗ trợ link youtube.com hoặc youtu.be.');
  }
  let videoId;
  if (url.hostname === 'youtu.be') {
    videoId = /^\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
  } else if (url.pathname === '/watch') {
    const ids = url.searchParams.getAll('v');
    if (ids.length === 1) videoId = ids[0];
  } else {
    videoId = /^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})\/?$/.exec(url.pathname)?.[1];
  }
  if (!videoId || !VIDEO_ID.test(videoId)) fail('INVALID_YOUTUBE_VIDEO', 'Link phải trỏ đến một video YouTube có ID hợp lệ.');
  return { videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
}

/** Format-specific, millisecond-precise parsing; never repair malformed timings. */
export function parseSubtitleTimestamp(input, format = 'vtt') {
  if (!['srt', 'vtt'].includes(format)) fail('UNSUPPORTED_SUBTITLE_FORMAT', 'Chỉ hỗ trợ phụ đề SRT hoặc WebVTT.');
  if (typeof input !== 'string') fail('INVALID_TIMESTAMP', 'Mốc thời gian phụ đề không hợp lệ.');
  const match = format === 'srt'
    ? /^(\d{2,}):(\d{2}):(\d{2}),(\d{3})$/.exec(input)
    : /^(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})$/.exec(input);
  if (!match) fail('INVALID_TIMESTAMP', 'Mốc thời gian phải đúng định dạng giờ:phút:giây,mili giây (SRT) hoặc phút:giây.mili giây (WebVTT).');
  const hours = Number(match[1] ?? 0), minutes = Number(match[2]), seconds = Number(match[3]), millis = Number(match[4]);
  if (!Number.isSafeInteger(hours) || minutes >= 60 || seconds >= 60) fail('INVALID_TIMESTAMP', 'Phút và giây phải nằm trong khoảng 00–59.');
  const result = ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
  if (!Number.isSafeInteger(result) || result > SHADOWING_MAX_DURATION_MS) fail('SUBTITLE_TOO_LONG', 'Phụ đề chỉ hỗ trợ mốc thời gian tối đa 30 phút.');
  return result;
}

function validateCueText(input, line) {
  if (typeof input !== 'string') fail('INVALID_CUE_TEXT', 'Nội dung câu phải là văn bản.', line);
  const text = input.replace(/\r\n?/g, '\n').normalize('NFC').trim();
  if (!text) fail('EMPTY_CUE', 'Câu phụ đề không được để trống.', line);
  if (Array.from(text).length > MAX_CUE_TEXT_LENGTH) fail('CUE_TOO_LONG', 'Mỗi câu phụ đề tối đa 300 ký tự.', line);
  if (CONTROL.test(text)) fail('INVALID_CUE_TEXT', 'Nội dung phụ đề chứa ký tự điều khiển không hợp lệ.', line);
  if (/[<>]/u.test(text)) fail('UNSUPPORTED_CUE_MARKUP', 'Chỉ hỗ trợ phụ đề văn bản thuần; hãy bỏ thẻ HTML, ruby và mốc thời gian nằm trong câu.', line);
  return text;
}

function validateCues(cues, lines = []) {
  if (!Array.isArray(cues) || cues.length === 0) fail('EMPTY_SUBTITLES', 'Phụ đề phải có ít nhất một câu.');
  if (cues.length > SHADOWING_MAX_CUES) fail('TOO_MANY_CUES', 'Phụ đề tối đa 500 câu.');
  const ids = new Set();
  let previousEnd = 0;
  return cues.map((cue, index) => {
    const line = lines[index];
    if (!cue || typeof cue !== 'object' || Array.isArray(cue)) fail('INVALID_CUE', 'Câu phụ đề không hợp lệ.', line);
    if (typeof cue.id !== 'string') fail('INVALID_CUE_ID', 'ID câu phụ đề phải là văn bản.', line);
    const id = cue.id.normalize('NFC').trim();
    if (!id || id.length > 128 || /[<>\r\n\t]/u.test(id) || CONTROL.test(id)) fail('INVALID_CUE_ID', 'ID câu phụ đề không hợp lệ.', line);
    if (ids.has(id)) fail('DUPLICATE_CUE_ID', `ID câu phụ đề bị trùng: ${id}.`, line);
    ids.add(id);
    if (!Number.isSafeInteger(cue.startMs) || !Number.isSafeInteger(cue.endMs) || cue.startMs < 0 || cue.startMs >= cue.endMs) {
      fail('INVALID_CUE_TIMING', 'Mỗi câu phải có mốc bắt đầu nhỏ hơn mốc kết thúc, tính bằng mili giây nguyên.', line);
    }
    if (cue.endMs > SHADOWING_MAX_DURATION_MS) fail('SUBTITLE_TOO_LONG', 'Phụ đề chỉ hỗ trợ mốc thời gian tối đa 30 phút.', line);
    if (index && cue.startMs < previousEnd) fail('OVERLAPPING_CUES', 'Các câu phải đúng thứ tự thời gian và không chồng lấn.', line);
    previousEnd = cue.endMs;
    return { id, startMs: cue.startMs, endMs: cue.endMs, text: validateCueText(cue.text, line) };
  });
}

/** Validate a JSON cue list with the same invariants as subtitle imports; returns fresh normalized objects. */
export function validateShadowingCues(cues) { return validateCues(cues); }

function parseCueTiming(line, format, lineNumber) {
  const match = /^(\S+)\s+-->\s+(\S+)(?:\s+(.+))?$/.exec(line.trim());
  if (!match) fail('INVALID_TIMESTAMP', 'Dòng thời gian phải có dạng bắt đầu --> kết thúc.', lineNumber);
  // Cue layout settings are deliberately unsupported rather than silently changing their meaning.
  if (match[3]) fail('UNSUPPORTED_CUE_SETTINGS', 'Hãy bỏ thiết lập vị trí/kiểu hiển thị khỏi dòng thời gian; hiện chỉ nhập phụ đề văn bản thuần.', lineNumber);
  try { return { startMs: parseSubtitleTimestamp(match[1], format), endMs: parseSubtitleTimestamp(match[2], format) }; }
  catch (error) { if (error instanceof ShadowingMediaError) error.line = lineNumber; throw error; }
}

/** Plain SRT/WebVTT only. Does not fetch media, infer Japanese, translate, tokenize, or synthesize timings. */
export function parseShadowingSubtitles(input, format = 'auto') {
  if (!['auto', 'srt', 'vtt'].includes(format)) fail('UNSUPPORTED_SUBTITLE_FORMAT', 'Chỉ hỗ trợ phụ đề SRT hoặc WebVTT.');
  if (typeof input !== 'string') fail('INVALID_SUBTITLES', 'Phụ đề phải là văn bản.');
  if (input.length > MAX_SUBTITLE_BYTES || new TextEncoder().encode(input).length > MAX_SUBTITLE_BYTES) {
    fail('SUBTITLE_FILE_TOO_LARGE', 'Tệp phụ đề quá lớn (tối đa 1 MiB UTF-8).');
  }
  const normalized = input.replace(/^\uFEFF/u, '').replace(/\r\n?/g, '\n').normalize('NFC');
  const lines = normalized.split('\n');
  let cursor = 0;
  while (cursor < lines.length && !lines[cursor].trim()) cursor++;
  const hasVttHeader = /^WEBVTT(?:[ \t].*)?$/.test(lines[cursor] ?? '');
  const actualFormat = format === 'auto' ? hasVttHeader ? 'vtt' : 'srt' : format;
  if (actualFormat === 'vtt') {
    if (!hasVttHeader) fail('INVALID_VTT_HEADER', 'WebVTT phải bắt đầu bằng dòng WEBVTT.', cursor + 1);
    cursor++;
    if (cursor < lines.length && lines[cursor].trim()) fail('UNSUPPORTED_VTT_HEADER', 'Cần một dòng trống sau WEBVTT; metadata mở rộng chưa được hỗ trợ.', cursor + 1);
  } else if (hasVttHeader) fail('SUBTITLE_FORMAT_MISMATCH', 'Tệp là WebVTT, không phải SRT.', cursor + 1);
  const cues = [], cueLines = [];
  while (cursor < lines.length) {
    while (cursor < lines.length && !lines[cursor].trim()) cursor++;
    if (cursor >= lines.length) break;
    const startLine = cursor + 1, block = [];
    while (cursor < lines.length && lines[cursor].trim()) block.push(lines[cursor++]);
    if (actualFormat === 'vtt' && /^NOTE(?:[ \t].*)?$/.test(block[0])) continue;
    if (actualFormat === 'vtt' && /^(?:STYLE|REGION)(?:[ \t].*)?$/.test(block[0])) {
      fail('UNSUPPORTED_VTT_BLOCK', 'WebVTT STYLE/REGION chưa được hỗ trợ; hãy nhập văn bản thuần.', startLine);
    }
    let id, timingIndex;
    if (actualFormat === 'srt') {
      if (!/^\d+$/.test(block[0].trim()) || !Number.isSafeInteger(Number(block[0].trim())) || Number(block[0].trim()) <= 0) {
        fail('INVALID_CUE_ID', 'Mỗi câu SRT phải bắt đầu bằng một số thứ tự nguyên dương.', startLine);
      }
      id = block[0].trim(); timingIndex = 1;
    } else if (block[0].includes('-->')) { id = `cue-${cues.length + 1}`; timingIndex = 0; }
    else { id = block[0].trim(); timingIndex = 1; }
    if (!block[timingIndex]) fail('INVALID_TIMESTAMP', 'Câu phụ đề thiếu dòng thời gian.', startLine + timingIndex);
    const timing = parseCueTiming(block[timingIndex], actualFormat, startLine + timingIndex);
    const body = block.slice(timingIndex + 1);
    if (body.some(line => line.includes('-->'))) fail('INVALID_CUE_SEPARATOR', 'Các câu phụ đề phải được ngăn cách bằng một dòng trống.', startLine);
    cues.push({ id, ...timing, text: body.join('\n') }); cueLines.push(startLine);
    if (cues.length > SHADOWING_MAX_CUES) fail('TOO_MANY_CUES', 'Phụ đề tối đa 500 câu.', startLine);
  }
  const validated = validateCues(cues, cueLines);
  return { format: actualFormat, cues: validated, endMs: validated.at(-1).endMs };
}
