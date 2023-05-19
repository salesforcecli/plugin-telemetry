/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* eslint-disable no-console */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { assert, expect, config } from 'chai';
import { execCmd, TestSession } from '@salesforce/cli-plugins-testkit';
import { JsonMap } from '@salesforce/ts-types';

config.truncateThreshold = 0;

const getTmpDir = () => path.join(path.join(os.tmpdir(), 'sfdx-telemetry'));

async function getTelemetryFiles(): Promise<string[]> {
  const tmp = getTmpDir();
  const files = (await fs.promises.readdir(tmp)) ?? [];
  console.log(`reading ${files.length} files from ${getTmpDir()}`);
  return files.map((file) => path.join(tmp, file));
}

async function getMostRecentFile(): Promise<string> {
  const file = (await getTelemetryFiles())
    .map((name) => ({ name, ctime: fs.statSync(name).ctime }))
    .sort((a, b) => b.ctime.getTime() - a.ctime.getTime())[0].name;
  return file;
}

async function getTelemetryData(): Promise<JsonMap[]> {
  const events = (await fs.promises.readFile(await getMostRecentFile(), 'utf8'))
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as JsonMap);
  return events;
}

async function clearTelemetryCache(): Promise<void> {
  const tmp = getTmpDir();

  // delete the whole dir and then put it back--only telemetry init does that
  await fs.promises.rm(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 1000 });
  await fs.promises.mkdir(tmp, { recursive: true });
}

describe('telemetry hook', () => {
  let testSession: TestSession;

  before('prepare session', async () => {
    testSession = await TestSession.create();
  });

  after(async () => {
    await testSession?.clean();
  });

  it('should populate the telemetry cache with command execution data', async () => {
    execCmd('telemetry --json', {
      ensureExitCode: 0,
      env: {
        ...process.env,
        SFDX_TELEMETRY_DEBUG: 'true',
        SF_TELEMETRY_DEBUG: 'true',
        SF_DISABLE_TELEMETRY: 'false',
        SFDX_DISABLE_TELEMETRY: 'false',
      },
    });

    const events = await getTelemetryData();

    const cmdExecution = events.find((obj) => obj.command === 'telemetry');
    assert(cmdExecution);
    expect(cmdExecution.eventName).to.equal('COMMAND_EXECUTION');
    expect(cmdExecution.status).to.equal('0');
    expect(cmdExecution.cliId).to.not.be.undefined;
    expect(cmdExecution.timestamp).to.not.be.undefined;
    expect(cmdExecution.plugin).to.not.be.undefined;
    expect(cmdExecution.plugin_version).to.not.be.undefined;
    expect(cmdExecution.platform).to.not.be.undefined;
    expect(cmdExecution.shell).to.not.be.undefined;
    expect(cmdExecution.arch).to.not.be.undefined;
    expect(cmdExecution.nodeEnv).to.not.be.undefined;
    expect(cmdExecution.nodeVersion).to.not.be.undefined;
    expect(cmdExecution.channel).to.not.be.undefined;
    expect(cmdExecution.executable).to.not.be.undefined;
    expect(cmdExecution.date).to.not.be.undefined;
    expect(cmdExecution.type).to.not.be.undefined;
    expect(cmdExecution['oclif.runMs']).to.not.be.undefined;
    expect(cmdExecution['oclif.initMs']).to.not.be.undefined;
    expect(cmdExecution['oclif.configLoadMs']).to.not.be.undefined;
    expect(cmdExecution['oclif.commandLoadMs']).to.not.be.undefined;
    expect(cmdExecution['oclif.corePluginsLoadMs']).to.not.be.undefined;
    expect(cmdExecution['oclif.userPluginsLoadMs']).to.not.be.undefined;
    expect(cmdExecution['oclif.linkedPluginsLoadMs']).to.not.be.undefined;
    expect(cmdExecution['oclif.initHookMs']).to.not.be.undefined;
    expect(cmdExecution['oclif.prerunHookMs']).to.not.be.undefined;
    expect(cmdExecution['oclif.postrunHookMs']).to.not.be.undefined;
    expect(cmdExecution.specifiedFlags).to.deep.equal('json');
    expect(cmdExecution.specifiedFlagFullNames).to.deep.equal('json');
  });

  it('should not populate the telemetry cache when telemetry is disabled', async () => {
    await clearTelemetryCache();

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
