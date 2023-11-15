/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook, Config } from '@oclif/core';

import enabledCheckStubs from '@salesforce/telemetry/enabledCheck';
import { StubbedType, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import sinon from 'sinon';
import Telemetry from '../../src/telemetry.js';
import { CommandExecution } from '../../src/commandExecution.js';
import hook from '../../src/hooks/telemetryPrerun.js';
import { MyCommand } from '../helpers/myCommand.js';

const args = { argv: [], Command: MyCommand, config: {} as Config, context: {} as Hook.Context };

describe('telemetry prerun hook', () => {
  let sandbox: sinon.SinonSandbox;
  let determineSfdxTelemetryEnabledStub: sinon.SinonStub;
  let createCommandStub: sinon.SinonStub;
  let recordStub: sinon.SinonStub;
  let recordErrorStub: sinon.SinonStub;
  let uploadStub: sinon.SinonStub;
  let processExitStub: sinon.SinonStub;
  let processCmdErrorStub: sinon.SinonStub;

  let config: StubbedType<Config>;
  let context: StubbedType<Hook.Context>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    determineSfdxTelemetryEnabledStub = stubMethod(sandbox, enabledCheckStubs, 'isEnabled');
    recordStub = sandbox.stub();
    recordErrorStub = sandbox.stub();
    uploadStub = sandbox.stub();
    config = stubInterface<Config>(sandbox, {});
    context = stubInterface<Hook.Context>(sandbox, { config });

    processExitStub = stubMethod(sandbox, process, 'once');
    processCmdErrorStub = stubMethod(sandbox, process, 'on').withArgs('sfCommandError');
    createCommandStub = stubMethod(sandbox, CommandExecution, 'create').callsFake(async () => ({
      toJson: () => ({}),
      getPluginInfo: () => ({
        name: '@salesforce/foo',
        version: '1.0.0',
      }),
      getCommandName: () => 'foo:bar',
    }));
    stubMethod(sandbox, Telemetry, 'create').callsFake(async () => ({
      record: recordStub,
      recordError: recordErrorStub,
      upload: uploadStub,
    }));
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('does nothing if telemetry is disabled ', async () => {
    determineSfdxTelemetryEnabledStub.resolves(false);

    await hook.call(context, args);

    expect(processExitStub.called).to.equal(false);
    expect(processCmdErrorStub.called).to.equal(false);
    expect(createCommandStub.called).to.equal(false);
  });

  describe('handlers', () => {
    beforeEach(() => {
      determineSfdxTelemetryEnabledStub.resolves(true);
    });
    it('does nothing if error is thrown', async () => {
      createCommandStub.restore();
      stubMethod(sandbox, CommandExecution, 'create').throws({});
      await hook.call(context, args);

      expect(processExitStub.called).to.equal(false);
      expect(processCmdErrorStub.called).to.equal(false);
      expect(createCommandStub.called).to.equal(false);
    });
    it('registers handlers', async () => {
      await hook.call(context, args);

      expect(createCommandStub.called).to.equal(true);
      expect(processExitStub.called).to.equal(true);
      expect(processCmdErrorStub.called).to.equal(true);
      expect(recordStub.called).to.equal(false);
      expect(uploadStub.called).to.equal(false);
    });

    it('calls record and upload on exit', async () => {
      await hook.call(context, args);

      expect(createCommandStub.called).to.equal(true);
      expect(processExitStub.called).to.equal(true);
      expect(processCmdErrorStub.called).to.equal(true);

      processExitStub.firstCall.args[1](0);

      expect(recordStub.called).to.equal(true);
      expect(uploadStub.called).to.equal(true);

      expect(recordErrorStub.called).to.equal(false);
    });

    it('calls record twice if exit listeners is 20', async () => {
      sandbox.stub(process, 'listenerCount').returns(20);

      await hook.call(context, args);

      expect(createCommandStub.called).to.equal(true);
      expect(processExitStub.called).to.equal(true);
      expect(processCmdErrorStub.called).to.equal(true);

      processExitStub.firstCall.args[1](0);

      expect(recordStub.calledTwice).to.equal(true);
      expect(uploadStub.called).to.equal(true);

      expect(recordErrorStub.called).to.equal(false);
    });
  });
});
