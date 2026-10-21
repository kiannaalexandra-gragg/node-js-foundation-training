// Module 7 output: the seed script, the M06 sample data loaded through Prisma.
// Run it: npm run db:seed (after `npm run db:reset`, or on a database that has been migrated).
// Success: it prints "Seeded: users 6, tasks 24, tags 7, task_tags 37".
import { prisma } from '../src/db.ts';
import { DEFAULT_OWNER_EMAIL } from '../src/services/task-service.ts';
import type { TaskStatus } from '../src/types/task.ts';

// The same people, tags and tasks as the M06 seed.sql, so the exercises and the API describe the
// same data. Two differences, both on purpose:
//   * users and tags have no hand-written ids. The add_task_owner migration already created the
//     default owner as user 1, so Ada cannot also be user 1. Rows are found by their unique email
//     or name instead, which also means this script can run twice without creating duplicates.
//   * task ids are UUIDs (the API contract), built from the M06 number so they never change between
//     runs: task 7 is always 00000000-0000-4000-8000-000000000007.

const users = [
  { email: 'ada@example.com', name: 'Ada Lovelace', createdAt: '2026-01-05 09:00:00' },
  { email: 'ben@example.com', name: 'Ben Carter', createdAt: '2026-01-12 10:30:00' },
  { email: 'chloe@example.com', name: 'Chloe Nguyen', createdAt: '2026-02-01 08:15:00' },
  { email: 'dev@example.com', name: 'Dev Patel', createdAt: '2026-02-20 14:45:00' },
  // Owns no tasks on purpose: it is the user the "no tasks" queries look for.
  { email: 'esme@example.com', name: 'Esme Walker', createdAt: '2026-03-03 11:00:00' },
] as const;

// "research" is on no task, on purpose.
const tags = ['backend', 'frontend', 'bug', 'docs', 'urgent', 'chore', 'research'] as const;
type TagName = (typeof tags)[number];

type SeedTask = {
  n: number;
  owner: (typeof users)[number]['email'];
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: number;
  dueDate: string | null;
  createdAt: string;
  tags: TagName[];
};

const ada = 'ada@example.com';
const ben = 'ben@example.com';
const chloe = 'chloe@example.com';
const dev = 'dev@example.com';

/* prettier-ignore */
const tasks: SeedTask[] = [
  { n: 1,  owner: ada,   title: 'Set up the Express project',    description: 'Install Express 5 and TypeScript', status: 'done',        priority: 1, dueDate: '2026-03-10', createdAt: '2026-03-01 09:00:00', tags: ['backend', 'chore'] },
  { n: 2,  owner: ada,   title: 'Design the tasks table',        description: 'Columns, types and constraints',   status: 'done',        priority: 1, dueDate: '2026-03-12', createdAt: '2026-03-02 09:30:00', tags: ['backend', 'docs'] },
  { n: 3,  owner: ada,   title: 'Write the seed script',         description: null,                               status: 'in_progress', priority: 2, dueDate: '2026-04-02', createdAt: '2026-03-05 10:00:00', tags: ['backend'] },
  { n: 4,  owner: ada,   title: 'Add pagination to the list',    description: 'Keyset, not OFFSET',               status: 'todo',        priority: 2, dueDate: '2026-04-15', createdAt: '2026-03-06 11:00:00', tags: ['backend', 'frontend'] },
  { n: 5,  owner: ada,   title: 'Fix the duplicate email bug',   description: 'UNIQUE is missing in staging',     status: 'todo',        priority: 1, dueDate: '2026-04-01', createdAt: '2026-03-07 09:45:00', tags: ['backend', 'bug', 'urgent'] },
  { n: 6,  owner: ada,   title: 'Tidy the README',               description: null,                               status: 'todo',        priority: 3, dueDate: null,         createdAt: '2026-03-08 16:00:00', tags: [] },
  { n: 7,  owner: ben,   title: 'Build the task list page',      description: 'Table with a status filter',       status: 'in_progress', priority: 2, dueDate: '2026-04-05', createdAt: '2026-03-02 13:00:00', tags: ['frontend'] },
  { n: 8,  owner: ben,   title: 'Style the status badges',       description: null,                               status: 'todo',        priority: 3, dueDate: '2026-04-20', createdAt: '2026-03-03 13:30:00', tags: ['frontend'] },
  { n: 9,  owner: ben,   title: 'Fix the broken date picker',    description: 'Off by one on month ends',         status: 'todo',        priority: 1, dueDate: '2026-03-30', createdAt: '2026-03-04 15:00:00', tags: ['frontend', 'bug', 'urgent'] },
  { n: 10, owner: ben,   title: 'Write the API usage docs',      description: 'Examples for every endpoint',      status: 'todo',        priority: 2, dueDate: '2026-04-25', createdAt: '2026-03-09 10:00:00', tags: ['docs'] },
  { n: 11, owner: ben,   title: 'Review the colour contrast',    description: 'WCAG AA',                          status: 'done',        priority: 2, dueDate: '2026-03-20', createdAt: '2026-03-10 10:30:00', tags: ['frontend', 'chore'] },
  { n: 12, owner: ben,   title: 'Archive the old branches',      description: null,                               status: 'done',        priority: 3, dueDate: null,         createdAt: '2026-03-11 17:00:00', tags: [] },
  { n: 13, owner: chloe, title: 'Index the tasks table',         description: 'user_id and status',               status: 'in_progress', priority: 1, dueDate: '2026-04-03', createdAt: '2026-03-12 09:00:00', tags: ['backend', 'urgent'] },
  { n: 14, owner: chloe, title: 'Document the junction table',   description: 'Explain task_tags in the README',  status: 'todo',        priority: 2, dueDate: '2026-04-10', createdAt: '2026-03-13 09:30:00', tags: ['docs', 'backend'] },
  { n: 15, owner: chloe, title: 'Fix the slow list query',       description: 'Full scan on status',              status: 'in_progress', priority: 1, dueDate: '2026-04-04', createdAt: '2026-03-14 11:15:00', tags: ['backend', 'bug', 'urgent'] },
  { n: 16, owner: chloe, title: 'Compare SQLite and Postgres',   description: 'Notes only, no code',              status: 'todo',        priority: 3, dueDate: null,         createdAt: '2026-03-15 14:00:00', tags: ['docs'] },
  { n: 17, owner: chloe, title: 'Add a health check endpoint',   description: 'GET /health',                      status: 'done',        priority: 2, dueDate: '2026-03-18', createdAt: '2026-03-16 10:00:00', tags: ['backend'] },
  { n: 18, owner: chloe, title: 'Rotate the staging API key',    description: null,                               status: 'todo',        priority: 2, dueDate: '2026-04-08', createdAt: '2026-03-17 12:00:00', tags: ['chore', 'urgent'] },
  { n: 19, owner: dev,   title: 'Clean up unused dependencies',  description: null,                               status: 'done',        priority: 3, dueDate: null,         createdAt: '2026-03-18 09:00:00', tags: [] },
  { n: 20, owner: dev,   title: 'Fix the failing login test',    description: 'Flaky on CI only',                 status: 'todo',        priority: 1, dueDate: '2026-03-31', createdAt: '2026-03-19 09:30:00', tags: ['bug', 'backend'] },
  { n: 21, owner: dev,   title: 'Write the migration guide',     description: 'From in-memory to SQLite',         status: 'in_progress', priority: 2, dueDate: '2026-04-12', createdAt: '2026-03-20 10:00:00', tags: ['docs', 'backend'] },
  { n: 22, owner: dev,   title: 'Prototype the tag filter',      description: 'Filter tasks by tag name',         status: 'todo',        priority: 2, dueDate: '2026-04-18', createdAt: '2026-03-21 10:30:00', tags: ['frontend', 'backend'] },
  { n: 23, owner: dev,   title: 'Update the contributing guide', description: 'Branch and commit rules',          status: 'done',        priority: 3, dueDate: '2026-03-25', createdAt: '2026-03-22 15:30:00', tags: ['docs', 'chore'] },
  { n: 24, owner: dev,   title: 'Remove the old config file',    description: null,                               status: 'todo',        priority: 3, dueDate: null,         createdAt: '2026-03-23 16:30:00', tags: [] },
];

// M06 wrote timestamps as 'YYYY-MM-DD HH:MM:SS' text in UTC. A Date needs the T and the Z.
const utc = (text: string): Date => new Date(`${text.replace(' ', 'T')}Z`);
const taskId = (n: number): string => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

async function main(): Promise<void> {
  // The owner of tasks created through the API. The migration creates it too, so on a migrated
  // database this finds it and changes nothing.
  await prisma.user.upsert({
    where: { email: DEFAULT_OWNER_EMAIL },
    create: { email: DEFAULT_OWNER_EMAIL, name: 'Default Owner' },
    update: {},
  });

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      create: { email: user.email, name: user.name, createdAt: utc(user.createdAt) },
      update: {},
    });
  }

  for (const name of tags) {
    await prisma.tag.upsert({ where: { name }, create: { name }, update: {} });
  }

  for (const task of tasks) {
    await prisma.task.upsert({
      where: { id: taskId(task.n) },
      create: {
        id: taskId(task.n),
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate === null ? null : new Date(task.dueDate),
        createdAt: utc(task.createdAt),
        // A nested write: Prisma finds the owner and the tags and links them in the same operation.
        owner: { connect: { email: task.owner } },
        tags: { connect: task.tags.map((name) => ({ name })) },
      },
      update: {},
    });
  }

  const [userCount, taskCount, tagCount, links] = await Promise.all([
    prisma.user.count(),
    prisma.task.count(),
    prisma.tag.count(),
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM "_TagToTask"`,
  ]);
  console.log(
    `Seeded: users ${userCount}, tasks ${taskCount}, tags ${tagCount}, task_tags ${links[0]?.n}`,
  );
}

main()
  .catch((err: unknown) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
