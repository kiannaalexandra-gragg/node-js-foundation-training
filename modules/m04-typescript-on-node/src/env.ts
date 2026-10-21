// Module 4 output: typed access to process.env.
// Nothing to run here. Used by demo.ts and checked by env.check.ts.
import { err, ok, type Result } from './domain/result.ts';

export type Env = {
  /** How long the demo's simulated save takes, in ms. */
  toolkitDelayMs: number;
};

// process.env is typed `NodeJS.ProcessEnv`: every value is `string | undefined`, whatever the
// variable really holds. Read it once, here, check it, and hand the rest of the program a
// proper Env. Taking `env` as a parameter (defaulting to process.env) makes it testable.
export function readEnv(env: NodeJS.ProcessEnv = process.env): Result<Env, string> {
  const raw = env.TOOLKIT_DELAY_MS?.trim();
  if (raw === undefined || raw === '') return ok({ toolkitDelayMs: 20 });
  // Digits only: Number() would also accept '0x10' and '1e3', and turn whitespace into 0.
  if (!/^\d+$/.test(raw)) {
    return err(`TOOLKIT_DELAY_MS must be a whole number of milliseconds, got "${raw}"`);
  }
  return ok({ toolkitDelayMs: Number(raw) });
}
