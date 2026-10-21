// Module 5 output: the five task handlers (list, create, get, update, delete).
// Nothing to run here. tasks.routes.ts maps URLs to them. Success: `npm run bruno` passes against a running server.
import type { Request, Response } from 'express';
import { NotFoundError } from '../errors.ts';
import { taskStore } from '../store/task-store.ts';
import type { Task } from '../types/task.ts';
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
  req: Request<object, Task[], unknown, { status?: unknown }>,
  res: Response<Task[]>,
): Promise<void> {
  const { status } = parseListQuery(req.query);
  res.status(200).json(await taskStore.list(status));
}

export async function createTask(
  req: Request<object, Task, unknown>,
  res: Response<Task>,
): Promise<void> {
  const input = parseCreateTask(req.body);
  res.status(201).json(await taskStore.create(input));
}

export async function getTask(req: Request<IdParams, Task>, res: Response<Task>): Promise<void> {
  const id = parseTaskId(req.params.id);
  const task = await taskStore.get(id);
  if (task === undefined) throw new NotFoundError(`Task ${id} not found`);
  res.status(200).json(task);
}

export async function updateTask(
  req: Request<IdParams, Task, unknown>,
  res: Response<Task>,
): Promise<void> {
  const id = parseTaskId(req.params.id);
  const patch = parseUpdateTask(req.body);
  const task = await taskStore.update(id, patch);
  if (task === undefined) throw new NotFoundError(`Task ${id} not found`);
  res.status(200).json(task);
}

export async function deleteTask(req: Request<IdParams>, res: Response): Promise<void> {
  const id = parseTaskId(req.params.id);
  const removed = await taskStore.remove(id);
  if (!removed) throw new NotFoundError(`Task ${id} not found`);
  res.sendStatus(204);
}
