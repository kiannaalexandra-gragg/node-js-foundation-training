// Module 6 output: a task search that is open to SQL injection. DO NOT copy this pattern.
// Nothing to run here. Used by demo.ts. Success: a crafted search term changes what the query
// means, not just what it matches.
import type Database from 'better-sqlite3';

export type TaskHit = { id: number; title: string; status: string };

// The flaw: `term` is pasted into the SQL text. The database receives one string and has no way to
// tell which part the developer wrote and which part the user typed. Exported so the demo can
// print the exact text the database is given.
export function buildVulnerableSql(term: string): string {
  return `SELECT id, title, status FROM tasks WHERE title LIKE '%${term}%' ORDER BY id`;
}

export function findTasksByTitleVulnerable(db: Database.Database, term: string): TaskHit[] {
  return db.prepare(buildVulnerableSql(term)).all() as TaskHit[];
}
