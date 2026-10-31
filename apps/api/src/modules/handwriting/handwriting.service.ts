import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as ort from 'onnxruntime-node';
import { HttpError } from '../../common/errors.js';
import { rasterize, type Strokes } from './handwriting.input.js';
const base = new URL('../../../content/handwriting/', import.meta.url);
let model: Promise<{ session: ort.InferenceSession; labels: string[] }> | undefined;
let active = 0;
async function load() {
  const [bytes, text] = await Promise.all([readFile(new URL('char_classifier.onnx',base)), readFile(new URL('char_classifier_labels.txt',base))]);
  if (createHash('sha256').update(bytes).digest('hex') !== '2c8d334e1541720dd1f8603a9dc3ecd270842756c99fbe24ce2de3e925e1f4a7'
    || createHash('sha256').update(text).digest('hex') !== 'a3b26bee5c6b37f3e76f802c8012c6b00c0dfbcda90de1a208d62386b2c6b3ba') throw new Error('Model checksum mismatch');
  const labels = Array.from(text.toString('utf8').trim());
  if(labels.length !== 6507) throw new Error('Invalid labels');
  const session = await ort.InferenceSession.create(bytes, { executionProviders: ['cpu'], intraOpNumThreads: 1, interOpNumThreads: 1 });
  return { session, labels };
}
export async function recognize(strokes: Strokes) {
  if (active >= 2) throw new HttpError(429, 'HANDWRITING_BUSY', 'Bộ nhận diện đang bận. Vui lòng thử lại.');
  active++;
  try {
    model ??= load().catch(error => { model=undefined; throw error; });
    const {session,labels} = await model;
    const result = await session.run({ image: new ort.Tensor('float32',rasterize(strokes),[1,1,64,64]) });
    const scores = result.probs.data as Float32Array;
    if(scores.length !== labels.length || !scores.every(Number.isFinite)) throw new Error('Invalid prediction');
    return labels.map((character,i) => ({character, score:scores[i]})).filter(c => c.score >= 0.001 && /^\p{Script=Han}$/u.test(c.character))
      .sort((a,b) => b.score-a.score).slice(0,8).map(c => ({character:c.character}));
  } catch(error) {
    if(error instanceof HttpError) throw error;
    throw new HttpError(503,'HANDWRITING_UNAVAILABLE','Chưa thể nhận diện chữ. Vui lòng thử lại sau.');
  } finally { active--; }
}
