// Module 2 output: Async toolkit with sleep, retry, withTimeout and mapLimit (named exports).
// Nothing to run here. Test it with async-toolkit.check.mjs.

/**
 * Resolve after `ms` milliseconds.
 * @param {number} ms
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new RangeError(`sleep: ms must be a non-negative number, got ${ms}`);
  }
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RetryError extends Error {
  constructor(attempts, options) {
    super(`Gave up after ${attempts} attempt${attempts === 1 ? '' : 's'}`, options);
    this.name = 'RetryError';
    this.attempts = attempts;
  }
}

/**
 * Call `fn` until it succeeds. `retries` is the number of extra tries after the first,
 * so `retries: 2` means at most 3 calls. Waits `delayMs` between tries.
 * Rejects with a RetryError whose `cause` is the last error from `fn`.
 * @template T
 * @param {(attempt: number) => T | Promise<T>} fn  receives the 0-based attempt number
 * @param {{ retries?: number, delayMs?: number }} [options]
 * @returns {Promise<T>}
 */
export async function retry(fn, { retries = 3, delayMs = 100 } = {}) {
  if (!Number.isInteger(retries) || retries < 0) {
    throw new RangeError(`retry: retries must be a non-negative integer, got ${retries}`);
  }
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new RangeError(`retry: delayMs must be a non-negative number, got ${delayMs}`);
  }
  let lastError;
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
  constructor(ms, options) {
    super(`Timed out after ${ms}ms`, options);
    this.name = 'TimeoutError';
    this.ms = ms;
  }
}

/**
 * Settle like `promise`, unless it takes longer than `ms`: then reject with a TimeoutError.
 * This does not cancel the underlying work. A promise cannot be cancelled from outside, so
 * pass an AbortSignal to whatever created it if the work itself must stop.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms) {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new RangeError(`withTimeout: ms must be a non-negative number, got ${ms}`);
  }
  // AbortSignal.timeout's timer is unref'd, so it never keeps the process alive after the
  // promise has settled (a plain setTimeout would, until it fired).
  const signal = AbortSignal.timeout(ms);
  const { promise: timeout, reject } = Promise.withResolvers();
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
 * @template T, R
 * @param {Iterable<T>} items
 * @param {number} limit
 * @param {(item: T, index: number) => R | Promise<R>} fn
 * @returns {Promise<R[]>}
 */
export async function mapLimit(items, limit, fn) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`mapLimit: limit must be an integer >= 1, got ${limit}`);
  }
  const list = [...items];
  const results = new Array(list.length);
  let nextIndex = 0;
  let failed = false;

  // Each worker pulls the next unclaimed index when it finishes its current one, so there
  // are never more than `limit` calls in flight. `nextIndex++` has no `await` in between
  // reading and bumping it, so two workers can never claim the same item.
  async function worker() {
    while (!failed && nextIndex < list.length) {
      const index = nextIndex++;
      try {
        results[index] = await fn(list[index], index);
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
