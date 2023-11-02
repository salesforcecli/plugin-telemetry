#!/usr/bin/env -S node --loader ts-node/esm --no-warnings=ExperimentalWarning
// eslint-disable-next-line node/shebang
async function main() {
  const { execute, settings } = await import('@oclif/core');
  settings.performanceEnabled = true;
  await execute({ development: true, dir: import.meta.url });
}

await main();
