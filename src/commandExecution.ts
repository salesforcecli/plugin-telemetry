/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join } from 'path';
import { Command, IConfig } from '@oclif/config';
import { parse } from '@oclif/parser';
import { fs, SfdxProject } from '@salesforce/core';
import { AsyncCreatable } from '@salesforce/kit';
import { isNumber, JsonMap } from '@salesforce/ts-types';
import { debug } from './debuger';
import { InitData } from './hooks/analyticsInit';

export type CommandExecutionOptions = {
  command: Command.Class;
  argv: string[];
  config: IConfig;
};

export class CommandExecution extends AsyncCreatable {
  public status?: number;
  private start: number;
  private upTimeAtCmdStart: number;
  private specifiedFlags: string[] = [];
  private specifiedFlagFullNames: string[] = [];
  private command: Command.Class;
  private argv: string[];
  private config: IConfig;
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
      possibleVcsPath = await SfdxProject.resolveProjectPath();
    } catch (err) {
      debug('Not in a sfdx project, using current working directory');
      possibleVcsPath = process.cwd();
    }

    const gitPath = join(possibleVcsPath, '.git');
    try {
      await fs.access(gitPath, fs.constants.R_OK);
      return 'git';
    } catch (err) {
      return 'other';
    }
  }

  public toJson(): JsonMap {
    return {
      eventName: 'COMMAND_EXECUTION',

      // System information
      platform: this.config.platform,
      shell: this.config.shell,
      arch: this.config.arch,
      vcs: this.vcs,
      nodeEnv: process.env.NODE_ENV,
      processUptime: process.uptime() * 1000,

      // CLI information
      version: this.config.version,
      channel: this.config.channel,
      origin: this.config.userAgent,
      plugin: this.command.plugin && this.command.plugin.name,
      // eslint-disable-next-line @typescript-eslint/camelcase
      plugin_version: this.command.plugin && this.command.plugin.version,
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

  protected async init(): Promise<void> {
    const argv = this.argv;
    const flagDefinitions = this.command.flags || {};

    // We can't get varargs on type Class, so we need to cast to any to parse flags properly
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyCmd: any = this.command;
    const commandDef = { flags: flagDefinitions, args: this.command.args, strict: !anyCmd.varargs };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let flags: any = {};
    try {
      flags = parse(argv, commandDef).flags;
    } catch (error) {
      debug('Error parsing flags');
    }
    this.orgUsername = flags.targetusername;
    this.devHubOrgUsername = flags.targetdevhubusername;

    this.determineSpecifiedFlags(argv, flags, flagDefinitions);

    this.vcs = await CommandExecution.resolveVCSInfo();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private determineSpecifiedFlags(argv: string[], flags: any, flagDefinitions: any): void {
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
