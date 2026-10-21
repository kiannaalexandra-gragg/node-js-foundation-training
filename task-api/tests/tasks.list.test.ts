// Module 9 output: integration tests for GET /api/v1/tasks: paging, filtering, searching and sorting.
// Run them: npm test. Success: every test passes against the real app and test.db.
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import { authed, TASKS } from './helpers/api.ts';
import { disconnectDb, resetDb } from './helpers/db.ts';
import { makeTask, makeTasks } from './helpers/factories.ts';

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await disconnectDb();
});

type Row = { id: string; title: string };
const titles = (body: { data: Row[] }): string[] => body.data.map((task) => task.title);

describe('GET /api/v1/tasks', () => {
  describe('the page and its meta', () => {
    it('answers an empty page when there are no tasks', async () => {
      const res = await authed().get(TASKS);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 } });
    });

    it('returns the first 20 of 25 tasks by default', async () => {
      await makeTasks(25);

      const res = await authed().get(TASKS);

      expect(res.body.data).toHaveLength(20);
      expect(res.body.meta).toEqual({ page: 1, pageSize: 20, total: 25, totalPages: 2 });
    });

    it('puts every task on exactly one page', async () => {
      await makeTasks(25);

      const seen: string[] = [];
      for (const page of [1, 2, 3]) {
        const res = await authed().get(TASKS).query({ page, pageSize: 10 });
        seen.push(...res.body.data.map((task: Row) => task.id));
        expect(res.body.meta).toMatchObject({ page, pageSize: 10, total: 25, totalPages: 3 });
      }

      expect(seen).toHaveLength(25);
      expect(new Set(seen).size).toBe(25);
    });

    it('answers an empty page past the last one, with the true total', async () => {
      await makeTasks(3);

      const res = await authed().get(TASKS).query({ page: 5 });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta).toMatchObject({ page: 5, total: 3, totalPages: 1 });
    });
  });

  describe('filtering and searching', () => {
    it('filters by status and counts only the matches', async () => {
      await makeTasks(3, (i) => ({ title: `todo ${i}`, status: 'todo' }));
      await makeTasks(2, (i) => ({ title: `done ${i}`, status: 'done' }));

      const res = await authed().get(TASKS).query({ status: 'done' });

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every((task: { status: string }) => task.status === 'done')).toBe(true);
      expect(res.body.meta.total).toBe(2);
    });

    it('searches the title and the description, ignoring case', async () => {
      await makeTask({ title: 'Fix the login bug', description: null });
      await makeTask({ title: 'Write docs', description: 'explain the LOGIN flow' });
      await makeTask({ title: 'Unrelated', description: 'nothing here' });

      const res = await authed().get(TASKS).query({ q: 'login', sortBy: 'title', order: 'asc' });

      expect(titles(res.body)).toEqual(['Fix the login bug', 'Write docs']);
      expect(res.body.meta.total).toBe(2);
    });

    it('combines a filter and a search', async () => {
      await makeTask({ title: 'Fix A', status: 'done' });
      await makeTask({ title: 'Fix B', status: 'todo' });
      await makeTask({ title: 'Other', status: 'done' });

      const res = await authed().get(TASKS).query({ status: 'done', q: 'fix' });

      expect(titles(res.body)).toEqual(['Fix A']);
    });
  });

  describe('sorting', () => {
    it('sorts newest first by default', async () => {
      await makeTask({ title: 'old', createdAt: new Date('2026-01-01T00:00:00Z') });
      await makeTask({ title: 'new', createdAt: new Date('2026-03-01T00:00:00Z') });
      await makeTask({ title: 'mid', createdAt: new Date('2026-02-01T00:00:00Z') });

      const res = await authed().get(TASKS);

      expect(titles(res.body)).toEqual(['new', 'mid', 'old']);
    });

    it('sorts by title ascending', async () => {
      await makeTasks(3, (i) => ({ title: ['b', 'c', 'a'][i] ?? '' }));

      const res = await authed().get(TASKS).query({ sortBy: 'title', order: 'asc' });

      expect(titles(res.body)).toEqual(['a', 'b', 'c']);
    });

    it('sorts by priority descending', async () => {
      await makeTasks(3, (i) => ({ title: `p${i + 1}`, priority: i + 1 }));

      const res = await authed().get(TASKS).query({ sortBy: 'priority', order: 'desc' });

      expect(titles(res.body)).toEqual(['p3', 'p2', 'p1']);
    });

    it('lists tasks with no due date first when sorting by dueDate ascending (SQLite)', async () => {
      await makeTask({ title: 'later', dueDate: new Date('2026-06-01T00:00:00Z') });
      await makeTask({ title: 'none', dueDate: null });
      await makeTask({ title: 'sooner', dueDate: new Date('2026-05-01T00:00:00Z') });

      const res = await authed().get(TASKS).query({ sortBy: 'dueDate', order: 'asc' });

      expect(titles(res.body)).toEqual(['none', 'sooner', 'later']);
    });

    it('breaks ties by id, so the order is the same on every request', async () => {
      await makeTasks(6, () => ({ priority: 2 }));

      const first = await authed().get(TASKS).query({ sortBy: 'priority', order: 'asc' });
      const second = await authed().get(TASKS).query({ sortBy: 'priority', order: 'asc' });

      const ids = first.body.data.map((task: Row) => task.id);
      expect(ids).toEqual([...ids].sort());
      expect(second.body.data.map((task: Row) => task.id)).toEqual(ids);
    });
  });

  describe('a bad query is a 400 that lists every bad parameter', () => {
    it('reports each one', async () => {
      const res = await authed()
        .get(TASKS)
        .query({ status: 'urgent', sortBy: 'password', order: 'up', page: '0', pageSize: '101' });

      expect(res.status).toBe(400);
      const paths = res.body.error.details.map((d: { path: string }) => d.path);
      expect(paths.sort()).toEqual(['order', 'page', 'pageSize', 'sortBy', 'status']);
    });

    it.each([
      ['page', '1e2'],
      ['page', '-1'],
      ['pageSize', '0'],
      ['q', ' '],
    ])('refuses %s=%j', async (name, value) => {
      const res = await authed().get(TASKS).query({ [name]: value });

      expect(res.status).toBe(400);
      expect(res.body.error.details[0].path).toBe(name);
    });
  });
});
