// Module 4 output: the M02 async toolkit ported to strict TypeScript (named exports).
// Nothing to run here. Test it with async-toolkit.check.ts.

export function sleep(ms: number): Promise<void> {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new RangeError(`sleep: ms must be a non-negative number, got ${ms}`);
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RetryError extends Error {
  // Declared as a field, not a constructor parameter property (`public attempts`): parameter
  // properties are not erasable syntax, so `erasableSyntaxOnly` rejects them.
  readonly attempts: number;

  constructor(attempts: number, options?: ErrorOptions) {
    super(`Gave up after ${attempts} attempt${attempts === 1 ? '' : 's'}`, options);
    this.name = 'RetryError';
    this.attempts = attempts;
  }
}

export type RetryOptions = {
  retries?: number;
  delayMs?: number;
};

/**
 * Call `fn` until it succeeds. `retries` is the number of extra tries after the first,
 * so `retries: 2` means at most 3 calls. Waits `delayMs` between tries.
 * Rejects with a RetryError whose `cause` is the last error from `fn`.
 * `fn` receives the 0-based attempt number.
 */
export async function retry<T>(
  fn: (attempt: number) => T | Promise<T>,
  { retries = 3, delayMs = 100 }: RetryOptions = {},
): Promise<T> {
  if (!Number.isInteger(retries) || retries < 0) {
    throw new RangeError(`retry: retries must be a non-negative integer, got ${retries}`);
  }
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new RangeError(`retry: delayMs must be a non-negative number, got ${delayMs}`);
  }
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // `return await`, not `return`: without the await a rejection skips this catch.
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      // The await inside this loop is deliberate: each try must finish before the next starts.
      if (attempt < retries) await sleep(delayMs);
    }
  }
  throw new RetryError(retries + 1, { cause: lastError });
}

export class TimeoutError extends Error {
  readonly ms: number;

  constructor(ms: number, options?: ErrorOptions) {
    super(`Timed out after ${ms}ms`, options);
    this.name = 'TimeoutError';
    this.ms = ms;
  }
}

/**
 * Settle like `promise`, unless it takes longer than `ms`: then reject with a TimeoutError.
 * This does not cancel the underlying work. A promise cannot be cancelled from outside, so
 * pass an AbortSignal to whatever created it if the work itself must stop.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new RangeError(`withTimeout: ms must be a non-negative number, got ${ms}`);
  }
  // AbortSignal.timeout's timer is unref'd, so it never keeps the process alive after the
  // promise has settled (a plain setTimeout would, until it fired).
  const signal = AbortSignal.timeout(ms);
  const { promise: timeout, reject } = Promise.withResolvers<never>();
  const onAbort = () => reject(new TimeoutError(ms, { cause: signal.reason }));
  signal.addEventListener('abort', onAbort, { once: true });
  return Promise.race([promise, timeout]).finally(() => {
    signal.removeEventListener('abort', onAbort);
  });
}

/**
 * Like `items.map(fn)` but runs at most `limit` calls of `fn` at the same time.
 * Results keep the order of `items`. If any call rejects, mapLimit rejects with that error
 * and starts no new calls (calls already running are left to finish on their own).
 */
export async function mapLimit<T, R>(
  items: Iterable<T>,
  limit: number,
  fn: (item: T, index: number) => R | Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`mapLimit: limit must be an integer >= 1, got ${limit}`);
  }
  const list = [...items];
  const results = new Array<R>(list.length);
  // One shared iterator of [index, item] pairs. Each worker takes the next pair when it
  // finishes its current one, so there are never more than `limit` calls in flight, and two
  // workers can never take the same pair. Iterating, rather than reading list[index], means
  // `item` is a T and not a `T | undefined` under noUncheckedIndexedAccess.
  const pairs = list.entries();
  let failed = false;

  async function worker(): Promise<void> {
    while (!failed) {
      const next = pairs.next();
      if (next.done) return;
      const [index, item] = next.value;
      try {
        results[index] = await fn(item, index);
      } catch (error) {
        failed = true;
        throw error;
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, list.length) }, worker);
  await Promise.all(workers);
  return results;
}
