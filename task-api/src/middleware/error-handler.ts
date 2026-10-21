// Module 5 output, extended in Module 7 with Prisma error codes: the central error handler.
// Nothing to run here. Registered last in app.ts. Success: every error response has the fixed envelope, and `npm run bruno` passes.
import type { NextFunction, Request, Response } from 'express';
import { AppError, ConflictError, NotFoundError } from '../errors.ts';
import { Prisma } from '../generated/prisma/client.ts';
import { requestIdOf } from './request-id.ts';

// The one place that builds an error response. Express knows this is an error handler because it
// declares four parameters, so `next` must stay in the signature even when it is only used for the
// headers-already-sent case below.
//
// The body is always { error: { code, message, details?, requestId } }. `details` is present only
// when the error has some (validation errors). Nothing here ever puts a stack trace or the text of
// an unexpected error into the response.

type ErrorBody = {
  error: {
    code: string;
    message: string;
    details?: { path: string; message: string }[];
    requestId: string;
  };
};

// body-parser (inside express.json) throws plain errors with a `type` we can recognise.
function bodyParserType(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string') {
    return err.type;
  }
  return undefined;
}

// Express, its router and body-parser mark an error as the client's fault with a 4xx `status` (the
// router's malformed %-escape error) or `statusCode` as well (body-parser's, from http-errors). A
// bad %-escape in a URL and a body that does not decompress are two examples. Returns that status,
// or undefined for anything else.
function clientErrorStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) return undefined;
  const candidates: unknown[] = [];
  if ('status' in err) candidates.push(err.status);
  if ('statusCode' in err) candidates.push(err.statusCode);
  for (const value of candidates) {
    if (typeof value === 'number' && value >= 400 && value < 500) return value;
  }
  return undefined;
}

// Prisma reports a failed query as a PrismaClientKnownRequestError with a code. Three of the codes
// mean "the request does not fit the data", so they map to client errors. The messages are fixed:
// Prisma's own text holds a code frame of your source and the field names, so it is never sent.
//   P2002  a unique constraint failed (a duplicate)        -> 409 CONFLICT
//   P2025  the record the operation needs does not exist   -> 404 NOT_FOUND
//   P2003  a foreign key constraint failed                 -> 409 CONFLICT
// P2003 is 409 here, not 400: the request was well-formed, and it conflicts with the rows that exist
// (an owner that does not exist, or one that still has tasks). Any other code is a bug or an outage.
function prismaErrorToAppError(err: Prisma.PrismaClientKnownRequestError): AppError | undefined {
  switch (err.code) {
    case 'P2002':
      return new ConflictError('A record with the same unique value already exists');
    case 'P2025':
      return new NotFoundError('Resource not found');
    case 'P2003':
      return new ConflictError('The request refers to, or depends on, a record that conflicts with it');
    default:
      return undefined;
  }
}

// Turns anything thrown into an AppError. Known client errors keep their meaning. Everything else
// is a programmer error and becomes a generic 500 whose message says nothing about the cause.
function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    const mapped = prismaErrorToAppError(err);
    if (mapped !== undefined) return mapped;
  }
  switch (bodyParserType(err)) {
    case 'entity.parse.failed':
      return new AppError(400, 'BAD_REQUEST', 'Request body is not valid JSON');
    case 'entity.too.large':
      return new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }
  // Any other client error keeps its 4xx status. The message is fixed, not the error's own text,
  // which can echo what the client sent.
  const status = clientErrorStatus(err);
  if (status !== undefined) {
    return status === 400
      ? new AppError(400, 'BAD_REQUEST', 'Bad request')
      : new AppError(status, 'CLIENT_ERROR', 'Request could not be processed');
  }
  return new AppError(500, 'INTERNAL_ERROR', 'Internal server error');
}

export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  // Once the response has started we cannot send a new one: let Express close the connection.
  if (res.headersSent) {
    next(err);
    return;
  }

  const appError = toAppError(err);
  const requestId = requestIdOf(res);

  // The full detail of a bug goes to the server log, with the request id, and nowhere else.
  if (appError.statusCode === 500) {
    console.error(`${requestId} ${req.method} ${req.originalUrl} unexpected error:`, err);
  }

  // The spread adds `details` only when there are some, and keeps the keys in the documented order.
  const body: ErrorBody = {
    error: {
      code: appError.code,
      message: appError.message,
      ...(appError.details !== undefined && { details: appError.details }),
      requestId,
    },
  };
  res.status(appError.statusCode).json(body);
}
