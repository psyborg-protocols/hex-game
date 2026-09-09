// _harness.mjs — the whole test framework. No dependencies, by design.

const cases = [];
export function test(name, fn) { cases.push({ name, fn }); }

export function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`${msg || 'not equal'}\n    expected ${b}\n    actual   ${a}`);
}

export function ok(cond, msg) {
  if (!cond) throw new Error(msg || 'expected truthy');
}

export async function run(title) {
  console.log(`\n${title}`);
  let failed = 0;
  for (const c of cases) {
    try {
      await c.fn();
      console.log(`  ok   ${c.name}`);
    } catch (e) {
      failed++;
      console.log(`  FAIL ${c.name}\n    ${e.message.split('\n').join('\n    ')}`);
    }
  }
  console.log(failed ? `\n${failed} of ${cases.length} failed` : `\nall ${cases.length} passed`);
  process.exit(failed ? 1 : 0);
}
