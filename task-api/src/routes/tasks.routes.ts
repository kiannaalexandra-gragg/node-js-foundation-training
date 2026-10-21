// Module 5 output: the /api/v1/tasks routes (URLs only, no logic).
// Nothing to run here. Mounted by routes/index.ts.
import express from 'express';
import {
  createTask,
  deleteTask,
  getTask,
  listTasks,
  updateTask,
} from '../handlers/tasks.handlers.ts';

// URLs only. Mounted at /api/v1/tasks by routes/index.ts, so these paths are relative to that.
export const tasksRouter = express.Router();

tasksRouter.get('/', listTasks);
tasksRouter.post('/', createTask);
tasksRouter.get('/:id', getTask);
tasksRouter.patch('/:id', updateTask);
tasksRouter.delete('/:id', deleteTask);
