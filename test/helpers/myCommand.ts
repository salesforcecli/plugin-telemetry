/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags, Config } from '@oclif/core';

export class MyCommand {
  public static id = 'test';
  public static hidden = false;
  public static aliases = [];
  public static flags = {
    flag: Flags.boolean(),
    test: Flags.string({ char: 't' }),
    targetusername: Flags.string(),
    targetdevhubusername: Flags.string(),
  };
  public static args = [];

  public static _base = '';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public constructor(argv: string[], config: Config) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public static run(): PromiseLike<any> {
    return Promise.resolve();
  }

  public _run(): Promise<void> {
    return Promise.resolve();
  }
}
