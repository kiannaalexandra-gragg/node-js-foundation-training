// Module 5 output: the in-memory task store.
// Nothing to run here. Used by the handlers. Success: tasks survive between requests and are gone after a restart.
import { randomUUID } from 'node:crypto';
import type { CreateTaskInput, Task, TaskStatus, UpdateTaskInput } from '../types/task.ts';

// The in-memory store: a Map that lives as long as the process. Restarting the server empties it.
//
// Every method is async even though a Map is synchronous. The handlers are written against a
// promise-returning store now, so M07 can swap in Prisma without touching them, and a rejected
// promise really does reach the error handler through Express 5 (no try/catch needed).
const tasks = new Map<string, Task>();

export const taskStore = {
  async list(status?: TaskStatus): Promise<Task[]> {
    const all = [...tasks.values()];
    return (status === undefined ? all : all.filter((task) => task.status === status)).map(
      (task) => ({ ...task }),
    );
  },

  async get(id: string): Promise<Task | undefined> {
    const task = tasks.get(id);
    return task === undefined ? undefined : { ...task };
  },

  async create(input: CreateTaskInput): Promise<Task> {
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      status: input.status ?? 'todo',
    };
    if (input.description !== undefined) task.description = input.description;
    tasks.set(task.id, task);
    return { ...task };
  },

  async update(id: string, patch: UpdateTaskInput): Promise<Task | undefined> {
    const existing = tasks.get(id);
    if (existing === undefined) return undefined;
    const updated: Task = { ...existing, ...patch };
    tasks.set(id, updated);
    return { ...updated };
  },

  async remove(id: string): Promise<boolean> {
    return tasks.delete(id);
  },
};
