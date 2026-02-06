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

import { SfError } from '@salesforce/core/sfError';
import type { Attributes, PdpEvent } from '@salesforce/telemetry';
import { asBoolean, asString, Dictionary } from '@salesforce/ts-types';
import Telemetry from './telemetry.js';
import { debug } from './debugger.js';
import { TelemetryGlobal } from './telemetryGlobal.js';

declare const global: TelemetryGlobal;

const PROJECT = 'salesforce-cli';
const APP_INSIGHTS_KEY =
  'InstrumentationKey=2ca64abb-6123-4c7b-bd9e-4fe73e71fe9c;IngestionEndpoint=https://eastus-1.in.applicationinsights.azure.com/;LiveEndpoint=https://eastus.livediagnostics.monitor.azure.com/;ApplicationId=ecd8fa7a-0e0d-4109-94db-4d7878ada862';

export class Uploader {
  private o11yUploadEndpoint: string = '';

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
    let appInsightsReporter: InstanceType<typeof TelemetryReporter>;
    let o11yReporter: InstanceType<typeof TelemetryReporter> | undefined;

    try {
      appInsightsReporter = await TelemetryReporter.create({
        project: PROJECT,
        key: APP_INSIGHTS_KEY,
        userId: this.telemetry.getCLIId(),
        waitForConnection: true,
        enableO11y: false,
        enableAppInsights: true,
      });
    } catch (err) {
      const error = SfError.wrap(err);
      debug(`Error creating reporter: ${error.message}`);
      // We can't do much without a reporter, so clear the telemetry file and move on.
      await this.telemetry.clear();
      return;
    }

    try {
      const events = await this.telemetry.read();
      const { appInsightsEvents, appInsightsErrors, o11yEvents } = this.parseEvents(events);

      // Send AppInsights events
      if (appInsightsEvents.length > 0) {
        appInsightsEvents.forEach((event) => {
          const eventName = asString(event.eventName) ?? 'UNKNOWN';
          delete event.eventName;
          appInsightsReporter.sendTelemetryEvent(eventName, event);
        });
      }

      // Send AppInsights errors
      if (appInsightsErrors.length > 0) {
        appInsightsErrors.forEach((event) => {
          const error = new Error();
          // We know this is an object because it is logged as such
          const errorObject = event.error as unknown as Dictionary;
          delete event.error;
          delete event.eventName;

          Object.assign(error, errorObject);
          error.name = asString(errorObject.name) ?? 'Unknown';
          error.message = asString(errorObject.message) ?? 'Unknown';
          error.stack = asString(errorObject.stack) ?? 'Unknown';
          appInsightsReporter.sendTelemetryException(error, event);
        });
      }

      // Send PDP events via O11y
      if (o11yEvents.length > 0) {
        try {
          o11yReporter = await TelemetryReporter.create({
            project: PROJECT,
            key: 'not-used',
            userId: this.telemetry.getCLIId(),
            waitForConnection: true,
            enableO11y: true,
            enableAppInsights: false,
            o11yUploadEndpoint: this.o11yUploadEndpoint,
          });
        } catch (err) {
          const error = SfError.wrap(err);
          debug(`Error creating o11y reporter: ${error.message}`);
        }
        o11yEvents.forEach((event) => o11yReporter?.sendPdpEvent(event));
      }
    } catch (err) {
      const error = SfError.wrap(err);
      debug(`Error reading or sending telemetry events: ${error.message}`);
    } finally {
      try {
        // We are done sending events
        appInsightsReporter.stop();
        if (o11yReporter) {
          o11yReporter.stop();
        }
      } catch (err) {
        const error = SfError.wrap(err);
        debug(`Error stopping telemetry reporter: ${error.message}`);
      } finally {
        // We always want to clear the file.
        await this.telemetry.clear();
      }
    }
  }

  private parseEvents(events: Attributes[]): {
    appInsightsEvents: Attributes[];
    appInsightsErrors: Attributes[];
    o11yEvents: PdpEvent[];
  } {
    const appInsightsEvents: Attributes[] = [];
    const appInsightsErrors: Attributes[] = [];
    const o11yEvents: PdpEvent[] = [];
    for (const event of events) {
      event.telemetryVersion = this.version;
      const eventType = asString(event.type) ?? Telemetry.EVENT;
      const eventName = asString(event.eventName) ?? 'UNKNOWN';
      const enableO11y = asBoolean(event.enableO11y) ?? false;
      const productFeatureId = asString(event.productFeatureId) ?? 'aJCEE0000000mHP4AY';
      this.o11yUploadEndpoint = asString(event.o11yUploadEndpoint) ?? '';
      delete event.type;
      delete event.enableO11y;
      delete event.o11yUploadEndpoint;
      delete event.productFeatureId;

      if (eventType === Telemetry.EVENT) {
        appInsightsEvents.push(event);
        if (enableO11y && this.o11yUploadEndpoint.length > 0 && eventName === 'COMMAND_EXECUTION') {
          const pluginName = `${asString(event.plugin) ?? 'unknownPlugin'}`;
          const commandName = `${asString(event.command) ?? 'unknownCommand'}`;
          o11yEvents.push({
            eventName: 'salesforceCli.executed',
            productFeatureId: productFeatureId as `aJC${string}`,
            componentId: `${pluginName}.${commandName}`,
            contextName: 'orgId::devhubId', // Delimited string of keys
            contextValue: `${event.orgId ?? ''}::${event.devhubId ?? ''}`, // Delimited string of values
          });
        }
      } else if (eventType === Telemetry.EXCEPTION) {
        appInsightsErrors.push(event);
      }
    }
    return { appInsightsEvents, appInsightsErrors, o11yEvents };
  }
}
