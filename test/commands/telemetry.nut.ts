/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
