// Module 9 output: integration tests for PATCH /api/v1/tasks/:id.
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

describe('PATCH /api/v1/tasks/:id', () => {
  it('changes only the fields sent', async () => {
    const task = await makeTask({ title: 'Before', priority: 1, description: 'keep me' });

    const res = await authed().patch(`${TASKS}/${task.id}`).send({ title: 'After' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: task.id, title: 'After', priority: 1, description: 'keep me' });
    const stored = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(stored.title).toBe('After');
  });

  it('moves updatedAt forward and leaves createdAt alone', async () => {
    // Both timestamps are seeded in the past, so "moved forward" means something: if the update did not
    // touch updatedAt, it would still read 2026-01-01 and the assertion below would fail.
    const past = new Date('2026-01-01T00:00:00Z');
    const task = await makeTask({ createdAt: past, updatedAt: past });

    const res = await authed().patch(`${TASKS}/${task.id}`).send({ status: 'in_progress' });

    expect(res.body.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(past.getTime());
    const stored = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(stored.updatedAt.getTime()).toBeGreaterThan(past.getTime());
  });

  it('clears the due date with null', async () => {
    const task = await makeTask({ dueDate: new Date('2026-12-31T00:00:00Z') });

    const res = await authed().patch(`${TASKS}/${task.id}`).send({ dueDate: null });

    expect(res.status).toBe(200);
    expect(res.body.dueDate).toBeNull();
  });

  it('answers 400 for a body with no fields', async () => {
    const task = await makeTask();

    const res = await authed().patch(`${TASKS}/${task.id}`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('answers 400 for an invalid status and changes nothing', async () => {
    const task = await makeTask({ status: 'todo' });

    const res = await authed().patch(`${TASKS}/${task.id}`).send({ status: 'finished' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual({
      path: 'status',
      message: 'Must be one of: todo, in_progress, done',
    });
    const stored = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(stored.status).toBe('todo');
  });

  it('answers 400 when the description is null, which is not allowed', async () => {
    const task = await makeTask();

    const res = await authed().patch(`${TASKS}/${task.id}`).send({ description: null });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual({ path: 'description', message: 'Must be a string' });
  });

  it('answers 404 for a task that does not exist', async () => {
    const res = await authed()
      .patch(`${TASKS}/00000000-0000-4000-8000-000000000000`)
      .send({ title: 'Ghost' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
