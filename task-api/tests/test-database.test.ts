// Module 9 output: tests for the rules that stop a test run from wiping a database that is not a test database.
// Run them: npm test. Success: dev.db and every look-alike is refused, and resetDb() throws before it deletes anything.
import { afterAll, afterEach, describe, expect, it } from '@jest/globals';
import { resolve } from 'node:path';
import { prisma } from '../src/db.ts';
import { disconnectDb, resetDb } from './helpers/db.ts';
import { makeTask } from './helpers/factories.ts';
import { perRunDatabaseUrl, testDatabasePath } from './helpers/test-database.ts';

afterAll(async () => {
  await disconnectDb();
});

describe('testDatabasePath', () => {
  it.each([
    ['file:./test.db'],
    ['file:./test-48213-1761043200000.db'],
    ['file:./test.db?connection_limit=1'],
  ])('accepts %s', (url) => {
    expect(testDatabasePath(url)).toMatch(/test[\w.-]*\.db$/);
  });

  it.each([
    ['the development database', 'file:./dev.db'],
    ['a name that only contains test', 'file:./mytest.db'],
    ['a name that does not end in .db', 'file:./test.sqlite'],
    ['a query string that looks like a path', 'file:./dev.db?x=/test.db'],
    ['a path that walks back to dev.db', 'file:./test.db/../dev.db'],
    ['a folder called test around dev.db', 'file:./test/dev.db'],
    ['a server URL', 'postgresql://localhost/test'],
    ['an empty path', 'file:'],
    ['nothing at all', undefined],
  ])('refuses %s', (_name, url) => {
    expect(() => testDatabasePath(url)).toThrow(/Refusing to touch the database/);
  });

  it('resolves the path before it reads the name', () => {
    expect(testDatabasePath('file:./test.db')).toBe(resolve('test.db'));
  });
});

describe('perRunDatabaseUrl', () => {
  it('adds the process id and the time, and keeps the folder and the extension', () => {
    expect(perRunDatabaseUrl('file:./test.db', 48213, 1761043200000)).toBe('file:./test-48213-1761043200000.db');
  });

  it('gives two runs two different files', () => {
    const one = perRunDatabaseUrl('file:./test.db', 100, 1);
    const two = perRunDatabaseUrl('file:./test.db', 101, 1);
    expect(one).not.toBe(two);
  });

  it('refuses a database that is not a test database, before it builds a name', () => {
    expect(() => perRunDatabaseUrl('file:./dev.db', 1, 1)).toThrow(/Refusing to touch the database/);
  });
});

describe('resetDb refuses a database that is not a test database', () => {
  const real = process.env.DATABASE_URL;
  afterEach(() => {
    process.env.DATABASE_URL = real;
  });

  it('throws before it deletes anything', async () => {
    const task = await makeTask({ title: 'must survive' });
    process.env.DATABASE_URL = 'file:./dev.db';

    await expect(resetDb()).rejects.toThrow(/Refusing to touch the database/);

    // The same connection as the rest of the suite: the row is still there.
    expect(await prisma.task.findUnique({ where: { id: task.id } })).not.toBeNull();
    process.env.DATABASE_URL = real;
    await resetDb();
  });
});
