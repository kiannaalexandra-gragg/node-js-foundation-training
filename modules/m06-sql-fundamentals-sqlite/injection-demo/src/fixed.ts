// Module 6 output: the same task search, fixed with a parameter.
// Nothing to run here. Used by demo.ts. Success: the same attack strings match no tasks, because
// they are compared as text and never read as SQL.
import type Database from 'better-sqlite3';
import type { TaskHit } from './vulnerable.ts';

// The fix: the SQL text is a constant with one `?` placeholder, and the value travels separately.
// The statement is parsed and planned before the value is attached, so the value can only ever be
// data. The `%` wildcards are added to the value, not to the SQL.
export function findTasksByTitleFixed(db: Database.Database, term: string): TaskHit[] {
  return db
    .prepare('SELECT id, title, status FROM tasks WHERE title LIKE ? ORDER BY id')
    .all(`%${term}%`) as TaskHit[];
}
