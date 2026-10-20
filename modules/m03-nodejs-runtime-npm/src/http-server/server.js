// Module 3 output, deliverable 2 of 2 (bare node:http server): starts the notes server.
// Run from modules/m03-nodejs-runtime-npm: npm run serve   (npm run dev restarts it when a file changes)
// Success: prints "notes server listening on http://localhost:3000". Stop it with Ctrl+C.
import { createNotesServer } from './notes-server.js';

// Environment variables are always strings, so PORT has to be converted and checked by hand.
// `||` and not `??`: a line like `PORT=` in .env gives "", and Number("") is 0, which would make
// the operating system pick a random port.
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error(`PORT must be a whole number from 0 to 65535, got "${process.env.PORT}"`);
  process.exit(2);
}

const server = createNotesServer();

// listen() reports a failure (such as a port already in use) as an 'error' event. With no listener,
// that event is thrown and prints a long stack trace.
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${port} is already in use` : error.message);
  process.exitCode = 1;
});

server.listen(port, () => {
  // Ask the server for its port: with PORT=0 the operating system picks a free one.
  console.log(`notes server listening on http://localhost:${server.address().port}`);
});

// Shut down cleanly: stop accepting connections, let requests already in flight finish, then exit.
function shutdown(signalName) {
  console.log(`${signalName} received, closing the server`);
  server.close((error) => {
    if (error) console.error(error);
    process.exit(error ? 1 : 0);
  });
  // close() also closes idle keep-alive connections, but a connection that is busy when the signal
  // arrives only goes idle after its response, and an idle one would then hold close() open. So keep
  // closing idle connections until the server has closed.
  setInterval(() => server.closeIdleConnections(), 100).unref();
  // If a request never finishes, do not wait forever.
  setTimeout(() => {
    console.error('shutdown timed out, forcing exit');
    process.exit(1);
  }, 5000).unref();
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
