import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const raw = process.env.TEST_DATABASE_URL;
if (!raw) throw new Error('Set TEST_DATABASE_URL in server/.env.test.');
const url = new URL(raw);
const database = url.pathname.slice(1);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^[a-z][a-z0-9_]*_test$/.test(database)) {
  throw new Error('Tests require a local PostgreSQL database whose name ends with _test.');
}
url.pathname = '/postgres';
const client = new pg.Client({ connectionString: url.toString() });
try {
  await client.connect();
  const result = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
  if (!result.rowCount) await client.query(`CREATE DATABASE "${database}"`);
} finally { await client.end(); }
const result = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/prisma/build/index.js', import.meta.url)), 'migrate', 'deploy'], {
  stdio: 'inherit', env: { ...process.env, DATABASE_URL: raw },
});
process.exitCode = result.status ?? 1;
