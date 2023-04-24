/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

export class MyCommand extends SfCommand<void> {
  public static id = 'test';
  public static hidden = false;
  public static aliases = [];
  public static flags = {
    flag: Flags.boolean(),
    test: Flags.string({ char: 't' }),
  };
  public static args = {};

  // eslint-disable-next-line class-methods-use-this
  public async run(): Promise<void> {
    return Promise.resolve();
  }
}
