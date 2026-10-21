// Module 7 output: the one PrismaClient for the whole app, built with the better-sqlite3 driver adapter.
// Nothing to run here. Imported by the task service, prisma/seed.ts and scripts/check-prisma-errors.ts. Success: `npm run typecheck` exits 0.
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from './generated/prisma/client.ts';

// Prisma 7 has no built-in database driver: PrismaClient must be given an adapter. The adapter opens
// the SQLite file itself, so it needs the URL here as well as in prisma7.config.ts (the config is
// only read by the CLI, never by the running app).
//
// One client for the whole process. Every PrismaClient owns a connection, so a new one per request
// would open a new connection each time. A module is evaluated once, so exporting the instance from
// here makes it a singleton without any extra code.
const url = process.env.DATABASE_URL;
if (url === undefined || url.trim() === '') {
  throw new Error('DATABASE_URL is required, for example file:./dev.db');
}

export const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url }),
  // Set LOG_QUERIES=true to print the SQL behind every call: it is how you see what Prisma really
  // runs. Off by default, because a seed of 24 tasks would print a line for every statement.
  // 'error' is left out on purpose: Prisma would print a code frame for every P2025, P2002 and P2003,
  // and those are normal 404s and 409s. A real failure reaches the error handler, which logs it.
  log: process.env.LOG_QUERIES === 'true' ? ['query', 'warn'] : ['warn'],
});
