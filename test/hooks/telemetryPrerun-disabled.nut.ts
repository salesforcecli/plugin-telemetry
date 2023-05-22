/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, config } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { getTelemetryFiles } from '../helpers/getTelemetryFiles';

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
    const filesBeforeRun = await getTelemetryFiles();
    expect(filesBeforeRun).to.deep.equal([]);

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

    const files = await getTelemetryFiles();
    expect(files).to.deep.equal([]);
  });
});
