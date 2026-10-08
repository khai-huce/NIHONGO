import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
for (const file of ['apps/web/.env', 'apps/admin/.env', 'apps/api/.env', 'apps/api/.env.test']) {
  const target = new URL(`../${file}`, import.meta.url);
  if (existsSync(target)) continue;
  const template = new URL(`../${file}.example`, import.meta.url);
  const content = readFileSync(template, 'utf8').replace('replace-with-a-random-secret-at-least-32-characters', randomBytes(32).toString('hex'));
  writeFileSync(target, content, { flag: 'wx' });
}
console.log('Environment files ready; existing values preserved. See README for setup.');
