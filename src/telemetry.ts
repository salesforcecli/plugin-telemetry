/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import cp from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EOL, tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Attributes } from '@salesforce/telemetry';
import { AsyncCreatable, env } from '@salesforce/kit';
import { SfError } from '@salesforce/core';
import { isBoolean, isNumber, isString, JsonMap } from '@salesforce/ts-types';
import { debug } from './debugger.js';
import { guessCISystem } from './guessCI.js';

const CLI_ID_FILE_NAME = 'CLIID.txt';
const USAGE_ACKNOWLEDGEMENT_FILE_NAME = 'acknowledgedUsageCollection.json';
const generateRandomId = (): string => randomBytes(20).toString('hex');

export type TelemetryOptions = {
  cacheDir?: string;
  telemetryFilePath?: string;
  executable?: string;
};

export default class Telemetry extends AsyncCreatable {
  /**
   * The name of event telemetry type.
   */
  public static EVENT = 'EVENT';

  /**
   * The name of exception telemetry type.
   */
  public static EXCEPTION = 'EXCEPTION';

  /**
   * The temporary directory where telemetry log files are stored.
   */
  public static tmpDir = env.getString('SF_TELEMETRY_PATH', join(tmpdir(), 'sf-telemetry'));

  private static cacheDir: string;
  private static executable = 'sfdx';
  private static telemetryTmpFile: string = join(Telemetry.tmpDir, `telemetry-${generateRandomId()}.log`);
  private static acknowledged = false;

  public firstRun = false;
  private fileDescriptor!: number;
  private cliId?: string;

  public constructor(options: TelemetryOptions) {
    super(options);

    if (options.cacheDir && !Telemetry.cacheDir) {
      Telemetry.cacheDir = options.cacheDir;
    }
    // We want to run off of a specific telemetry file, so override.
    if (options.telemetryFilePath) {
      Telemetry.telemetryTmpFile = options.telemetryFilePath;
    }

    if (options.executable) {
      Telemetry.executable = options.executable;
    }
  }

  /**
   * Tell the user they acknowledge data collection.
   */
  public static async acknowledgeDataCollection(): Promise<void> {
    // Only check once per process, regardless of how often this is instantiated.
    if (Telemetry.acknowledged) {
      return;
    }

    if (!Telemetry.cacheDir) {
      debug('Unable to check acknowledgment path because Telemetry.cacheDir is not set yet');
      return;
    }

    const acknowledgementFilePath = join(Telemetry.cacheDir, USAGE_ACKNOWLEDGEMENT_FILE_NAME);
    try {
      await fs.promises.access(acknowledgementFilePath, fs.constants.R_OK);
      debug('Usage acknowledgement file already exists');
    } catch (error) {
      const err = error as SfError;
      if (err.code === 'ENOENT') {
        if (!env.getBoolean('SF_TELEMETRY_DISABLE_ACKNOWLEDGEMENT', false)) {
          // eslint-disable-next-line no-console
          console.warn(
            `You acknowledge and agree that the CLI tool may collect usage information, user environment, and crash reports for the purposes of providing services or functions that are relevant to use of the CLI tool and product improvements.${EOL}`
          );
        }
        Telemetry.acknowledged = true;
        await fs.promises.mkdir(Telemetry.cacheDir, { recursive: true });
        await fs.promises.writeFile(acknowledgementFilePath, JSON.stringify({ acknowledged: true }));
        debug('Wrote usage acknowledgement file', acknowledgementFilePath);
      } else {
        debug('Could not access', acknowledgementFilePath, 'DUE TO:', err.code, err.message);
      }
    }
  }

  // eslint-disable-next-line class-methods-use-this
  public getTelemetryFilePath(): string {
    return Telemetry.telemetryTmpFile;
  }

  public getCLIId(): string {
    if (this.cliId) return this.cliId;

    const cliIdPath = join(Telemetry.cacheDir, CLI_ID_FILE_NAME);

    try {
      this.cliId = fs.readFileSync(cliIdPath, 'utf8');
    } catch (err) {
      debug('Unique CLI ID not found, generating and writing new ID to ', cliIdPath);
      this.cliId = generateRandomId();
      fs.writeFileSync(cliIdPath, this.cliId, 'utf8');

      // If there is not a unique ID for this CLI, consider it a first run.
      this.firstRun = true;
    }
    return this.cliId;
  }

  /**
   * Record data to the telemetry file. Only valid properties will be recorded to the file, which
   * are strings, numbers, and booleans. All booleans get logged to App Insights as string representations.
   */
  public record(data: JsonMap): void {
    // Only store valid telemetry attributes to the log file.
    const dataToRecord = Object.keys(data).reduce<JsonMap>((map, key) => {
      const value = data[key];
      const isException = data.type === Telemetry.EXCEPTION && key === 'error';
      const validType = isString(value) || isBoolean(value) || isNumber(value);

      if (isException || validType) {
        map[key] = value;
      }

      return map;
    }, {});

    if (!dataToRecord.type) {
      dataToRecord.type = Telemetry.EVENT;
    }

    if (!dataToRecord.eventName) {
      // This would mean a consumer forgot to set this.
      // Still log it as unknown so we can try to fix it.
      dataToRecord.eventName = 'UNKNOWN';

      // Don't break this into a utility because the stack HAS to start from this method.
      const stack = new Error().stack ?? '';
      const locations = stack.split(/\r?\n/).filter((line) => /\s*at /.test(line));
      if (locations.length >= 2) {
        // The first location is this file, the second is the calling file.
        // Replace HOME for GDPR.
        dataToRecord.requestorLocation = locations[1].replace(process.env.HOME ?? '', '');
      }
      debug('Missing event name!');
    }

    // Unique to this CLI installation
    dataToRecord.cliId = this.getCLIId();
    dataToRecord.ci = guessCISystem();
    dataToRecord.executable = Telemetry.executable;
    try {
      fs.writeSync(this.fileDescriptor, JSON.stringify(dataToRecord) + EOL);
    } catch (err) {
      const error = err as SfError;
      debug(`Error saving telemetry line to file: ${error.message}`);
    }
  }

  public recordError(error: Error, data: JsonMap): void {
    data.type = Telemetry.EXCEPTION;
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
    debug('Deleting the log file', this.getTelemetryFilePath());
    await fs.promises.unlink(this.getTelemetryFilePath());
  }

  public async read(): Promise<Attributes[]> {
    try {
      debug(`Reading ${this.getTelemetryFilePath()}`);
      const data = await fs.promises.readFile(this.getTelemetryFilePath(), 'utf8');
      return data
        .split(EOL)
        .filter((line) => !!line)
        .map((line) => JSON.parse(line) as Attributes);
    } catch (error) {
      const err = error as SfError;
      debug(`Error reading: ${err.message}`);
      // If anything goes wrong, it just means a couple of lost telemetry events.
      return [];
    }
  }

  public upload(): void {
    // Completely disconnect from this process so it doesn't wait for telemetry to upload
    const processPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'processes', 'upload.js');

    const telemetryDebug = env.getBoolean('SF_TELEMETRY_DEBUG', false);
    const nodePath = process.argv[0];

    // Don't spawn if we are in telemetry debug. This allows us to run the process manually with --inspect-brk.
    if (!telemetryDebug) {
      debug(`Spawning "${nodePath} ${processPath} ${Telemetry.cacheDir} ${this.getTelemetryFilePath()}"`);
      cp.spawn(nodePath, [processPath, Telemetry.cacheDir, this.getTelemetryFilePath()], {
        ...(process.platform === 'win32' ? { shell: true, windowsHide: true } : {}),
        detached: true,
        stdio: 'ignore',
      }).unref();
    } else {
      debug(
        `DEBUG MODE. Run the uploader manually with the following command:${EOL}${processPath} ${
          Telemetry.cacheDir
        } ${this.getTelemetryFilePath()}`
      );
    }
  }

  protected async init(): Promise<void> {
    // If we are going to record telemetry, make sure the user is aware.
    await Telemetry.acknowledgeDataCollection();

    // Make sure the tmp dir is created.
    try {
      await fs.promises.access(Telemetry.tmpDir, fs.constants.W_OK);
    } catch (error) {
      const err = error as SfError;
      if (err.code === 'ENOENT') {
        debug('Telemetry temp dir does not exist, creating...');
        await fs.promises.mkdir(Telemetry.tmpDir, { recursive: true });
      }
    }
    // Create a file descriptor to be used
    this.fileDescriptor = fs.openSync(this.getTelemetryFilePath(), 'a');
    debug(`Using telemetry logging file ${this.getTelemetryFilePath()}`);
  }
}
