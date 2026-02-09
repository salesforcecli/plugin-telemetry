/*
 * Copyright 2026, Salesforce, Inc.
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
import { assert, expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';

describe('telemetry', () => {
  let testSession: TestSession;

  before('prepare session and ensure environment variables', async () => {
    testSession = await TestSession.create();
  });

  after(async () => {
    await testSession?.clean();
  });

  it('should show that telemetry is enabled', () => {
    const command = 'telemetry';
    const result = execCmd(command, { ensureExitCode: 0, env: { ...process.env, SF_DISABLE_TELEMETRY: 'false' } })
      .shellOutput.stdout;
    const output = result.split('\n');

    const tempDir = output[1].split(' ').slice(-1).pop()?.slice(0, -1);
    const cacheDir = output[2].split(' ').slice(-1).pop()?.slice(0, -1);
    assert(tempDir);
    assert(cacheDir);
    expect(fs.existsSync(tempDir)).to.be.true;
    expect(fs.existsSync(cacheDir)).to.be.true;
    expect(output[0]).to.include('Telemetry is enabled');
  });
});
