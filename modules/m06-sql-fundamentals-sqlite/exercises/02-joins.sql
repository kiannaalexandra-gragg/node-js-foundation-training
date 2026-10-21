-- Module 6 exercises 7-11: INNER and LEFT joins, including the three-table join through task_tags.
-- Run it: sqlite3 m06.db < exercises/02-joins.sql
-- Needs schema.sql and seed.sql loaded first. Nothing here changes data.

.headers on
.mode column
PRAGMA foreign_keys = ON;

.print '--- Exercise 7 [easy]: each in-progress task with the name of its owner (INNER JOIN).'
SELECT t.id, t.title, u.name AS owner
FROM tasks AS t
INNER JOIN users AS u ON u.id = t.user_id
WHERE t.status = 'in_progress'
ORDER BY t.id;

.print '--- Exercise 8 [medium]: users who own no tasks. LEFT JOIN keeps every user, then WHERE keeps the unmatched ones.'
SELECT u.id, u.name
FROM users AS u
LEFT JOIN tasks AS t ON t.user_id = u.id
WHERE t.id IS NULL;

.print '--- Exercise 9 [medium]: every task carrying the "urgent" tag, with its owner (three tables, one junction).'
SELECT t.id, t.title, u.name AS owner
FROM tags AS g
INNER JOIN task_tags AS tt ON tt.tag_id = g.id
INNER JOIN tasks AS t ON t.id = tt.task_id
INNER JOIN users AS u ON u.id = t.user_id
WHERE g.name = 'urgent'
ORDER BY t.id;

.print '--- Exercise 10 [medium]: tasks that have no tag at all. An INNER JOIN would drop exactly these rows.'
SELECT t.id, t.title
FROM tasks AS t
LEFT JOIN task_tags AS tt ON tt.task_id = t.id
WHERE tt.tag_id IS NULL
ORDER BY t.id;

.print '--- Exercise 11 [hard]: each task listed once with all its tag names joined into one text column (tasks 1-5).'
.print '    A task with 3 tags is 3 rows after the join, so GROUP BY t.id folds them back into one.'
.print '    The order of the names inside group_concat is not defined by SQL. Here it follows tag_id.'
SELECT t.id, t.title, group_concat(g.name, ', ') AS tags
FROM tasks AS t
LEFT JOIN task_tags AS tt ON tt.task_id = t.id
LEFT JOIN tags AS g ON g.id = tt.tag_id
WHERE t.id <= 5
GROUP BY t.id
ORDER BY t.id;
