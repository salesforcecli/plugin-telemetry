/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags, Command } from '@oclif/core';

export class MyCommand extends Command {
  public static id = 'test';
  public static hidden = false;
  public static aliases = [];
  public static flags = {
    flag: Flags.boolean(),
    test: Flags.string({ char: 't' }),
    targetusername: Flags.string(),
    targetdevhubusername: Flags.string(),
  };
  public static args = {};

  // eslint-disable-next-line class-methods-use-this
  public async run(): Promise<void> {
    return Promise.resolve();
  }
}
