// Module 5 output: hand-written request validation (M08 replaces it with Zod).
// Nothing to run here. Used by the handlers. Success: bad input throws one ValidationError that lists every problem.
import { ValidationError, type ErrorDetail } from '../errors.ts';
import {
  TASK_STATUSES,
  isTaskStatus,
  type CreateTaskInput,
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

export function parseCreateTask(body: unknown): CreateTaskInput {
  const input = requireObject(body);
  const problems: ErrorDetail[] = [];

  const title = checkTitle(input.title, true, problems);
  const description = checkDescription(input.description, problems);
  const status = checkStatus(input.status, problems);

  if (problems.length > 0 || title === undefined) throw new ValidationError(problems);

  const task: CreateTaskInput = { title };
  if (description !== undefined) task.description = description;
  if (status !== undefined) task.status = status;
  return task;
}

export function parseUpdateTask(body: unknown): UpdateTaskInput {
  const input = requireObject(body);
  const problems: ErrorDetail[] = [];

  const title = checkTitle(input.title, false, problems);
  const description = checkDescription(input.description, problems);
  const status = checkStatus(input.status, problems);

  // A PATCH that changes nothing is a mistake, not a no-op.
  const sent = ['title', 'description', 'status'].some((key) => input[key] !== undefined);
  if (!sent) {
    problems.push({ path: 'body', message: 'At least one of title, description, status is required' });
  }
  if (problems.length > 0) throw new ValidationError(problems);

  const patch: UpdateTaskInput = {};
  if (title !== undefined) patch.title = title;
  if (description !== undefined) patch.description = description;
  if (status !== undefined) patch.status = status;
  return patch;
}

export function parseTaskId(id: string): string {
  if (!UUID.test(id)) {
    throw new ValidationError([{ path: 'id', message: 'Must be a valid UUID' }]);
  }
  return id;
}

// GET /api/v1/tasks accepts one optional filter, ?status=todo|in_progress|done.
//   - no `status`: every task.
//   - a valid `status`: only the tasks with that status.
//   - anything else (an unknown value, an empty `?status=`, or `status` given twice): a 400
//     VALIDATION_ERROR with path "status". An invalid filter is never ignored, so a typo cannot
//     silently return the unfiltered list.
export function parseListQuery(query: unknown): { status?: TaskStatus } {
  const raw = isPlainObject(query) ? query.status : undefined;
  if (raw === undefined) return {};
  if (!isTaskStatus(raw)) {
    throw new ValidationError([{ path: 'status', message: STATUS_MESSAGE }]);
  }
  return { status: raw };
}
