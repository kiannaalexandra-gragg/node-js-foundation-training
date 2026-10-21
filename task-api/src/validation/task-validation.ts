// Module 5 output, extended in Module 7: hand-written request validation (M08 replaces it with Zod).
// Nothing to run here. Used by the handlers. Success: bad input throws one ValidationError that lists every problem.
import { ValidationError, type ErrorDetail } from '../errors.ts';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  SORT_FIELDS,
  SORT_ORDERS,
  TASK_STATUSES,
  isTaskStatus,
  type CreateTaskInput,
  type ListTasksQuery,
  type SortField,
  type SortOrder,
  type TaskStatus,
  type UpdateTaskInput,
} from '../types/task.ts';

// Hand-written validation, on purpose. Every check below is the kind of code M08 deletes when Zod
// arrives. Each function takes `unknown` (nothing from the network is trusted), collects every
// problem it finds instead of stopping at the first, and throws one ValidationError.
//
// Fields that are not part of the contract (an `id` or `foo` in the body) are ignored, not
// rejected: the server owns the id, and extra keys do no harm.

const STATUS_MESSAGE = `Must be one of: ${TASK_STATUSES.join(', ')}`;
// The ids this API hands out are UUIDs, so anything else cannot match a task.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Express 5 leaves req.body undefined when no body parser ran (no Content-Type: application/json),
// so "no body at all" is the first thing to handle.
function requireObject(body: unknown): Record<string, unknown> {
  if (!isPlainObject(body)) {
    throw new ValidationError([{ path: 'body', message: 'Must be a JSON object' }]);
  }
  return body;
}

function checkTitle(value: unknown, required: boolean, problems: ErrorDetail[]): string | undefined {
  if (value === undefined) {
    if (required) problems.push({ path: 'title', message: 'Required' });
    return undefined;
  }
  if (typeof value !== 'string') {
    problems.push({ path: 'title', message: 'Must be a string' });
    return undefined;
  }
  if (value.trim() === '') {
    problems.push({ path: 'title', message: 'Must not be empty' });
    return undefined;
  }
  return value.trim();
}

function checkDescription(value: unknown, problems: ErrorDetail[]): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    problems.push({ path: 'description', message: 'Must be a string' });
    return undefined;
  }
  return value;
}

function checkStatus(value: unknown, problems: ErrorDetail[]): TaskStatus | undefined {
  if (value === undefined) return undefined;
  if (!isTaskStatus(value)) {
    problems.push({ path: 'status', message: STATUS_MESSAGE });
    return undefined;
  }
  return value;
}

function checkPriority(value: unknown, problems: ErrorDetail[]): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 3) {
    problems.push({ path: 'priority', message: 'Must be a whole number from 1 (high) to 3 (low)' });
    return undefined;
  }
  return value;
}

// A due date is a calendar date or a full ISO 8601 date-time, as text. `null` clears it.
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2}))?$/;

// new Date('2026-02-30') does not fail: JavaScript rolls it over to 2 March, and the wrong date would
// be stored. So the year, month and day in the text are checked against the calendar as well.
function isRealDay(text: string): boolean {
  const [year, month, day] = text.slice(0, 10).split('-').map(Number) as [number, number, number];
  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year && check.getUTCMonth() === month - 1 && check.getUTCDate() === day
  );
}

function checkDueDate(value: unknown, problems: ErrorDetail[]): Date | null | undefined {
  if (value === undefined || value === null) return value;
  const date =
    typeof value === 'string' && ISO_DATE.test(value) && isRealDay(value)
      ? new Date(value)
      : undefined;
  if (date === undefined || Number.isNaN(date.getTime())) {
    problems.push({
      path: 'dueDate',
      message: 'Must be an ISO 8601 date such as 2026-12-31, or null',
    });
    return undefined;
  }
  return date;
}

export function parseCreateTask(body: unknown): CreateTaskInput {
  const input = requireObject(body);
  const problems: ErrorDetail[] = [];

  const title = checkTitle(input.title, true, problems);
  const description = checkDescription(input.description, problems);
  const status = checkStatus(input.status, problems);
  const priority = checkPriority(input.priority, problems);
  const dueDate = checkDueDate(input.dueDate, problems);

  if (problems.length > 0 || title === undefined) throw new ValidationError(problems);

  const task: CreateTaskInput = { title };
  if (description !== undefined) task.description = description;
  if (status !== undefined) task.status = status;
  if (priority !== undefined) task.priority = priority;
  if (dueDate !== undefined) task.dueDate = dueDate;
  return task;
}

export function parseUpdateTask(body: unknown): UpdateTaskInput {
  const input = requireObject(body);
  const problems: ErrorDetail[] = [];

  const title = checkTitle(input.title, false, problems);
  const description = checkDescription(input.description, problems);
  const status = checkStatus(input.status, problems);
  const priority = checkPriority(input.priority, problems);
  const dueDate = checkDueDate(input.dueDate, problems);

  // A PATCH that changes nothing is a mistake, not a no-op. The message is the one v1 shipped, and
  // the Bruno collection asserts it word for word.
  const sent = ['title', 'description', 'status', 'priority', 'dueDate'].some(
    (key) => input[key] !== undefined,
  );
  if (!sent) {
    problems.push({ path: 'body', message: 'At least one of title, description, status is required' });
  }
  if (problems.length > 0) throw new ValidationError(problems);

  const patch: UpdateTaskInput = {};
  if (title !== undefined) patch.title = title;
  if (description !== undefined) patch.description = description;
  if (status !== undefined) patch.status = status;
  if (priority !== undefined) patch.priority = priority;
  if (dueDate !== undefined) patch.dueDate = dueDate;
  return patch;
}

export function parseTaskId(id: string): string {
  if (!UUID.test(id)) {
    throw new ValidationError([{ path: 'id', message: 'Must be a valid UUID' }]);
  }
  return id;
}

// A query-string value that must be one of a fixed list, or absent (then `fallback`). Anything else
// (an unknown value, an empty `?order=`, or the key given twice, which Express turns into an
// array) is a problem, never ignored, so a typo cannot silently return a different list.
function checkChoice<T extends string>(
  raw: unknown,
  path: string,
  choices: readonly T[],
  fallback: T,
  problems: ErrorDetail[],
): T {
  if (raw === undefined) return fallback;
  const match = choices.find((choice) => choice === raw);
  if (match === undefined) {
    problems.push({ path, message: `Must be one of: ${choices.join(', ')}` });
    return fallback;
  }
  return match;
}

// A query-string value that must be a whole number of 1 or more (and at most `max`, when given), or
// absent (then `fallback`).
function checkWholeNumber(
  raw: unknown,
  path: string,
  max: number | undefined,
  fallback: number,
  problems: ErrorDetail[],
): number {
  if (raw === undefined) return fallback;
  const value = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isSafeInteger(value) || value < 1 || (max !== undefined && value > max)) {
    problems.push({
      path,
      message: max === undefined ? 'Must be a whole number of 1 or more' : `Must be a whole number from 1 to ${max}`,
    });
    return fallback;
  }
  return value;
}

// GET /api/v1/tasks accepts these optional query parameters. A bad value is a 400 VALIDATION_ERROR
// that lists every bad parameter, never ignored.
//   status    todo | in_progress | done        only tasks with this status
//   q         text                             tasks whose title or description contains it
//   sortBy    createdAt | title | priority | dueDate | status    (default createdAt)
//   order     asc | desc                       (default desc)
//   page      1, 2, 3 ...                      (default 1)
//   pageSize  1 to MAX_PAGE_SIZE               (default DEFAULT_PAGE_SIZE)
export function parseListQuery(query: unknown): ListTasksQuery {
  const input = isPlainObject(query) ? query : {};
  const problems: ErrorDetail[] = [];

  let status: ListTasksQuery['status'];
  if (input.status !== undefined) {
    if (isTaskStatus(input.status)) status = input.status;
    else problems.push({ path: 'status', message: STATUS_MESSAGE });
  }

  let q: string | undefined;
  if (input.q !== undefined) {
    if (typeof input.q === 'string' && input.q.trim() !== '') q = input.q.trim();
    else problems.push({ path: 'q', message: 'Must be a non-empty string' });
  }

  const sortBy: SortField = checkChoice(input.sortBy, 'sortBy', SORT_FIELDS, 'createdAt', problems);
  const order: SortOrder = checkChoice(input.order, 'order', SORT_ORDERS, 'desc', problems);
  const page = checkWholeNumber(input.page, 'page', undefined, 1, problems);
  const pageSize = checkWholeNumber(
    input.pageSize,
    'pageSize',
    MAX_PAGE_SIZE,
    DEFAULT_PAGE_SIZE,
    problems,
  );

  if (problems.length > 0) throw new ValidationError(problems);

  const parsed: ListTasksQuery = { sortBy, order, page, pageSize };
  if (status !== undefined) parsed.status = status;
  if (q !== undefined) parsed.q = q;
  return parsed;
}
