// Module 9 output: integration tests for the Prisma error mapping (P2002 and P2003 become a 409) in the real error handler.
// Run them: npm test. Success: every test passes against test.db with nothing mocked.
import { afterAll, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { prisma } from '../src/db.ts';
import { errorHandler } from '../src/middleware/error-handler.ts';
import { requestId } from '../src/middleware/request-id.ts';
import { DEFAULT_OWNER_EMAIL } from '../src/services/task-service.ts';
import { disconnectDb, resetDb } from './helpers/db.ts';

// No endpoint of the Task API can make a unique or a foreign-key violation: users and tags are not
// exposed. So this file builds a two-route app of its own, with the real request-id middleware and
// the real error handler, and the routes make real Prisma calls that really fail on test.db.
// Nothing is mocked: the 409 comes from a real P2002 or P2003.
const app = express();
app.use(requestId);
app.get('/duplicate-user', async (_req, res) => {
  await prisma.user.create({ data: { email: DEFAULT_OWNER_EMAIL, name: 'A second owner' } });
  res.sendStatus(201);
});
app.get('/task-for-missing-user', async (_req, res) => {
  await prisma.task.create({ data: { title: 'Orphan', userId: 999_999 } });
  res.sendStatus(201);
});
app.use(errorHandler);

beforeEach(async () => {
  await resetDb();
});
afterAll(async () => {
  await disconnectDb();
});

describe('Prisma errors become a 409 CONFLICT', () => {
  it('maps a unique violation (P2002) and does not echo Prisma', async () => {
    const res = await request(app).get('/duplicate-user');

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'CONFLICT',
      message: 'A record with the same unique value already exists',
    });
    expect(JSON.stringify(res.body)).not.toContain(DEFAULT_OWNER_EMAIL);
    expect(await prisma.user.count({ where: { email: DEFAULT_OWNER_EMAIL } })).toBe(1);
  });

  it('maps a foreign-key violation (P2003) and stores nothing', async () => {
    const res = await request(app).get('/task-for-missing-user');

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(await prisma.task.count()).toBe(0);
  });
});
