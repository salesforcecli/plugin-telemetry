/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Hook } from '@oclif/core';
import type { SfError } from '@salesforce/core';
import type { JsonMap } from '@salesforce/ts-types';
import enabledCheck from '@salesforce/telemetry/enabledCheck';
import type { TelemetryGlobal } from '../telemetryGlobal.js';
import { debug } from '../debugger.js';

declare const global: TelemetryGlobal;

type CommonData = {
  nodeVersion: string;
  plugin?: string;
  // eslint-disable-next-line camelcase
  plugin_version?: string;
  command?: string;
};
/**
 * A hook that runs before every command that:
 * 1. Warns the user about command usage data collection the CLI does unless they have already acknowledged the warning.
 * 2. Writes logs to a file, including execution and errors.
 * 3. Logs command usage data to the server right after the process ends by spawning a detached process.
 */
const hook: Hook.Prerun = async function (options): Promise<void> {
  // Don't even bother logging if telemetry is disabled
  if (!(await enabledCheck.isEnabled())) {
    debug('Telemetry disabled. Doing nothing.');
    return;
  }

  try {
    const [path, Performance, Lifecycle, Telemetry, CommandExecution] = await Promise.all([
      await import('node:path'),
      (await import('@oclif/core')).Performance,
      (await import('@salesforce/core')).Lifecycle,
      (await import('../telemetry.js')).default,
      (await import('../commandExecution.js')).CommandExecution,
    ]);

    const errors: Array<{ event: JsonMap; error: SfError }> = [];

    // Instantiating telemetry shows data collection warning.
    // Adding this to the global so that telemetry events are sent even when different
    // versions of this plugin are in use by the CLI.
    const telemetry = (global.cliTelemetry = await Telemetry.create({
      cacheDir: this.config.cacheDir,
      executable: this.config.bin,
    }));

    const commandExecution = await CommandExecution.create({
      command: options.Command,
      argv: options.argv,
      config: this.config,
    });

    let commonData: CommonData;

    try {
      Lifecycle.getInstance().onTelemetry(async (data) => {
        await Promise.resolve(
          telemetry.record({
            type: 'EVENT',
            ...commonDataMemoized(),
            ...data,
          })
        );
      });
    } catch (err) {
      // even if this throws, the rest of telemetry is not affected
      const error = err as SfError;
      debug('Error subscribing to telemetry events', error.message);
    }

    process.on('warning', (warning) => {
      telemetry.record({
        ...commonDataMemoized(),
        eventName: 'NODE_WARNING',
        warningType: warning.name,
        stack: warning.stack,
        message: warning.message,
      });
    });

    debug('Setting up process exit handler');
    process.once('exit', (status) => {
      let oclifPerf: typeof Performance.oclifPerf | undefined;
      let nonOclifPerf: Record<string, number> | undefined;
      try {
        oclifPerf = Performance.oclifPerf;
        nonOclifPerf = Object.fromEntries(
          Array.from(Performance.results.entries()).flatMap(([owner, results]) =>
            results.map((result): [string, number] => [`${owner}__${result.name}`, result.duration ?? 0])
          )
        );
      } catch (err) {
        debug('Unable to get oclif performance metrics', err);
      }

      for (const { event, error } of errors) {
        telemetry.recordError(error, { ...event, ...oclifPerf, ...nonOclifPerf });
      }

      commandExecution.status = status;
      telemetry.record({ ...commandExecution.toJson(), ...oclifPerf, ...nonOclifPerf });

      if (process.listenerCount('exit') >= 20) {
        // On exit listeners have been a problem in the past. Make sure we don't accumulate too many...
        // This could be from too many plugins. If we start getting this, log number of plugins too.
        telemetry.record({
          eventName: 'EVENT_EMITTER_WARNING',
          count: process.listenerCount('exit'),
        });
      }

      // If it is the first time the telemetry is running, consider it a new "install".
      if (telemetry.firstRun) {
        telemetry.record({
          eventName: 'INSTALL',
          installType:
            this.config.binPath?.includes(path.join('sfdx', 'client')) ??
            this.config.binPath?.includes(path.join('sf', 'client'))
              ? 'installer'
              : 'npm',
          platform: this.config.platform,
        });
      }
      // Upload to server. Starts another process.
      // At this point, any other events during the CLI lifecycle should be logged.
      telemetry.upload();
    });

    // Log command errors to the server.

    // Record failed command executions from commands that extend SfdxCommand
    process.on('cmdError', (error: SfError) => {
      errors.push({ error, event: { ...commandExecution.toJson(), eventName: 'COMMAND_ERROR' } });
    });

    // Record failed command executions from commands that extend SfCommand
    process.on('sfCommandError', (error: SfError) => {
      errors.push({ error, event: { ...commandExecution.toJson(), eventName: 'COMMAND_ERROR' } });
    });

    const commonDataMemoized = (): CommonData => {
      if (!commonData) {
        const pluginInfo = commandExecution.getPluginInfo();
        commonData = {
          nodeVersion: process.version,
          plugin: pluginInfo.name,
          // eslint-disable-next-line camelcase
          plugin_version: pluginInfo.version,
          command: commandExecution.getCommandName(),
        };
      }
      return commonData;
    };
  } catch (err) {
    const error = err as SfError;
    debug('Error with logging or sending telemetry:', error.message);
  }
};

export default hook;
