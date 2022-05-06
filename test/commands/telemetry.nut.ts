/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import { expect } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { getString } from '@salesforce/ts-types';

describe('telemetry', () => {
  let testSession: TestSession;

  before('prepare session and ensure environment variables', async () => {
    testSession = await TestSession.create({});
  });

  after(async () => {
    await testSession?.clean();
  });

  it('should enable the telemetry', () => {
    const command = 'telemetry';
    const result = execCmd(command, { ensureExitCode: 0 });
    const output = getString(result, 'shellOutput.stdout').split('\n');
    const tempDir = output[1].split(' ').slice(-1).pop().slice(0, -1);
    const cacheDir = output[2].split(' ').slice(-1).pop().slice(0, -1);
    expect(fs.existsSync(tempDir)).to.be.true;
    expect(fs.existsSync(cacheDir)).to.be.true;
    expect(output[0]).to.include('Telemetry is enabled');
  });
});
