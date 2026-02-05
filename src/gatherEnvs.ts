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
  key.startsWith('OCLIF') ||
  key.startsWith('JSFORCE_') ||
  key === 'FORCE_OPEN_URL' ||
  key === 'FORCE_SHOW_SPINNER' ||
  key === 'FORCE_SPINNER_DELAY' ||
  key === 'HTTPS_PROXY' ||
  key === 'HTTP_PROXY' ||
  key === 'https_proxy' ||
  key === 'http_proxy';

/** we do some automatic SFDX => SF and we don't want 2 of all of those  */
const isNotDuplicatedAcrossCLIs = (key: string, index: number, array: string[]): boolean =>
  !(key.startsWith('SFDX_') && array.includes(key.replace('SFDX_', 'SF_')));
