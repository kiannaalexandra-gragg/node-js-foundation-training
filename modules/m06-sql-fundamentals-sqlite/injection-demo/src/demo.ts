// Module 6 output: runs each attack string against the vulnerable search, then the fixed one.
// Run it: npm run demo
// Success: the controls say OK, the tautology and UNION attacks say SUCCEEDED against the vulnerable
// query and BLOCKED against the fixed one, and the process exits 0. If anything behaves otherwise, it
// exits 1. The stacked-statement attempt is reported, not scored.
//
// "BLOCKED" alone would also be printed by a fixed query that returns nothing for every input, so the
// controls check that the fixed query still finds the same tasks as the vulnerable one for a normal term.
import { openDemoDb } from './db.ts';
import { findTasksByTitleFixed } from './fixed.ts';
import {
  buildVulnerableSql,
  findTasksByTitleVulnerable,
  type TaskHit,
} from './vulnerable.ts';

const db = openDemoDb();
const totalTasks = (db.prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number }).n;
const userEmails = (db.prepare('SELECT email FROM users').all() as { email: string }[]).map(
  (row) => row.email,
);

type Attack = {
  name: string;
  term: string;
  // True when the rows prove the attack did something the search was never meant to do.
  worked: (rows: TaskHit[]) => boolean;
};

const attacks: Attack[] = [
  {
    name: 'Tautology: make the WHERE clause always true',
    // The quote closes the string, `OR 1=1` is always true, and `--` comments out the rest. The
    // `zzz` matches no title, so every row returned comes from the injected condition. Without it
    // the query would read LIKE '%', which matches every task even with no attack.
    term: "zzz' OR 1=1 --",
    worked: (rows) => rows.length === totalTasks,
  },
  {
    name: 'UNION: read another table through the search box',
    // The first SELECT matches nothing, and the UNION adds one row per user, with the email in
    // the title column. Both SELECTs must return three columns of compatible types.
    term: "zzz' UNION SELECT id, email, name FROM users --",
    worked: (rows) => userEmails.every((email) => rows.some((row) => row.title === email)),
  },
];

function ids(rows: TaskHit[]): string {
  return rows.map((row) => row.id).join(',');
}

function show(rows: TaskHit[]): void {
  const shown = rows.slice(0, 3).map((row) => `${row.id}: ${row.title}`);
  const more = rows.length > 3 ? `, ... (+${rows.length - 3} more)` : '';
  console.log(`    rows: ${rows.length}${shown.length > 0 ? ` -> ${shown.join(' | ')}${more}` : ''}`);
}

let allAsExpected = true;

console.log(`Database: ${totalTasks} tasks, ${userEmails.length} users.\n`);

console.log('Normal use, term "Fix":');
console.log(`  vulnerable SQL: ${buildVulnerableSql('Fix')}`);
const fixVulnerable = findTasksByTitleVulnerable(db, 'Fix');
const fixFixed = findTasksByTitleFixed(db, 'Fix');
show(fixVulnerable);
show(fixFixed);
console.log();

console.log('Normal use, term "zzz" (the baseline for the attacks below, no task has this title):');
const zzzVulnerable = findTasksByTitleVulnerable(db, 'zzz');
const zzzFixed = findTasksByTitleFixed(db, 'zzz');
show(zzzVulnerable);
show(zzzFixed);
console.log();

// The controls: both queries find the same, non-empty set for "Fix", and neither finds anything for
// "zzz".
const controlsOk =
  fixVulnerable.length > 0 &&
  ids(fixVulnerable) === ids(fixFixed) &&
  zzzVulnerable.length === 0 &&
  zzzFixed.length === 0;
console.log(
  `Controls: ${controlsOk ? 'OK' : 'FAILED'} (the fixed query must still search, and "zzz" must match nothing)\n`,
);
if (!controlsOk) allAsExpected = false;

for (const attack of attacks) {
  console.log(`Attack: ${attack.name}`);
  console.log(`  term: ${attack.term}`);
  console.log(`  vulnerable SQL: ${buildVulnerableSql(attack.term)}`);

  const vulnerableRows = findTasksByTitleVulnerable(db, attack.term);
  const succeeded = attack.worked(vulnerableRows);
  console.log(`  vulnerable: ${succeeded ? 'SUCCEEDED' : 'did not work'}`);
  show(vulnerableRows);

  const fixedRows = findTasksByTitleFixed(db, attack.term);
  const blocked = fixedRows.length === 0;
  console.log(`  fixed:      ${blocked ? 'BLOCKED' : 'STILL LEAKING'}`);
  show(fixedRows);
  console.log();

  if (!succeeded || !blocked) allAsExpected = false;
}

// A stacked statement: finish the search, then run a second statement that destroys data.
const stacked = "'; DROP TABLE tasks; --";
console.log('Attack: stacked statement, a second statement after the search');
console.log(`  term: ${stacked}`);
console.log(`  vulnerable SQL: ${buildVulnerableSql(stacked)}`);
try {
  findTasksByTitleVulnerable(db, stacked);
  console.log('  vulnerable: ran without an error');
} catch (error) {
  console.log(`  vulnerable: the driver refused: ${(error as Error).message}`);
}
const stillThere = (db.prepare('SELECT COUNT(*) AS n FROM tasks').get() as { n: number }).n;
console.log(`  tasks table after the attempt: ${stillThere} rows`);
console.log(`  fixed: ${findTasksByTitleFixed(db, stacked).length} rows, the text is only compared, never run\n`);

process.exit(allAsExpected ? 0 : 1);
