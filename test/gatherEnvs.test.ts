/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { getRelevantEnvs } from '../src/gatherEnvs.js';

const testEnvs = ['SF_TEST', 'SFDX_TEST', 'SF_TEST2', 'OTHER_ENV'];
describe('gatherEnvs', () => {
  afterEach(() => {
    testEnvs.map((env) => delete process.env[env]);
  });

  it('returns 1 relevant SF env', () => {
    process.env.SF_TEST = 'test';
    expect(getRelevantEnvs()).to.deep.equal({ specifiedEnvs: ['SF_TEST'], uniqueEnvs: ['SF_TEST'] });
  });

  it('returns 1 relevant DX env', () => {
    process.env.SFDX_TEST = 'test';
    expect(getRelevantEnvs()).to.deep.equal({ specifiedEnvs: ['SFDX_TEST'], uniqueEnvs: ['SFDX_TEST'] });
  });

  it('returns multiple relevant envs, but not the duplicated ones', () => {
    process.env.SF_TEST = 'test';
    process.env.SFDX_TEST = 'test';
    process.env.SF_TEST2 = 'test';
    expect(getRelevantEnvs()).to.deep.equal({
      specifiedEnvs: ['SFDX_TEST', 'SF_TEST', 'SF_TEST2'],
      uniqueEnvs: ['SF_TEST', 'SF_TEST2'],
    });
  });

  it('returns no relevant envs', () => {
    expect(getRelevantEnvs()).to.deep.equal({ specifiedEnvs: [], uniqueEnvs: [] });
  });

  it('returns no irrelevant envs', () => {
    process.env.OTHER_ENV = 'test';
    expect(getRelevantEnvs()).to.deep.equal({ specifiedEnvs: [], uniqueEnvs: [] });
  });

  describe('for proxies', () => {
    const proxyEnvs = ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy'];

    afterEach(() => {
      proxyEnvs.map((env) => delete process.env[env]);
    });

    it('returns HTTPS env', () => {
      process.env.HTTPS_PROXY = 'HTTPS-test';
      expect(getRelevantEnvs()).to.deep.equal({ specifiedEnvs: ['HTTPS_PROXY'], uniqueEnvs: ['HTTPS_PROXY'] });
    });

    it('returns HTTP env', () => {
      process.env.HTTP_PROXY = 'HTTP-test';
      expect(getRelevantEnvs()).to.deep.equal({ specifiedEnvs: ['HTTP_PROXY'], uniqueEnvs: ['HTTP_PROXY'] });
    });

    it('returns HTTPS and HTTP env', () => {
      process.env.HTTPS_PROXY = 'HTTPS-test';
      process.env.HTTP_PROXY = 'HTTP-test';
      expect(getRelevantEnvs()).to.deep.equal({
        specifiedEnvs: ['HTTPS_PROXY', 'HTTP_PROXY'],
        uniqueEnvs: ['HTTPS_PROXY', 'HTTP_PROXY'],
      });
    });

    it('returns https env', () => {
      // eslint-disable-next-line camelcase
      process.env.https_proxy = 'https-test';
      expect(getRelevantEnvs()).to.deep.equal({ specifiedEnvs: ['https_proxy'], uniqueEnvs: ['https_proxy'] });
    });

    it('returns http env', () => {
      // eslint-disable-next-line camelcase
      process.env.http_proxy = 'http-test';
      expect(getRelevantEnvs()).to.deep.equal({ specifiedEnvs: ['http_proxy'], uniqueEnvs: ['http_proxy'] });
    });

    it('returns HTTPS, HTTP, https, http env', () => {
      process.env.HTTPS_PROXY = 'HTTPS-test';
      process.env.HTTP_PROXY = 'HTTP-test';
      // eslint-disable-next-line camelcase
      process.env.https_proxy = 'https-test';
      // eslint-disable-next-line camelcase
      process.env.http_proxy = 'http-test';
      expect(getRelevantEnvs()).to.deep.equal({
        specifiedEnvs: ['HTTPS_PROXY', 'HTTP_PROXY', 'http_proxy', 'https_proxy'],
        uniqueEnvs: ['HTTPS_PROXY', 'HTTP_PROXY', 'http_proxy', 'https_proxy'],
      });
    });
  });
});
