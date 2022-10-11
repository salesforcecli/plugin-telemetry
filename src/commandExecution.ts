/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import * as fs from 'fs';
import { Config, Interfaces, Parser } from '@oclif/core';
import { SfProject } from '@salesforce/core';
import { AsyncCreatable } from '@salesforce/kit';
import { isNumber, JsonMap, Optional } from '@salesforce/ts-types';
import { debug } from './debuger';
import { InitData } from './hooks/telemetryInit';

export type CommandExecutionOptions = {
  command: Partial<Interfaces.Command.Class>;
  argv: string[];
  config: Partial<Config>;
};

interface PluginInfo {
  name: Optional<string>;
  version: Optional<string>;
}

export class CommandExecution extends AsyncCreatable {
  public status?: number;
  private start: number;
  private upTimeAtCmdStart: number;
  private specifiedFlags: string[] = [];
  private specifiedFlagFullNames: string[] = [];
  private command: Partial<Interfaces.Command.Class>;
  private argv: string[];
  private config: Partial<Config>;
  private vcs?: string;

  // These will be removed by the uploader
  private orgUsername?: string;
  private devHubOrgUsername?: string;

  public constructor(options: CommandExecutionOptions) {
    super(options);

    this.start = Date.now();
    this.command = options.command;
    this.argv = options.argv;
    this.config = options.config;
    this.upTimeAtCmdStart = process.uptime() * 1000;
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
      runtime: Date.now() - this.start,
      upTimeAtCmdStart: this.upTimeAtCmdStart,
      oclifLoadTime: InitData.upTimeAtInit,
      commandLoadTime: this.upTimeAtCmdStart - InitData.upTimeAtInit,

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
    const flagDefinitions = this.command.flags || {};

    // We can't get varargs on type Class, so we need to cast to any to parse flags properly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyCmd: any = this.command;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const commandDef = { flags: flagDefinitions, args: this.command.args, strict: !anyCmd.varargs };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let flags: Interfaces.Input<any, any> = {};
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      flags = (await Parser.parse(argv, commandDef)).flags;
    } catch (error) {
      debug('Error parsing flags');
    }
    this.orgUsername = flags['targetusername'] as string;
    this.devHubOrgUsername = flags['targetdevhubusername'] as string;

    this.determineSpecifiedFlags(argv, flags, flagDefinitions);

    this.vcs = await CommandExecution.resolveVCSInfo();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private determineSpecifiedFlags(argv: string[], flags: any, flagDefinitions: Interfaces.Input<any, any>): void {
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      Object.keys(flags).forEach((flagName) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
