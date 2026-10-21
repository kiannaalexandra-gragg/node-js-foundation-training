// Module 5 output: the Task types for Task API v1.
// Nothing to run here. Type-check with `npm run typecheck`.

// The Task domain for Task API v1, carried over from M04. The program's API contract fixes the
// fields at id, title, description (optional) and status, so the M04 timestamps are left out until
// M07, where the database owns them.

// One list of allowed values is the source of truth: the type is derived from it, so the runtime
// array (used by validation) and the compile-time union cannot drift apart.
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Task = {
  readonly id: string;
  title: string;
  description?: string;
  status: TaskStatus;
};

// What a client sends to create a task. The server owns the id, and status defaults to 'todo'.
export type CreateTaskInput = Omit<Task, 'id' | 'status'> & Partial<Pick<Task, 'status'>>;

// What a client sends to change a task: any subset of the creatable fields.
export type UpdateTaskInput = Partial<CreateTaskInput>;

export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}
