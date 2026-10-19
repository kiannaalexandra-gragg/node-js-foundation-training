// Module 2 output: sequential vs parallel fetch timing against JSONPlaceholder (needs internet).
// Run from the repo root: node modules/m02-modern-javascript-async-await/timing-comparison.mjs [rounds]
// Success: a timing table (3 rounds by default) and a one-line summary. Parallel is usually faster,
// but network conditions vary, so the script reports the result instead of requiring it.
import assert from 'node:assert/strict';

const BASE_URL = 'https://jsonplaceholder.typicode.com';
const IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ROUNDS = Number(process.argv[2] ?? 3);

if (!Number.isInteger(ROUNDS) || ROUNDS < 1) {
  throw new Error('Rounds must be a positive integer.');
}

async function fetchPost(id) {
  // AbortSignal.timeout actually cancels the request if the server hangs.
  const response = await fetch(`${BASE_URL}/posts/${id}`, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`GET /posts/${id} failed with ${response.status}`);
  return response.json();
}

// One request at a time: each await finishes before the next fetch starts.
async function fetchSequential() {
  const posts = [];
  for (const id of IDS) {
    posts.push(await fetchPost(id));
  }
  return posts;
}

// All requests start immediately; Promise.all waits for the slowest one.
async function fetchParallel() {
  return Promise.all(IDS.map((id) => fetchPost(id)));
}

async function timed(label, fn) {
  const start = performance.now();
  const posts = await fn();
  const ms = performance.now() - start;
  assert.deepEqual(posts.map((post) => post.id), IDS, `${label} returned the wrong posts`);
  return ms;
}

console.log(`Fetching ${IDS.length} posts from ${BASE_URL}, ${ROUNDS} rounds`);
console.log('round  sequential(ms)  parallel(ms)');
const sequentialTimes = [];
const parallelTimes = [];
for (let round = 1; round <= ROUNDS; round++) {
  // await in a loop is intended here: rounds must not overlap or they would skew each other.
  const sequential = await timed('sequential', fetchSequential);
  const parallel = await timed('parallel', fetchParallel);
  sequentialTimes.push(sequential);
  parallelTimes.push(parallel);
  console.log(`${String(round).padStart(5)}  ${sequential.toFixed(0).padStart(14)}  ${parallel.toFixed(0).padStart(12)}`);
}

const total = (times) => times.reduce((sum, ms) => sum + ms, 0);
const sequentialTotal = total(sequentialTimes);
const parallelTotal = total(parallelTimes);
console.log(`total  ${sequentialTotal.toFixed(0).padStart(14)}  ${parallelTotal.toFixed(0).padStart(12)}`);
if (parallelTotal < sequentialTotal) {
  console.log(`Parallel was ${(sequentialTotal / parallelTotal).toFixed(1)}x faster overall.`);
} else {
  console.log(
    'Parallel was not faster in these measurements. Network variability may affect the result; try again.',
  );
}
