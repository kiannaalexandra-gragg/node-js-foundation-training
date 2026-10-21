// Module 5 output: the simple API-key check for /api/v1.
// Nothing to run here. Registered in app.ts. Success: a request without a valid X-API-Key header gets a 401.
import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.ts';
import { UnauthorizedError } from '../errors.ts';

// A simple API-key check, nothing more: it is not user authentication. The caller sends the key in
// the X-API-Key header.
//
// Both keys are hashed first so timingSafeEqual always compares two buffers of the same length (it
// throws on different lengths), and the comparison time does not leak how much of the key matched.
function sameKey(received: string, expected: string): boolean {
  const a = createHash('sha256').update(received).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function apiKeyAuth(req: Request, _res: Response, next: NextFunction): void {
  const key = req.get('x-api-key');
  if (key === undefined || !sameKey(key, config.apiKey)) {
    // The same message for a missing and a wrong key, so it does not say which one it was.
    next(new UnauthorizedError('Missing or invalid API key'));
    return;
  }
  next();
}
