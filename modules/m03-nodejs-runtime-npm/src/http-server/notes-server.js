// Module 3 output, deliverable 2 of 2 (bare node:http server): three JSON endpoints and no framework.
// Nothing to run here. server.js starts it, and server.check.js tests it.
// Routing, body parsing, error handling and response helpers are all written by hand:
//   GET  /notes       list every note
//   POST /notes       create a note from a JSON body { "text": "..." }
//   GET  /notes/:id   read one note
import http from 'node:http';
import { randomUUID } from 'node:crypto';

// ---- Helpers: errors, responses and reading the body --------------------------------------------
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_TEXT_LENGTH = 1000;

class HttpError extends Error {
  constructor(status, message, headers = {}) {
    super(message);
    this.status = status;
    this.headers = headers;
  }
}

function sendJson(res, status, body, headers = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

// Read the request body, which arrives as a stream of chunks, and parse it as JSON.
async function readJsonBody(req) {
  const type = req.headers['content-type'] ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json');
  }
  // Refuse an oversized body from its declared length before reading any of it. (No `Connection:
  // close` here: with it, fetch could fail with EPIPE before it could read the 413.)
  if (Number(req.headers['content-length']) > MAX_BODY_BYTES) {
    throw new HttpError(413, `Body is larger than ${MAX_BODY_BYTES} bytes`);
  }
  // A chunked body has no declared length, so count the bytes as they arrive too. Here `Connection:
  // close` is needed: without it the 413 was unreliable for some clients (fetch timed out in 2 of 5 runs).
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      throw new HttpError(413, `Body is larger than ${MAX_BODY_BYTES} bytes`, { Connection: 'close' });
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Body is not valid JSON');
  }
}

// ---- The server: handlers, routing and the one error handler ------------------------------------
export function createNotesServer() {
  const notes = new Map();

  const listNotes = (req, res) => sendJson(res, 200, [...notes.values()]);

  async function createNote(req, res) {
    const body = await readJsonBody(req);
    if (typeof body?.text !== 'string' || body.text.trim() === '' || body.text.length > MAX_TEXT_LENGTH) {
      throw new HttpError(400, `"text" must be a non-empty string of at most ${MAX_TEXT_LENGTH} characters`);
    }
    const note = { id: randomUUID(), text: body.text, createdAt: new Date().toISOString() };
    notes.set(note.id, note);
    sendJson(res, 201, note, { Location: `/notes/${note.id}` });
  }

  function getNote(req, res, id) {
    const note = notes.get(id);
    if (!note) throw new HttpError(404, `No note with id ${id}`);
    sendJson(res, 200, note);
  }

  // Match a method and path to a handler by hand: split the path into segments and compare them.
  function route(method, segments) {
    if (segments[0] !== 'notes' || segments.length > 2) return null;
    const allowed = segments.length === 1 ? { GET: listNotes, POST: createNote } : { GET: getNote };
    const handler = allowed[method];
    if (!handler) throw new HttpError(405, `${method} is not allowed here`, { Allow: Object.keys(allowed).join(', ') });
    return (req, res) => handler(req, res, segments[1]);
  }

  return http.createServer(async (req, res) => {
    try {
      // Parse the path from a fixed prefix: the Host header is client input and must not decide whether
      // parsing throws. A prefix, not a base: with `new URL(req.url, base)`, a target that starts with //
      // is read as a host, so `GET //` threw and answered 500.
      if (!req.url.startsWith('/')) throw new HttpError(400, 'Request target must start with /');
      let pathname;
      try {
        ({ pathname } = new URL(`http://localhost${req.url}`));
      } catch {
        throw new HttpError(400, 'Bad request target');
      }
      // Dropping empty segments makes /notes, /notes/ and //notes the same route.
      const segments = pathname.split('/').filter(Boolean);
      const handler = route(req.method, segments);
      if (!handler) throw new HttpError(404, `No route for ${pathname}`);
      await handler(req, res);
    } catch (error) {
      // The one place every failure ends up. Without it, a thrown error in this async function
      // becomes an unhandled rejection and takes the whole process down.
      if (res.headersSent) return res.destroy();
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: { status: error.status, message: error.message } }, error.headers);
      } else {
        console.error(error);
        sendJson(res, 500, { error: { status: 500, message: 'Internal Server Error' } });
      }
    }
  });
}
