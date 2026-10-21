-- Module 6 exercises 21-25: transactions, then indexes and EXPLAIN QUERY PLAN.
-- Run it: sqlite3 m06.db < exercises/05-transactions-and-indexes.sql
-- Needs schema.sql and seed.sql loaded first. Rebuild the database before EVERY run of this file:
-- exercise 23 changes data, and 24 and 25 change the indexes. Order matters: 21 and 22 leave the
-- data untouched.
--
-- Exercise 21 fails on purpose. The sqlite3 command prints
--   Runtime error near line N: CHECK constraint failed: status IN (...)
-- and exits 1, even though this is a correct run. The result to check is the count after ROLLBACK.
-- Do not add -bail: it would stop at the error, before the ROLLBACK line runs.

.headers on
.mode column
PRAGMA foreign_keys = ON;

.print '--- Exercise 21 [medium]: a transaction that fails half way, then ROLLBACK undoes the half that worked.'
.print '    The second INSERT breaks the status CHECK. The first one must not survive.'
SELECT COUNT(*) AS tasks_before FROM tasks;
BEGIN;
INSERT INTO tasks (user_id, title) VALUES (1, 'Half-done task');
INSERT INTO tasks (user_id, title, status) VALUES (1, 'Bad status task', 'blocked');
SELECT COUNT(*) AS tasks_inside_transaction FROM tasks;
ROLLBACK;
SELECT COUNT(*) AS tasks_after FROM tasks;

.print '--- Exercise 22 [medium]: delete every finished task inside a transaction, look, then change your mind with ROLLBACK.'
BEGIN;
DELETE FROM tasks WHERE status = 'done';
SELECT COUNT(*) AS tasks_inside_transaction FROM tasks;
ROLLBACK;
SELECT COUNT(*) AS tasks_after_rollback FROM tasks;

.print '--- Exercise 23 [hard]: hand user 4 tasks to user 5, then remove user 4, as one all-or-nothing COMMIT.'
.print '    Without the UPDATE first, deleting user 4 would cascade and delete the tasks too.'
BEGIN;
UPDATE tasks SET user_id = 5 WHERE user_id = 4;
DELETE FROM users WHERE id = 4;
COMMIT;
SELECT u.name, COUNT(t.id) AS task_count
FROM users AS u
LEFT JOIN tasks AS t ON t.user_id = u.id
GROUP BY u.id
ORDER BY u.id;

.print '--- Exercise 24 [medium]: query plan for "tasks by status", without and then with idx_tasks_status.'
DROP INDEX idx_tasks_status;
EXPLAIN QUERY PLAN SELECT id, title FROM tasks WHERE status = 'todo';
CREATE INDEX idx_tasks_status ON tasks (status);
EXPLAIN QUERY PLAN SELECT id, title FROM tasks WHERE status = 'todo';

.print '--- Exercise 25 [hard]: query plan for "tasks due before 1 April", without and then with an index on due_date.'
-- schema.sql has no due_date index. This DROP only makes the file safe to run again on a database
-- that it has already run on.
DROP INDEX IF EXISTS idx_tasks_due_date;
EXPLAIN QUERY PLAN SELECT id, title FROM tasks WHERE due_date < '2026-04-01';
CREATE INDEX idx_tasks_due_date ON tasks (due_date);
EXPLAIN QUERY PLAN SELECT id, title FROM tasks WHERE due_date < '2026-04-01';
