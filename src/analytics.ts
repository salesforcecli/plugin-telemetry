/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import * as systemFs from 'fs';
import { EOL, tmpdir } from 'os';
import { join } from 'path';
import { Attributes } from '@salesforce/telemetry';
import { AsyncCreatable, env } from '@salesforce/kit';
import { fs } from '@salesforce/core';
import { isBoolean, isNumber, isString, JsonMap } from '@salesforce/ts-types';
import { debug } from './debuger';

const CLI_ID_FILE_NAME = 'CLIID.txt';
const USAGE_ACKNOWLEDGEMENT_FILE_NAME = 'acknowledgedUsageCollection.json';

export type AnalyticsOptions = {
  cacheDir?: string;
  analyticsFilePath?: string;
};

export type CI =
  | 'circleci'
  | 'travisci'
  | 'jenkins'
  | 'github_actions'
  | 'azure_pipelines'
  | 'teamcity'
  | 'gitlab'
  | 'nevercode'
  | 'wercker'
  | 'buildkite'
  | 'semaphore'
  | 'bitrise'
  | 'buddy'
  | 'appveyor'
  | 'unknown';

export default class Analytics extends AsyncCreatable {
  /**
   * The name of event telemetry type.
   */
  public static EVENT = 'EVENT';

  /**
   * The name of exception telemetry type.
   */
  public static EXCEPTION = 'EXCEPTION';

  /**
   * The temporary directory where analytic log files are stored.
   */
  public static tmpDir = env.getString('SFDX_TELEMETRY_PATH', join(tmpdir(), 'sfdx-analytics'));

  private static cacheDir: string;
  private static analyticsTmpFile: string = join(Analytics.tmpDir, `analytics-${Analytics.generateRandomId()}.log`);
  private static acknowledged = false;

  public firstRun = false;
  private fileDescriptor!: number;
  private cliId?: string;

  public constructor(options: AnalyticsOptions) {
    super(options);

    if (options.cacheDir && !Analytics.cacheDir) {
      Analytics.cacheDir = options.cacheDir;
    }
    // We want to run off of a specific analytics file, so override.
    if (options.analyticsFilePath) {
      Analytics.analyticsTmpFile = options.analyticsFilePath;
    }
  }

  /**
   * Tell the user they acknowledge data collection.
   */
  public static async acknowledgeDataCollection(): Promise<void> {
    // Only check once per process, regardless of how often this is instantiated.
    if (Analytics.acknowledged) {
      return;
    }

    if (!Analytics.cacheDir) {
      debug('Unable to check acknowledgment path because Analytics.cacheDir is not set yet');
      return;
    }

    const acknowledgementFilePath = join(Analytics.cacheDir, USAGE_ACKNOWLEDGEMENT_FILE_NAME);
    try {
      await fs.access(acknowledgementFilePath, fs.constants.R_OK);
      debug('Usage acknowledgement file already exists');
    } catch (err) {
      if (err.code === 'ENOENT') {
        if (!env.getBoolean('SFDX_TELEMETRY_DISABLE_ACKNOWLEDGEMENT', false)) {
          // eslint-disable-next-line no-console
          console.warn(
            'You acknowledge and agree that the CLI tool may collect usage information, ' +
              'user environment, and crash reports for the purposes of providing services or functions that are relevant ' +
              'to use of the CLI tool and product improvements.',
            EOL
          );
        }
        Analytics.acknowledged = true;
        await fs.mkdirp(Analytics.cacheDir);
        await fs.writeJson(acknowledgementFilePath, { acknowledged: true });
        debug('Wrote usage acknowledgement file', acknowledgementFilePath);
      } else {
        debug('Could not access', acknowledgementFilePath, 'DUE TO:', err.code, err.message);
      }
    }
  }

  public static guessCISystem(): CI | undefined {
    const keys = Object.keys(process.env);
    if (keys.find((key) => key.startsWith('CIRCLE'))) {
      return 'circleci';
    }
    if (keys.find((key) => key.startsWith('TRAVIS'))) {
      return 'travisci';
    }
    if (keys.find((key) => key.startsWith('GITHUB_ACTION'))) {
      return 'github_actions';
    }
    if (keys.find((key) => key.startsWith('AGENT_NAME')) || keys.find((key) => key.startsWith('BUILD_BUILDNUMBER'))) {
      return 'azure_pipelines';
    }
    if (keys.find((key) => key.startsWith('TEAMCITY'))) {
      return 'teamcity';
    }
    if (keys.find((key) => key.startsWith('GITLAB'))) {
      return 'gitlab';
    }
    if (keys.find((key) => key.startsWith('NEVERCODE'))) {
      return 'nevercode';
    }
    if (keys.find((key) => key.startsWith('WERCKER'))) {
      return 'wercker';
    }
    if (keys.find((key) => key.startsWith('BUILDKITE'))) {
      return 'buildkite';
    }
    if (keys.find((key) => key.startsWith('SEMAPHORE'))) {
      return 'semaphore';
    }
    if (keys.find((key) => key.startsWith('BITRISE'))) {
      return 'bitrise';
    }
    if (keys.find((key) => key.startsWith('BUDDY'))) {
      return 'buddy';
    }
    if (keys.find((key) => key.startsWith('APPVEYOR'))) {
      return 'appveyor';
    }
    if (keys.find((key) => key.startsWith('JENKINS'))) {
      return 'jenkins';
    }
    if (keys.find((key) => key === 'CI' || key === 'CONTINUOUS_INTEGRATION')) {
      return 'unknown';
    }
  }

  private static generateRandomId(): string {
    return randomBytes(20).toString('hex');
  }

  public getAnalyticsLogFilePath(): string {
    return Analytics.analyticsTmpFile;
  }

  public getCLIId(): string {
    if (this.cliId) return this.cliId;

    const cliIdPath = join(Analytics.cacheDir, CLI_ID_FILE_NAME);

    try {
      this.cliId = systemFs.readFileSync(cliIdPath, 'utf8');
    } catch (err) {
      debug('Unique CLI ID not found, generating and writing new ID to ', cliIdPath);
      this.cliId = Analytics.generateRandomId();
      systemFs.writeFileSync(cliIdPath, this.cliId, 'utf8');

      // If there is not a unique ID for this CLI, consider it a first run.
      this.firstRun = true;
    }
    return this.cliId;
  }

  /**
   * Record data to the analytics file. Only valid properties will be recorded to the file, which
   * are strings, numbers, and booleans. All booleans get logged to App Insights as string representations.
   */
  public record(data: JsonMap): void {
    // Only store valid telemetry attributes to the log file.
    const dataToRecord = Object.keys(data).reduce((map, key) => {
      const value = data[key];
      const isException = data.type === Analytics.EXCEPTION && key === 'error';
      const validType = isString(value) || isBoolean(value) || isNumber(value);

      if (isException || validType) {
        map[key] = value;
      }

      return map;
    }, {} as JsonMap);

    if (!dataToRecord.type) {
      dataToRecord.type = Analytics.EVENT;
    }

    if (!dataToRecord.eventName) {
      // This would mean a consumer forgot to set this.
      // Still log it as unknown so we can try to fix it.
      dataToRecord.eventName = 'UNKNOWN';

      // Don't break this into a utility because the stack HAS to start from this method.
      const stack = new Error().stack || '';
      const locations = stack.split(EOL).filter((line) => /\s*at /.test(line));
      if (locations.length >= 2) {
        // The first location is this file, the second is the calling file.
        // Replace HOME for GDPR.
        dataToRecord.requestorLocation = locations[1].replace(process.env.HOME || '', '');
      }
      debug('Missing event name!');
    }

    // Unique to this CLI installation
    dataToRecord.cliId = this.getCLIId();
    dataToRecord.ci = Analytics.guessCISystem();
    try {
      systemFs.writeSync(this.fileDescriptor, JSON.stringify(dataToRecord) + EOL);
    } catch (error) {
      debug(`Error saving analytics line to file: ${error.message as string}`);
    }
  }

  public recordError(error: Error, data: JsonMap): void {
    data.type = Analytics.EXCEPTION;
    // Also have on custom attributes since app insights might parse differently
    data.errorName = error.name;
    data.errorMessage = error.message;
    data.error = Object.assign(
      {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } as JsonMap,
      error
    );
    this.record(data);
  }

  public async clear(): Promise<void> {
    debug('Deleting the log file', this.getAnalyticsLogFilePath());
    await fs.unlink(this.getAnalyticsLogFilePath());
  }

  public async read(): Promise<Attributes[]> {
    try {
      debug(`Reading ${this.getAnalyticsLogFilePath()}`);
      const data = await fs.readFile(this.getAnalyticsLogFilePath(), 'utf8');
      const events = data
        .split(EOL)
        .filter((line) => !!line)
        .map((line) => JSON.parse(line) as Attributes);
      return events;
    } catch (err) {
      debug(`Error reading: ${err.message as string}`);
      // If anything goes wrong, it just means a couple of lost telemetry events.
      return [];
    }
  }

  public upload(): void {
    // Completely disconnect from this process so it doesn't wait for telemetry to upload
    const processPath = join(__dirname, '..', 'processes', 'upload');

    const telemetryDebug = env.getBoolean('SFDX_TELEMETRY_DEBUG', false);
    const nodePath = process.argv[0];

    // Don't spawn if we are in telemetry debug. This allows us to run the process manually with --inspect-brk.
    if (!telemetryDebug) {
      debug(`Spawning "${nodePath} ${processPath} ${Analytics.cacheDir} ${this.getAnalyticsLogFilePath()}"`);
      spawn(nodePath, [processPath, Analytics.cacheDir, this.getAnalyticsLogFilePath()], {
        detached: true,
        stdio: 'ignore',
      }).unref();
    } else {
      debug(
        `DEBUG MODE. Run the uploader manually with the following command:${EOL}${processPath} ${
          Analytics.cacheDir
        } ${this.getAnalyticsLogFilePath()}`
      );
    }
  }

  protected async init(): Promise<void> {
    // If we are going to record analytics, make sure the user is aware.
    await Analytics.acknowledgeDataCollection();

    // Make sure the tmp dir is created.
    try {
      await fs.access(Analytics.tmpDir, fs.constants.W_OK);
    } catch (err) {
      if (err.code === 'ENOENT') {
        debug('Analytics temp dir does not exist, creating...');
        await fs.mkdirp(Analytics.tmpDir);
      }
    }
    // Create a file descriptor to be used
    this.fileDescriptor = systemFs.openSync(this.getAnalyticsLogFilePath(), 'a');
    debug(`Using analytics logging file ${this.getAnalyticsLogFilePath()}`);
  }
}
