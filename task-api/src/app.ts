// Module 5 output: builds and exports the Express app (middleware, routes, 404 and error handler). It never calls listen.
// Nothing to run here. server.ts starts it. Success: `npm run typecheck` exits 0 and, with the server running, GET /health answers {"status":"ok"}.
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.ts';
import { apiKeyAuth } from './middleware/api-key-auth.ts';
import { errorHandler } from './middleware/error-handler.ts';
import { requestLogger } from './middleware/logger.ts';
import { notFound } from './middleware/not-found.ts';
import { requestId } from './middleware/request-id.ts';
import { v1Router } from './routes/index.ts';

// Builds and exports the app. It never calls listen: server.ts does that, so a test can import
// this file and call the app directly without opening a port.
export const app = express();

// Order matters: a request flows through these top to bottom, and the first one that responds ends
// it. Request id and logger come first so that every request, even one rejected by a later step,
// has an id and a log line. The 404 handler comes after every route, and the error handler comes
// last, because Express only passes an error to handlers registered after the place it was thrown.
app.use(requestId);
app.use(requestLogger);
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    // Browsers may only read response headers a server exposes.
    exposedHeaders: ['X-Request-Id'],
  }),
);

// Open on purpose: a health check must work without a key.
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// The key is checked once, for everything under /api/v1, and before the body is read: a caller
// without a key gets a 401, and cannot make the server buffer and parse a body. express.json comes
// before the routes, or req.body would be undefined in the handlers.
app.use('/api/v1', apiKeyAuth, express.json(), v1Router);

app.use(notFound);
app.use(errorHandler);
