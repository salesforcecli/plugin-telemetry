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

import type { Org } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';

/**
 * Tests set these before calling `CommandExecution.create` to control what
 * the `target-org` / `target-dev-hub` flags resolve to, since the real flags
 * do a network/filesystem-backed org resolution that we don't want in unit tests.
 */
export const orgFlagState: { targetOrg?: Org; targetDevHub?: Org } = {};

export class MyOrgCommand extends SfCommand<void> {
  public static id = 'test:org';
  public static flags = {
    'target-org': Flags.custom<Org>()({
      parse: async () => orgFlagState.targetOrg,
    }),
    'target-dev-hub': Flags.custom<Org>()({
      parse: async () => orgFlagState.targetDevHub,
    }),
  };

  // eslint-disable-next-line class-methods-use-this
  public async run(): Promise<void> {
    return Promise.resolve();
  }
}
