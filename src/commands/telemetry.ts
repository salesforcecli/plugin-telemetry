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

import { SfCommand } from '@salesforce/sf-plugins-core';
import { isEnabled } from '@salesforce/telemetry/enabledCheck';
import Telemetry from '../telemetry.js';
import { TelemetryGlobal } from '../telemetryGlobal.js';

declare const global: TelemetryGlobal;

export type TelemetryGetResult = {
  enabled: boolean;
  cliId?: string;
  tmpDir: string;
  cacheDir: string;
};

export default class TelemetryGet extends SfCommand<TelemetryGetResult> {
  public static hidden = true;

  public async run(): Promise<TelemetryGetResult> {
    const enabled = await isEnabled();
    const cliId = global.cliTelemetry?.getCLIId();

    this.log(`Telemetry is ${enabled ? 'enabled' : 'disabled'}.`);
    this.log(`Telemetry tmp directory is ${Telemetry.tmpDir}.`);
    this.log(`Telemetry cache directory is ${this.config.cacheDir}.`);
    this.log();
    this.log(`Salesforce CLI ID is ${cliId ?? '<undefined because global.cliTelemetry is undefined>'}.`);

    return {
      enabled,
      cliId,
      tmpDir: Telemetry.tmpDir,
      cacheDir: this.config.cacheDir,
    };
  }
}
