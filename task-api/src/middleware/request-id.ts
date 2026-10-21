// Module 5 output: request-ID middleware.
// Nothing to run here. Registered first in app.ts. Success: every response, error or not, carries an X-Request-Id header.
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

// Gives every request an id, so one request can be followed through the logs and matched to the
// error a client received. It must run first: the logger and the error handler both read the id.
//
// An id sent by a caller is reused only when it is short and made of safe characters. Anything
// else is replaced, so a caller cannot push arbitrary text into our logs and headers.
const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/;

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get('x-request-id');
  const id = incoming !== undefined && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}

// res.locals is where Express keeps per-request values for later middleware. It is typed loosely,
// so this one function is the only place that reads the id back and gives it a string type.
export function requestIdOf(res: Response): string {
  const id: unknown = res.locals.requestId;
  return typeof id === 'string' ? id : 'unknown';
}
