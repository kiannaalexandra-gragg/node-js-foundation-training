// Module 9 output: integration tests for DELETE /api/v1/tasks/:id.
// Run them: npm test. Success: every test passes against the real app and test.db.
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { prisma } from '../src/db.ts';
import { authed, TASKS } from './helpers/api.ts';
import { disconnectDb, resetDb } from './helpers/db.ts';
import { makeTask } from './helpers/factories.ts';

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await disconnectDb();
});

describe('DELETE /api/v1/tasks/:id', () => {
  it('answers 204 with no body and removes the task', async () => {
    const task = await makeTask();

    const res = await authed().delete(`${TASKS}/${task.id}`);

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
    expect(await prisma.task.findUnique({ where: { id: task.id } })).toBeNull();
  });

  it('leaves the other tasks alone', async () => {
    const [keep, drop] = [await makeTask(), await makeTask()];

    await authed().delete(`${TASKS}/${drop.id}`);

    expect(await prisma.task.count()).toBe(1);
    expect((await authed().get(`${TASKS}/${keep.id}`)).status).toBe(200);
  });

  it('answers 404 for a task that is already gone', async () => {
    const task = await makeTask();
    await authed().delete(`${TASKS}/${task.id}`);

    const again = await authed().delete(`${TASKS}/${task.id}`);

    expect(again.status).toBe(404);
    expect(again.body.error.code).toBe('NOT_FOUND');
    expect((await authed().get(`${TASKS}/${task.id}`)).status).toBe(404);
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const res = await authed().delete(`${TASKS}/42`);

    expect(res.status).toBe(400);
  });
});
