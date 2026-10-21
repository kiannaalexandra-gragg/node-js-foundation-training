-- Module 6 exercises 17-20: subqueries, then INSERT / UPDATE / DELETE.
-- Run it: sqlite3 m06.db < exercises/04-subqueries-and-dml.sql
-- Needs schema.sql and seed.sql loaded first. Exercise 20 CHANGES data, so rebuild the database
-- (schema.sql, then seed.sql) before running this file again, and before running any other file after
-- it. Run twice without a rebuild, user 4 is already gone and the counts end at 20 tasks and 31 links.

.headers on
.mode column
PRAGMA foreign_keys = ON;

.print '--- Exercise 17 [medium]: tasks more urgent than average. The scalar subquery returns one number, AVG(priority).'
SELECT id, title, priority
FROM tasks
WHERE priority < (SELECT AVG(priority) FROM tasks)
ORDER BY priority, id;

.print '--- Exercise 18 [medium]: tasks tagged "urgent" without joining, using IN with a nested subquery.'
SELECT id, title
FROM tasks
WHERE id IN (
  SELECT task_id
  FROM task_tags
  WHERE tag_id = (SELECT id FROM tags WHERE name = 'urgent')
)
ORDER BY id;

.print '--- Exercise 19 [hard]: tags that appear on no finished task, using a correlated NOT EXISTS.'
.print '    The inner query reads g.id from the outer row, so it runs once per tag.'
SELECT g.id, g.name
FROM tags AS g
WHERE NOT EXISTS (
  SELECT 1
  FROM task_tags AS tt
  INNER JOIN tasks AS t ON t.id = tt.task_id
  WHERE tt.tag_id = g.id AND t.status = 'done'
)
ORDER BY g.id;

.print '--- Exercise 20 [hard]: INSERT, UPDATE and a cascading DELETE. Counts before, then after.'
SELECT (SELECT COUNT(*) FROM users)     AS users,
       (SELECT COUNT(*) FROM tasks)     AS tasks,
       (SELECT COUNT(*) FROM task_tags) AS task_tags;

INSERT INTO tasks (user_id, title, status, priority)
VALUES (5, 'Plan the M07 migration', 'todo', 1);

INSERT INTO task_tags (task_id, tag_id)
VALUES (last_insert_rowid(), 1);

UPDATE tasks SET status = 'done' WHERE id = 3;

-- Deleting user 4 deletes their 6 tasks (tasks.user_id ... ON DELETE CASCADE), and deleting those
-- tasks deletes their task_tags rows (task_tags.task_id ... ON DELETE CASCADE).
DELETE FROM users WHERE id = 4;

SELECT (SELECT COUNT(*) FROM users)     AS users,
       (SELECT COUNT(*) FROM tasks)     AS tasks,
       (SELECT COUNT(*) FROM task_tags) AS task_tags;
