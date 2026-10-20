// Module 3 output, deliverable 1 of 2 (log-report CLI): the counting half, `parseLine` and `aggregateLines`.
// Nothing to run here. log-report.js uses it, and aggregate.check.js tests it.
// It knows nothing about files, flags or exit codes, so it can be checked with a plain array.

const METHOD = /^[A-Z]+$/;
const STATUS = /^[1-5]\d\d$/;
const DIGITS = /^\d+$/;

// Returns the fields of one log line, or null when the line is not a well-formed record.
export function parseLine(line) {
  const parts = line.split(' ');
  if (parts.length !== 5) return null;
  const [timestamp, method, path, status, duration] = parts;
  if (Number.isNaN(Date.parse(timestamp))) return null;
  if (!METHOD.test(method) || !path.startsWith('/')) return null;
  if (!STATUS.test(status) || !DIGITS.test(duration)) return null;
  return { timestamp, method, path, status, durationMs: Number(duration) };
}

function increment(map, key) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

// Turn a Map of counts into a plain object with its keys in a fixed order.
function toSortedObject(map) {
  return Object.fromEntries([...map].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

// Consumes any async iterable of lines, one at a time, and keeps only the counters. Memory use
// depends on how many distinct statuses, methods and paths exist, never on how many lines there are.
export async function aggregateLines(lines, { top = 5 } = {}) {
  let totalLines = 0;
  let malformedLines = 0;
  let durationSum = 0;
  let maxDurationMs = 0;
  let firstTimestamp = null;
  let lastTimestamp = null;
  const byStatus = new Map();
  const byStatusClass = new Map();
  const byMethod = new Map();
  const byPath = new Map();

  for await (const line of lines) {
    if (line === '') continue; // a blank line is not a record, good or bad
    totalLines++;
    const record = parseLine(line);
    if (record === null) {
      malformedLines++;
      continue;
    }
    increment(byStatus, record.status);
    increment(byStatusClass, `${record.status[0]}xx`);
    increment(byMethod, record.method);
    increment(byPath, record.path);
    durationSum += record.durationMs;
    if (record.durationMs > maxDurationMs) maxDurationMs = record.durationMs;
    firstTimestamp ??= record.timestamp;
    lastTimestamp = record.timestamp;
  }

  const parsedLines = totalLines - malformedLines;
  const topPaths = [...byPath]
    .sort(([pathA, countA], [pathB, countB]) => countB - countA || (pathA < pathB ? -1 : 1))
    .slice(0, top)
    .map(([path, count]) => ({ path, count }));

  return {
    totalLines,
    parsedLines,
    malformedLines,
    firstTimestamp,
    lastTimestamp,
    byStatus: toSortedObject(byStatus),
    byStatusClass: toSortedObject(byStatusClass),
    byMethod: toSortedObject(byMethod),
    topPaths,
    averageDurationMs: parsedLines === 0 ? 0 : Math.round((durationSum / parsedLines) * 10) / 10,
    maxDurationMs,
  };
}
