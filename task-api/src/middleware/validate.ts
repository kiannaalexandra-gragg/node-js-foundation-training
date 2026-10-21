// Module 8 output: the typed validate({ params, body, query }) middleware, and validOf for the handlers.
// Nothing to run here. Used by routes/tasks.routes.ts and the handlers. Success: a bad request becomes a 400 VALIDATION_ERROR before the handler runs, and a good one reaches it with typed data in res.locals.valid.
import type { Request, RequestHandler, Response } from 'express';
import type { z } from 'zod';

// One schema for each part of the request that carries untrusted data. All three are optional: a
// route validates only the parts it reads.
type Schemas = { params?: z.ZodType; body?: z.ZodType; query?: z.ZodType };

// Any key other than params, body and query is refused at compile time. Without this a typo such as
// `qurey` would compile, be typed as parsed data by Valid<S>, and never run, because the loop below
// only visits the three known parts.
type OnlyKnownParts<S> = { [K in Exclude<keyof S, keyof Schemas>]: never };

// What a handler gets: the output of each schema that was given, under the same name. The types are
// z.output, so they are what the schema produced after defaults, coercion and trimming, not what
// the client sent.
export type Valid<S extends Schemas> = {
  [K in keyof S]: S[K] extends z.ZodType ? z.output<S[K]> : never;
};
export type ValidLocals<S extends Schemas> = { valid: Valid<S> };

// params first, then the body, then the query: the order v2's handlers checked them in, so a request
// with a bad id and a bad body still reports only the id. Each part reports all of its own problems.
const PARTS = ['params', 'body', 'query'] as const;

// Express 5 makes req.query a read-only getter, so the parsed query cannot be assigned back to it.
// The parsed values go on res.locals instead, which Express gives every request for exactly this:
// data for the rest of the request. req.body and req.params are left as the client sent them.
//
// A failure is passed to next() as the ZodError itself. The central error handler is the one place
// that turns it into the 400 envelope, like every other error.
export function validate<S extends Schemas>(
  schemas: S & OnlyKnownParts<S>,
): RequestHandler<Request['params'], unknown, unknown, Request['query'], ValidLocals<S>> {
  return (req, res, next) => {
    const valid: Record<string, unknown> = {};
    for (const part of PARTS) {
      const schema = schemas[part];
      if (schema === undefined) continue;
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        next(result.error);
        return;
      }
      valid[part] = result.data;
    }
    res.locals.valid = valid as Valid<S>;
    next();
  };
}

// How a handler reads what validate() parsed. The type of `res` ties a handler to one request schema
// object, but the compiler cannot tell whether a route actually put validate() in front of it, and
// Express accepts a handler mounted without it. So the read is checked at runtime too: a missing
// validate() is a bug in the routes, and it says so in the server log (a 500 to the client, never a
// quiet pass-through of unvalidated input).
export function validOf<V, B>(res: Response<B, { valid: V }>): V {
  const valid: V | undefined = res.locals.valid;
  if (valid === undefined) {
    throw new Error('res.locals.valid is missing: this handler is mounted without validate()');
  }
  return valid;
}
