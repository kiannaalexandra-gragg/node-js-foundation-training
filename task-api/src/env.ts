// Module 8 output: reads and checks the environment with Zod. parseEnv is shared, and this file holds the database settings.
// Nothing to run here. Imported by config.ts and db.ts. Success: a bad value stops the process at startup, with every problem listed.
import { z } from 'zod';

// Reads the environment once, at startup, and fails fast: a process that cannot start properly
// should say so immediately, not fail on the first request. The thrown text lists one line per
// variable that is wrong, so you fix them all in one go.
export function parseEnv<S extends z.ZodType>(schema: S, env: NodeJS.ProcessEnv): z.output<S> {
  const result = schema.safeParse(env);
  if (!result.success) {
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const issue of result.error.issues) {
      const key = issue.path.join('.');
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(issue.message);
    }
    throw new Error(`Invalid environment:\n- ${lines.join('\n- ')}`);
  }
  return result.data;
}

// The database settings live here, apart from config.ts, on purpose. db.ts is imported by the seed
// script and by scripts/check-prisma-errors.ts as well as by the server, and those only need a
// database: if db.ts read API_KEY and PORT too, `npm run db:seed` would refuse to run without an API
// key it never uses.
const DATABASE_URL_MESSAGE = 'DATABASE_URL is required, for example file:./dev.db';

export const dbEnvSchema = z
  .object({
    // Checked for being blank but passed on as written, the way v2 did.
    DATABASE_URL: z
      .string({ error: DATABASE_URL_MESSAGE })
      .refine((url) => url.trim() !== '', { error: DATABASE_URL_MESSAGE }),
    // Only the text "true" turns query logging on, and anything else leaves it off, as in v2.
    LOG_QUERIES: z
      .string()
      .default('false')
      .transform((text) => text === 'true'),
  })
  .transform((env) => ({ databaseUrl: env.DATABASE_URL, logQueries: env.LOG_QUERIES }));

export type DbConfig = z.output<typeof dbEnvSchema>;

export function loadDbConfig(env: NodeJS.ProcessEnv): DbConfig {
  return parseEnv(dbEnvSchema, env);
}
