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
  beforeEach(() => {
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
});
