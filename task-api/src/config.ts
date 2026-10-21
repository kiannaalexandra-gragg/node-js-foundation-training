// Module 5 output: the environment (PORT, NODE_ENV, API_KEY, CORS_ORIGIN), read once at startup.
// Nothing to run here. Imported by app.ts, server.ts and two middleware. Success: a bad value stops the server at startup, with every problem listed.

// Reads the environment once, at startup, and fails fast: a server that cannot start properly
// should say so immediately, not fail on the first request. Hand-written here on purpose; M08
// replaces it with a Zod schema.

const NODE_ENVS = ['development', 'production', 'test'] as const;
type NodeEnv = (typeof NODE_ENVS)[number];

export type Config = {
  port: number;
  nodeEnv: NodeEnv;
  apiKey: string;
  // '*' allows any origin. Otherwise the list of allowed origins.
  corsOrigin: '*' | string[];
};

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const problems: string[] = [];

  const portText = env.PORT ?? '3000';
  const port = Number(portText);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push(`PORT must be an integer from 1 to 65535, got "${portText}"`);
  }

  const nodeEnvText = env.NODE_ENV ?? 'development';
  const nodeEnv = NODE_ENVS.find((value) => value === nodeEnvText);
  if (nodeEnv === undefined) {
    problems.push(`NODE_ENV must be one of ${NODE_ENVS.join(', ')}, got "${nodeEnvText}"`);
  }

  const apiKey = env.API_KEY ?? '';
  if (apiKey.trim() === '') {
    problems.push('API_KEY is required and must not be empty');
  }

  const corsText = (env.CORS_ORIGIN ?? '*').trim();
  const corsOrigin =
    corsText === '*'
      ? '*'
      : corsText
          .split(',')
          .map((origin) => origin.trim())
          .filter((origin) => origin !== '');

  if (problems.length > 0 || nodeEnv === undefined) {
    throw new Error(`Invalid environment:\n- ${problems.join('\n- ')}`);
  }

  return { port, nodeEnv, apiKey, corsOrigin };
}

export const config = loadConfig(process.env);
