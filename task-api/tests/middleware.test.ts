// Module 9 output: integration tests for the middleware and the error handler: request id, API key, 404 handler, body errors, no stack leak.
// Run them: npm test. Success: every test passes against the real app and test.db.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { taskService } from '../src/services/task-service.ts';
import { anonymous, authed, TASKS } from './helpers/api.ts';
import { disconnectDb, resetDb } from './helpers/db.ts';

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await disconnectDb();
});

describe('GET /health', () => {
  it('answers 200 without an API key', async () => {
    const res = await anonymous().get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('the API key', () => {
  it('rejects a request with no key', async () => {
    const res = await anonymous().get(TASKS);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatchObject({ code: 'UNAUTHORIZED', message: 'Missing or invalid API key' });
  });

  it('rejects a wrong key with the same answer', async () => {
    const res = await anonymous().get(TASKS).set('X-API-Key', 'wrong-key');

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Missing or invalid API key');
  });

  it('answers 401, not 400, to malformed JSON that has no key', async () => {
    const res = await anonymous().post(TASKS).set('Content-Type', 'application/json').send('{"title":');

    expect(res.status).toBe(401);
  });
});

describe('the request id', () => {
  it('puts a generated id on a successful response', async () => {
    const res = await authed().get(TASKS);

    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('puts an id on a response the key check rejected', async () => {
    const res = await anonymous().get(TASKS);

    expect(res.headers['x-request-id']).toBeDefined();
    expect(res.body.error.requestId).toBe(res.headers['x-request-id']);
  });

  it('reuses a safe id sent by the caller', async () => {
    const id = `test-${randomUUID()}`;

    const res = await authed().get(TASKS).set('X-Request-Id', id);

    expect(res.headers['x-request-id']).toBe(id);
  });

  it('replaces an id with unsafe characters', async () => {
    const res = await authed().get(TASKS).set('X-Request-Id', 'bad id;<script>');

    expect(res.headers['x-request-id']).not.toBe('bad id;<script>');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe('the 404 handler', () => {
  it('answers an unknown route under the API with the NOT_FOUND envelope', async () => {
    const res = await authed().get('/api/v1/nothing-here');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({
      code: 'NOT_FOUND',
      message: 'Route not found: GET /api/v1/nothing-here',
    });
  });

  it('answers an unknown route outside the API', async () => {
    const res = await anonymous().get('/nothing-here');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('answers a known path with a method it does not have', async () => {
    const res = await authed().put(TASKS);

    expect(res.status).toBe(404);
  });
});

describe('bad bodies', () => {
  it('answers 400 BAD_REQUEST to malformed JSON', async () => {
    const res = await authed().post(TASKS).set('Content-Type', 'application/json').send('{"title":');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: 'BAD_REQUEST', message: 'Request body is not valid JSON' });
  });

  it('answers 413 to a body over the size limit', async () => {
    const res = await authed()
      .post(TASKS)
      .send({ title: 'x'.repeat(200_000) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});

describe('the error handler never leaks', () => {
  it('turns an unexpected failure into a generic 500 with no stack and no cause', async () => {
    const secret = 'ECONNRESET at /srv/secret/path.ts:12';
    jest.spyOn(taskService, 'list').mockRejectedValue(new Error(secret));
    const logged = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    const res = await authed().get(TASKS);

    expect(res.status).toBe(500);
    expect(res.body.error).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('secret');
    expect(text).not.toContain('.ts:');
    expect(text).not.toMatch(/\n\s+at /);
    expect(res.body.error).not.toHaveProperty('stack');
    // The detail is for the server log, with the request id so the two can be matched up.
    expect(logged).toHaveBeenCalledWith(expect.stringContaining(res.body.error.requestId), expect.any(Error));
  });
});
