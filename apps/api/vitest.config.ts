import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

loadEnvFile(new URL('./.env.test', import.meta.url));
export default defineConfig({ root: fileURLToPath(new URL('.', import.meta.url)), test: { include: ['tests/**/*.test.ts'], fileParallelism: false, testTimeout: 15000, hookTimeout: 15000 } });
