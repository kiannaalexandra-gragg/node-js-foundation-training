-- Module 6 exercises 1-6: SELECT, filtering, sorting and pagination.
-- Run it: sqlite3 m06.db < exercises/01-select-filter-sort.sql
-- Needs schema.sql and seed.sql loaded first. Nothing here changes data.
-- Tiers: [easy] one clause, [medium] two or three clauses together, [hard] needs a design choice.

.headers on
.mode column
PRAGMA foreign_keys = ON;

.print '--- Exercise 1 [easy]: every task still waiting to start, most urgent first.'
SELECT id, title, priority
FROM tasks
WHERE status = 'todo'
ORDER BY priority ASC, id ASC;

.print '--- Exercise 2 [easy]: tasks whose title mentions "Fix" (LIKE is case-insensitive for ASCII in SQLite).'
SELECT id, title
FROM tasks
WHERE title LIKE '%Fix%'
ORDER BY id;

.print '--- Exercise 3 [easy]: tasks with no due date. "= NULL" matches nothing, so use IS NULL.'
SELECT id, title, status
FROM tasks
WHERE due_date IS NULL
ORDER BY id;

.print '--- Exercise 4 [medium]: open tasks (not done) of priority 1 or 2, due between 30 March and 10 April, soonest first.'
SELECT id, title, status, priority, due_date
FROM tasks
WHERE status <> 'done'
  AND priority IN (1, 2)
  AND due_date BETWEEN '2026-03-30' AND '2026-04-10'
ORDER BY due_date ASC, id ASC;

.print '--- Exercise 5 [medium]: page 2 of the task list, 5 per page, using LIMIT and OFFSET.'
SELECT id, title
FROM tasks
ORDER BY id
LIMIT 5 OFFSET 5;

.print '--- Exercise 6 [hard]: the page after the one that ended at (created_at 2026-03-07 09:45:00, id 5), by keyset.'
.print '    (Row values like this need SQLite 3.15 or later.)'
.print '    The row values compare (created_at, id) together. With an index on (created_at, id) the plan is a'
.print '    SEARCH that starts at that row. Without one, as here, it is a scan plus a sort.'
SELECT id, title, created_at
FROM tasks
WHERE (created_at, id) > ('2026-03-07 09:45:00', 5)
ORDER BY created_at ASC, id ASC
LIMIT 5;
