/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
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
