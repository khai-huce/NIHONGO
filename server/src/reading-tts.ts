import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { z } from 'zod';
import { HttpError } from './errors.js';

export const READING_VOICE = 'ja-JP-NanamiNeural';
export const readingMediaSchema = z.object({
  segments: z.array(z.object({ sentenceId: z.string(), fileName: z.string().regex(/^\d+\.mp3$/),
    durationSec: z.number().positive().max(1800), offsetSec: z.number().nonnegative() }).strict()).min(1).max(300),
  totalSeconds: z.number().positive().max(3600),
}).strict();
export type ReadingMedia = z.infer<typeof readingMediaSchema>;
export type ReadingTts = (input: { directory: string; voice: string; sentences: { id: string; text: string }[] }) => Promise<ReadingMedia>;
export const defaultReadingStorage = fileURLToPath(new URL('../storage/reading', import.meta.url));

const bundledPython = fileURLToPath(new URL(process.platform === 'win32' ? '../.venv-tts/Scripts/python.exe' : '../.venv-tts/bin/python', import.meta.url));
export function edgeReadingTts(python = existsSync(bundledPython) ? bundledPython : 'python'): ReadingTts {
  return input => new Promise((accept, reject) => {
    const child = spawn(python, [fileURLToPath(new URL('../scripts/edge_synthesize.py', import.meta.url))], {
      shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    let stdout = '', stderr = '', settled = false;
    const failure = () => new HttpError(503, 'AUDIO_UNAVAILABLE', 'Chưa tạo được audio từ Microsoft Edge. Bài đọc đã được lưu; vui lòng thử lại.');
    const finish = (error?: Error, media?: ReadingMedia) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else accept(media!);
    };
    const timer = setTimeout(() => { child.kill(); finish(failure()); }, 180_000);
    child.stdout.on('data', chunk => {
      stdout += chunk.toString('utf8');
      if (Buffer.byteLength(stdout) > 100_000) { child.kill(); finish(failure()); }
    });
    child.stderr.on('data', chunk => { if (stderr.length < 200) stderr += chunk.toString('utf8'); });
    child.on('error', () => finish(failure()));
    child.stdin.on('error', () => finish(failure()));
    child.on('close', code => {
      if (code !== 0) { console.error('Edge TTS unavailable:', /^[A-Za-z]+\s*$/.test(stderr) ? stderr.trim() : 'ProviderFailure'); finish(failure()); return; }
      try { finish(undefined, readingMediaSchema.parse(JSON.parse(stdout))); } catch { finish(failure()); }
    });
    child.stdin.end(JSON.stringify({ ...input, directory: resolve(input.directory) }));
  });
}
