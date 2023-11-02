#!/usr/bin/env node

// eslint-disable-next-line node/shebang
async function main() {
  const { execute, settings } = await import('@oclif/core');
  settings.performanceEnabled = true;
  await execute({ dir: import.meta.url });
}

await main();
