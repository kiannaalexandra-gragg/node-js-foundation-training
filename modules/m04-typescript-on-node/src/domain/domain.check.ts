// Module 4 output: self-checks for the Task domain types and Result<T, E>.
// Run from this folder: npm run check   (or: npx tsx src/domain/domain.check.ts)
// Two kinds of check: runtime asserts (run the file) and type-level asserts (`npm run typecheck`).
// Success: "ok - ..." lines and no error from either command.
import assert from 'node:assert/strict';
import { sleep } from '../toolkit/async-toolkit.ts';
import {
  applyTaskUpdate,
  createTask,
  isTaskStatus,
  STATUS_LABELS,
  TASK_STATUSES,
  type CreateTaskInput,
  type Task,
  type TaskStatus,
  type UpdateTaskInput,
} from './task.ts';
import { attempt, err, mapResult, ok, toError, unwrapOr, type Result } from './result.ts';

// Type-level assertions: these cost nothing at runtime and fail `tsc --noEmit` if a type drifts.
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;

type _StatusIsTheUnion = Expect<Equal<TaskStatus, 'todo' | 'in_progress' | 'done'>>;
type _CreateKeys = Expect<Equal<keyof CreateTaskInput, 'title' | 'description' | 'status'>>;
type _TitleRequiredOnCreate = Expect<Equal<CreateTaskInput['title'], string>>;
type _StatusOptionalOnCreate = Expect<Equal<{} extends Pick<CreateTaskInput, 'status'> ? true : false, true>>;
type _UpdateIsAllOptional = Expect<Equal<{} extends UpdateTaskInput ? true : false, true>>;
type _UpdateKeepsTypes = Expect<Equal<UpdateTaskInput['status'], TaskStatus | undefined>>;
// The update input must not offer the server-owned fields, and must keep Task's own field types.
type _UpdateKeys = Expect<Equal<keyof UpdateTaskInput, 'title' | 'description' | 'status'>>;
type _DescriptionType = Expect<Equal<Task['description'], string | undefined>>;

async function check(name: string, fn: () => void | Promise<void>): Promise<void> {
  await fn();
  console.log(`ok - ${name}`);
}

const now = new Date('2026-10-21T09:00:00.000Z');

await check('TASK_STATUSES lists the three statuses in order', () => {
  assert.deepEqual([...TASK_STATUSES], ['todo', 'in_progress', 'done']);
});

await check('isTaskStatus accepts the three statuses and rejects everything else', () => {
  for (const status of TASK_STATUSES) assert.equal(isTaskStatus(status), true);
  for (const bad of ['TODO', 'finished', '', 0, null, undefined, {}]) {
    assert.equal(isTaskStatus(bad), false);
  }
});

await check('isTaskStatus narrows an unknown value to TaskStatus', () => {
  const raw: unknown = 'done';
  if (isTaskStatus(raw)) {
    // Inside this branch `raw` is a TaskStatus, so it can index STATUS_LABELS.
    assert.equal(STATUS_LABELS[raw], 'Done');
  } else {
    assert.fail('expected done to be a TaskStatus');
  }
});

await check('STATUS_LABELS has a label for every status', () => {
  assert.deepEqual(Object.keys(STATUS_LABELS), [...TASK_STATUSES]);
});

await check('createTask fills server-owned fields and defaults status to todo', () => {
  const task = createTask('t1', { title: 'Write the M04 guide' }, now);
  assert.deepEqual(task, {
    id: 't1',
    title: 'Write the M04 guide',
    status: 'todo',
    createdAt: now,
    updatedAt: now,
  });
  assert.equal('description' in task, false);
});

await check('createTask keeps an explicit status and description', () => {
  const task = createTask('t2', { title: 'Ship', description: 'to main', status: 'in_progress' }, now);
  assert.equal(task.status, 'in_progress');
  assert.equal(task.description, 'to main');
});

await check('applyTaskUpdate changes only the given fields and bumps updatedAt', () => {
  const before: Task = createTask('t3', { title: 'Old', description: 'keep me' }, now);
  const later = new Date('2026-10-22T09:00:00.000Z');
  const after = applyTaskUpdate(before, { title: 'New', status: 'done' }, later);
  assert.equal(after.title, 'New');
  assert.equal(after.status, 'done');
  assert.equal(after.description, 'keep me');
  assert.equal(after.id, 't3');
  assert.equal(after.createdAt, now);
  assert.equal(after.updatedAt, later);
  assert.equal(before.title, 'Old'); // the input task is not mutated

  // An undefined field means "leave it alone", it must not blank the task. This compiles
  // because every field of UpdateTaskInput is optional.
  const untouched = applyTaskUpdate(before, { title: undefined, status: undefined }, later);
  assert.equal(untouched.title, 'Old');
  assert.equal(untouched.status, 'todo');

  // An object held in a variable is not checked for extra properties, so this compiles. The
  // server-owned fields must still survive it.
  const loose = { title: 'Newer', id: 'hijack', createdAt: new Date(0) };
  const guarded = applyTaskUpdate(before, loose, later);
  assert.equal(guarded.title, 'Newer');
  assert.equal(guarded.id, 't3');
  assert.equal(guarded.createdAt, now);
});

await check('the compiler rejects wrong task and input shapes', () => {
  // @ts-expect-error id is server-owned: it is not part of CreateTaskInput
  createTask('t4', { title: 'x', id: 'client-chose-this' }, now);
  // @ts-expect-error 'finished' is not one of the three statuses
  createTask('t5', { title: 'x', status: 'finished' }, now);
  // @ts-expect-error title is required on create
  createTask('t6', {}, now);
  const task = createTask('t7', { title: 'x' }, now);
  // @ts-expect-error id is readonly
  task.id = 'other';
  // @ts-expect-error createdAt is readonly
  task.createdAt = now;
  // These compile: title, description, status and updatedAt are writable.
  task.title = 'y';
  task.status = 'done';
});

await check('Result: ok and err build the two variants', () => {
  assert.deepEqual(ok(1), { ok: true, value: 1 });
  assert.deepEqual(err('nope'), { ok: false, error: 'nope' });
});

await check('Result: checking `ok` narrows to value or error', () => {
  function describe(result: Result<number, string>): string {
    if (result.ok) {
      // @ts-expect-error `error` does not exist on the ok variant
      result.error;
      return `got ${result.value}`;
    }
    // @ts-expect-error `value` does not exist on the failed variant
    result.value;
    return `failed: ${result.error}`;
  }
  assert.equal(describe(ok(42)), 'got 42');
  assert.equal(describe(err('boom')), 'failed: boom');
});

await check('Result: mapResult maps ok values and passes failures through untouched', () => {
  assert.deepEqual(mapResult(ok(2), (n) => n * 10), ok(20));
  const failure: Result<number, string> = err('bad');
  assert.equal(mapResult(failure, (n) => n * 10), failure);
});

await check('Result: unwrapOr returns the value or the fallback', () => {
  assert.equal(unwrapOr(ok('v'), 'fallback'), 'v');
  assert.equal(unwrapOr(err('x'), 'fallback'), 'fallback');
});

await check('toError keeps an Error and wraps anything else with the original as cause', () => {
  const original = new RangeError('already an error');
  assert.equal(toError(original), original);
  const wrapped = toError('just a string');
  assert.ok(wrapped instanceof Error);
  assert.equal(wrapped.message, 'just a string');
  assert.equal(wrapped.cause, 'just a string');

  // String() throws for an object with no prototype, so toError has to guard it.
  const bare = Object.create(null);
  const fromBare = toError(bare);
  assert.ok(fromBare instanceof Error);
  assert.equal(fromBare.cause, bare);
});

await check('attempt turns a resolved promise into ok and a rejection into err', async () => {
  const good = await attempt(async () => {
    await sleep(1);
    return 'fine';
  });
  assert.deepEqual(good, { ok: true, value: 'fine' });

  const bad = await attempt(async () => {
    throw 'a thrown string, not an Error';
  });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    assert.ok(bad.error instanceof Error);
    assert.equal(bad.error.message, 'a thrown string, not an Error');
  }

  // attempt never throws, even when what was thrown cannot be turned into a string.
  const worst = await attempt(async () => {
    throw Object.create(null);
  });
  assert.equal(worst.ok, false);
});
