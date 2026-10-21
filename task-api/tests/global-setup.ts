// Module 9 output: gives this test run its own database and migrates it, once, before any test file runs.
// Nothing to run here. Listed in jest.config.js as globalSetup. Success: a test-<pid>-<time>.db file exists with every migration applied.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { perRunDatabaseUrl } from './helpers/test-database.ts';

// Runs once, in the Jest parent process, so it loads the test settings itself.
export default function globalSetup(): void {
  if (existsSync('.env.test')) process.loadEnvFile('.env.test');

  // The configured name is checked first (a DATABASE_URL copied from .env is refused here), then this
  // run gets its own file. Setting the variable now means every test file, which Jest starts after
  // this, reads the per-run URL when db.ts is imported. teardown reads it back to delete the file.
  process.env.DATABASE_URL = perRunDatabaseUrl(process.env.DATABASE_URL, process.pid, Date.now());

  // `migrate deploy` applies the committed migrations and creates none. It creates the file, with the
  // same tables and the same default owner as dev.db. The child inherits DATABASE_URL, and
  // prisma7.config.ts does not replace a variable that is already set.
  execFileSync('npx', ['prisma@7', 'migrate', 'deploy'], { env: process.env, stdio: 'pipe' });
}
