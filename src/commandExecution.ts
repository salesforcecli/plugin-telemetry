/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import * as fs from 'fs';
import { Config, Command, Parser, Performance } from '@oclif/core';
import { FlagInput } from '@oclif/core/lib/interfaces/parser';
import { SfProject } from '@salesforce/core';
import { AsyncCreatable } from '@salesforce/kit';
import { isNumber, JsonMap, Optional } from '@salesforce/ts-types';
import { debug } from './debugger';

export type CommandExecutionOptions = {
  command: Partial<Command.Class>;
  argv: string[];
  config: Partial<Config>;
};

interface PluginInfo {
  name: Optional<string>;
  version: Optional<string>;
}

export class CommandExecution extends AsyncCreatable {
  public status?: number;
  private specifiedFlags: string[] = [];
  private specifiedFlagFullNames: string[] = [];
  private command: Partial<Command.Class>;
  private argv: string[];
  private config: Partial<Config>;
  private vcs?: string;

  // These will be removed by the uploader
  private orgUsername?: string;
  private devHubOrgUsername?: string;

  public constructor(options: CommandExecutionOptions) {
    super(options);

    this.command = options.command;
    this.argv = options.argv;
    this.config = options.config;
  }

  /**
   * Determines whether the SFDX project is using GIT for version control or some other VCS.
   * Returns a token indicating the VCS for usage stats, or an empty string if the command
   * was executed outside of an SFDX project.
   */
  public static async resolveVCSInfo(): Promise<string> {
    let possibleVcsPath: string;
    try {
      possibleVcsPath = await SfProject.resolveProjectPath();
    } catch (err) {
      debug('Not in a sfdx project, using current working directory');
      possibleVcsPath = process.cwd();
    }

    const gitPath = join(possibleVcsPath, '.git');
    try {
      await fs.promises.access(gitPath, fs.constants.R_OK);
      return 'git';
    } catch (err) {
      return 'other';
    }
  }

  public toJson(): JsonMap {
    const pluginInfo = this.getPluginInfo();
    return {
      eventName: 'COMMAND_EXECUTION',
      // System information
      platform: this.config.platform,
      shell: this.config.shell,
      arch: this.config.arch,
      vcs: this.vcs,
      nodeEnv: process.env.NODE_ENV,
      nodeVersion: process.version,
      processUptime: process.uptime() * 1000,

      // CLI information
      version: this.config.version,
      channel: this.config.channel,
      executable: this.config.bin,
      origin: this.config.userAgent,
      plugin: pluginInfo.name,
      // eslint-disable-next-line camelcase
      plugin_version: pluginInfo.version,
      command: this.command.id,
      // As the user specified, including short names
      specifiedFlags: this.specifiedFlags.join(' '),
      // Flags the user specified, only the full names
      specifiedFlagFullNames: this.specifiedFlagFullNames.join(' '),
      sfdxEnv: process.env.SFDX_ENV,
      s3HostOverride: process.env.SFDX_S3_HOST,
      npmRegistryOverride: process.env.SFDX_NPM_REGISTRY,
      tool: process.env.SFDX_TOOL,
      interceptorMode: process.env.INTERCEPTOR_MODE,

      // Execution information
      date: new Date().toUTCString(),
      // Don't log status or timestamp as a number, otherwise vscode will think it is a metric
      status: isNumber(this.status) ? this.status.toString() : undefined,
      timestamp: String(Date.now()),

      // The amount of time (ms) required for oclif to execute the main `run` function.
      // This does not represent the entire execution time of the command. The `processUptime`
      // metric is the most accurate measure of how long the command execution.
      //
      // Our CLIs instantiate the Config before running oclif's `run` method, meaning that
      // this metric will be less than the actual time spent in oclif.
      'oclif.runMs': Performance.highlights.runTime,
      // The amount of time (ms) required for oclif to get to the point where it can start running the command.
      'oclif.initMs': Performance.highlights.initTime,
      // The amount of time (ms) required for oclif to load the Config.
      'oclif.configLoadMs': Performance.highlights.configLoadTime,
      // The amount of time (ms) required for oclif to load the command.
      'oclif.commandLoadMs': Performance.highlights.commandLoadTime,
      // The amount of time (ms) required for oclif to load core (i.e. bundled) plugins.
      'oclif.corePluginsLoadMs': Performance.highlights.corePluginsLoadTime,
      // The amount of time (ms) required for oclif to load user plugins.
      'oclif.userPluginsLoadMs': Performance.highlights.userPluginsLoadTime,
      // The amount of time (ms) required for oclif to load linked plugins.
      'oclif.linkedPluginsLoadMs': Performance.highlights.linkedPluginsLoadTime,
      // The amount of time (ms) required for oclif to run all the init hooks
      'oclif.initHookMs': Performance.highlights.hookRunTimes.init.total,
      // The amount of time (ms) required for oclif to run all the prerun hooks
      'oclif.prerunHookMs': Performance.highlights.hookRunTimes.prerun.total,
      // The amount of time (ms) required for oclif to run all the postrun hooks
      'oclif.postrunHookMs': Performance.highlights.hookRunTimes.postrun.total,

      // Salesforce Information
      // Set the usernames so the uploader can resolve it to orgIds.
      // Since resolving org ids can make API calls, we want to do that in the
      // uploader process so we don't slow down the CLI.
      devHubUsername: this.devHubOrgUsername,
      orgUsername: this.orgUsername,
    };
  }

  public getPluginInfo(): PluginInfo {
    return {
      name: this.command.plugin?.name,
      version: this.command.plugin?.version,
    };
  }

  public getCommandName(): string {
    return this.command.id;
  }

  protected async init(): Promise<void> {
    const argv = this.argv;
    const flagDefinitions = this.command.flags ?? {};

    let flags: FlagInput = {};
    try {
      flags = (
        await Parser.parse(argv, {
          flags: flagDefinitions,
          args: this.command.args,
          // @ts-expect-error because varargs is not on SfCommand but is on SfdxCommand
          strict: this.command.strict ?? !this.command.varargs,
        })
      ).flags;
    } catch (error) {
      debug('Error parsing flags');
    }
    this.orgUsername = flags['targetusername'] as unknown as string;
    this.devHubOrgUsername = flags['targetdevhubusername'] as unknown as string;

    this.determineSpecifiedFlags(argv, flags, flagDefinitions);

    this.vcs = await CommandExecution.resolveVCSInfo();
  }

  private determineSpecifiedFlags(argv: string[], flags: FlagInput, flagDefinitions: FlagInput): void {
    // Help won't be in the parsed flags
    const shortHelp = argv.find((arg) => /^-h$/.test(arg));
    const fullHelp = argv.find((arg) => /^--help$/.test(arg));
    if (shortHelp || fullHelp) {
      if (shortHelp) {
        this.specifiedFlags.push('h');
      } else {
        this.specifiedFlags.push('help');
      }
      this.specifiedFlagFullNames.push('help');
      // All other flags don't matter if help is specified, so end here.
    } else {
      Object.keys(flags).forEach((flagName) => {
        const shortCode = flagDefinitions[flagName] && (flagDefinitions[flagName].char as string);
        // Oclif will include the flag if there is a default, but we only want to add it if the
        // user specified it, so confirm in the argv list.
        if (shortCode && argv.find((arg) => new RegExp(`^-${shortCode}(=.*)?$`).test(arg))) {
          this.specifiedFlags.push(shortCode);
          this.specifiedFlagFullNames.push(flagName);
        } else if (argv.find((arg) => new RegExp(`^--${flagName}(=.*)?$`).test(arg))) {
          this.specifiedFlags.push(flagName);
          this.specifiedFlagFullNames.push(flagName);
        }
      });
    }
  }
}
