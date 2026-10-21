// Module 4 output: self-checks for the typed environment reader.
// Run from this folder: npm run check   (or: npx tsx src/env.check.ts)
import assert from 'node:assert/strict';
import { readEnv } from './env.ts';

function check(name: string, fn: () => void): void {
  fn();
  console.log(`ok - ${name}`);
}

check('readEnv falls back to the default when the variable is unset or empty', () => {
  assert.deepEqual(readEnv({}), { ok: true, value: { toolkitDelayMs: 20 } });
  assert.deepEqual(readEnv({ TOOLKIT_DELAY_MS: '' }), { ok: true, value: { toolkitDelayMs: 20 } });
  // A whitespace-only value counts as unset too: Number('  ') is 0, which would silently mean "no delay".
  assert.deepEqual(readEnv({ TOOLKIT_DELAY_MS: '   ' }), { ok: true, value: { toolkitDelayMs: 20 } });
});

check('readEnv parses a valid number', () => {
  assert.deepEqual(readEnv({ TOOLKIT_DELAY_MS: '5' }), { ok: true, value: { toolkitDelayMs: 5 } });
  assert.deepEqual(readEnv({ TOOLKIT_DELAY_MS: ' 7 ' }), { ok: true, value: { toolkitDelayMs: 7 } });
  assert.deepEqual(readEnv({ TOOLKIT_DELAY_MS: '0' }), { ok: true, value: { toolkitDelayMs: 0 } });
});

check('readEnv returns an error Result for a bad value instead of throwing', () => {
  // '0x10' and '1e3' are numbers to Number(), but not a plain count of milliseconds.
  for (const bad of ['soon', '-1', 'NaN', '0x10', '1e3', '1.5']) {
    const result = readEnv({ TOOLKIT_DELAY_MS: bad });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /TOOLKIT_DELAY_MS/);
  }
});
