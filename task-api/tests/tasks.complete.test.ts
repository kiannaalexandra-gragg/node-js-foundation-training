// Module 9 output: integration tests for PATCH /api/v1/tasks/:id/complete, written before the route existed.
// Run them: npm test. Success: every test passes against the real app and test.db.
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { prisma } from '../src/db.ts';
import { anonymous, authed, TASKS } from './helpers/api.ts';
import { disconnectDb, resetDb } from './helpers/db.ts';
import { makeTask } from './helpers/factories.ts';

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await disconnectDb();
});

describe('PATCH /api/v1/tasks/:id/complete', () => {
  it('marks a todo task as done', async () => {
    const task = await makeTask({ status: 'todo' });

    const res = await authed().patch(`${TASKS}/${task.id}/complete`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: task.id, status: 'done' });
    const stored = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(stored.status).toBe('done');
  });

  it('marks an in-progress task as done and changes nothing else', async () => {
    const task = await makeTask({ status: 'in_progress', title: 'Keep me', priority: 1 });

    const res = await authed().patch(`${TASKS}/${task.id}/complete`);

    expect(res.body).toMatchObject({ status: 'done', title: 'Keep me', priority: 1 });
  });

  it('answers 200 again for a task that is already done', async () => {
    const task = await makeTask({ status: 'done' });

    const res = await authed().patch(`${TASKS}/${task.id}/complete`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
  });

  it('only completes the task named in the URL', async () => {
    const [target, other] = [await makeTask(), await makeTask()];

    await authed().patch(`${TASKS}/${target.id}/complete`);

    const done = await prisma.task.findUniqueOrThrow({ where: { id: target.id } });
    const untouched = await prisma.task.findUniqueOrThrow({ where: { id: other.id } });
    expect(done.status).toBe('done');
    expect(untouched.status).toBe('todo');
  });

  it('answers 404 for a task that does not exist', async () => {
    const res = await authed().patch(`${TASKS}/00000000-0000-4000-8000-000000000000/complete`);

    // The message tells "no such task" (Prisma's P2025) from "no such route" (the 404 handler).
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Resource not found' });
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const res = await authed().patch(`${TASKS}/not-a-uuid/complete`);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual({ path: 'id', message: 'Must be a valid UUID' });
  });

  it('answers 401 without an API key and leaves the task alone', async () => {
    const task = await makeTask();

    const res = await anonymous().patch(`${TASKS}/${task.id}/complete`);

    expect(res.status).toBe(401);
    const stored = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(stored.status).toBe('todo');
  });
});
