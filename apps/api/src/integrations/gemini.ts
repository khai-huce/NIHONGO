import type { Config } from '../config/env.js';
import { HttpError } from '../common/errors.js';

async function readGeminiBody(response: Response): Promise<{ candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>; status?: string; steps?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }> }> {
  if (Number(response.headers.get('content-length')) > 1_000_000 || !response.body) throw Error('Response too large or empty');
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > 1_000_000) { await reader.cancel(); throw Error('Response too large'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export class GeminiProviderOverloaded extends HttpError {}

/** Transport only: each feature owns its prompt, schema validation and persistence. */
export async function requestGeminiJson(config: Config, input: {
  instruction: string; data: unknown; schema: object; maxOutputTokens: number; timeoutMs: number;
  useDefaultSampling?: boolean;
  video?: { url: string; startMs: number; endMs: number };
}): Promise<unknown> {
  if (!config.GEMINI_API_KEY || !config.GEMINI_MODEL) {
    throw new HttpError(503, 'AI_NOT_CONFIGURED', 'Gemini chưa được cấu hình ở máy chủ.');
  }
  let response: Response;
  try {
    response = await fetch(input.video ? 'https://generativelanguage.googleapis.com/v1beta/interactions' : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.GEMINI_MODEL)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.GEMINI_API_KEY },
      signal: AbortSignal.timeout(input.timeoutMs),
      body: JSON.stringify(input.video ? {
        model: config.GEMINI_MODEL, store: false, system_instruction: input.instruction,
        input: [{ type: 'video', uri: input.video.url, processing: { type: 'static', start_offset: `${input.video.startMs / 1000}s`, end_offset: `${input.video.endMs / 1000}s` } },
          { type: 'text', text: JSON.stringify(input.data) }],
        generation_config: { max_output_tokens: input.maxOutputTokens },
        response_format: { type: 'text', mime_type: 'application/json', schema: input.schema },
      } : {
        systemInstruction: { parts: [{ text: input.instruction }] },
        contents: [{ role: 'user', parts: [
          { text: JSON.stringify(input.data) },
        ] }],
        generationConfig: { ...(input.useDefaultSampling ? {} : { temperature: 0 }), maxOutputTokens: input.maxOutputTokens,
          responseMimeType: 'application/json', responseJsonSchema: input.schema },
      }),
    });
  } catch { throw new HttpError(503, 'AI_UNAVAILABLE', 'Gemini chưa phản hồi. Vui lòng thử lại sau.'); }
  if (!response.ok) {
    // Do not expose the provider body/key or mistake provider auth for the learner's session.
    await response.body?.cancel().catch(() => undefined);
    if (response.status === 401 || response.status === 403) {
      throw new HttpError(503, 'AI_ACCESS_DENIED', 'Gemini từ chối quyền truy cập. Quản trị viên cần kiểm tra API key và quyền của dự án.');
    }
    if (response.status === 402) {
      throw new HttpError(503, 'AI_BILLING_REQUIRED', 'Gemini yêu cầu điều kiện thanh toán. Ứng dụng chỉ dùng mức miễn phí; quản trị viên cần kiểm tra model và dự án.');
    }
    if (response.status === 404) {
      throw new HttpError(503, 'AI_MODEL_UNAVAILABLE', 'Không tìm thấy model hoặc tài nguyên Gemini đã cấu hình. Quản trị viên cần kiểm tra cấu hình máy chủ.');
    }
    if ([400, 416, 422].includes(response.status)) {
      throw new HttpError(502, 'AI_REQUEST_REJECTED', 'Gemini từ chối yêu cầu gửi từ máy chủ. Quản trị viên cần kiểm tra tham số và điều kiện sử dụng model.');
    }
    if (response.status === 503) {
      throw new GeminiProviderOverloaded(503, 'AI_UNAVAILABLE', 'Gemini đang quá tải hoặc tạm ngừng phục vụ (503). Vui lòng thử lại sau.');
    }
    throw new HttpError(response.status === 429 ? 429 : 503,
      response.status === 429 ? 'AI_QUOTA' : 'AI_UNAVAILABLE',
      response.status === 429 ? 'Gemini đang giới hạn lượt hoặc đã hết hạn mức. Vui lòng thử lại sau.'
        : response.status >= 500 ? 'Dịch vụ Gemini tạm thời chưa sẵn sàng. Vui lòng thử lại sau.'
        : 'Chưa gọi được Gemini. Hãy kiểm tra cấu hình model/key ở máy chủ.');
  }
  try {
    const body = await readGeminiBody(response);
    if (input.video) {
      if (body.status !== 'completed') throw Error('Incomplete video response');
      const text = body.steps?.filter(step => step.type === 'model_output').flatMap(step => step.content ?? [])
        .filter(part => part.type === 'text' && typeof part.text === 'string').map(part => part.text).join('');
      if (!text || text.length > 350000) throw Error('Invalid video response');
      return JSON.parse(text);
    }
    const candidate = body.candidates?.[0];
    if (candidate?.finishReason !== 'STOP') throw Error('Incomplete response');
    const text = candidate.content?.parts?.filter((part): part is { text: string; thought?: boolean } => !part.thought && typeof part.text === 'string')
      .map(part => part.text).join('');
    if (typeof text !== 'string' || !text || text.length > 100000) throw Error('Invalid response');
    return JSON.parse(text);
  } catch { throw new HttpError(502, 'AI_INVALID_RESPONSE', 'Gemini trả kết quả chưa đầy đủ hoặc không hợp lệ. Vui lòng thử lại.'); }
}
