/*
 * Copyright 2025, Salesforce, Inc.
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

import { SfError } from '@salesforce/core/sfError';
import { asString, Dictionary } from '@salesforce/ts-types';
import Telemetry from './telemetry.js';
import { debug } from './debugger.js';

import { TelemetryGlobal } from './telemetryGlobal.js';

declare const global: TelemetryGlobal;

const PROJECT = 'salesforce-cli';
const APP_INSIGHTS_KEY =
  'InstrumentationKey=2ca64abb-6123-4c7b-bd9e-4fe73e71fe9c;IngestionEndpoint=https://eastus-1.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=ecd8fa7a-0e0d-4109-94db-4d7878ada862';

export class Uploader {
  private constructor(private telemetry: Telemetry, private version: string) {}

  /**
   * Sends events from telemetry.
   */
  public static async upload(cacheDir: string, telemetryFilePath: string, version: string): Promise<void> {
    const telemetry = (global.cliTelemetry = await Telemetry.create({ cacheDir, telemetryFilePath }));
    const uploader = new Uploader(telemetry, version);
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
        event.telemetryVersion = this.version;
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
