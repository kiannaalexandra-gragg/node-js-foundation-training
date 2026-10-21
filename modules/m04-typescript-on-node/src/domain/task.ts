// Module 4 output: the Task domain types.
// Nothing to run here. Type-check with `npm run typecheck`, exercise with domain.check.ts.

// One list of allowed values is the source of truth: the type is derived from it, so the
// runtime array and the compile-time union cannot drift apart. `as const` keeps each entry a
// literal ('todo') instead of widening to string. A union, not an enum: enums are not
// erasable syntax, so `erasableSyntaxOnly` rejects them.
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Task = {
  readonly id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  readonly createdAt: Date;
  updatedAt: Date;
};

// What a client sends to create a task. The server owns id and the timestamps, so they are
// omitted. status is optional on create (a new task starts as 'todo'), so it is taken out of
// the required part and put back as optional.
export type CreateTaskInput = Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'status'> &
  Partial<Pick<Task, 'status'>>;

// What a client sends to change a task: any subset of the creatable fields.
export type UpdateTaskInput = Partial<CreateTaskInput>;

// A user-defined type guard: `value is TaskStatus` tells the compiler that when this returns
// true, `value` can be treated as a TaskStatus.
export function isTaskStatus(value: unknown): value is TaskStatus {
  return typeof value === 'string' && (TASK_STATUSES as readonly string[]).includes(value);
}

// `satisfies` checks the object against Record<TaskStatus, string> (a missing or misspelled
// key is an error) without widening its type to that Record, so STATUS_LABELS.todo is
// accepted and STATUS_LABELS.nope is an error.
export const STATUS_LABELS = {
  todo: 'To do',
  in_progress: 'In progress',
  done: 'Done',
} satisfies Record<TaskStatus, string>;

// Build a Task from a create input: the server-owned fields are filled in here.
export function createTask(id: string, input: CreateTaskInput, now: Date = new Date()): Task {
  return {
    id,
    title: input.title,
    ...(input.description !== undefined && { description: input.description }),
    status: input.status ?? 'todo',
    createdAt: now,
    updatedAt: now,
  };
}

// Apply an update input to a task, returning a new task. A field that is missing or undefined is
// left alone. Each field is named here on purpose, instead of `{ ...task, ...update }`: a spread
// would copy whatever the object holds, including `undefined` values and keys that are not part
// of UpdateTaskInput (an object held in a variable is not checked for extra properties), so a
// client could blank a required field or overwrite the server-owned id and createdAt.
export function applyTaskUpdate(task: Task, update: UpdateTaskInput, now: Date = new Date()): Task {
  return {
    ...task,
    title: update.title ?? task.title,
    ...(update.description !== undefined && { description: update.description }),
    status: update.status ?? task.status,
    updatedAt: now,
  };
}
