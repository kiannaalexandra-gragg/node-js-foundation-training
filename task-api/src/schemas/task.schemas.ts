// Module 8 output: the Zod schemas for every request the Task API accepts, and the types derived from them.
// Nothing to run here. Used by routes/tasks.routes.ts (through validate) and by the handlers and the task service for their types. Success: `npm run typecheck` exits 0.
import { z } from 'zod';
import { TaskStatus } from '../generated/prisma/enums.ts';

// Schemas first, types second. Each type below is derived from a schema with z.infer or z.output, so
// the rules a request must meet and the type the handler receives cannot drift apart: change a schema
// and the compiler shows every place that needs to follow.
//
// The messages are the ones v1 and v2 sent, word for word, because the Bruno collection asserts them.
// A schema keeps the v2 rules too: unknown keys in a body are stripped (z.object), not rejected, and
// every field problem is reported, not just the first.

export const TASK_STATUSES = Object.values(TaskStatus);
const STATUS_MESSAGE = `Must be one of: ${TASK_STATUSES.join(', ')}`;
const PRIORITY_MESSAGE = 'Must be a whole number from 1 (high) to 3 (low)';

// The fields a list can be sorted by. A list of names, not any column the client types, so a
// client cannot sort by something that is not meant to be public.
export const SORT_FIELDS = ['createdAt', 'title', 'priority', 'dueDate', 'status'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// "Required" when the key is missing (its value is undefined), the type message when it is there but
// the wrong type.
const orRequired = (typeMessage: string) => (issue: { input?: unknown }) =>
  issue.input === undefined ? 'Required' : typeMessage;

// --- Body -----------------------------------------------------------------------------------------

// The documented contract (README, "The task"): a due date is a date (2026-12-31) or an ISO 8601
// date-time with a time zone (Z or +08:00), as text, and `null` clears it. The date-time may have
// seconds or stop at the minute (precision -1), as v2 allowed. The day must exist on the calendar, so
// 2026-02-30 is refused rather than rolled over to 2 March by `new Date`. An hour is 00 to 23 (hour 24,
// "end of day", is refused) and a year is four digits, 0000 to 9999. The output is a Date, which is what
// Prisma wants.
const DUE_DATE_MESSAGE = 'Must be an ISO 8601 date such as 2026-12-31, or null';
const dueDate = z
  .union(
    [
      z.iso.date(),
      z.iso.datetime({ offset: true }),
      z.iso.datetime({ offset: true, precision: -1 }),
    ],
    { error: DUE_DATE_MESSAGE },
  )
  .transform((text) => new Date(text))
  .nullable();

// The fields a client may set. The server owns the id, the owner and the timestamps.
export const createTaskBody = z.object(
  {
    title: z
      .string({ error: orRequired('Must be a string') })
      .trim()
      .min(1, { error: 'Must not be empty' }),
    description: z.string({ error: 'Must be a string' }).optional(),
    status: z.enum(TaskStatus, { error: STATUS_MESSAGE }).optional(),
    // 1 (high) to 3 (low).
    priority: z
      .int({ error: PRIORITY_MESSAGE })
      .min(1, { error: PRIORITY_MESSAGE })
      .max(3, { error: PRIORITY_MESSAGE })
      .optional(),
    dueDate: dueDate.optional(),
  },
  { error: 'Must be a JSON object' },
);

// Derived from the create schema, not written again: any subset of the same fields, and at least one.
// A PATCH that changes nothing is a mistake, not a no-op.
export const updateTaskBody = createTaskBody
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, {
    error: 'At least one of title, description, status is required',
  });

// --- Params ---------------------------------------------------------------------------------------

// The ids this API hands out are UUIDs, so anything else cannot match a task. z.guid() is the
// "any 8-4-4-4-12 hex" check v2 used. z.uuid() would also demand a valid version and variant digit.
export const taskParams = z.object({ id: z.guid({ error: 'Must be a valid UUID' }) });

// --- Query ----------------------------------------------------------------------------------------

// A query-string value that must be a whole number of 1 or more (and at most `max`, when given).
// Everything in a query string is text, so the digits are checked first and then turned into a number:
// z.coerce.number() on its own would let "1e2", " 5" and "0x10" through, because Number() reads them.
function wholeNumber(max?: number) {
  const message =
    max === undefined ? 'Must be a whole number of 1 or more' : `Must be a whole number from 1 to ${max}`;
  let size = z.int({ error: message }).min(1, { error: message });
  if (max !== undefined) size = size.max(max, { error: message });
  return z
    .string({ error: message })
    .regex(/^\d+$/, { error: message })
    .transform(Number)
    .pipe(size);
}

const choice = <T extends readonly [string, ...string[]]>(values: T) =>
  z.enum(values, { error: `Must be one of: ${values.join(', ')}` });

// GET /api/v1/tasks accepts these optional query parameters. A bad value is a 400 VALIDATION_ERROR
// that lists every bad parameter, never ignored.
//   status    todo | in_progress | done        only tasks with this status
//   q         text                             tasks whose title or description contains it
//   sortBy    createdAt | title | priority | dueDate | status    (default createdAt)
//   order     asc | desc                       (default desc)
//   page      1, 2, 3 ...                      (default 1)
//   pageSize  1 to MAX_PAGE_SIZE               (default DEFAULT_PAGE_SIZE)
export const listTasksQuery = z.object({
  status: z.enum(TaskStatus, { error: STATUS_MESSAGE }).optional(),
  q: z
    .string({ error: 'Must be a non-empty string' })
    .trim()
    .min(1, { error: 'Must be a non-empty string' })
    .optional(),
  sortBy: choice(SORT_FIELDS).default('createdAt'),
  order: choice(SORT_ORDERS).default('desc'),
  page: wholeNumber().default(1),
  pageSize: wholeNumber(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

// --- One request schema per route -----------------------------------------------------------------

// The routes pass these to validate(), and the handlers take their types from the same objects, so a
// handler's type cannot name a different schema from the one its route was given. It does not force a
// route to call validate() at all: the handlers read through validOf, which throws if it did not run.
export const listTasksRequest = { query: listTasksQuery };
export const createTaskRequest = { body: createTaskBody };
export const getTaskRequest = { params: taskParams };
export const updateTaskRequest = { params: taskParams, body: updateTaskBody };
export const deleteTaskRequest = { params: taskParams };

// --- Derived types --------------------------------------------------------------------------------

// What a handler receives after validation (z.output), which is what the service takes.
export type CreateTaskInput = z.output<typeof createTaskBody>;
export type UpdateTaskInput = z.output<typeof updateTaskBody>;
export type ListTasksQuery = z.output<typeof listTasksQuery>;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = (typeof SORT_ORDERS)[number];
