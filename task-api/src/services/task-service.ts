// Module 7 output: the task service, the Prisma-backed replacement for the M05 in-memory store.
// Nothing to run here. Used by the handlers. Success: tasks survive a server restart, and `npm run bruno` passes.
import { NotFoundError } from '../errors.ts';
import { prisma } from '../db.ts';
import type { Prisma } from '../generated/prisma/client.ts';
import type {
  CreateTaskInput,
  ListTasksQuery,
  Task,
  TaskPage,
  UpdateTaskInput,
} from '../types/task.ts';

// The service holds every database call for tasks, so handlers know nothing about Prisma and a
// change to the data layer stays in this file. It keeps the shape of the M05 store (list, get,
// create, update, remove), so the handlers changed very little when the store was swapped out.
//
// The API has no users yet, so every task created through it belongs to this one owner. The
// owner is created by the add_task_owner migration and by the seed script.
export const DEFAULT_OWNER_EMAIL = 'owner@example.com';

export const taskService = {
  async list(query: ListTasksQuery): Promise<TaskPage> {
    const { status, q, sortBy, order, page, pageSize } = query;

    // Built piece by piece so only the filters the client sent end up in the query. `contains`
    // becomes SQL LIKE '%q%'. SQLite's LIKE ignores case for ASCII letters, so 'fix' finds 'Fix'.
    const where: Prisma.TaskWhereInput = {};
    if (status !== undefined) where.status = status;
    if (q !== undefined) {
      where.OR = [{ title: { contains: q } }, { description: { contains: q } }];
    }

    // The id is a tie-breaker. Without it, two tasks with the same sort value could swap places
    // between two requests, and a task could appear on two pages or on none.
    const orderBy: Prisma.TaskOrderByWithRelationInput[] = [{ [sortBy]: order }, { id: 'asc' }];

    // One transaction for both reads, so `total` describes the same rows `data` was cut from.
    const [data, total] = await prisma.$transaction([
      prisma.task.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.task.count({ where }),
    ]);

    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  },

  async get(id: string): Promise<Task> {
    const task = await prisma.task.findUnique({ where: { id } });
    if (task === null) throw new NotFoundError(`Task ${id} not found`);
    return task;
  },

  async create(input: CreateTaskInput): Promise<Task> {
    const owner = await prisma.user.findUnique({ where: { email: DEFAULT_OWNER_EMAIL } });
    // Not a client mistake: the database was not migrated or seeded. A plain Error becomes a 500.
    if (owner === null) {
      throw new Error(`Default owner ${DEFAULT_OWNER_EMAIL} is missing: run the migrations`);
    }
    return prisma.task.create({ data: { ...input, userId: owner.id } });
  },

  // update and remove do not look the task up first. Prisma throws a P2025 error when the row does
  // not exist, and the central error handler turns that into the same 404 the handlers used to throw.
  async update(id: string, patch: UpdateTaskInput): Promise<Task> {
    return prisma.task.update({ where: { id }, data: patch });
  },

  async remove(id: string): Promise<void> {
    await prisma.task.delete({ where: { id } });
  },
};
