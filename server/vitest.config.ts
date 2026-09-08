import { loadEnvFile } from 'node:process';
import { defineConfig } from 'vitest/config';

loadEnvFile('.env.test');
export default defineConfig({ test: { include: ['tests/**/*.test.ts'], fileParallelism: false, testTimeout: 15000, hookTimeout: 15000 } });
