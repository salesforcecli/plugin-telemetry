/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook, IConfig } from '@oclif/config';
import { StubbedType, stubInterface } from '@salesforce/ts-sinon';
import { expect } from 'chai';
import * as sinon from 'sinon';
import hook, { InitData } from '../../src/hooks/telemetryInit';
import { MyCommand } from '../helpers/myCommand';

// The hook doesn't like the stubInterface type, so just set it to any.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const args: any = { argv: [], Command: MyCommand };

describe('telemetry init hook', () => {
  let sandbox: sinon.SinonSandbox;

  let config: StubbedType<IConfig>;
  let context: StubbedType<Hook.Context>;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    config = stubInterface<IConfig>(sandbox, {});
    context = stubInterface<Hook.Context>(sandbox, { config });
  });

  it('should record the process uptime', async () => {
    await hook.call(context, args);
    expect(InitData.upTimeAtInit).to.not.undefined;
    expect(typeof InitData.upTimeAtInit).to.equal('number');
  });
});
