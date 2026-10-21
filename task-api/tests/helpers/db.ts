// Module 9 output: the helpers that keep every test starting from the same database.
// Nothing to run here. Imported by the test files. Success: after resetDb() there are no tasks, no tags and only the default owner.
import { prisma } from '../../src/db.ts';
import { DEFAULT_OWNER_EMAIL } from '../../src/services/task-service.ts';
import { testDatabasePath } from './test-database.ts';

// Run in beforeEach. The order matters because of the foreign keys: a task points at its owner, so
// the tasks go first, then the tags, then the users. Deleting a task or a tag also removes its rows
// in the tag join table. The default owner stays, and is put back if it is gone: the migrations create
// it, `create` needs it to exist, and a test that finds it missing would be testing the cleanup, not the API.
export async function resetDb(): Promise<void> {
  // The second guard. global-setup already checked, but a wipe must not depend on the setup having run
  // (a Jest config pointed somewhere else, or this helper called on its own). Nothing is deleted
  // unless the database this process uses is a test database.
  testDatabasePath(process.env.DATABASE_URL);

  await prisma.task.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.user.deleteMany({ where: { email: { not: DEFAULT_OWNER_EMAIL } } });
  await prisma.user.upsert({
    where: { email: DEFAULT_OWNER_EMAIL },
    update: {},
    create: { email: DEFAULT_OWNER_EMAIL, name: 'Default Owner' },
  });
}

// Run in afterAll. The client holds an open connection to the test database, and Jest would otherwise
// report that it did not exit cleanly.
export async function disconnectDb(): Promise<void> {
  await prisma.$disconnect();
}
