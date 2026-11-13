import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.string().url().refine(value => new URL(value).origin === value, 'Use an origin without a trailing slash or path'),
  ADMIN_ORIGIN: z.string().url().refine(value => new URL(value).origin === value, 'Use an origin without a trailing slash or path').optional(),
  DATABASE_URL: z.string().url().refine(value => /^postgres(ql)?:/.test(value), 'PostgreSQL URL required'),
  SESSION_SECRET: z.string().min(32).refine(value => !value.startsWith('replace-'), 'Generate a random SESSION_SECRET'),
  GOOGLE_CLIENT_ID: z.string().trim().default('').refine(value => value === '' || value.endsWith('.apps.googleusercontent.com'), 'Invalid Google Web client ID'),
  TTS_PYTHON: z.string().min(1).optional(),
  TTS_STORAGE_DIR: z.string().min(1).optional(),
  GEMINI_API_KEY: z.string().trim().optional(),
  YOUTUBE_API_KEY: z.string().trim().optional(),
  GEMINI_MODEL: z.string().regex(/^gemini-[a-z0-9.-]+$/).optional(),
  READING_QUIZ_GEMINI_MODEL: z.string().regex(/^gemini-[a-z0-9.-]+$/).optional(),
  SHADOWING_GEMINI_MODEL: z.string().regex(/^gemini-[a-z0-9.-]+$/).optional(),
  GEMINI_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).optional(),
  GEMINI_GLOBAL_DAILY_LIMIT: z.coerce.number().int().min(1).max(10000).optional(),
});

export type Config = z.infer<typeof schema>;

export function readConfig(): Config {
  const envPath = new URL('../../.env', import.meta.url);
  if (existsSync(envPath)) loadEnvFile(envPath);
  const result = schema.safeParse(process.env);
  if (!result.success) {
    // Report field names only: configuration errors must not print credentials.
    throw new Error(`Invalid environment: ${result.error.issues.map(issue => issue.path.join('.')).join(', ')}. See apps/api/.env.example.`);
  }
  return result.data;
}
