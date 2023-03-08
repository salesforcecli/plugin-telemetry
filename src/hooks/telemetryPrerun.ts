/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import { Hook, Performance } from '@oclif/core';
import { Org, SfError, Lifecycle } from '@salesforce/core';
import { TelemetryReporter } from '@salesforce/telemetry';
import Telemetry from '../telemetry';
import { TelemetryGlobal } from '../telemetryGlobal';
import { CommandExecution } from '../commandExecution';
import { debug } from '../debugger';

declare const global: TelemetryGlobal;

interface CommonData {
  nodeVersion: string;
  plugin: string;
  // eslint-disable-next-line camelcase
  plugin_version: string;
  command: string;
}
/**
 * A hook that runs before every command that:
 * 1. Warns the user about command usage data collection the CLI does unless they have already acknowledged the warning.
 * 2. Writes logs to a file, including execution and errors.
 * 3. Logs command usage data to the server right after the process ends by spawning a detached process.
 */
const hook: Hook.Prerun = async function (options): Promise<void> {
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
            this.config.binPath?.includes(join('sfdx', 'client')) || this.config.binPath?.includes(join('sf', 'client'))
              ? 'installer'
              : 'npm',
          platform: this.config.platform,
        });
      }
      // Upload to server. Starts another process.
      // At this point, any other events during the CLI lifecycle should be logged.
      telemetry.upload();
    });

    // Log command errors to the server.  The ts-ignore is necessary
    // because TS is strict about the events that can be handled on process.

    // Record failed command executions from commands that extend SfdxCommand
    process.on(
      'cmdError',
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (cmdErr: SfError, _, org?: Org): Promise<void> => {
        await Performance.collect();

        const { orgType, apiVersion } = await getOrgInfo(org);

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

    // Record failed command executions from commands that extend SfCommand
    process.on(
      'sfCommandError',
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      async (cmdErr: SfError, flags: Record<string, unknown> & { 'target-org'?: Org; 'target-dev-hub'?: Org }) => {
        await Performance.collect();
        const { orgType, apiVersion } = await getOrgInfo(flags['target-org'] ?? flags['target-dev-hub']);
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

    const getOrgInfo = async (
      org: Org | undefined
    ): Promise<{ apiVersion: string | undefined; orgType: 'devhub' | 'scratch' | undefined }> => {
      const apiVersion = org ? org.getConnection().getApiVersion() : undefined;
      let orgType: 'devhub' | 'scratch' | undefined;

      try {
        orgType = org && (await org.determineIfDevHubOrg()) ? 'devhub' : undefined;
        if (!orgType && org) {
          await org.checkScratchOrg();
          orgType = 'scratch';
        }
      } catch (err) {
        /* leave the org as unknown for app insights */
      }

      return { apiVersion, orgType };
    };

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
