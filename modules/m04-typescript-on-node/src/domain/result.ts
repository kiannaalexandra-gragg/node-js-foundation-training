// Module 4 output: a discriminated-union Result<T, E>.
// Nothing to run here. Type-check with `npm run typecheck`, exercise with domain.check.ts.

// `ok` is the discriminant: checking it narrows the whole object, so `value` is only
// reachable when ok is true and `error` only when it is false.
export type Result<T, E = Error> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// Result<T, never> and Result<never, E> are assignable to any Result<T, E>, so ok(1) fits a
// function declared to return Result<number, string>.
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// Anything can be thrown in JavaScript, so a caught value is `unknown`. Turn it into an Error
// once, here, and keep the original as `cause` when it was not one already. String() can itself
// throw (for Object.create(null), or an object whose toString throws), so it is guarded: this
// function is what lets `attempt` promise that it never throws.
export function toError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown;
  let message: string;
  try {
    message = String(thrown);
  } catch {
    message = 'A value that cannot be converted to a string was thrown';
  }
  return new Error(message, { cause: thrown });
}

// Run an async function and capture a rejection as a Result instead of throwing.
export async function attempt<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
  try {
    return ok(await fn());
  } catch (thrown) {
    return err(toError(thrown));
  }
}

export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result;
}

export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.value : fallback;
}
