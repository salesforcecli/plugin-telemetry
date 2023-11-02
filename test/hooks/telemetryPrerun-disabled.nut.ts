/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, config } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { getTelemetryFiles } from '../helpers/getTelemetryFiles.js';

config.truncateThreshold = 0;

describe('telemetry hook', () => {
  let testSession: TestSession;

  before('prepare session', async () => {
    testSession = await TestSession.create();
  });

  after(async () => {
    await testSession?.clean();
  });

  it('should not populate the telemetry cache when telemetry is disabled', async () => {
    // we are agnostic as to what's still around in the telemetry files, we just don't want this command to add another one.
    // we can't delete them because we don't have permission to do that in the GHA windows temp dir
    const filesBeforeRun = await getTelemetryFiles();

    execCmd('telemetry --json', {
      ensureExitCode: 0,
      env: {
        ...process.env,
        SFDX_TELEMETRY_DEBUG: 'true',
        SF_TELEMETRY_DEBUG: 'true',
        SFDX_DISABLE_TELEMETRY: 'true',
        SF_DISABLE_TELEMETRY: 'true',
      },
    });

    const filesAfterRun = await getTelemetryFiles();
    // sometimes the telemetry uploader runs and removes files, so it's ok if they WERE there but now aren't, but there can't be any new ones
    expect(filesAfterRun.every((file) => filesBeforeRun.includes(file)));
  });
});
