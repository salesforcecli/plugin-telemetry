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
