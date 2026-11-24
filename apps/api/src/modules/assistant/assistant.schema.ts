import { z } from 'zod';
import { HttpError } from '../../common/errors.js';
import type { AssistantSource } from './assistant-knowledge.js';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const noControls = (text: string) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/u.test(text);
const text = (limit: number) => z.string().trim().min(1).max(limit).refine(noControls, 'Nội dung có ký tự điều khiển không được hỗ trợ.');
const inputSchema = z.object({
  id: uuid, expectedUserId: uuid, message: text(1000),
  currentRoute: z.string().max(500).optional(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: text(4000) }).strict()).max(10),
}).strict().refine(value => value.history.reduce((total, item) => total + item.content.length, 0) <= 16000,
  'Lịch sử gửi kèm tối đa 16.000 ký tự. Hãy bắt đầu một cuộc trò chuyện mới.');
export type AssistantInput = z.infer<typeof inputSchema>;
export const parseAssistantInput = (value: unknown): AssistantInput => inputSchema.parse(value);

const replySchema = z.object({ text: text(4000), sourceIds: z.array(z.string().min(1).max(150)).max(6) }).strict();
export type AssistantAiReply = z.infer<typeof replySchema>;
const { $schema: _draft, ...jsonSchema } = z.toJSONSchema(replySchema);
const localBounds = new Set(['minLength', 'maxLength', 'minItems', 'maxItems']);
export const assistantJsonSchema: object = JSON.parse(JSON.stringify(jsonSchema, (key, value) => localBounds.has(key) ? undefined : value));

export function validateAssistantReply(value: unknown, sources: AssistantSource[]): AssistantAiReply {
  const parsed = replySchema.safeParse(value);
  const invalid = () => new HttpError(502, 'AI_INVALID_RESPONSE', 'Trợ lý trả nội dung hoặc nguồn chưa hợp lệ. Hãy thử lại; chưa có dữ liệu học nào bị thay đổi.');
  if (!parsed.success) throw invalid();
  const reply = parsed.data;
  const allowed = new Set(sources.map(source => source.id));
  if (new Set(reply.sourceIds).size !== reply.sourceIds.length || reply.sourceIds.some(id => !allowed.has(id))) throw invalid();
  // Replies are plain text. Only the server may turn known source records into links.
  if (/(?:https?:\/\/|www\.|javascript:|data:)|<\/?[a-z][^>]*>|\[[^\]]*\]\([^)]*\)/iu.test(reply.text)) throw invalid();
  return reply;
}
