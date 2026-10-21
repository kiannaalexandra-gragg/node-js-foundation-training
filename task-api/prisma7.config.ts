// Module 7 output: the Prisma CLI configuration (Prisma 7 reads the datasource URL from here, not from schema.prisma).
// Nothing to run here. Read by `npx prisma@7 ...`. Success: `npx prisma@7 migrate status` connects to the database in DATABASE_URL.
import { existsSync } from 'node:fs';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 does not load .env by itself. Node 24 can, so no dotenv package is needed. The guard keeps
// a missing .env (CI sets real environment variables instead) from crashing the CLI.
if (existsSync('.env')) process.loadEnvFile('.env');

// The file is called prisma7.config.ts because this project uses Prisma 7.10 or later. On Prisma
// versions before 7.10 it is prisma.config.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Run by `npx prisma@7 db seed`, which the db:seed script wraps.
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
