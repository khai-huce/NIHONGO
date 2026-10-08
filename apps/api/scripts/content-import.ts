import { readFile } from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { readConfig } from '../src/config/env.js';
import { commitContentImport, parseContentImport, previewContentImport } from '../src/modules/content/content.service.js';

const [file, flag, previewHash, ...extra] = process.argv.slice(2);
if (!file || extra.length || (flag && (flag !== '--commit' || !/^[a-f0-9]{64}$/.test(previewHash ?? ''))))
  throw new Error('Usage: tsx scripts/content-import.ts <input.json> [--commit <previewHash>]');
const config = readConfig();
const db = new PrismaClient({ datasources: { db: { url: config.DATABASE_URL } } });
try {
  const input = parseContentImport(JSON.parse(await readFile(file, 'utf8')));
  console.log(flag ? await commitContentImport(db, input, previewHash) : await previewContentImport(db, input));
} finally { await db.$disconnect(); }
