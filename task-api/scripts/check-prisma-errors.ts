// Module 7 output: proves P2002, P2025 and P2003 each reach the central error handler and come out as the right status.
// Run it: npm run check:errors (needs a migrated database, and it leaves no rows behind).
// Success: three lines ending PASS, and exit code 0.
import express from 'express';
import type { AddressInfo } from 'node:net';
import { prisma } from '../src/db.ts';
import { errorHandler } from '../src/middleware/error-handler.ts';
import { requestId } from '../src/middleware/request-id.ts';

// P2002, P2025 and P2003 cannot be reached through the v1 routes: the task endpoints have no unique
// column a client can collide with and no foreign key a client can set. So this script makes the
// REAL errors, by running real failing queries against the real database, and sends each one through
// the REAL error handler by way of a throwaway Express app. Nothing in the mapping is faked.
//
// Each case below says which query fails and why. `expected` is what the mapping must produce.
type Case = {
  name: string;
  code: string;
  expected: { status: number; code: string };
  run: () => Promise<unknown>;
};

const cases: Case[] = [
  {
    name: 'duplicate email',
    code: 'P2002',
    expected: { status: 409, code: 'CONFLICT' },
    // users.email is UNIQUE and the default owner already has this address.
    run: () => prisma.user.create({ data: { email: 'owner@example.com', name: 'Duplicate' } }),
  },
  {
    name: 'update a task that does not exist',
    code: 'P2025',
    expected: { status: 404, code: 'NOT_FOUND' },
    // update() needs the row to exist, and no task has this id.
    run: () =>
      prisma.task.update({
        where: { id: '99999999-9999-4999-8999-999999999999' },
        data: { title: 'x' },
      }),
  },
  {
    name: 'task for an owner that does not exist',
    code: 'P2003',
    expected: { status: 409, code: 'CONFLICT' },
    // tasks.userId is a foreign key, and no user has this id. userId is written directly (an
    // "unchecked" create), so Prisma does not look the user up first and the database refuses it.
    run: () => prisma.task.create({ data: { title: 'orphan', userId: 999_999 } }),
  },
];

const app = express();
app.use(requestId);
app.get('/case/:index', async (req) => {
  const found = cases[Number(req.params.index)];
  if (found === undefined) throw new Error('No such case');
  await found.run();
});
app.use(errorHandler);

const server = app.listen(0);
const { port } = server.address() as AddressInfo;

let failed = false;
for (const [index, c] of cases.entries()) {
  // Prisma's own error comes first, to show the code the mapping is keyed on.
  const raw = await c.run().then(
    () => 'no error',
    (err: unknown) => (err as { code?: string }).code ?? 'not a Prisma error',
  );

  const res = await fetch(`http://127.0.0.1:${port}/case/${index}`);
  const body = (await res.json()) as { error: { code: string; message: string } };
  const ok =
    raw === c.code && res.status === c.expected.status && body.error.code === c.expected.code;
  if (!ok) failed = true;
  console.log(
    `${c.code} ${c.name}: Prisma code ${raw} -> HTTP ${res.status} ${body.error.code} "${body.error.message}" ${ok ? 'PASS' : 'FAIL'}`,
  );
}

server.close();
await prisma.$disconnect();
process.exit(failed ? 1 : 0);
