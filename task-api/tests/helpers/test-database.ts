// Module 9 output: the rules for which database a test run may use, shared by the setup and by resetDb.
// Nothing to run here. Imported by tests/global-setup.ts, tests/global-teardown.ts and tests/helpers/db.ts. Success: only a file whose name starts with `test` and ends in `.db` is accepted.
import { basename, resolve } from 'node:path';

// A test run deletes every row, so the database must be checked by what it really is, not by a
// string that happens to contain "test". The check is on the resolved file path:
//   * the URL must be a `file:` URL, so anything else (a server URL, nothing at all) is refused;
//   * a query string is cut off first, because `file:./dev.db?x=/test.db` would otherwise look like
//     a file called test.db;
//   * the path is resolved before its name is read, so `file:./test.db/../dev.db` is dev.db;
//   * the file name must be `test`, then anything, then `.db`.
// Anything unexpected throws. Failing closed is the point: when in doubt, do not wipe the database.
export function testDatabasePath(url: string | undefined): string {
  if (url === undefined || !url.startsWith('file:')) {
    throw new Error(`Refusing to touch the database: DATABASE_URL must be a file: URL such as file:./test.db, got "${String(url)}"`);
  }
  const path = resolve(url.slice('file:'.length).split('?')[0] ?? '');
  if (!/^test[\w.-]*\.db$/.test(basename(path))) {
    throw new Error(`Refusing to touch the database: ${path} is not a test database (its name must start with "test" and end in ".db")`);
  }
  return path;
}

// The database one test run uses: the configured name with the process id and the time added, so
// test.db becomes test-48213-1761043200000.db. Two runs at the same time get two files and cannot
// wipe each other's rows. Same folder, same extension, still starts with "test".
export function perRunDatabaseUrl(configuredUrl: string | undefined, pid: number, now: number): string {
  testDatabasePath(configuredUrl);
  const [path = '', query] = (configuredUrl as string).split('?');
  const withRun = path.replace(/\.db$/, `-${pid}-${now}.db`);
  return query === undefined ? withRun : `${withRun}?${query}`;
}
