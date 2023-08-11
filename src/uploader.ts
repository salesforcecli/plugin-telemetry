/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable no-await-in-loop */
import { SfError } from '@salesforce/core';
import { asString, Dictionary } from '@salesforce/ts-types';
import Telemetry from './telemetry';
import { debug, version } from './debugger';

import { TelemetryGlobal } from './telemetryGlobal';

declare const global: TelemetryGlobal;

const PROJECT = 'salesforce-cli';
const APP_INSIGHTS_KEY = '2ca64abb-6123-4c7b-bd9e-4fe73e71fe9c';

export class Uploader {
  private constructor(private telemetry: Telemetry) {}

  /**
   * Sends events from telemetry.
   */
  public static async upload(cacheDir: string, telemetryFilePath: string): Promise<void> {
    const telemetry = (global.cliTelemetry = await Telemetry.create({ cacheDir, telemetryFilePath }));
    const uploader = new Uploader(telemetry);
    await uploader.sendToTelemetry();
  }

  /**
   * Reads the telemetry events from file and sends them to the telemetry service.
   */
  private async sendToTelemetry(): Promise<void> {
    const { TelemetryReporter } = await import('@salesforce/telemetry');
    let reporter: InstanceType<typeof TelemetryReporter>;
    try {
      reporter = await TelemetryReporter.create({
        project: PROJECT,
        key: APP_INSIGHTS_KEY,
        userId: this.telemetry.getCLIId(),
        waitForConnection: true,
      });
    } catch (err) {
      const error = err as SfError;
      debug(`Error creating reporter: ${error.message}`);
      // We can't do much without a reporter, so clear the telemetry file and move on.
      await this.telemetry.clear();
      return;
    }

    try {
      const events = await this.telemetry.read();
      for (const event of events) {
        event.telemetryVersion = version;
        const eventType = asString(event.type) ?? Telemetry.EVENT;
        const eventName = asString(event.eventName) ?? 'UNKNOWN';
        delete event.type;
        delete event.eventName;

        if (eventType === Telemetry.EVENT) {
          reporter.sendTelemetryEvent(eventName, event);
        } else if (eventType === Telemetry.EXCEPTION) {
          const error = new Error();
          // We know this is an object because it is logged as such
          const errorObject = event.error as unknown as Dictionary;
          delete event.error;

          Object.assign(error, errorObject);
          error.name = asString(errorObject.name) ?? 'Unknown';
          error.message = asString(errorObject.message) ?? 'Unknown';
          error.stack = asString(errorObject.stack) ?? 'Unknown';
          reporter.sendTelemetryException(error, event);
        }
      }
    } catch (err) {
      const error = err as SfError;
      debug(`Error reading or sending telemetry events: ${error.message}`);
    } finally {
      try {
        // We are done sending events
        reporter.stop();
      } catch (err) {
        const error = err as SfError;
        debug(`Error stopping telemetry reporter: ${error.message}`);
      } finally {
        // We always want to clear the file.
        await this.telemetry.clear();
      }
    }
  }
}
