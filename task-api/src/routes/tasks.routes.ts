// Module 5 output, validation added in Module 8, the complete route in Module 9: the /api/v1/tasks routes (URLs and validation, no logic).
// Nothing to run here. Mounted by routes/index.ts.
import express from 'express';
import {
  completeTask,
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from '../handlers/tasks.handlers.ts';
import { validate } from '../middleware/validate.ts';
import {
  completeTaskRequest,
  createTaskRequest,
  deleteTaskRequest,
  getTaskRequest,
  listTasksRequest,
  updateTaskRequest,
} from '../schemas/task.schemas.ts';

// URLs and what each one accepts. Mounted at /api/v1/tasks by routes/index.ts, so these paths are
// relative to that. validate() runs first, so a handler only ever sees input that passed.
export const tasksRouter = express.Router();

tasksRouter.get('/', validate(listTasksRequest), listTasks);
tasksRouter.post('/', validate(createTaskRequest), createTask);
tasksRouter.get('/:id', validate(getTaskRequest), getTask);
tasksRouter.patch('/:id', validate(updateTaskRequest), updateTask);
tasksRouter.patch('/:id/complete', validate(completeTaskRequest), completeTask);
tasksRouter.delete('/:id', validate(deleteTaskRequest), deleteTask);
