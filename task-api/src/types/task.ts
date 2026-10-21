// Module 5 output, changed in Module 7: the Task types for Task API v2.
// Nothing to run here. Type-check with `npm run typecheck`.

// In v1 these types were written by hand. In v2 the database owns the shape of a task, so the types
// come from the Prisma schema and cannot drift from it: change schema.prisma, run `npm run
// db:generate`, and the compiler shows every place that needs to follow.
import type { Task as TaskRow } from '../generated/prisma/client.ts';
import { TaskStatus } from '../generated/prisma/enums.ts';

export type { TaskStatus };

// One list of allowed values, taken from the schema's enum, used by validation at runtime.
export const TASK_STATUSES = Object.values(TaskStatus);

// A task exactly as the database returns it. JSON turns the Date fields into ISO strings on the way out.
export type Task = TaskRow;

// What a client sends to create a task. The server owns the id, the owner and the timestamps. status
// defaults to 'todo' and priority to 2 in the database.
export type CreateTaskInput = {
  title: string;
  description?: string;
  status?: TaskStatus;
  // 1 (high) to 3 (low).
  priority?: number;
  // null means "no due date".
  dueDate?: Date | null;
};

// What a client sends to change a task: any subset of the creatable fields.
export type UpdateTaskInput = Partial<CreateTaskInput>;

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

// The fields a list can be sorted by. A list of names, not any column the client types, so a
// client cannot sort by something that is not meant to be public.
export const SORT_FIELDS = ['createdAt', 'title', 'priority', 'dueDate', 'status'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// GET /api/v1/tasks after validation: every field has a value, either the client's or the default.
export type ListTasksQuery = {
  status?: TaskStatus;
  // Matches tasks whose title or description contains this text.
  q?: string;
  sortBy: SortField;
  order: SortOrder;
  // 1-based.
  page: number;
  pageSize: number;
};

export type PageMeta = {
  page: number;
  pageSize: number;
  // Tasks matching the filters, across all pages.
  total: number;
  totalPages: number;
};

export type TaskPage = { data: Task[]; meta: PageMeta };
