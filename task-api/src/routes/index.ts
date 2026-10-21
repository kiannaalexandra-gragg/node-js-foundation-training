// Module 5 output: the /api/v1 router.
// Nothing to run here. Mounted by app.ts.
import express from 'express';
import { tasksRouter } from './tasks.routes.ts';

// Everything under /api/v1. A later version of the API would get its own router next to this one.
export const v1Router = express.Router();

v1Router.use('/tasks', tasksRouter);
