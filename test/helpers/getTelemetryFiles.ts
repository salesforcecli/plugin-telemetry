/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
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
