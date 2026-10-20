// Module 3 support file: generates the practice log that the log-report CLI reads (deliverable 1 of 2).
// Run from modules/m03-nodejs-runtime-npm: npm run generate-log
// Options: --size-mb 5 (default 100), --seed 2 (default 1), --out /tmp/small.log (default data/access.log)
// Success: "Wrote 2231981 lines, 100.0 MB, to <path>/data/access.log in ~2s (seed 1)".
//
// One record per line: `<ISO timestamp> <METHOD> <path> <status> <duration ms>`. The same seed always
// writes the same file, so everyone's report can be compared. About one line in a thousand is
// deliberately garbled, so the CLI has to cope with bad input.
import { createWriteStream } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { finished } from 'node:stream/promises';
import { parseArgs } from 'node:util';

let values;
try {
  ({ values } = parseArgs({
    options: {
      out: { type: 'string', short: 'o', default: path.join(import.meta.dirname, '..', '..', 'data', 'access.log') },
      'size-mb': { type: 'string', default: '100' },
      seed: { type: 'string', default: '1' },
    },
  }));
} catch (error) {
  // parseArgs throws on an unknown flag or a missing value. Turn that into a usage error, exit 2.
  console.error(`generate-log: ${error.message}`);
  process.exit(2);
}

const sizeMb = Number(values['size-mb']);
const seed = Number(values.seed);
if (!Number.isFinite(sizeMb) || sizeMb <= 0 || !Number.isInteger(seed)) {
  console.error('generate-log: --size-mb must be a positive number and --seed an integer');
  process.exit(2);
}
const targetBytes = Math.round(sizeMb * 1024 * 1024);

// A small, fast, seedable random number generator (mulberry32). Math.random cannot be seeded.
function makeRandom(initial) {
  let state = initial >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = makeRandom(seed);

// Pick one entry from a list of [value, weight] pairs.
function weighted(entries) {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = random() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll < 0) return value;
  }
  return entries.at(-1)[0];
}

const ROUTES = [
  [['GET', '/'], 20],
  [['GET', '/api/tasks'], 25],
  [['POST', '/api/tasks'], 8],
  [['GET', '/api/tasks/1'], 6],
  [['GET', '/api/tasks/2'], 5],
  [['GET', '/api/tasks/3'], 4],
  [['PUT', '/api/tasks/1'], 3],
  [['DELETE', '/api/tasks/2'], 2],
  [['GET', '/api/users'], 7],
  [['GET', '/api/users/me'], 6],
  [['POST', '/api/login'], 5],
  [['POST', '/api/logout'], 2],
  [['GET', '/health'], 9],
  [['GET', '/static/app.js'], 6],
  [['GET', '/static/app.css'], 5],
  [['GET', '/favicon.ico'], 3],
  [['GET', '/admin'], 1],
  [['GET', '/api/reports'], 2],
];
const STATUSES = [
  [200, 70],
  [201, 5],
  [204, 3],
  [301, 2],
  [304, 6],
  [400, 3],
  [401, 2],
  [404, 5],
  [500, 2.5],
  [503, 1.5],
];

const START_MS = Date.UTC(2026, 0, 1);
let clock = START_MS;

function makeLine() {
  clock += Math.floor(random() * 60);
  const timestamp = new Date(clock).toISOString();
  const [method, route] = weighted(ROUTES);
  const status = weighted(STATUSES);
  const durationMs = 1 + Math.floor(random() * random() * 900);
  const line = `${timestamp} ${method} ${route} ${status} ${durationMs}`;
  if (random() < 0.001) {
    // Garbled records: cut short, wrong field type, or not a log line at all.
    return weighted([
      [line.slice(0, 20 + Math.floor(random() * 15)), 1],
      [`${timestamp} ${method} ${route} OK ${durationMs}`, 1],
      ['-- connection reset by peer --', 1],
    ]);
  }
  return line;
}

await mkdir(path.dirname(values.out), { recursive: true });
const output = createWriteStream(values.out);

let bytes = 0;
let lines = 0;
const startedAt = performance.now();
while (bytes < targetBytes) {
  // Build roughly 64 KB at a time, so the file is written in chunks, not line by line.
  const chunk = [];
  let chunkBytes = 0;
  while (chunkBytes < 64 * 1024 && bytes + chunkBytes < targetBytes) {
    const line = makeLine() + '\n';
    chunk.push(line);
    chunkBytes += line.length; // every character here is ASCII, so length equals bytes
    lines++;
  }
  bytes += chunkBytes;
  // write() returns false when its internal buffer is full. Wait for 'drain' before writing more,
  // otherwise the whole file piles up in memory, which is the thing this lab is about avoiding.
  if (!output.write(chunk.join(''))) await once(output, 'drain');
}
output.end();
await finished(output);

const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
console.log(`Wrote ${lines} lines, ${(bytes / 1024 / 1024).toFixed(1)} MB, to ${values.out} in ${seconds}s (seed ${seed})`);
