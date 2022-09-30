/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook, Config } from '@oclif/core';
import { SfError } from '@salesforce/core';
import TelemetryReporter from '@salesforce/telemetry';
import { StubbedType, stubInterface, stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import * as sinon from 'sinon';
import Telemetry from '../../src/telemetry';
import { CommandExecution } from '../../src/commandExecution';
import hook from '../../src/hooks/telemetryPrerun';
import { MyCommand } from '../helpers/myCommand';

// The hook doesn't like the stubInterface type, so just set it to any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const args: any = { argv: [], Command: MyCommand };

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
    determineSfdxTelemetryEnabledStub = stubMethod(sandbox, TelemetryReporter, 'determineSfdxTelemetryEnabled');
    recordStub = sandbox.stub();
    recordErrorStub = sandbox.stub();
    uploadStub = sandbox.stub();
    config = stubInterface<Config>(sandbox, {});
    context = stubInterface<Hook.Context>(sandbox, { config });

    processExitStub = stubMethod(sandbox, process, 'once');
    processCmdErrorStub = stubMethod(sandbox, process, 'on').withArgs('cmdError');
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

    it('calls recordError on cmdError with no org', async () => {
      await hook.call(context, args);

      expect(createCommandStub.called).to.equal(true);
      expect(processExitStub.called).to.equal(true);
      expect(processCmdErrorStub.called).to.equal(true);

      await processCmdErrorStub.firstCall.args[1](new SfError('test'), {});

      expect(recordErrorStub.called).to.equal(true);
      expect(recordErrorStub.firstCall.args[1].orgType).to.equal(undefined);

      expect(recordStub.called).to.equal(false);
      expect(uploadStub.called).to.equal(false);
    });

    it('calls recordError on cmdError with devhub org', async () => {
      await hook.call(context, args);

      expect(createCommandStub.called).to.equal(true);
      expect(processExitStub.called).to.equal(true);
      expect(processCmdErrorStub.called).to.equal(true);

      await processCmdErrorStub.firstCall.args[1](
        new SfError('test'),
        {},
        {
          determineIfDevHubOrg: async () => true,
          getConnection: () => ({ getApiVersion: () => '47.0' }),
        }
      );

      expect(recordErrorStub.called).to.equal(true);
      expect(recordErrorStub.firstCall.args[1].orgType).to.equal('devhub');

      expect(recordStub.called).to.equal(false);
      expect(uploadStub.called).to.equal(false);
    });

    it('calls recordError on cmdError with scratch org', async () => {
      await hook.call(context, args);

      expect(createCommandStub.called).to.equal(true);
      expect(processExitStub.called).to.equal(true);
      expect(processCmdErrorStub.called).to.equal(true);

      await processCmdErrorStub.firstCall.args[1](
        new SfError('test'),
        {},
        {
          determineIfDevHubOrg: async () => false,
          checkScratchOrg: async () => {},
          getConnection: () => ({ getApiVersion: () => '47.0' }),
        }
      );

      expect(recordErrorStub.called).to.equal(true);
      expect(recordErrorStub.firstCall.args[1].orgType).to.equal('scratch');

      expect(recordStub.called).to.equal(false);
      expect(uploadStub.called).to.equal(false);
    });

    it('calls recordError on cmdError with undefined org when not a scratch org', async () => {
      await hook.call(context, args);

      expect(createCommandStub.called).to.equal(true);
      expect(processExitStub.called).to.equal(true);
      expect(processCmdErrorStub.called).to.equal(true);

      await processCmdErrorStub.firstCall.args[1](
        new SfError('test'),
        {},
        {
          determineIfDevHubOrg: async () => false,
          checkScratchOrg: async () => Promise.reject(new Error()),
          getConnection: () => ({ getApiVersion: () => '47.0' }),
        }
      );

      expect(recordErrorStub.called).to.equal(true);
      expect(recordErrorStub.firstCall.args[1].orgType).to.equal(undefined);

      expect(recordStub.called).to.equal(false);
      expect(uploadStub.called).to.equal(false);
    });

    it('calls recordError on cmdError when failing to determine org type', async () => {
      await hook.call(context, args);

      expect(createCommandStub.called).to.equal(true);
      expect(processExitStub.called).to.equal(true);
      expect(processCmdErrorStub.called).to.equal(true);

      await processCmdErrorStub.firstCall.args[1](
        new SfError('test'),
        {},
        {
          determineIfDevHubOrg: async () => Promise.reject(new Error()),
          checkScratchOrg: async () => {},
          getConnection: () => ({ getApiVersion: () => '47.0' }),
        }
      );

      expect(recordErrorStub.called).to.equal(true);
      expect(recordErrorStub.firstCall.args[1].orgType).to.equal(undefined);

      expect(recordStub.called).to.equal(false);
      expect(uploadStub.called).to.equal(false);
    });
  });
});
