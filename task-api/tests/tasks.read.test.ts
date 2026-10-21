// Module 9 output: integration tests for GET /api/v1/tasks/:id.
// Run them: npm test. Success: every test passes against the real app and test.db.
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { authed, TASKS } from './helpers/api.ts';
import { disconnectDb, resetDb } from './helpers/db.ts';
import { makeTask } from './helpers/factories.ts';

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await disconnectDb();
});

describe('GET /api/v1/tasks/:id', () => {
  it('returns the task', async () => {
    const task = await makeTask({ title: 'Find me', priority: 1 });

    const res = await authed().get(`${TASKS}/${task.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: task.id, title: 'Find me', priority: 1, status: 'todo' });
  });

  it('answers 404 NOT_FOUND for an id that does not exist', async () => {
    const res = await authed().get(`${TASKS}/00000000-0000-4000-8000-000000000000`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND', message: expect.stringContaining('not found') });
  });

  it('answers 400 for an id that is not a UUID', async () => {
    const res = await authed().get(`${TASKS}/not-a-uuid`);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual({ path: 'id', message: 'Must be a valid UUID' });
  });
});
