-- Module 6 output: seed data for the Task API schema.
-- Run it after the schema: sqlite3 m06.db < schema.sql && sqlite3 m06.db < seed.sql
-- Success: users 5, tasks 24, tags 7, task_tags 37.
--
-- Ids are written out so the exercises give the same answer on every run. The data is shaped on
-- purpose so each exercise has something to find:
--   * user 5 (Esme) owns no tasks                -> LEFT JOIN, NOT EXISTS
--   * tag 7 (research) is on no task             -> LEFT JOIN from tags, HAVING
--   * tasks 6, 12, 19, 24 have no tags           -> LEFT JOIN from tasks
--   * several tasks have no description or no due date (NULL) -> IS NULL, COUNT(col) vs COUNT(*)
--   * priorities and statuses repeat             -> ties for ORDER BY, groups for GROUP BY

PRAGMA foreign_keys = ON;

INSERT INTO users (id, email, name, created_at) VALUES
  (1, 'ada@example.com',   'Ada Lovelace',  '2026-01-05 09:00:00'),
  (2, 'ben@example.com',   'Ben Carter',    '2026-01-12 10:30:00'),
  (3, 'chloe@example.com', 'Chloe Nguyen',  '2026-02-01 08:15:00'),
  (4, 'dev@example.com',   'Dev Patel',     '2026-02-20 14:45:00'),
  (5, 'esme@example.com',  'Esme Walker',   '2026-03-03 11:00:00');

INSERT INTO tags (id, name) VALUES
  (1, 'backend'),
  (2, 'frontend'),
  (3, 'bug'),
  (4, 'docs'),
  (5, 'urgent'),
  (6, 'chore'),
  (7, 'research');

INSERT INTO tasks (id, user_id, title, description, status, priority, due_date, created_at) VALUES
  (1,  1, 'Set up the Express project',      'Install Express 5 and TypeScript',  'done',        1, '2026-03-10', '2026-03-01 09:00:00'),
  (2,  1, 'Design the tasks table',          'Columns, types and constraints',    'done',        1, '2026-03-12', '2026-03-02 09:30:00'),
  (3,  1, 'Write the seed script',           NULL,                                'in_progress', 2, '2026-04-02', '2026-03-05 10:00:00'),
  (4,  1, 'Add pagination to the list',      'Keyset, not OFFSET',                'todo',        2, '2026-04-15', '2026-03-06 11:00:00'),
  (5,  1, 'Fix the duplicate email bug',     'UNIQUE is missing in staging',      'todo',        1, '2026-04-01', '2026-03-07 09:45:00'),
  (6,  1, 'Tidy the README',                 NULL,                                'todo',        3, NULL,         '2026-03-08 16:00:00'),
  (7,  2, 'Build the task list page',        'Table with a status filter',        'in_progress', 2, '2026-04-05', '2026-03-02 13:00:00'),
  (8,  2, 'Style the status badges',         NULL,                                'todo',        3, '2026-04-20', '2026-03-03 13:30:00'),
  (9,  2, 'Fix the broken date picker',      'Off by one on month ends',          'todo',        1, '2026-03-30', '2026-03-04 15:00:00'),
  (10, 2, 'Write the API usage docs',        'Examples for every endpoint',       'todo',        2, '2026-04-25', '2026-03-09 10:00:00'),
  (11, 2, 'Review the colour contrast',      'WCAG AA',                           'done',        2, '2026-03-20', '2026-03-10 10:30:00'),
  (12, 2, 'Archive the old branches',        NULL,                                'done',        3, NULL,         '2026-03-11 17:00:00'),
  (13, 3, 'Index the tasks table',           'user_id and status',                'in_progress', 1, '2026-04-03', '2026-03-12 09:00:00'),
  (14, 3, 'Document the junction table',     'Explain task_tags in the README',   'todo',        2, '2026-04-10', '2026-03-13 09:30:00'),
  (15, 3, 'Fix the slow list query',         'Full scan on status',               'in_progress', 1, '2026-04-04', '2026-03-14 11:15:00'),
  (16, 3, 'Compare SQLite and Postgres',     'Notes only, no code',               'todo',        3, NULL,         '2026-03-15 14:00:00'),
  (17, 3, 'Add a health check endpoint',     'GET /health',                       'done',        2, '2026-03-18', '2026-03-16 10:00:00'),
  (18, 3, 'Rotate the staging API key',      NULL,                                'todo',        2, '2026-04-08', '2026-03-17 12:00:00'),
  (19, 4, 'Clean up unused dependencies',    NULL,                                'done',        3, NULL,         '2026-03-18 09:00:00'),
  (20, 4, 'Fix the failing login test',      'Flaky on CI only',                  'todo',        1, '2026-03-31', '2026-03-19 09:30:00'),
  (21, 4, 'Write the migration guide',       'From in-memory to SQLite',          'in_progress', 2, '2026-04-12', '2026-03-20 10:00:00'),
  (22, 4, 'Prototype the tag filter',        'Filter tasks by tag name',          'todo',        2, '2026-04-18', '2026-03-21 10:30:00'),
  (23, 4, 'Update the contributing guide',   'Branch and commit rules',           'done',        3, '2026-03-25', '2026-03-22 15:30:00'),
  (24, 4, 'Remove the old config file',      NULL,                                'todo',        3, NULL,         '2026-03-23 16:30:00');

INSERT INTO task_tags (task_id, tag_id) VALUES
  (1, 1), (1, 6),
  (2, 1), (2, 4),
  (3, 1),
  (4, 1), (4, 2),
  (5, 1), (5, 3), (5, 5),
  (7, 2),
  (8, 2),
  (9, 2), (9, 3), (9, 5),
  (10, 4),
  (11, 2), (11, 6),
  (13, 1), (13, 5),
  (14, 4), (14, 1),
  (15, 1), (15, 3), (15, 5),
  (16, 4),
  (17, 1),
  (18, 6), (18, 5),
  (20, 3), (20, 1),
  (21, 4), (21, 1),
  (22, 2), (22, 1),
  (23, 4), (23, 6);
