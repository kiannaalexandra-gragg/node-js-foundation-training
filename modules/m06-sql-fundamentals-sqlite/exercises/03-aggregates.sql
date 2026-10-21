-- Module 6 exercises 12-16: aggregates with GROUP BY and HAVING.
-- Run it: sqlite3 m06.db < exercises/03-aggregates.sql
-- Needs schema.sql and seed.sql loaded first. Nothing here changes data.

.headers on
.mode column
PRAGMA foreign_keys = ON;

.print '--- Exercise 12 [easy]: how many tasks are in each status?'
SELECT status, COUNT(*) AS task_count
FROM tasks
GROUP BY status
ORDER BY task_count DESC, status;

.print '--- Exercise 13 [medium]: how many tasks does every user own, including users with none?'
.print '    COUNT(t.id) counts only matched rows, so the user with no tasks gets 0. COUNT(*) would give 1.'
SELECT u.name, COUNT(t.id) AS task_count
FROM users AS u
LEFT JOIN tasks AS t ON t.user_id = u.id
GROUP BY u.id
ORDER BY task_count DESC, u.id;

.print '--- Exercise 14 [medium]: users with at least 2 finished tasks. WHERE filters rows before grouping, HAVING filters groups after.'
SELECT u.name, COUNT(*) AS done_count
FROM users AS u
INNER JOIN tasks AS t ON t.user_id = u.id
WHERE t.status = 'done'
GROUP BY u.id
HAVING COUNT(*) >= 2
ORDER BY done_count DESC, u.id;

.print '--- Exercise 15 [medium]: how many tasks carry each tag, busiest first, including tags used nowhere.'
SELECT g.name, COUNT(tt.task_id) AS task_count
FROM tags AS g
LEFT JOIN task_tags AS tt ON tt.tag_id = g.id
GROUP BY g.id
ORDER BY task_count DESC, g.name;

.print '--- Exercise 16 [hard]: per status, the count of rows against the count of due dates, plus average priority and date range.'
.print '    COUNT(*) counts rows, COUNT(due_date) skips NULLs, and MIN/MAX(due_date) ignore NULLs too.'
.print '    (priority is NOT NULL, so avg_priority does not show anything about NULLs.)'
SELECT status,
       COUNT(*)            AS tasks,
       COUNT(due_date)     AS with_due_date,
       ROUND(AVG(priority), 2) AS avg_priority,
       MIN(due_date)       AS earliest_due,
       MAX(due_date)       AS latest_due
FROM tasks
GROUP BY status
ORDER BY status;
