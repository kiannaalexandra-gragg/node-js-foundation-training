// Module 5 output, extended in Module 7 to close the database: the only file that calls listen, with graceful shutdown on SIGTERM and SIGINT.
// Run from task-api/: npm run dev   (restarts on change; npm start runs it once)
// Success: prints "Task API listening on http://localhost:3000 (development)". Ctrl+C prints "Server closed" and exits 0.
import { app } from './app.ts';
import { config } from './config.ts';
import { prisma } from './db.ts';

// The only file that calls listen.
const server = app.listen(config.port, (err) => {
  // Express 5 passes a startup failure (for example EADDRINUSE) to this callback instead of
  // throwing. Ignoring it would print "listening" and then exit 0, which looks like a clean run.
  if (err) {
    console.error(`Could not listen on port ${config.port}:`, err);
    process.exit(1);
  }
  console.log(`Task API listening on http://localhost:${config.port} (${config.nodeEnv})`);
});

// Graceful shutdown: stop taking new connections, let requests already in flight finish, then
// exit. A process manager sends SIGTERM when it wants the server to stop. SIGINT is Ctrl+C.
let shuttingDown = false;

function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, closing the server`);

  // server.close stops listening and calls back once every open connection has ended.
  server.close((err) => {
    if (err) {
      console.error('Error while closing the server:', err);
      process.exit(1);
    }
    // No request is in flight any more, so the database connection can be closed safely.
    prisma.$disconnect().then(
      () => {
        console.log('Server closed');
        process.exit(0);
      },
      (disconnectErr: unknown) => {
        console.error('Error while closing the database:', disconnectErr);
        process.exit(1);
      },
    );
  });

  // If a connection never ends, do not wait forever. unref() so this timer alone does not keep
  // the process alive.
  setTimeout(() => {
    console.error('Shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
