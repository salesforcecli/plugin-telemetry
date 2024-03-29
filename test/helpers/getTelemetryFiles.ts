/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import fs from 'node:fs';
import path from 'node:path';
import Telemetry from '../../src/telemetry.js';

export async function getTelemetryFiles(): Promise<string[]> {
  const tmp = Telemetry.tmpDir;
  const files = (await fs.promises.readdir(tmp)) ?? [];
  // eslint-disable-next-line no-console
  console.log(`reading ${files.length} files from ${tmp}`);
  return files.map((file) => path.join(tmp, file));
}
