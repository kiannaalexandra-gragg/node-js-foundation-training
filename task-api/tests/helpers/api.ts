// Module 9 output: the Supertest helpers. They call the exported Express app directly, with no port.
// Nothing to run here. Imported by the test files. Success: authed().get('/health') answers 200.
import request from 'supertest';
import { app } from '../../src/app.ts';

export const API_BASE = '/api/v1';
export const TASKS = `${API_BASE}/tasks`;

// An agent keeps what it is told to send (cookies, and any header set on it) for every request it
// makes. This API has no cookies, so the agent is used for the key: every request from authed()
// carries X-API-Key without each test repeating it.
export function authed() {
  return request.agent(app).set('X-API-Key', process.env.API_KEY ?? '');
}

// A request with no key, for the tests about authentication.
export function anonymous() {
  return request(app);
}
