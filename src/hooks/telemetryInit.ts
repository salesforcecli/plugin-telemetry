/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Hook } from '@oclif/core';

export class InitData {
  public static upTimeAtInit: number;
}

/**
 * A hook that runs when the CLI is initialized but before a command is found to run.
 * Records the process uptime, which we take as the time it takes to load OCLIF
 */
// We don't need to do anything async but make it clear oclif takes an async function with the right signature.
// eslint-disable-next-line @typescript-eslint/require-await
const hook: Hook.Init = async (): Promise<void> => {
  InitData.upTimeAtInit = process.uptime() * 1000;
};

export default hook;
