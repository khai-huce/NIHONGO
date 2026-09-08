import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

for (const relative of ['../../.env', '../.env', '../.env.test']) {
  const target = new URL(relative, import.meta.url);
  if (existsSync(target)) continue;
  const template = new URL(`${relative}.example`, import.meta.url);
  const content = readFileSync(template, 'utf8').replace('replace-with-a-random-secret-at-least-32-characters', randomBytes(32).toString('hex'));
  writeFileSync(target, content, { flag: 'wx' });
}
console.log('Environment files ready. Existing values were preserved; see README for Google setup.');
