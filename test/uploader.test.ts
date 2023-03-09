/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import TelemetryReporter from '@salesforce/telemetry';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import * as sinon from 'sinon';
import Telemetry from '../src/telemetry';
import { Uploader } from '../src/uploader';

describe('uploader', () => {
  let sandbox: sinon.SinonSandbox;
  let createStub: sinon.SinonStub;
  let sendTelemetryEventStub: sinon.SinonStub;
  let sendTelemetryExceptionStub: sinon.SinonStub;
  let stopStub: sinon.SinonStub;
  let readStub: sinon.SinonStub;
  let clearStub: sinon.SinonStub;
  let getCliIdStub: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    sendTelemetryEventStub = sandbox.stub();
    sendTelemetryExceptionStub = sandbox.stub(); // stubMethod(sandbox, TelemetryReporter.prototype, 'sendTelemetryException');
    stopStub = sandbox.stub(); // stubMethod(sandbox, TelemetryReporter.prototype, 'stop');
    readStub = sandbox.stub();
    clearStub = sandbox.stub();
    getCliIdStub = sandbox.stub().returns('testId');

    createStub = stubMethod(sandbox, TelemetryReporter, 'create').callsFake(async () => ({
      sendTelemetryEvent: sendTelemetryEventStub,
      sendTelemetryException: sendTelemetryExceptionStub,
      stop: stopStub,
    }));
    stubMethod(sandbox, Telemetry, 'create').callsFake(async () => ({
      getCLIId: getCliIdStub,
      read: readStub,
      clear: clearStub,
    }));
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('sends events', async () => {
    readStub.resolves([
      {
        eventName: 'test',
        type: Telemetry.EVENT,
        data: 'testData',
      },
    ]);

    await Uploader.upload('test', 'test');
    expect(sendTelemetryEventStub.called).to.equal(true);
    expect(sendTelemetryEventStub.firstCall.args[0]).to.equal('test');
    expect(sendTelemetryEventStub.firstCall.args[1].eventName).to.equal(undefined);
    expect(sendTelemetryEventStub.firstCall.args[1].type).to.equal(undefined);
    expect(sendTelemetryEventStub.firstCall.args[1].data).to.equal('testData');
  });

  it('sends exception', async () => {
    readStub.resolves([
      {
        eventName: 'test',
        type: Telemetry.EXCEPTION,
        error: { stack: 'testStack' },
        data: 'testData',
      },
    ]);

    await Uploader.upload('test', 'test');
    expect(sendTelemetryExceptionStub.called).to.equal(true);

    const error = sendTelemetryExceptionStub.firstCall.args[0];
    expect(error).instanceOf(Error);
    expect(error.stack).to.equal('testStack');
    expect(sendTelemetryExceptionStub.firstCall.args[1].eventName).to.equal(undefined);
    expect(sendTelemetryExceptionStub.firstCall.args[1].type).to.equal(undefined);
    expect(sendTelemetryExceptionStub.firstCall.args[1].data).to.equal('testData');
  });

  it('telemetry sets cliId as userId', async () => {
    readStub.resolves([]);
    await Uploader.upload('test', 'test');
    expect(createStub.called).to.equal(true);
    expect(createStub.firstCall.args[0].userId).to.equal('testId');
  });

  it('clears telemetry file', async () => {
    readStub.resolves([]);
    await Uploader.upload('test', 'test');
    expect(clearStub.called).to.equal(true);
  });
});
