// Module 9 output: factories that put a task straight into the test database, without the API.
// Nothing to run here. Imported by the test files. Success: makeTask() returns a stored task that has an owner.
import { prisma } from '../../src/db.ts';
import type { Prisma, Task, User } from '../../src/generated/prisma/client.ts';
import { DEFAULT_OWNER_EMAIL } from '../../src/services/task-service.ts';

// A test sets up the rows it needs here and then checks the API, so a failing "get" test means "get"
// is broken, not that "create" was. Every field a test cares about is passed in, so the test shows
// it: a test that sorts by date passes the dates, and never relies on the clock.
let counter = 0;

export async function defaultOwner(): Promise<User> {
  return prisma.user.findUniqueOrThrow({ where: { email: DEFAULT_OWNER_EMAIL } });
}

export async function makeTask(overrides: Partial<Prisma.TaskUncheckedCreateInput> = {}): Promise<Task> {
  counter += 1;
  const owner = await defaultOwner();
  return prisma.task.create({
    data: { title: `Task ${counter}`, userId: owner.id, ...overrides },
  });
}

// Makes `count` tasks one after another. SQLite has a single writer, so they are not made in parallel.
// `build(i)` returns the fields for task number i, so a test says what differs between the rows.
export async function makeTasks(
  count: number,
  build: (i: number) => Partial<Prisma.TaskUncheckedCreateInput> = () => ({}),
): Promise<Task[]> {
  const tasks: Task[] = [];
  for (let i = 0; i < count; i += 1) tasks.push(await makeTask(build(i)));
  return tasks;
}
