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
  public static aliases = ['deprecated:alias'];
  public static deprecateAliases = true;
  public static flags = {
    flag: Flags.boolean(),
    test: Flags.string({ char: 't' }),
    valid: Flags.string({ aliases: ['invalid', 'i'], char: 'v', deprecateAliases: true }),
    newflag: Flags.string({ aliases: ['oldflag', 'o'], char: 'n', deprecateAliases: true }),
    user: Flags.string({
      aliases: ['targetuser'],
      deprecateAliases: true,
      default: async () => 'test',
    }),
    blue: Flags.string({
      aliases: ['bleu'],
    }),
    red: Flags.string({
      charAliases: ['e'],
      char: 'r',
    }),
  };
  public static args = {};

  // eslint-disable-next-line class-methods-use-this
  public async run(): Promise<void> {
    return Promise.resolve();
  }
}
