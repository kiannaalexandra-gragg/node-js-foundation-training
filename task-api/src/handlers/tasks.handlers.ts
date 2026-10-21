// Module 5 output, changed in Module 7: the five task handlers (list, create, get, update, delete).
// Nothing to run here. tasks.routes.ts maps URLs to them. Success: `npm run bruno` passes against a running server.
import type { Request, Response } from 'express';
import { taskService } from '../services/task-service.ts';
import type { Task, TaskPage } from '../types/task.ts';
import {
  parseCreateTask,
  parseListQuery,
  parseTaskId,
  parseUpdateTask,
} from '../validation/task-validation.ts';

// Handlers hold the logic and know nothing about URLs: tasks.routes.ts decides which URL reaches
// which handler. They are typed Request<Params, ResBody, ReqBody, Query>. The body and the query
// are `unknown` because they come from the network, and the parse functions turn them into
// something typed.
//
// There is no try/catch anywhere in this file. In Express 5 a handler that throws, or returns a
// rejected promise, is passed to the error handler for us.

type IdParams = { id: string };

export async function listTasks(
  req: Request<object, TaskPage, unknown, Record<string, unknown>>,
  res: Response<TaskPage>,
): Promise<void> {
  const query = parseListQuery(req.query);
  res.status(200).json(await taskService.list(query));
}

export async function createTask(
  req: Request<object, Task, unknown>,
  res: Response<Task>,
): Promise<void> {
  const input = parseCreateTask(req.body);
  res.status(201).json(await taskService.create(input));
}

export async function getTask(req: Request<IdParams, Task>, res: Response<Task>): Promise<void> {
  const id = parseTaskId(req.params.id);
  res.status(200).json(await taskService.get(id));
}

export async function updateTask(
  req: Request<IdParams, Task, unknown>,
  res: Response<Task>,
): Promise<void> {
  const id = parseTaskId(req.params.id);
  const patch = parseUpdateTask(req.body);
  // A task that does not exist makes Prisma throw P2025, which the error handler turns into a 404.
  res.status(200).json(await taskService.update(id, patch));
}

export async function deleteTask(req: Request<IdParams>, res: Response): Promise<void> {
  const id = parseTaskId(req.params.id);
  await taskService.remove(id);
  res.sendStatus(204);
}
