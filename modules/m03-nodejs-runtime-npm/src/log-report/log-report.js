// Module 3 output, deliverable 1 of 2 (log-report CLI): streams a log file line by line into a JSON report.
// Run from modules/m03-nodejs-runtime-npm: npm run report -- --stats   (add --help to see every option)
// Success: "Wrote report.json: 2231981 lines, 2200 malformed" for the default generated log, plus a
// `stats:` line with the elapsed time and peak memory.
// Exit codes: 0 report written, 1 the run failed (for example the input is missing),
// 2 bad command line, 130 stopped by SIGINT (Ctrl+C), 143 stopped by SIGTERM.
import { createReadStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { parseArgs } from 'node:util';
import { aggregateLines } from './aggregate.js';

// ---- Options and usage --------------------------------------------------------------------------
const USAGE = `Usage: node src/log-report/log-report.js [options]

Options:
  -i, --input <file>   log file to read      (default: data/access.log at the module root)
  -o, --output <file>  report file to write  (default: report.json in the current directory)
  -n, --top <count>    how many paths to list in topPaths (default: 5)
      --stats          print elapsed time and peak memory to stderr when done
  -h, --help           show this help`;

function fail(message, code) {
  console.error(`log-report: ${message}`);
  process.exitCode = code;
}

let values;
try {
  ({ values } = parseArgs({
    options: {
      input: { type: 'string', short: 'i', default: path.join(import.meta.dirname, '..', '..', 'data', 'access.log') },
      output: { type: 'string', short: 'o', default: 'report.json' },
      top: { type: 'string', short: 'n', default: '5' },
      stats: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  }));
} catch (error) {
  fail(`${error.message}\n\n${USAGE}`, 2);
}

if (values?.help) {
  console.log(USAGE);
} else if (values) {
  await run(values);
}

// ---- The run: stream the file, count, write the report ------------------------------------------
async function run({ input, output, top, stats }) {
  const topCount = Number(top);
  if (!Number.isInteger(topCount) || topCount < 1) {
    return fail(`--top must be a whole number of at least 1, got "${top}"`, 2);
  }

  // One AbortController lets a signal stop the read stream cleanly instead of killing the process.
  // Installing a handler replaces Node's default "exit now" behaviour, so Ctrl+C must never be
  // allowed to leave the process stuck. In testing, a read blocked on a pipe that never sends data
  // could not be abandoned politely, and even process.exit() did not end the process. So a second
  // signal removes our handler and re-sends the signal, and Node's default ends the process at once.
  const controller = new AbortController();
  const stop = (signalName, code) => () => {
    if (controller.signal.aborted) {
      process.removeAllListeners(signalName);
      process.kill(process.pid, signalName);
      return;
    }
    process.exitCode = code;
    controller.abort(signalName);
  };
  process.on('SIGINT', stop('SIGINT', 130));
  process.on('SIGTERM', stop('SIGTERM', 143));

  const startedAt = performance.now();
  let writing = false; // tells a missing input from a missing output folder, which are both ENOENT
  try {
    const source = createReadStream(input, { encoding: 'utf8', signal: controller.signal });
    // readline hands over one line at a time and only reads as fast as we consume, so the 100 MB
    // file never has to exist in memory all at once.
    const lines = readline.createInterface({ input: source, crlfDelay: Infinity });
    const counts = await aggregateLines(lines, { top: topCount });

    const report = { source: path.basename(input), ...counts };
    writing = true;
    await writeFile(output, JSON.stringify(report, null, 2) + '\n');
    console.log(`Wrote ${output}: ${counts.totalLines} lines, ${counts.malformedLines} malformed`);

    if (stats) {
      const seconds = ((performance.now() - startedAt) / 1000).toFixed(2);
      const peakMb = (process.resourceUsage().maxRSS / 1024).toFixed(1);
      console.error(`stats: ${seconds}s elapsed, peak memory ${peakMb} MB (maxRSS)`);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.error(`log-report: stopped by ${controller.signal.reason}, no report written`);
    } else if (error.code === 'ENOENT') {
      fail(`cannot ${writing ? 'write' : 'read'} ${error.path}: no such file or directory`, 1);
    } else {
      fail(error.message, 1);
    }
  }
}
