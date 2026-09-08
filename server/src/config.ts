import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z.string().url().refine(value => new URL(value).origin === value, 'Use an origin without a trailing slash or path'),
  DATABASE_URL: z.string().url().refine(value => /^postgres(ql)?:/.test(value), 'PostgreSQL URL required'),
  SESSION_SECRET: z.string().min(32).refine(value => !value.startsWith('replace-'), 'Generate a random SESSION_SECRET'),
  GOOGLE_CLIENT_ID: z.string().trim().default('').refine(value => value === '' || value.endsWith('.apps.googleusercontent.com'), 'Invalid Google Web client ID'),
});

export type Config = z.infer<typeof schema>;

export function readConfig(): Config {
  const envPath = new URL('../.env', import.meta.url);
  if (existsSync(envPath)) loadEnvFile(envPath);
  const result = schema.safeParse(process.env);
  if (!result.success) {
    // Report field names only: configuration errors must not print credentials.
    throw new Error(`Invalid environment: ${result.error.issues.map(issue => issue.path.join('.')).join(', ')}. See server/.env.example.`);
  }
  return result.data;
}
