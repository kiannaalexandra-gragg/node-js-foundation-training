// Module 2 output: self-checks for the Async toolkit.
// Run from the repo root: node modules/m02-modern-javascript-async-await/async-toolkit.check.mjs
// Success: 23 "ok - ..." lines and no error.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { sleep, retry, RetryError, withTimeout, TimeoutError, mapLimit } from './async-toolkit.mjs';

const run = promisify(execFile);

async function check(name, fn) {
  await fn();
  console.log(`ok - ${name}`);
}

await check('sleep waits at least the requested time', async () => {
  const start = performance.now();
  await sleep(50);
  const elapsed = performance.now() - start;
  // setTimeout can fire a hair early against performance.now(), so allow 5ms of slack.
  assert.ok(elapsed >= 45, `expected >= 45ms, got ${elapsed.toFixed(1)}ms`);
});

await check('sleep resolves with undefined', async () => {
  assert.equal(await sleep(1), undefined);
});

await check('sleep rejects bad input synchronously', () => {
  assert.throws(() => sleep(-1), RangeError);
  assert.throws(() => sleep('soon'), RangeError);
});

await check('retry returns the first success without retrying', async () => {
  let calls = 0;
  const result = await retry(async () => {
    calls++;
    return 'done';
  }, { retries: 3, delayMs: 1 });
  assert.equal(result, 'done');
  assert.equal(calls, 1);
});

await check('retry retries an async rejection until it succeeds', async () => {
  const attempts = [];
  const result = await retry(async (attempt) => {
    attempts.push(attempt);
    if (attempt < 2) throw new Error(`fail ${attempt}`);
    return 'third time lucky';
  }, { retries: 3, delayMs: 1 });
  assert.equal(result, 'third time lucky');
  assert.deepEqual(attempts, [0, 1, 2]);
});

await check('retry gives up with a RetryError that keeps the last error as cause', async () => {
  let calls = 0;
  await assert.rejects(
    retry(async () => {
      calls++;
      throw new Error(`boom ${calls}`);
    }, { retries: 2, delayMs: 1 }),
    (error) => {
      assert.ok(error instanceof RetryError);
      assert.equal(error.attempts, 3);
      assert.equal(error.cause.message, 'boom 3');
      return true;
    },
  );
  assert.equal(calls, 3);
});

await check('retry waits delayMs between tries but not after the last one', async () => {
  const start = performance.now();
  await assert.rejects(retry(async () => { throw new Error('x'); }, { retries: 2, delayMs: 40 }));
  const elapsed = performance.now() - start;
  // 3 attempts -> 2 waits of 40ms = 80ms. A wait after the last attempt would make it ~120ms.
  assert.ok(elapsed >= 75, `expected >= 75ms, got ${elapsed.toFixed(1)}ms`);
  assert.ok(elapsed < 115, `expected < 115ms, got ${elapsed.toFixed(1)}ms`);
});

await check('retry with retries: 0 calls fn exactly once', async () => {
  let calls = 0;
  await assert.rejects(retry(async () => { calls++; throw new Error('x'); }, { retries: 0 }), RetryError);
  assert.equal(calls, 1);
});

await check('retry rejects a bad retries option', async () => {
  await assert.rejects(retry(async () => {}, { retries: -1 }), RangeError);
});

await check('retry rejects a bad delayMs even when fn would succeed first time', async () => {
  let calls = 0;
  await assert.rejects(retry(async () => { calls++; }, { delayMs: -1 }), RangeError);
  await assert.rejects(retry(async () => { calls++; }, { delayMs: 'soon' }), RangeError);
  assert.equal(calls, 0); // fn is never called with invalid options
});

await check('withTimeout passes through a value that arrives in time', async () => {
  const value = await withTimeout(sleep(10).then(() => 'fast'), 200);
  assert.equal(value, 'fast');
});

await check('withTimeout rejects with a TimeoutError when the promise is too slow', async () => {
  const start = performance.now();
  await assert.rejects(withTimeout(sleep(500), 40), (error) => {
    assert.ok(error instanceof TimeoutError);
    assert.equal(error.ms, 40);
    return true;
  });
  assert.ok(performance.now() - start < 300, 'should reject near 40ms, not wait for the 500ms promise');
});

await check('withTimeout passes through the original rejection unchanged', async () => {
  const original = new Error('original failure');
  await assert.rejects(withTimeout(Promise.reject(original), 200), (error) => error === original);
});

await check('withTimeout survives the slow promise rejecting after the timeout', async () => {
  // Promise.race has already attached handlers, so this late rejection must not become unhandled.
  const late = sleep(80).then(() => { throw new Error('too late'); });
  await assert.rejects(withTimeout(late, 20), TimeoutError);
  await sleep(120);
});

await check('withTimeout does not keep the process alive after the promise settles', async () => {
  const code = `
    import { withTimeout, sleep } from ${JSON.stringify(new URL('./async-toolkit.mjs', import.meta.url).href)};
    await withTimeout(sleep(5), 10_000);
  `;
  const start = performance.now();
  await run(process.execPath, ['--input-type=module', '--eval', code]);
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 3000, `child took ${elapsed.toFixed(0)}ms, a lingering 10s timer would be ~10000ms`);
});

await check('withTimeout rejects a bad ms synchronously', () => {
  assert.throws(() => withTimeout(sleep(1), -5), RangeError);
});

await check('mapLimit keeps results in input order even when calls finish out of order', async () => {
  // Earlier items sleep longer, so they finish last.
  const results = await mapLimit([30, 20, 10, 0], 4, async (ms, index) => {
    await sleep(ms);
    return `${index}:${ms}`;
  });
  assert.deepEqual(results, ['0:30', '1:20', '2:10', '3:0']);
});

await check('mapLimit never runs more than `limit` calls at once, and does reach the limit', async () => {
  let running = 0;
  let peak = 0;
  const results = await mapLimit([...Array(10).keys()], 3, async (n) => {
    running++;
    peak = Math.max(peak, running);
    await sleep(15);
    running--;
    return n * 2;
  });
  assert.equal(peak, 3);
  assert.deepEqual(results, [0, 2, 4, 6, 8, 10, 12, 14, 16, 18]);
});

await check('mapLimit with limit 1 is sequential', async () => {
  const order = [];
  await mapLimit([1, 2, 3], 1, async (n) => {
    order.push(`start ${n}`);
    await sleep(5);
    order.push(`end ${n}`);
  });
  assert.deepEqual(order, ['start 1', 'end 1', 'start 2', 'end 2', 'start 3', 'end 3']);
});

await check('mapLimit passes the index and accepts a sync fn and any iterable', async () => {
  const results = await mapLimit(new Set(['a', 'b']), 2, (item, index) => `${item}${index}`);
  assert.deepEqual(results, ['a0', 'b1']);
});

await check('mapLimit handles an empty input and a limit larger than the input', async () => {
  assert.deepEqual(await mapLimit([], 5, async (x) => x), []);
  assert.deepEqual(await mapLimit([1, 2], 50, async (x) => x + 1), [2, 3]);
});

await check('mapLimit rejects with the first error and starts no new work after it', async () => {
  const started = [];
  await assert.rejects(
    mapLimit([0, 1, 2, 3, 4, 5], 2, async (n) => {
      started.push(n);
      await sleep(10);
      if (n === 1) throw new Error('item 1 failed');
      return n;
    }),
    /item 1 failed/,
  );
  await sleep(60); // give a runaway worker time to start more items, if it were going to
  assert.deepEqual(started, [0, 1, 2]);
});

await check('mapLimit rejects a bad limit', async () => {
  await assert.rejects(mapLimit([1], 0, async (x) => x), RangeError);
  await assert.rejects(mapLimit([1], 1.5, async (x) => x), RangeError);
});
