/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Config } from '@oclif/core';
import { stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import { createSandbox } from 'sinon';
import { CommandExecution } from '../src/commandExecution';
import { MyCommand } from './helpers/myCommand';

describe('toJson', () => {
  const sandbox = createSandbox();

  beforeEach(() => {
    stubMethod(sandbox, CommandExecution, 'resolveVCSInfo').returns('git');
    process.env = {};
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('shows event name', async () => {
    const config = stubInterface<Config>(sandbox, {});
    const execution = await CommandExecution.create({
      argv: [],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();

    expect(actual.eventName).to.equal('COMMAND_EXECUTION');
  });

  it('shows flags', async () => {
    process.env.CI = 'true';
    const config = stubInterface<Config>(sandbox, {});
    const execution = await CommandExecution.create({
      argv: ['--flag', '-t=asdf'],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();

    expect(actual.specifiedFlags).to.equal('flag t');
    expect(actual.specifiedFlagFullNames).to.equal('flag test');
  });

  it('shows short help flag', async () => {
    process.env.CI = 'true';
    const config = stubInterface<Config>(sandbox, {});
    const execution = await CommandExecution.create({
      argv: ['-h'],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();

    expect(actual.specifiedFlags).to.equal('h');
    expect(actual.specifiedFlagFullNames).to.equal('help');
  });

  it('shows long help flag', async () => {
    process.env.CI = 'true';
    const config = stubInterface<Config>(sandbox, {});
    const execution = await CommandExecution.create({
      argv: ['--help'],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();

    expect(actual.specifiedFlags).to.equal('help');
    expect(actual.specifiedFlagFullNames).to.equal('help');
  });

  it('shows default org ids', async () => {
    process.env.CI = 'true';
    const config = stubInterface<Config>(sandbox, {});
    const execution = await CommandExecution.create({
      argv: [],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();

    expect(actual.devHubUsername).to.equal(undefined);
    expect(actual.orgUsername).to.equal(undefined);
  });

  it('shows org ids with flags', async () => {
    process.env.CI = 'true';
    const config = stubInterface<Config>(sandbox, {});
    const execution = await CommandExecution.create({
      argv: ['--targetusername=org', '--targetdevhubusername=devhub'],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();

    expect(actual.devHubUsername).to.equal('devhub');
    expect(actual.orgUsername).to.equal('org');
  });
});
