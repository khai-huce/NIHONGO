import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { readConfig } from '../src/config/env.js';
import { initialCatalogSchema, seedContentCatalog } from '../src/modules/content/content.service.js';

const args = process.argv.slice(2);
if (args.some(arg => arg !== '--commit')) throw new Error('Usage: tsx scripts/content-seed.ts [--commit]');
const config = readConfig();
const db = new PrismaClient({ datasources: { db: { url: config.DATABASE_URL } } });
try {
  const fixture = initialCatalogSchema.parse(JSON.parse(await readFile(new URL('../content/catalog-initial.json', import.meta.url), 'utf8')));
  if (args.includes('--commit')) console.log(await seedContentCatalog(db, fixture));
  else console.log({ mode: 'preview', kanji: fixture.kanji.length, radicals: fixture.radicals.length,
    missingKanji: fixture.kanji.length - await db.kanjiContent.count({ where: { id: { in: fixture.kanji.map(entry => entry.data.id) } } }),
    note: 'Only missing content is inserted. Existing editorial data and progress are preserved. Use --commit to apply.' });
} finally { await db.$disconnect(); }
