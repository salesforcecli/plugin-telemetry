/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import Debug from 'debug';

interface PackageJson {
  [key: string]: unknown;
  version: string;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const packageJson = require('../package.json') as PackageJson;
export const version = packageJson.version;

export const debug = Debug(`sfdx:telemetry@${version}`);
