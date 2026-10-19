// Module 2 output: the same node:fs task with callbacks (Part 1), with async/await (Part 2), and checks (Part 3).
// Run from the repo root: node modules/m02-modern-javascript-async-await/fs-refactor.mjs
// Success: three "ok - ..." lines and no error.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

// ---- Part 1: Before (callbacks) -------------------------------------------------------------
// Read a JSON file, add `stamped: true`, write it to a new file, read it back.
// Each step nests one level deeper and repeats its own `if (error)` check.
function stampFileCallback(inputPath, outputPath, callback) {
  fs.readFile(inputPath, 'utf8', (readError, text) => {
    if (readError) return callback(readError);
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      return callback(parseError);
    }
    data.stamped = true;
    fs.writeFile(outputPath, JSON.stringify(data, null, 2), (writeError) => {
      if (writeError) return callback(writeError);
      fs.readFile(outputPath, 'utf8', (verifyError, written) => {
        if (verifyError) return callback(verifyError);
        // Parse inside the try, but call the callback outside it, so a throw from the
        // caller's own callback is never mistaken for a parse error and called back twice.
        let result;
        try {
          result = JSON.parse(written);
        } catch (parseError) {
          return callback(parseError);
        }
        callback(null, result);
      });
    });
  });
}

// ---- Part 2: After (promises and async/await) -----------------------------------------------
// Same steps in a straight line. File errors and JSON.parse errors share one rejection path.
async function stampFile(inputPath, outputPath) {
  const text = await fsPromises.readFile(inputPath, 'utf8');
  const data = JSON.parse(text);
  data.stamped = true;
  await fsPromises.writeFile(outputPath, JSON.stringify(data, null, 2));
  return JSON.parse(await fsPromises.readFile(outputPath, 'utf8'));
}

// ---- Part 3: Self-checks --------------------------------------------------------------------
// Both versions must give the same result and fail the same way. The callback version is wrapped
// with promisify so the checks can await it.
const stampFileViaCallback = promisify(stampFileCallback);

const dir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'm02-fs-refactor-'));
try {
  const inputPath = path.join(dir, 'input.json');
  await fsPromises.writeFile(inputPath, JSON.stringify({ name: 'toolkit', stage: 2 }));

  const expected = { name: 'toolkit', stage: 2, stamped: true };
  assert.deepEqual(await stampFileViaCallback(inputPath, path.join(dir, 'out-callback.json')), expected);
  assert.deepEqual(await stampFile(inputPath, path.join(dir, 'out-await.json')), expected);
  console.log('ok - callback and async/await versions produce the same result');

  const missing = path.join(dir, 'nope.json');
  await assert.rejects(stampFileViaCallback(missing, path.join(dir, 'x.json')), { code: 'ENOENT' });
  await assert.rejects(stampFile(missing, path.join(dir, 'y.json')), { code: 'ENOENT' });
  console.log('ok - both versions fail with ENOENT for a missing file');

  const malformed = path.join(dir, 'malformed.json');
  await fsPromises.writeFile(malformed, '{ not json');
  await assert.rejects(stampFileViaCallback(malformed, path.join(dir, 'x.json')), { name: 'SyntaxError' });
  await assert.rejects(stampFile(malformed, path.join(dir, 'y.json')), { name: 'SyntaxError' });
  console.log('ok - both versions fail with SyntaxError for malformed JSON');
} finally {
  await fsPromises.rm(dir, { recursive: true, force: true });
}
