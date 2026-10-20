// Module 3 output, deliverable 1 of 2 (log-report CLI): self-checks for aggregate.js.
// Run from modules/m03-nodejs-runtime-npm: node src/log-report/aggregate.check.js
// Success: 6 "ok - ..." lines and no error.
import assert from 'node:assert/strict';
import { aggregateLines, parseLine } from './aggregate.js';

async function check(name, fn) {
  await fn();
  console.log(`ok - ${name}`);
}

const GOOD = '2026-01-01T00:00:00.037Z GET /api/tasks 200 856';

await check('parseLine reads a well-formed record', () => {
  assert.deepEqual(parseLine(GOOD), {
    timestamp: '2026-01-01T00:00:00.037Z',
    method: 'GET',
    path: '/api/tasks',
    status: '200',
    durationMs: 856,
  });
});

await check('parseLine returns null for every kind of bad line', () => {
  const bad = [
    '',
    '-- connection reset by peer --',
    '2026-01-01T00:00:00.037Z GET /api/tasks 200', // a field is missing
    '2026-01-01T00:00:00.037Z GET /api/tasks OK 856', // status is not a number
    '2026-01-01T00:00:00.037Z GET /api/tasks 700 856', // not an HTTP status class
    'not-a-date GET /api/tasks 200 856',
    '2026-01-01T00:00:00.037Z get /api/tasks 200 856', // method must be upper case
    '2026-01-01T00:00:00.037Z GET api/tasks 200 856', // path must start with /
    '2026-01-01T00:00:00.037Z GET /api/tasks 200 -5', // negative duration
    `${GOOD} extra`,
  ];
  for (const line of bad) assert.equal(parseLine(line), null, `expected null for "${line}"`);
});

const SAMPLE = [
  '2026-01-01T00:00:00.001Z GET /a 200 10',
  '2026-01-01T00:00:00.002Z GET /b 404 20',
  '2026-01-01T00:00:00.003Z POST /a 201 30',
  '',
  'garbage',
  '2026-01-01T00:00:00.004Z GET /b 500 40',
  '2026-01-01T00:00:00.005Z GET /c 200 50',
];

await check('aggregateLines counts statuses, classes, methods and paths', async () => {
  const report = await aggregateLines(SAMPLE);
  assert.equal(report.totalLines, 6, 'the blank line is skipped, the garbage line counts');
  assert.equal(report.malformedLines, 1);
  assert.equal(report.parsedLines, 5);
  assert.deepEqual(report.byStatus, { 200: 2, 201: 1, 404: 1, 500: 1 });
  assert.deepEqual(report.byStatusClass, { '2xx': 3, '4xx': 1, '5xx': 1 });
  assert.deepEqual(report.byMethod, { GET: 4, POST: 1 });
  assert.equal(report.firstTimestamp, '2026-01-01T00:00:00.001Z');
  assert.equal(report.lastTimestamp, '2026-01-01T00:00:00.005Z');
  assert.equal(report.averageDurationMs, 30);
  assert.equal(report.maxDurationMs, 50);
});

await check('topPaths is ordered by count then path, and limited by top', async () => {
  const report = await aggregateLines(SAMPLE, { top: 2 });
  assert.deepEqual(report.topPaths, [
    { path: '/a', count: 2 },
    { path: '/b', count: 2 },
  ]);
});

await check('aggregateLines accepts an async generator, not only an array', async () => {
  async function* lines() {
    for (let i = 0; i < 1000; i++) yield GOOD;
    yield 'garbage';
  }
  const report = await aggregateLines(lines());
  assert.equal(report.totalLines, 1001);
  assert.equal(report.byStatus['200'], 1000);
  assert.equal(report.malformedLines, 1);
});

await check('an empty input gives an empty report, not a crash', async () => {
  const report = await aggregateLines([]);
  assert.equal(report.totalLines, 0);
  assert.equal(report.firstTimestamp, null);
  assert.equal(report.averageDurationMs, 0);
  assert.deepEqual(report.topPaths, []);
});
