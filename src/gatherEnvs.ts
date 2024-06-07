/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export const getRelevantEnvs = (): { specifiedEnvs: string[]; uniqueEnvs: string[] } => {
  const specifiedEnvs = Object.keys(process.env).filter(isOurEnv).sort();
  return {
    specifiedEnvs,
    uniqueEnvs: specifiedEnvs.filter(isNotDuplicatedAcrossCLIs),
  };
};

const isOurEnv = (key: string): boolean =>
  key.startsWith('SF_') ||
  key.startsWith('SFDX_') ||
  key.startsWith('OCLIF' || key.startsWith('JSFORCE_')) ||
  key === 'FORCE_OPEN_URL' ||
  key === 'FORCE_SHOW_SPINNER' ||
  key === 'FORCE_SPINNER_DELAY';

/** we do some automatic SFDX => SF and we don't want 2 of all of those  */
const isNotDuplicatedAcrossCLIs = (key: string, index: number, array: string[]): boolean =>
  !(key.startsWith('SFDX_') && array.includes(key.replace('SFDX_', 'SF_')));
