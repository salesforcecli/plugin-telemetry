/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Interfaces, Performance } from '@oclif/core';
import { stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import sinon from 'sinon';
import { CommandExecution } from '../src/commandExecution.js';
import { MyCommand } from './helpers/myCommand.js';

describe('toJson', () => {
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    stubMethod(sandbox, Performance, 'oclifPerf').get(() => ({
      runTime: 0,
      initTime: 0,
      configLoadTime: 0,
      commandLoadTime: 0,
      corePluginsLoadTime: 0,
      userPluginsLoadTime: 0,
      linkedPluginsLoadTime: 0,
      hookRunTimes: {
        init: { total: 0 },
        prerun: { total: 0 },
        postrun: { total: 0 },
      },
    }));
    process.env = {};
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('shows event name', async () => {
    const config = stubInterface<Interfaces.Config>(sandbox, {});
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
    const config = stubInterface<Interfaces.Config>(sandbox, {});
    const execution = await CommandExecution.create({
      argv: ['--flag', '-t=asdf'],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();

    expect(actual.specifiedFlags).to.equal('flag t');
    expect(actual.specifiedFlagFullNames).to.equal('flag test');
  });

  it('shows deprecated chars as chars', async () => {
    process.env.CI = 'true';
    const config = stubInterface<Interfaces.Config>(sandbox, {});
    const execution = await CommandExecution.create({
      // -i is deprecated
      argv: ['--flag', '-i="abc"'],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();

    expect(actual.deprecatedFlagsUsed).to.equal('i');
    expect(actual.specifiedFlags).to.equal('flag valid');
    expect(actual.specifiedFlagFullNames).to.equal('flag valid');
  });

  it('shows multiple deprecated chars as chars', async () => {
    process.env.CI = 'true';
    const config = stubInterface<Interfaces.Config>(sandbox, {});
    const execution = await CommandExecution.create({
      // -i and -o are deprecated
      argv: ['--flag', '-i="abc"', '-o="why"'],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();

    expect(actual.deprecatedFlagsUsed).to.equal('i o');
    expect(actual.specifiedFlags).to.equal('flag valid newflag');
    expect(actual.specifiedFlagFullNames).to.equal('flag valid newflag');
  });

  it('shows deprecated flags as flags', async () => {
    process.env.CI = 'true';
    const config = stubInterface<Interfaces.Config>(sandbox, {});
    const execution = await CommandExecution.create({
      // --invalid is deprecated
      argv: ['--flag', '--invalid="abc"'],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();

    expect(actual.deprecatedFlagsUsed).to.equal('invalid');
    expect(actual.specifiedFlags).to.equal('flag valid');
    expect(actual.specifiedFlagFullNames).to.equal('flag valid');
  });

  it('shows multiple deprecated flags as flags', async () => {
    process.env.CI = 'true';
    const config = stubInterface<Interfaces.Config>(sandbox, {});
    const execution = await CommandExecution.create({
      // --invalid and --oldflag are deprecated
      argv: ['--flag', '--invalid="abc"', '--oldflag="why"'],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();

    expect(actual.deprecatedFlagsUsed).to.equal('invalid oldflag');
    expect(actual.specifiedFlags).to.equal('flag valid newflag');
    expect(actual.specifiedFlagFullNames).to.equal('flag valid newflag');
  });

  it('shows multiple deprecated flags and chars as flags and chars', async () => {
    process.env.CI = 'true';
    const config = stubInterface<Interfaces.Config>(sandbox, {});
    const execution = await CommandExecution.create({
      // --invalid and -o are deprecated
      argv: ['--flag', '--invalid="abc"', '-o="why"'],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();

    expect(actual.deprecatedFlagsUsed).to.equal('invalid o');
    expect(actual.specifiedFlags).to.equal('flag valid newflag');
    expect(actual.specifiedFlagFullNames).to.equal('flag valid newflag');
  });

  it('shows captures deprecated alias usage', async () => {
    process.env.CI = 'true';
    // call with deprecated alias
    process.argv = ['path/to/my/node', 'path/to/sf', 'deprecated:alias', '--oldflag="why"'];
    const config = stubInterface<Interfaces.Config>(sandbox, {});
    const execution = await CommandExecution.create({
      argv: ['--oldflag="why"'],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();
    expect(actual.specifiedFlags).to.equal('newflag');
    expect(actual.specifiedFlagFullNames).to.equal('newflag');
    expect(actual.deprecatedFlagsUsed).to.equal('oldflag');
    expect(actual.deprecatedCommandUsed).to.equal('deprecated:alias');
  });

  it('does not capture flags that have a default value but were not specified by the user', async () => {
    process.env.CI = 'true';
    const config = stubInterface<Interfaces.Config>(sandbox, {});

    // the `test` command has `user` flag that sets a default value
    // we run this command with no flags to ensure only flags specified (typed by user) are captured in telemetry
    const execution = await CommandExecution.create({
      argv: [],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();
    expect(actual.specifiedFlags).to.equal('');
    expect(actual.specifiedFlagFullNames).to.equal('');
    expect(actual.deprecatedFlagsUsed).to.equal('');
  });

  it('captures flag if used non-deprecated alias', async () => {
    process.env.CI = 'true';
    const config = stubInterface<Interfaces.Config>(sandbox, {});

    // flag name: "blue"
    // flag alias: "bleu"
    // non-deprecated alias
    const execution = await CommandExecution.create({
      argv: ['--bleu', 'test'],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();
    expect(actual.specifiedFlags).to.equal('blue');
    expect(actual.specifiedFlagFullNames).to.equal('blue');
    expect(actual.deprecatedFlagsUsed).to.equal('');
  });

  it('captures flag if used non-deprecated char alias', async () => {
    process.env.CI = 'true';
    const config = stubInterface<Interfaces.Config>(sandbox, {});

    // flag name: "red"
    // flag char: "r"
    // flag char alias: "e"
    // non-deprecated alias
    const execution = await CommandExecution.create({
      argv: ['-e', 'test'],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();
    expect(actual.specifiedFlags).to.equal('red');
    expect(actual.specifiedFlagFullNames).to.equal('red');
    expect(actual.deprecatedFlagsUsed).to.equal('');
  });

  it('shows short help flag', async () => {
    process.env.CI = 'true';
    const config = stubInterface<Interfaces.Config>(sandbox, {});
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
    const config = stubInterface<Interfaces.Config>(sandbox, {});
    const execution = await CommandExecution.create({
      argv: ['--help'],
      command: MyCommand,
      config,
    });
    const actual = execution.toJson();

    expect(actual.specifiedFlags).to.equal('help');
    expect(actual.specifiedFlagFullNames).to.equal('help');
  });
});
