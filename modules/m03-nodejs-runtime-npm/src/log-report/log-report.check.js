// Module 3 output, deliverable 1 of 2 (log-report CLI): end-to-end checks that run the real CLI as a child process.
// Run from modules/m03-nodejs-runtime-npm: node src/log-report/log-report.check.js
// Success: 9 "ok - ..." lines and no error. It generates a 300 MB log, so it takes about 10 seconds.
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { promisify } from 'node:util';

const run = promisify(execFile);
const CLI = path.join(import.meta.dirname, 'log-report.js');

async function check(name, fn) {
  await fn();
  console.log(`ok - ${name}`);
}

// Resolves when the child has ended. The timeout makes a child that never ends fail the check
// instead of hanging the whole run.
const waitForClose = (child) => once(child, 'close', { signal: AbortSignal.timeout(15_000) });

// execFile rejects on a non-zero exit code. Turn that into a result so checks can assert on it.
async function runCli(args) {
  try {
    const { stdout, stderr } = await run(process.execPath, [CLI, ...args]);
    return { code: 0, stdout, stderr };
  } catch (error) {
    return { code: error.code, stdout: error.stdout, stderr: error.stderr };
  }
}

const dir = await mkdtemp(path.join(tmpdir(), 'm03-log-report-'));
try {
  const input = path.join(dir, 'in.log');
  const output = path.join(dir, 'out.json');
  await writeFile(
    input,
    [
      '2026-01-01T00:00:00.001Z GET /a 200 10',
      '2026-01-01T00:00:00.002Z GET /b 404 20',
      'garbage',
      '2026-01-01T00:00:00.003Z POST /a 201 30',
      '',
    ].join('\n'),
  );

  await check('writes a JSON report with the right counts and exits 0', async () => {
    const result = await runCli(['-i', input, '-o', output]);
    assert.equal(result.code, 0);
    const report = JSON.parse(await readFile(output, 'utf8'));
    assert.equal(report.source, 'in.log');
    assert.equal(report.totalLines, 4);
    assert.equal(report.malformedLines, 1);
    assert.deepEqual(report.byStatus, { 200: 1, 201: 1, 404: 1 });
    assert.deepEqual(report.topPaths, [
      { path: '/a', count: 2 },
      { path: '/b', count: 1 },
    ]);
  });

  await check('--top limits topPaths', async () => {
    const result = await runCli(['-i', input, '-o', output, '--top', '1']);
    assert.equal(result.code, 0);
    assert.equal(JSON.parse(await readFile(output, 'utf8')).topPaths.length, 1);
  });

  await check('--stats prints elapsed time and peak memory to stderr', async () => {
    const result = await runCli(['-i', input, '-o', output, '--stats']);
    assert.equal(result.code, 0);
    assert.match(result.stderr, /^stats: [\d.]+s elapsed, peak memory [\d.]+ MB/m);
  });

  await check('a missing input or an unwritable output exits 1, names which one, and writes no report', async () => {
    const missingOutput = path.join(dir, 'never.json');
    const noInput = await runCli(['-i', path.join(dir, 'nope.log'), '-o', missingOutput]);
    assert.equal(noInput.code, 1);
    assert.match(noInput.stderr, /cannot read .*nope\.log: no such file or directory/);
    await assert.rejects(readFile(missingOutput), { code: 'ENOENT' });

    const noFolder = path.join(dir, 'no-such-folder', 'out.json');
    const noOutput = await runCli(['-i', input, '-o', noFolder]);
    assert.equal(noOutput.code, 1);
    assert.match(noOutput.stderr, /cannot write .*out\.json: no such file or directory/);
  });

  await check('an unknown flag exits 2 and shows the usage', async () => {
    const result = await runCli(['--nope']);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /Unknown option '--nope'/);
    assert.match(result.stderr, /Usage: node src\/log-report\/log-report\.js/);
  });

  await check('a bad --top exits 2', async () => {
    for (const bad of ['0', '-3', 'abc', '1.5']) {
      const result = await runCli(['-i', input, '-o', output, '--top', bad]);
      assert.equal(result.code, 2, `--top ${bad}`);
    }
  });

  await check('--help prints the usage and exits 0', async () => {
    const result = await runCli(['--help']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Usage: node src\/log-report\/log-report\.js/);
  });

  await check('SIGINT stops a run in progress: exit 130 and no report', async () => {
    // A 300 MB log takes a few seconds to read, so a signal at 0.7 s lands well inside the run. The wait
    // gives the child time to start and install its handlers (the CLI prints nothing we could wait for).
    const bigLog = path.join(dir, 'big.log');
    await run(process.execPath, [path.join(import.meta.dirname, 'generate-log.js'), '--size-mb', '300', '-o', bigLog]);
    const interruptedOutput = path.join(dir, 'interrupted.json');
    const child = spawn(process.execPath, [CLI, '-i', bigLog, '-o', interruptedOutput], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    const closed = waitForClose(child);
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    await new Promise((resolve) => setTimeout(resolve, 700));
    child.kill('SIGINT');
    const [code, signal] = await closed;
    assert.equal(code, 130, `got code ${code}, signal ${signal}: null and SIGINT means the signal arrived before the handler existed`);
    assert.match(stderr, /stopped by SIGINT/);
    await assert.rejects(readFile(interruptedOutput), { code: 'ENOENT' });
  });

  if (process.platform === 'win32') {
    console.log('skip - the stuck-read check needs /dev/stdin, which Windows does not have');
  } else {
    await check('a second SIGINT forces the exit when a read is stuck', async () => {
      // Reading /dev/stdin from a pipe that never sends data is a read that cannot finish.
      const child = spawn(process.execPath, [CLI, '-i', '/dev/stdin', '-o', path.join(dir, 'stuck.json')], {
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      const closed = waitForClose(child);
      try {
        await new Promise((resolve) => setTimeout(resolve, 700));
        child.kill('SIGINT');
        await new Promise((resolve) => setTimeout(resolve, 700));
        // A process killed by a signal has exitCode null too, so check signalCode as well.
        assert.ok(child.exitCode === null && child.signalCode === null, 'the first SIGINT alone must not end a stuck read');
        child.kill('SIGINT');
        // The second signal ends the process through Node's default handler, so it dies "by SIGINT"
        // (no exit code of its own). A shell reports that as 130.
        const [code, signal] = await closed;
        assert.equal(code, null);
        assert.equal(signal, 'SIGINT');
      } finally {
        child.kill('SIGKILL'); // never leave a stuck child behind if an assertion above failed
      }
    });
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
