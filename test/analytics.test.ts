/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as cp from 'child_process';
import * as systemFs from 'fs';
import { EOL } from 'os';
import { fs } from '@salesforce/core';
import { stubMethod } from '@salesforce/ts-sinon';
// import { Dictionary } from '@salesforce/ts-types';
import { expect } from 'chai';
import * as sinon from 'sinon';
import Analytics from '../src/analytics';

describe('analytics', () => {
  let sandbox: sinon.SinonSandbox;
  let openStub: sinon.SinonStub;
  let readFileSyncStub: sinon.SinonStub;
  let writeFileStub: sinon.SinonStub;
  let writeStub: sinon.SinonStub;
  let readFileStub: sinon.SinonStub;
  let unlinkStub: sinon.SinonStub;
  let accessStub: sinon.SinonStub;
  let mkdirpStub: sinon.SinonStub;
  let writeJsonStub: sinon.SinonStub;
  const env = process.env;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    openStub = stubMethod(sandbox, systemFs, 'openSync');
    readFileSyncStub = stubMethod(sandbox, systemFs, 'readFileSync');
    writeFileStub = stubMethod(sandbox, systemFs, 'writeFileSync');
    writeStub = stubMethod(sandbox, systemFs, 'writeSync');
    readFileStub = stubMethod(sandbox, fs, 'readFile');
    unlinkStub = stubMethod(sandbox, fs, 'unlink');
    accessStub = stubMethod(sandbox, fs, 'access');
    mkdirpStub = stubMethod(sandbox, fs, 'mkdirp');
    writeJsonStub = stubMethod(sandbox, fs, 'writeJson');
    process.env = {};

    // Return a fake CLI ID
    readFileSyncStub.withArgs('test/CLIID.txt').returns('testCliID');

    // Reset caches
    Analytics['acknowledged'] = false;
  });

  afterEach(() => {
    sandbox.restore();
    process.env = env;
  });

  it('shows telemetry warning', async () => {
    const warn = stubMethod(sandbox, console, 'warn');
    // Access private property and method
    Analytics['cacheDir'] = 'test';
    await Analytics['acknowledgeDataCollection']();
    expect(accessStub.called).to.equal(true);
    expect(warn.called).to.equal(false);
  });

  it('does not show telemetry warning', async () => {
    const warn = stubMethod(sandbox, console, 'warn');
    accessStub.throws({ code: 'ENOENT' });
    // Access private property and method
    Analytics['cacheDir'] = 'test';
    await Analytics['acknowledgeDataCollection']();
    expect(accessStub.called).to.equal(true);
    expect(mkdirpStub.called).to.equal(true);
    expect(writeJsonStub.called).to.equal(true);
    expect(warn.called).to.equal(true);
  });
  it('does not show telemetry warning on unknown error', async () => {
    const warn = stubMethod(sandbox, console, 'warn');
    accessStub.throws({ code: 'ACCESS' });
    // Access private property and method
    Analytics['cacheDir'] = 'test';
    await Analytics['acknowledgeDataCollection']();
    expect(accessStub.called).to.equal(true);
    expect(mkdirpStub.called).to.equal(false);
    expect(writeJsonStub.called).to.equal(false);
    expect(warn.called).to.equal(false);
  });

  describe('record', () => {
    it('sets defaults', async () => {
      const analytics = await Analytics.create({ cacheDir: 'test' });
      analytics.record({});

      expect(writeStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeStub.firstCall.args[1]);
      expect(logLine.type).to.contains(Analytics.EVENT);
      expect(logLine.eventName).to.contains('UNKNOWN');
      expect(logLine).to.be.haveOwnProperty('requestorLocation');
      expect(logLine).to.be.haveOwnProperty('cliId').and.equal('testCliID');

      expect(openStub.called).to.equal(true);
      // Only called once for the CLI ID
      expect(readFileSyncStub.calledTwice).to.equal(false);
      expect(writeFileStub.called).to.equal(false);
      expect(unlinkStub.called).to.equal(false);
      // It should call our to check usage file
      expect(accessStub.called).to.equal(true);
      expect(mkdirpStub.called).to.equal(false);
      expect(writeJsonStub.called).to.equal(false);
    });

    it('shows jenkins CI', async () => {
      process.env.JENKINS_WORKSPACE = 'test';
      const analytics = await Analytics.create({ cacheDir: 'test' });
      analytics.record({});
      expect(writeStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeStub.firstCall.args[1]);
      expect(logLine.ci).to.equal('jenkins');
    });

    it('shows travis CI', async () => {
      process.env.TRAVIS = 'true';
      const analytics = await Analytics.create({ cacheDir: 'test' });
      analytics.record({});
      expect(writeStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeStub.firstCall.args[1]);
      expect(logLine.ci).to.equal('travisci');
    });
    it('shows circle CI', async () => {
      process.env.CIRCLE_BRANCH = 'master';
      const analytics = await Analytics.create({ cacheDir: 'test' });
      analytics.record({});
      expect(writeStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeStub.firstCall.args[1]);
      expect(logLine.ci).to.equal('circleci');
    });
    it('shows github actions CI', async () => {
      process.env.GITHUB_ACTIONS = 'test';
      const analytics = await Analytics.create({ cacheDir: 'test' });
      analytics.record({});
      expect(writeStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeStub.firstCall.args[1]);
      expect(logLine.ci).to.equal('github_actions');
    });
    it('shows CI', async () => {
      process.env.CI = 'true';
      const analytics = await Analytics.create({ cacheDir: 'test' });
      analytics.record({});
      expect(writeStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeStub.firstCall.args[1]);
      expect(logLine.ci).to.equal('unknown');
    });

    it('scrubs non valid types', async () => {
      const analytics = await Analytics.create({ cacheDir: 'test' });
      analytics.record({
        a: 'test',
        b: false,
        c: 0,
        d: { a: 'b' },
      });

      expect(writeStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeStub.firstCall.args[1]);
      expect(logLine.a).to.equal('test');
      expect(logLine.b).to.equal(false);
      expect(logLine.c).to.equal(0);
      expect(logLine.d).to.equal(undefined);
    });
    it('does not scrub error exceptions', async () => {
      const analytics = await Analytics.create({ cacheDir: 'test' });
      class MyError extends Error {
        public additionalErrorInfo = 'testInfo';
      }
      const error = new MyError('testMessage');
      error.name = 'testName';
      error.stack = 'testStack';

      analytics.recordError(error, { additionalInfo: 'testing' });

      expect(writeStub.calledOnce).to.equal(true);
      const logLine = JSON.parse(writeStub.firstCall.args[1]);
      expect(logLine.error.name).to.deep.equal('testName');
      expect(logLine.error.message).to.deep.equal('testMessage');
      expect(logLine.error.stack).to.deep.equal('testStack');
      expect(logLine.error.additionalErrorInfo).to.deep.equal('testInfo');
      expect(logLine.additionalInfo).to.deep.equal('testing');
    });
  });

  it('clear deletes file', async () => {
    const analytics = await Analytics.create({ cacheDir: 'test' });
    await analytics.clear();
    expect(unlinkStub.called).to.equal(true);
  });

  it('read file parses lines properly', async () => {
    readFileStub.returns(`{ "eventName": "test1" }${EOL}{ "eventName": "test2" }`);
    const analytics = await Analytics.create({ cacheDir: 'test' });
    const data = await analytics.read();
    expect(data[0].eventName).to.equal('test1');
    expect(data[1].eventName).to.equal('test2');
  });

  it('upload spawns completely detached process', async () => {
    const unref = sinon.stub();
    const stub = stubMethod(sandbox, cp, 'spawn').returns({ unref });
    const analytics = await Analytics.create({ cacheDir: 'test' });
    analytics.upload();
    expect(stub.called).to.equal(true);
    // True detached process
    expect(stub.firstCall.args[2].detached).to.equal(true);
    expect(stub.firstCall.args[2].stdio).to.equal('ignore');
    expect(unref.called).to.equal(true);
  });
});
