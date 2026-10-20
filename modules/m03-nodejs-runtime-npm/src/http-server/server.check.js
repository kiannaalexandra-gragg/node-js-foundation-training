// Module 3 output, deliverable 2 of 2 (bare node:http server): checks for the routes and error paths over
// real HTTP, then a graceful shutdown.
// Run from modules/m03-nodejs-runtime-npm: node src/http-server/server.check.js
// Success: 12 "ok - ..." lines and no error.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { createNotesServer } from './notes-server.js';

async function check(name, fn) {
  await fn();
  console.log(`ok - ${name}`);
}

const server = createNotesServer();
server.listen(0); // port 0: let the operating system pick a free port
await once(server, 'listening');
const base = `http://localhost:${server.address().port}`;

// Every request gets a 5 s limit, so a handler that never answers fails the check instead of hanging it.
const fetchTimed = (url, options = {}) => fetch(url, { ...options, signal: AbortSignal.timeout(5000) });

const postJson = (body, headers = {}) =>
  fetchTimed(`${base}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

try {
  let created;

  await check('POST /notes creates a note: 201, JSON, and a Location header', async () => {
    const response = await postJson({ text: 'first note' });
    assert.equal(response.status, 201);
    assert.match(response.headers.get('content-type'), /^application\/json/);
    created = await response.json();
    assert.match(created.id, /^[0-9a-f-]{36}$/);
    assert.equal(created.text, 'first note');
    assert.equal(response.headers.get('location'), `/notes/${created.id}`);
  });

  await check('GET /notes lists the notes', async () => {
    const response = await fetchTimed(`${base}/notes`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), [created]);
  });

  await check('GET /notes/:id returns one note, and a trailing slash or a leading // works too', async () => {
    for (const suffix of ['', '/']) {
      const response = await fetchTimed(`${base}/notes/${created.id}${suffix}`);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), created);
    }
    assert.equal((await fetchTimed(`${base}//notes`)).status, 200);
  });

  await check('an unknown id is a 404 with a JSON error, not an empty 200', async () => {
    const response = await fetchTimed(`${base}/notes/nope`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: { status: 404, message: 'No note with id nope' } });
  });

  await check('an unknown route is a 404 with a JSON error, including odd paths like // that once gave a 500', async () => {
    for (const unknown of ['/nothing', '//', '//x/notes', '//a:b/']) {
      const response = await fetchTimed(`${base}${unknown}`);
      assert.equal(response.status, 404, unknown);
      assert.equal((await response.json()).error.status, 404, unknown);
    }
  });

  await check('a known path with the wrong method is a 405 with an Allow header', async () => {
    const onCollection = await fetchTimed(`${base}/notes`, { method: 'DELETE' });
    assert.equal(onCollection.status, 405);
    assert.equal(onCollection.headers.get('allow'), 'GET, POST');
    const onItem = await fetchTimed(`${base}/notes/${created.id}`, { method: 'POST' });
    assert.equal(onItem.status, 405);
    assert.equal(onItem.headers.get('allow'), 'GET');
  });

  await check('malformed JSON is a 400 and the server keeps serving', async () => {
    const response = await postJson('{"text": oops');
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.message, 'Body is not valid JSON');
    assert.equal((await fetchTimed(`${base}/notes`)).status, 200);
  });

  await check('a wrong Content-Type is a 415', async () => {
    const response = await postJson('hello', { 'Content-Type': 'text/plain' });
    assert.equal(response.status, 415);
  });

  await check('a body without a usable "text" is a 400, including null, arrays and empty text', async () => {
    for (const body of [{}, { text: 42 }, { text: '   ' }, { text: 'x'.repeat(1001) }, 'null', '[1]', '']) {
      const response = await postJson(body);
      assert.equal(response.status, 400, `body ${JSON.stringify(body)}`);
    }
  });

  await check('a body over 1 MiB is a 413 by its Content-Length', async () => {
    const response = await postJson({ text: 'a'.repeat(2 * 1024 * 1024) });
    assert.equal(response.status, 413);
  });

  await check('a chunked body over 1 MiB is a 413 too, counted as it arrives', async () => {
    const status = await new Promise((resolve, reject) => {
      const request = http.request(`${base}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' },
      });
      request.on('response', (response) => {
        resolve(response.statusCode);
        response.resume();
      });
      // The server may close the connection while we are still writing, which is fine here.
      request.on('error', (error) => (error.code === 'ECONNRESET' || error.code === 'EPIPE' ? null : reject(error)));
      request.write('{"text":"');
      request.write('a'.repeat(600 * 1024));
      request.write('a'.repeat(600 * 1024));
      request.end('"}');
    });
    assert.equal(status, 413);
  });
} finally {
  server.closeAllConnections();
  server.close();
}

await check('server.js closes cleanly on SIGTERM, even with a request still in flight', async () => {
  const child = spawn(process.execPath, [path.join(import.meta.dirname, 'server.js')], {
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const closed = once(child, 'close', { signal: AbortSignal.timeout(15_000) });
  let socket;
  try {
    // Wait for the "listening" line, which also tells us the port. Fail if the server exits or is silent.
    let output = '';
    const port = await new Promise((resolve, reject) => {
      child.stdout.on('data', (chunk) => {
        output += chunk;
        const match = output.match(/listening on http:\/\/localhost:(\d+)/);
        if (match) resolve(Number(match[1]));
      });
      child.once('close', (code) => reject(new Error(`server.js exited with code ${code} before it was listening`)));
      setTimeout(() => reject(new Error('server.js was not listening after 5 s')), 5000).unref();
    });

    // Start a request and leave it half-sent, so it is still in flight when the signal arrives.
    const body = '{"text":"in flight"}';
    let response = '';
    socket = net.connect(port, 'localhost');
    socket.on('data', (chunk) => (response += chunk));
    socket.write(
      `POST /notes HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\n` +
        `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body.slice(0, 8)}`,
    );
    await sleep(200);
    const signalledAt = performance.now();
    child.kill('SIGTERM');
    await sleep(200);
    socket.write(body.slice(8)); // finish the request after the server has been told to stop

    const [code] = await closed;
    assert.equal(code, 0, 'exit code 1 after about 5 s means shutdown timed out waiting on a connection');
    assert.ok(performance.now() - signalledAt < 3000, 'it should exit once the request is answered, not wait for the 5 s timer');
    assert.match(response, /^HTTP\/1\.1 201/, 'the request in flight must still be answered');
    assert.match(output, /SIGTERM received/);
  } finally {
    socket?.destroy();
    child.kill('SIGKILL');
  }
});
