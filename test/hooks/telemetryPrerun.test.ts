/*
 * Copyright 2025, Salesforce, Inc.
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
