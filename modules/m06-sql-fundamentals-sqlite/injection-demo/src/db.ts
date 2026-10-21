// Module 6 output: opens a throwaway in-memory database built from the module's own SQL files.
// Nothing to run here. Used by demo.ts. Success: the database has the users/tasks/tags/task_tags
// tables and the seed rows, and nothing is written to disk.
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';

// schema.sql and seed.sql live one folder above injection-demo/, so the demo attacks the same
// tables the exercises use, not a copy that could drift.
function readSql(name: string): string {
  return readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
}

export function openDemoDb(): Database.Database {
  const db = new Database(':memory:');
  // Foreign keys are per connection in SQLite, so turn them on for this one as well.
  db.pragma('foreign_keys = ON');
  // exec() runs a whole file of statements. It is the right tool for the trusted schema and seed
  // files, and (as demo.ts shows) the wrong one for anything built from user input.
  db.exec(readSql('schema.sql'));
  db.exec(readSql('seed.sql'));
  return db;
}
