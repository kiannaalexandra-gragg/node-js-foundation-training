/*
  Warnings:

  - Added the required column `userId` to the `Task` table without a default value. This is not possible if the table is not empty.


  Hand-edited (created with --create-only). Prisma could not generate this step: a required column
  with no default cannot be added to rows that already exist. Below, the default owner is created
  first, and the existing tasks are backfilled to it in the INSERT ... SELECT.
*/
-- Hand-written: the owner every existing task (and every task the API creates) belongs to.
-- ON CONFLICT DO NOTHING keeps this safe if the user already exists.
INSERT INTO "User" ("email", "name", "createdAt")
VALUES ('owner@example.com', 'Default Owner', CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO NOTHING;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" INTEGER NOT NULL DEFAULT 2,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" INTEGER NOT NULL,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
-- Hand-edited: "userId" added to the column list, and the default owner's id selected for it.
INSERT INTO "new_Task" ("createdAt", "description", "dueDate", "id", "priority", "status", "title", "updatedAt", "userId") SELECT "createdAt", "description", "dueDate", "id", "priority", "status", "title", "updatedAt", (SELECT "id" FROM "User" WHERE "email" = 'owner@example.com') FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE INDEX "Task_status_idx" ON "Task"("status");
CREATE INDEX "Task_userId_idx" ON "Task"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
