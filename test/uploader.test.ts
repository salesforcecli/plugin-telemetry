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

import TelemetryReporter from '@salesforce/telemetry';
import { stubMethod } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import sinon from 'sinon';
import Telemetry from '../src/telemetry.js';
import { Uploader } from '../src/uploader.js';

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

    createStub = stubMethod(sandbox, TelemetryReporter.default, 'create').callsFake(async () => ({
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

    await Uploader.upload('test', 'test', '1.0.0');
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

    await Uploader.upload('test', 'test', '1.0.0');
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
    await Uploader.upload('test', 'test', '1.0.0');
    expect(createStub.called).to.equal(true);
    expect(createStub.firstCall.args[0].userId).to.equal('testId');
  });

  it('clears telemetry file', async () => {
    readStub.resolves([]);
    await Uploader.upload('test', 'test', '1.0.0');
    expect(clearStub.called).to.equal(true);
  });
});
