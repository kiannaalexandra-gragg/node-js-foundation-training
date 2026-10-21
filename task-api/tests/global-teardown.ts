// Module 9 output: deletes this test run's database when the run ends.
// Nothing to run here. Listed in jest.config.js as globalTeardown. Success: the test-<pid>-<time>.db file and its journal files are gone.
import { rmSync } from 'node:fs';
import { testDatabasePath } from './helpers/test-database.ts';

// Runs once, in the same process as globalSetup, after the last test file, and also when tests fail.
// It cannot run if the process is killed, so a crashed run can leave a file behind: it is
// git-ignored, and safe to delete by hand.
export default function globalTeardown(): void {
  // The same check as before any wipe: only a test database is ever deleted.
  const path = testDatabasePath(process.env.DATABASE_URL);
  for (const suffix of ['', '-journal', '-wal', '-shm']) rmSync(`${path}${suffix}`, { force: true });
}
