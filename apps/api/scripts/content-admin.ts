import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { readConfig } from '../src/config/env.js';

const args = process.argv.slice(2);
if (args.length !== 2 || !['grant', 'revoke'].includes(args[0])) throw new Error('Usage: tsx scripts/content-admin.ts grant|revoke <explicit-user-uuid>');
const id = z.string().uuid().parse(args[1]);
const config = readConfig();
const db = new PrismaClient({ datasources: { db: { url: config.DATABASE_URL } } });
try {
  const user = await db.user.findUnique({ where: { id }, select: { id: true } });
  if (!user) throw new Error('User ID does not exist. No role was changed.');
  const role = args[0] === 'grant' ? 'admin' : 'user';
  await db.user.update({ where: { id }, data: { role } });
  console.log({ id, role });
} finally { await db.$disconnect(); }
