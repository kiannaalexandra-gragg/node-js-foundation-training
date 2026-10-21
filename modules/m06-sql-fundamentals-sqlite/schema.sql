-- Module 6 output: the Task API schema, users / tasks / tags / task_tags.
-- Run it: sqlite3 m06.db < schema.sql
-- Success: `.tables` lists four tables, and re-running the file does not fail.
-- Re-running it DROPS all four tables and their data. Load seed.sql again afterwards: seed.sql is not
-- safe to run twice on its own, because its explicit ids would collide.

-- SQLite does not enforce foreign keys unless this is on, and it is per connection, not stored in
-- the database file. Every connection that writes must run it (the sqlite3 CLI and better-sqlite3
-- included).
PRAGMA foreign_keys = ON;

-- Drop children before parents, so the foreign keys never point at a table that is already gone.
DROP TABLE IF EXISTS task_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id         INTEGER PRIMARY KEY,
  email      TEXT    NOT NULL UNIQUE,
  name       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 1:N with users: one user owns many tasks, and each task has exactly one owner.
-- id, title, description and status are the fields M05's API contract already fixes.
CREATE TABLE tasks (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title       TEXT    NOT NULL CHECK (length(title) > 0),
  description TEXT,
  status      TEXT    NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  priority    INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 3),
  due_date    TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tags (
  id   INTEGER PRIMARY KEY,
  name TEXT    NOT NULL UNIQUE
);

-- The junction table for M:N between tasks and tags. One row means "this task has this tag".
-- The pair (task_id, tag_id) is the primary key, so the same tag cannot be attached to the same
-- task twice and no surrogate id is needed. Deleting either side removes the link rows.
CREATE TABLE task_tags (
  task_id INTEGER NOT NULL REFERENCES tasks (id) ON DELETE CASCADE,
  tag_id  INTEGER NOT NULL REFERENCES tags (id)  ON DELETE CASCADE,
  PRIMARY KEY (task_id, tag_id)
);

-- Indexes. SQLite indexes the primary key but not foreign key columns, so index the ones the
-- queries filter or join on. Exercises 24 and 25 (in exercises/05-...) show the plan before and
-- after.
CREATE INDEX idx_tasks_user_id ON tasks (user_id);
CREATE INDEX idx_tasks_status  ON tasks (status);
CREATE INDEX idx_task_tags_tag_id ON task_tags (tag_id);
