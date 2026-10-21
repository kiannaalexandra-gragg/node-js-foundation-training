// Module 4 output: a small run of the whole toolkit with the Task types and Result.
// Run from this folder: npm run demo
import { attempt, unwrapOr } from './domain/result.ts';
import { createTask, type CreateTaskInput, type Task } from './domain/task.ts';
import { readEnv } from './env.ts';
import { mapLimit, retry, sleep, withTimeout } from './toolkit/async-toolkit.ts';

const env = readEnv();
if (!env.ok) {
  console.error(env.error);
  process.exit(1);
}
const { toolkitDelayMs } = env.value;

const inputs: CreateTaskInput[] = [
  { title: 'Set up tsconfig' },
  { title: 'Port the toolkit', status: 'in_progress' },
  { title: 'Model Result<T, E>', description: 'discriminated union' },
  { title: 'Write the guide' },
  { title: 'Open the PR' },
];

// A pretend save: takes `toolkitDelayMs`, then builds the Task.
async function save(input: CreateTaskInput, index: number): Promise<Task> {
  await sleep(toolkitDelayMs);
  return createTask(`task-${index + 1}`, input);
}

// mapLimit<CreateTaskInput, Task>: at most 2 saves at a time, results in input order.
const tasks = await mapLimit(inputs, 2, save);
for (const task of tasks) console.log(`${task.id}  [${task.status}]  ${task.title}`);

// retry<Task>: the first two tries fail, the third succeeds.
const flaky = await retry(
  async (tryNumber) => {
    if (tryNumber < 2) throw new Error(`save failed on attempt ${tryNumber}`);
    return save({ title: 'Flaky save' }, 99);
  },
  { retries: 3, delayMs: 5 },
);
console.log(`retry: ${flaky.title} saved`);

// withTimeout + attempt: a save slower than the timeout becomes an error Result, not a throw.
const slow = await attempt(() => withTimeout(sleep(toolkitDelayMs + 200).then(() => 'late'), toolkitDelayMs));
console.log(slow.ok ? `slow: ${slow.value}` : `slow: ${slow.error.name}: ${slow.error.message}`);
console.log(`unwrapOr: ${unwrapOr(slow, 'fallback value')}`);
