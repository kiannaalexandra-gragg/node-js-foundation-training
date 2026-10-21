// Module 5 output: request logging middleware.
// Nothing to run here. Registered in app.ts. Success: the server prints one line per request.
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.ts';
import { requestIdOf } from './request-id.ts';

// One line per request: id, method, URL, status and how long it took. It logs on the response's
// 'finish' event, because the status code does not exist yet when the middleware first runs.
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    if (config.nodeEnv === 'test') return;
    const ms = Number(process.hrtime.bigint() - start) / 1_000_000;
    console.log(
      `${requestIdOf(res)} ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`,
    );
  });
  next();
}
