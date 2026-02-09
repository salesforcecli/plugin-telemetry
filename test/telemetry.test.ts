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

/* eslint-disable @typescript-eslint/no-unsafe-argument */

import cp from 'node:child_process';
import { EOL } from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { inspect } from 'node:util';
import { stubMethod } from '@salesforce/ts-sinon';
import { SfError } from '@salesforce/core';
import { expect } from 'chai';
import sinon from 'sinon';
import Telemetry from '../src/telemetry.js';

describe('telemetry', () => {
  let sandbox: sinon.SinonSandbox;
  let openStub: sinon.SinonStub;
  let readFileSyncStub: sinon.SinonStub;
  let writeFileSyncStub: sinon.SinonStub;
  let writeSyncStub: sinon.SinonStub;
  let readFileStub: sinon.SinonStub;
  let unlinkStub: sinon.SinonStub;
  let accessStub: sinon.SinonStub;
  let mkdirStub: sinon.SinonStub;
  let writeFileStub: sinon.SinonStub;
  const env = process.env;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    openStub = stubMethod(sandbox, fs, 'openSync');
    readFileSyncStub = stubMethod(sandbox, fs, 'readFileSync');
    writeFileSyncStub = stubMethod(sandbox, fs, 'writeFileSync');
    writeSyncStub = stubMethod(sandbox, fs, 'writeSync');
    readFileStub = stubMethod(sandbox, fs.promises, 'readFile');
    unlinkStub = stubMethod(sandbox, fs.promises, 'unlink');
    accessStub = stubMethod(sandbox, fs.promises, 'access');
    mkdirStub = stubMethod(sandbox, fs.promises, 'mkdir');
    writeFileStub = stubMethod(sandbox, fs.promises, 'writeFile');
    process.env = {};

    // Return a fake CLI ID
    readFileSyncStub.withArgs(path.join('test', 'CLIID.txt')).returns('testCliID');

    // Reset caches
    Telemetry['acknowledged'] = false;
  });

  afterEach(() => {
    sandbox.restore();
    process.env = env;
  });

  it('shows telemetry warning', async () => {
    const warn = stubMethod(sandbox, console, 'warn');
    // Access private property and method
    Telemetry['cacheDir'] = 'test';
    await Telemetry['acknowledgeDataCollection']();
    expect(accessStub.called).to.equal(true);
    expect(warn.called).to.equal(false);
  });

  it('does not show telemetry warning', async () => {
    const warn = stubMethod(sandbox, console, 'warn');
    accessStub.throws({ code: 'ENOENT' });
    // Access private property and method
    Telemetry['cacheDir'] = 'test';
    await Telemetry['acknowledgeDataCollection']();
    expect(accessStub.called).to.equal(true);
    expect(mkdirStub.called).to.equal(true);
    expect(writeFileStub.called).to.equal(true);
    expect(warn.called).to.equal(true);
  });
  it('does not show telemetry warning on unknown error', async () => {
    const warn = stubMethod(sandbox, console, 'warn');
    accessStub.throws({ code: 'ACCESS' });
    // Access private property and method
    Telemetry['cacheDir'] = 'test';
    await Telemetry['acknowledgeDataCollection']();
    expect(accessStub.called).to.equal(true);
    expect(mkdirStub.called).to.equal(false);
    expect(writeFileStub.called).to.equal(false);
    expect(warn.called).to.equal(false);
  });

  describe('record', () => {
    it('sets defaults', async () => {
      const telemetry = await Telemetry.create({ cacheDir: 'test' });
      telemetry.record({});

      expect(writeSyncStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeSyncStub.firstCall.args[1]);
      expect(logLine.type).to.contains(Telemetry.EVENT);
      expect(logLine.eventName).to.contains('UNKNOWN');
      expect(logLine).to.be.haveOwnProperty('requestorLocation');
      expect(logLine).to.be.haveOwnProperty('cliId').and.equal('testCliID');

      expect(openStub.called).to.equal(true);
      // Only called once for the CLI ID
      expect(readFileSyncStub.calledTwice).to.equal(false);
      expect(writeFileSyncStub.called).to.equal(false);
      expect(unlinkStub.called).to.equal(false);
      // It should call our to check usage file
      expect(accessStub.called).to.equal(true);
      expect(mkdirStub.called).to.equal(false);
      expect(writeFileStub.called).to.equal(false);
    });

    it('shows jenkins CI', async () => {
      process.env.JENKINS_WORKSPACE = 'test';
      const telemetry = await Telemetry.create({ cacheDir: 'test' });
      telemetry.record({});
      expect(writeSyncStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeSyncStub.firstCall.args[1]);
      expect(logLine.ci).to.equal('jenkins');
    });

    it('shows travis CI', async () => {
      process.env.TRAVIS = 'true';
      const telemetry = await Telemetry.create({ cacheDir: 'test' });
      telemetry.record({});
      expect(writeSyncStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeSyncStub.firstCall.args[1]);
      expect(logLine.ci).to.equal('travisci');
    });
    it('shows circle CI', async () => {
      process.env.CIRCLE_BRANCH = 'master';
      const telemetry = await Telemetry.create({ cacheDir: 'test' });
      telemetry.record({});
      expect(writeSyncStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeSyncStub.firstCall.args[1]);
      expect(logLine.ci).to.equal('circleci');
    });
    it('shows github actions CI', async () => {
      process.env.GITHUB_ACTIONS = 'test';
      const telemetry = await Telemetry.create({ cacheDir: 'test' });
      telemetry.record({});
      expect(writeSyncStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeSyncStub.firstCall.args[1]);
      expect(logLine.ci).to.equal('github_actions');
    });
    it('shows CI', async () => {
      process.env.CI = 'true';
      const telemetry = await Telemetry.create({ cacheDir: 'test' });
      telemetry.record({});
      expect(writeSyncStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeSyncStub.firstCall.args[1]);
      expect(logLine.ci).to.equal('unknown');
    });

    it('scrubs non valid types', async () => {
      const telemetry = await Telemetry.create({ cacheDir: 'test' });
      telemetry.record({
        a: 'test',
        b: false,
        c: 0,
        d: { a: 'b' },
      });

      expect(writeSyncStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeSyncStub.firstCall.args[1]);
      expect(logLine.a).to.equal('test');
      expect(logLine.b).to.equal(false);
      expect(logLine.c).to.equal(0);
      expect(logLine.d).to.equal(undefined);
    });
    it('does not scrub error exceptions', async () => {
      const telemetry = await Telemetry.create({ cacheDir: 'test' });
      class MyError extends Error {
        public additionalErrorInfo = 'testInfo';
      }
      const error = new MyError('testMessage');
      error.name = 'testName';
      error.stack = 'testStack';

      telemetry.recordError(error, { additionalInfo: 'testing' });

      expect(writeSyncStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeSyncStub.firstCall.args[1]);
      expect(logLine.error.name).to.deep.equal('testName');
      expect(logLine.error.message).to.deep.equal('testMessage');
      expect(logLine.error.stack).to.deep.equal('testStack');
      expect(logLine.error.additionalErrorInfo).to.deep.equal('testInfo');
      expect(logLine.additionalInfo).to.deep.equal('testing');
    });
    it('propagates error.data and error.cause', async () => {
      const telemetry = await Telemetry.create({ cacheDir: 'test' });
      const errorCause = new Error('this is the cause of the problem');
      errorCause.name = 'TheErrorCause';
      const error = new SfError('top level message', 'TopLevelErrorName', ['take this action'], errorCause);
      error.data = { clientId: 'asdf1234', grantType: 'authcode' };

      telemetry.recordError(error, { foo: 'bar' });

      expect(writeSyncStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeSyncStub.firstCall.args[1]);
      expect(logLine.error.name).to.equal('TopLevelErrorName');
      expect(logLine.error.message).to.equal('top level message');
      expect(logLine.error.stack).to.be.ok;
      expect(logLine.errorName).to.equal('TopLevelErrorName');
      expect(logLine.errorMessage).to.equal('top level message');
      expect(logLine.errorData).to.equal(JSON.stringify(error.data));
      expect(logLine.errorCause).to.equal(inspect(errorCause));
      expect(logLine.foo).to.equal('bar');
    });
  });

  it('clear deletes file', async () => {
    const telemetry = await Telemetry.create({ cacheDir: 'test' });
    await telemetry.clear();
    expect(unlinkStub.called).to.equal(true);
  });

  it('read file parses lines properly', async () => {
    readFileStub.returns(`{ "eventName": "test1" }${EOL}{ "eventName": "test2" }`);
    const telemetry = await Telemetry.create({ cacheDir: 'test' });
    const data = await telemetry.read();
    expect(data[0].eventName).to.equal('test1');
    expect(data[1].eventName).to.equal('test2');
  });

  it('upload spawns completely detached process', async () => {
    const unref = sinon.stub();
    const stub = stubMethod(sandbox, cp, 'spawn').returns({ unref });
    const telemetry = await Telemetry.create({ cacheDir: 'test' });
    telemetry.upload();
    expect(stub.called).to.equal(true);
    // True detached process
    expect(stub.firstCall.args[2].detached).to.equal(true);
    expect(stub.firstCall.args[2].stdio).to.equal('ignore');
    expect(unref.called).to.equal(true);
  });
});
