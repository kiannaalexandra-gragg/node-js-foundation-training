// Module 5 output: the 404 middleware for unmatched routes.
// Nothing to run here. Registered after every route in app.ts. Success: an unknown URL gets the NOT_FOUND envelope.
import type { NextFunction, Request, Response } from 'express';
import { NotFoundError } from '../errors.ts';

// Runs only when no route answered. It does not respond itself: it hands a NotFoundError to the
// central error handler, so an unknown URL gets the same envelope as every other error.
export function notFound(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
}
