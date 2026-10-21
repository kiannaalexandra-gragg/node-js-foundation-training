// Module 9 output: integration tests for POST /api/v1/tasks.
// Run them: npm test. Success: every test passes against the real app and test.db.
import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { prisma } from '../src/db.ts';
import { DEFAULT_OWNER_EMAIL } from '../src/services/task-service.ts';
import { authed, TASKS } from './helpers/api.ts';
import { disconnectDb, resetDb } from './helpers/db.ts';
import { defaultOwner } from './helpers/factories.ts';

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await disconnectDb();
});

describe('POST /api/v1/tasks', () => {
  it('creates a task with defaults and stores it', async () => {
    const owner = await defaultOwner();

    const res = await authed().post(TASKS).send({ title: 'Write the tests' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: 'Write the tests',
      description: null,
      status: 'todo',
      priority: 2,
      dueDate: null,
      userId: owner.id,
    });
    expect(res.body.id).toEqual(expect.any(String));
    const stored = await prisma.task.findUnique({ where: { id: res.body.id } });
    expect(stored?.title).toBe('Write the tests');
  });

  it('keeps every field the client sets', async () => {
    const res = await authed()
      .post(TASKS)
      .send({
        title: 'Ship v4',
        description: 'Tests and CI',
        status: 'in_progress',
        priority: 1,
        dueDate: '2026-12-31T10:00:00Z',
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      description: 'Tests and CI',
      status: 'in_progress',
      priority: 1,
      dueDate: '2026-12-31T10:00:00.000Z',
    });
  });

  it('turns a date-only due date into midnight UTC', async () => {
    const res = await authed().post(TASKS).send({ title: 'Dated', dueDate: '2026-12-31' });

    expect(res.status).toBe(201);
    expect(res.body.dueDate).toBe('2026-12-31T00:00:00.000Z');
  });

  it('trims the title', async () => {
    const res = await authed().post(TASKS).send({ title: '  padded  ' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('padded');
  });

  it('ignores fields the server owns', async () => {
    const owner = await defaultOwner();
    const clientId = '11111111-1111-4111-8111-111111111111';

    const res = await authed()
      .post(TASKS)
      .send({ title: 'Mine', id: clientId, userId: 999, createdAt: '2000-01-01T00:00:00Z' });

    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe(clientId);
    expect(res.body.userId).toBe(owner.id);
    expect(res.body.createdAt).not.toBe('2000-01-01T00:00:00.000Z');
  });

  it('answers a generic 500 when the default owner is missing, and stores nothing', async () => {
    // Not the client's fault: the database was not migrated. resetDb puts the owner back afterwards.
    await prisma.user.delete({ where: { email: DEFAULT_OWNER_EMAIL } });
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await authed().post(TASKS).send({ title: 'No owner' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    expect(JSON.stringify(res.body)).not.toContain(DEFAULT_OWNER_EMAIL);
    expect(logged).toHaveBeenCalled();
    expect(await prisma.task.count()).toBe(0);
  });

  describe('rejects a bad body with 400 and details', () => {
    it.each([
      ['no title', {}, 'title', 'Required'],
      ['an empty title', { title: '' }, 'title', 'Must not be empty'],
      ['a blank title', { title: '   ' }, 'title', 'Must not be empty'],
      ['a title that is not a string', { title: 5 }, 'title', 'Must be a string'],
      ['an unknown status', { title: 'x', status: 'blocked' }, 'status', 'Must be one of: todo, in_progress, done'],
      ['a priority above 3', { title: 'x', priority: 4 }, 'priority', 'Must be a whole number from 1 (high) to 3 (low)'],
      ['a fractional priority', { title: 'x', priority: 1.5 }, 'priority', 'Must be a whole number from 1 (high) to 3 (low)'],
      ['an impossible date', { title: 'x', dueDate: '2026-02-30' }, 'dueDate', 'Must be an ISO 8601 date such as 2026-12-31, or null'],
      ['hour 24', { title: 'x', dueDate: '2026-12-31T24:00:00Z' }, 'dueDate', 'Must be an ISO 8601 date such as 2026-12-31, or null'],
    ])('%s', async (_name, body, path, message) => {
      const res = await authed().post(TASKS).send(body);

      expect(res.status).toBe(400);
      expect(res.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(res.body.error.details).toContainEqual({ path, message });
      expect(await prisma.task.count()).toBe(0);
    });

    it('reports every bad field, not just the first', async () => {
      const res = await authed().post(TASKS).send({ title: '', status: 'nope', priority: 9 });

      expect(res.status).toBe(400);
      const paths = res.body.error.details.map((d: { path: string }) => d.path);
      expect(paths.sort()).toEqual(['priority', 'status', 'title']);
    });

    it('a body that is not a JSON object', async () => {
      const res = await authed().post(TASKS).send([1, 2]);

      expect(res.status).toBe(400);
      expect(res.body.error.details).toContainEqual({ path: 'body', message: 'Must be a JSON object' });
    });
  });
});
