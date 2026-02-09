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

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

export class MyArgCommand extends SfCommand<void> {
  public static id = 'test';
  public static hidden = false;
  public static aliases = ['deprecated:alias'];
  public static deprecateAliases = true;
  public static strict = false;
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

  // eslint-disable-next-line class-methods-use-this
  public async run(): Promise<void> {
    return Promise.resolve();
  }
}
