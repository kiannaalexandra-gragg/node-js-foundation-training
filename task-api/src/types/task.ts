// Module 5 output, changed in Module 7 and Module 8: the Task types for Task API v3.
// Nothing to run here. Type-check with `npm run typecheck`.

// In v1 these types were written by hand. In v2 the database owns the shape of a task, so the types
// come from the Prisma schema and cannot drift from it: change schema.prisma, run `npm run
// db:generate`, and the compiler shows every place that needs to follow. In v3 the request types
// come from the Zod schemas in the same way.
import type { Task as TaskRow } from '../generated/prisma/client.ts';
import type { TaskStatus } from '../generated/prisma/enums.ts';

export type { TaskStatus };

// A task exactly as the database returns it. JSON turns the Date fields into ISO strings on the way out.
export type Task = TaskRow;

// What a client sends to create or change a task, and the query a list accepts, are not described
// here any more. They are derived from the Zod schemas in schemas/task.schemas.ts, so the rules and
// the types are one thing.

export type PageMeta = {
  page: number;
  pageSize: number;
  // Tasks matching the filters, across all pages.
  total: number;
  totalPages: number;
};

export type TaskPage = { data: Task[]; meta: PageMeta };
