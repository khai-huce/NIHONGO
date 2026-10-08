import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { readConfig } from '../src/config/env.js';
import { commitPitchImport, preparePitchImport, sha256 } from '../src/modules/pitch-accent/pitch-import.js';

const [flag, hash, ...extra] = process.argv.slice(2);
if (extra.length || (flag && (flag !== '--commit' || !/^[a-f0-9]{64}$/.test(hash ?? '')))) {
  throw new Error('Usage: npm run pitch:import --workspace @nihongo/api [-- --commit <previewHash>]');
}
const manifest = JSON.parse(await readFile(new URL('../content/pitch-accent/kanjium-manifest.json', import.meta.url), 'utf8')) as {
  revision: string; sourceId: string; files: { name: string; path: string; sha256: string }[];
};
const cache = new URL(`../storage/pitch-accent/${manifest.revision}/`, import.meta.url);
await mkdir(cache, { recursive: true });
const texts: string[] = [];
for (const file of manifest.files) {
  const cachedFile = new URL(file.name, cache);
  let data = await readFile(cachedFile).catch(() => null);
  if (!data) {
    const response = await fetch(`https://raw.githubusercontent.com/mifunetoshiro/kanjium/${manifest.revision}/${file.path}`, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`Could not download ${file.name}: HTTP ${response.status}`);
    data = Buffer.from(await response.arrayBuffer());
    if (data.length > 15000000 || sha256(data) !== file.sha256) throw new Error(`Source checksum mismatch: ${file.name}`);
    await writeFile(cachedFile, data);
  }
  if (sha256(data) !== file.sha256) throw new Error(`Cached source checksum mismatch: ${file.name}`);
  texts.push(data.toString('utf8'));
}
const source = {
  id: manifest.sourceId, name: 'Kanjium',
  url: `https://github.com/mifunetoshiro/kanjium/tree/${manifest.revision}`,
  license: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  version: manifest.revision, checksum: sha256(JSON.stringify(manifest.files)),
  attribution: 'Pitch accent notation provided by Uros O. through Kanjium. Changes by NIHONGO: kana search normalization, extraction of structured contours, validation and deduplication; adapted pitch data licensed CC BY-SA 4.0.',
  notes: 'Source: accents.txt and conjugations.txt at the pinned revision. No inferred accents, translations or audio. Original notation and source line retained. See apps/api/content/pitch-accent for checksums, license and import rules.',
};
const formUrl = `https://github.com/mifunetoshiro/kanjium/blob/${manifest.revision}/data/source_files/conjugations.txt`;
const prepared = preparePitchImport(source, texts[0], texts[1], formUrl);
await writeFile(new URL('import-report.json', cache), JSON.stringify({ ...prepared.summary, previewHash: prepared.previewHash }, null, 2) + '\n');
console.log(JSON.stringify({ ...prepared.summary, previewHash: prepared.previewHash }, null, 2));
if (flag) {
  const config = readConfig();
  const db = new PrismaClient({ datasources: { db: { url: config.DATABASE_URL } } });
  try { console.log(JSON.stringify(await commitPitchImport(db, prepared, hash))); }
  finally { await db.$disconnect(); }
}
