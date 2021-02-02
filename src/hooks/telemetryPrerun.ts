/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import { Hook, Hooks } from '@oclif/config';
import { Org, SfdxError } from '@salesforce/core';
import { TelemetryReporter } from '@salesforce/telemetry';
import Telemetry from '../telemetry';
import { TelemetryGlobal } from '../telemetryGlobal';
import { CommandExecution } from '../commandExecution';
import { debug } from '../debuger';

declare const global: TelemetryGlobal;

/**
 * A hook that runs before every command that:
 * 1. Warns the user about command usage data collection the CLI does unless they have already acknowledged the warning.
 * 2. Writes logs to a file, including execution and errors.
 * 3. Logs command usage data to the server right after the process ends by spawning a detached process.
 */
const hook: Hook.Prerun = async function (options: Hooks['prerun']): Promise<void> {
  const telemetryEnabled = await TelemetryReporter.determineSfdxTelemetryEnabled();
  // Don't even bother logging if telemetry is disabled
  if (!telemetryEnabled) {
    debug('Telemetry disabled. Doing nothing.');
    return;
  }

  try {
    // Instantiating telemetry shows data collection warning.
    // Adding this to the global so that telemetry events are sent even when different
    // versions of this plugin are in use by the CLI.
    const telemetry = (global.cliTelemetry = await Telemetry.create({ cacheDir: this.config.cacheDir }));

    const commandExecution = await CommandExecution.create({
      command: options.Command,
      argv: options.argv,
      config: this.config,
    });

    process.on('warning', (warning) => {
      const pluginInfo = commandExecution.getPluginInfo();
      telemetry.record({
        eventName: 'NODE_WARNING',
        warningType: warning.name,
        stack: warning.stack,
        message: warning.message,
        nodeVersion: process.version,
        plugin: pluginInfo.name,
        // eslint-disable-next-line camelcase
        plugin_version: pluginInfo.version,
        command: commandExecution.getCommandName(),
      });
    });

    debug('Setting up process exit handler');
    process.once('exit', (status) => {
      commandExecution.status = status;
      telemetry.record(commandExecution.toJson());

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
            this.config.binPath && this.config.binPath.includes(join('sfdx', 'client')) ? 'installer' : 'npm',
          platform: this.config.platform,
        });
      }
      // Upload to server. Starts another process.
      // At this point, any other events during the CLI lifecycle should be logged.
      telemetry.upload();
    });

    // Log command errors to the server.  The ts-ignore is necessary
    // because TS is strict about the events that can be handled on process.

    process.on(
      'cmdError',
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (cmdErr: SfdxError, _, org?: Org): Promise<void> => {
        const apiVersion = org ? org.getConnection().getApiVersion() : undefined;
        let orgType: string | undefined = org && (await org.determineIfDevHubOrg()) ? 'devhub' : undefined;
        if (!orgType && org) {
          try {
            await org.checkScratchOrg();
            orgType = 'scratch';
          } catch (err) {
            /* Leave the org as unknown for app insights */
          }
        }

        // Telemetry will scrub the exception
        telemetry.recordError(
          cmdErr,
          Object.assign(commandExecution.toJson(), {
            eventName: 'COMMAND_ERROR',
            apiVersion,
            orgType,
          })
        );
      }
    );
  } catch (err) {
    const error = err as SfdxError;
    debug('Error with logging or sending telemetry:', error.message);
  }
};

export default hook;
