/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flags } from '@oclif/command';
import { IConfig } from '@oclif/config';

export class MyCommand {
  public static id = 'test';
  public static hidden = false;
  public static aliases = [];
  public static flags = {
    flag: flags.boolean(),
    test: flags.string({ char: 't' }),
    targetusername: flags.string(),
    targetdevhubusername: flags.string(),
  };
  public static args = [];

  public static _base = '';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public constructor(argv: string[], config: IConfig) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static run(): PromiseLike<any> {
    return Promise.resolve();
  }

  public _run() {
    return Promise.resolve();
  }
}
