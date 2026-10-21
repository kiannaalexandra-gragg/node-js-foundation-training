// Module 5 output, replaced in Module 8: the environment (PORT, NODE_ENV, API_KEY, CORS_ORIGIN), read once at startup and checked with Zod.
// Nothing to run here. Imported by app.ts, server.ts and two middleware. Success: a bad value stops the server at startup, with every problem listed.
import { z } from 'zod';
import { parseEnv } from './env.ts';

// The same rules and the same messages as the hand-written loadConfig of M05, as a schema. The
// settings the database needs (DATABASE_URL, LOG_QUERIES) are in env.ts and are not read here, so a
// script that only needs the database does not need an API key.

const NODE_ENVS = ['development', 'production', 'test'] as const;

// The port is text until it is checked, so the message can show what was actually set.
const portRule = z.int().min(1).max(65535);
const PORT_MESSAGE = (issue: { input?: unknown }): string =>
  `PORT must be an integer from 1 to 65535, got "${String(issue.input)}"`;
const API_KEY_MESSAGE = 'API_KEY is required and must not be empty';

const envSchema = z
  .object({
    // Everything in the environment is text, so the port is read with Number() once it has passed
    // portRule. A missing PORT is 3000.
    PORT: z
      .string()
      .default('3000')
      .refine((text) => portRule.safeParse(Number(text)).success, { error: PORT_MESSAGE })
      .transform(Number),
    NODE_ENV: z
      .enum(NODE_ENVS, {
        error: (issue) => `NODE_ENV must be one of ${NODE_ENVS.join(', ')}, got "${String(issue.input)}"`,
      })
      .default('development'),
    // Checked for being blank but kept as written, the way v2 did.
    API_KEY: z
      .string({ error: API_KEY_MESSAGE })
      .refine((key) => key.trim() !== '', { error: API_KEY_MESSAGE }),
    // '*' allows any origin. Otherwise a comma-separated list of allowed origins.
    CORS_ORIGIN: z
      .string()
      .default('*')
      .transform((text) => {
        const trimmed = text.trim();
        return trimmed === '*'
          ? ('*' as const)
          : trimmed
              .split(',')
              .map((origin) => origin.trim())
              .filter((origin) => origin !== '');
      }),
  })
  .transform((env) => ({
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
    apiKey: env.API_KEY,
    corsOrigin: env.CORS_ORIGIN,
  }));

// The type is derived from the schema, so it cannot disagree with it.
export type Config = z.output<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  return parseEnv(envSchema, env);
}

export const config = loadConfig(process.env);
