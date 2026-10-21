// Module 5 output, changed in Module 7 and again in Module 8: the five task handlers (list, create, get, update, delete).
// Nothing to run here. tasks.routes.ts maps URLs to them. Success: `npm run bruno` passes against a running server.
import type { Request, Response } from 'express';
import { validOf, type ValidLocals } from '../middleware/validate.ts';
import type {
  createTaskRequest,
  deleteTaskRequest,
  getTaskRequest,
  listTasksRequest,
  updateTaskRequest,
} from '../schemas/task.schemas.ts';
import { taskService } from '../services/task-service.ts';
import type { Task, TaskPage } from '../types/task.ts';

// Handlers hold the logic and know nothing about URLs: tasks.routes.ts decides which URL reaches
// which handler. By the time one runs, validate() has already checked the request and put the
// result in res.locals.valid, so nothing here parses or checks anything. validOf(res) reads it. The
// type of each `valid` is derived from the same schema object the route passes to validate(),
// through ValidLocals<typeof ...>: there is no second, hand-written description of the input to keep
// in step. What the types cannot do is force a route to call validate(): validOf throws a clear
// error if one does not.
//
// There is no try/catch anywhere in this file. In Express 5 a handler that throws, or returns a
// rejected promise, is passed to the error handler for us.

export async function listTasks(
  _req: Request,
  res: Response<TaskPage, ValidLocals<typeof listTasksRequest>>,
): Promise<void> {
  res.status(200).json(await taskService.list(validOf(res).query));
}

export async function createTask(
  _req: Request,
  res: Response<Task, ValidLocals<typeof createTaskRequest>>,
): Promise<void> {
  res.status(201).json(await taskService.create(validOf(res).body));
}

export async function getTask(
  _req: Request,
  res: Response<Task, ValidLocals<typeof getTaskRequest>>,
): Promise<void> {
  res.status(200).json(await taskService.get(validOf(res).params.id));
}

export async function updateTask(
  _req: Request,
  res: Response<Task, ValidLocals<typeof updateTaskRequest>>,
): Promise<void> {
  const { params, body } = validOf(res);
  // A task that does not exist makes Prisma throw P2025, which the error handler turns into a 404.
  res.status(200).json(await taskService.update(params.id, body));
}

export async function deleteTask(
  _req: Request,
  res: Response<never, ValidLocals<typeof deleteTaskRequest>>,
): Promise<void> {
  await taskService.remove(validOf(res).params.id);
  res.sendStatus(204);
}
