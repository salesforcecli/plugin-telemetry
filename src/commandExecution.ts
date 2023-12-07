/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Config, Command, Flags, Parser } from '@oclif/core';
import { FlagInput } from '@oclif/core/lib/interfaces/parser.js';
import { Org } from '@salesforce/core';
import { AsyncCreatable } from '@salesforce/kit';
import { isNumber, JsonMap, Optional } from '@salesforce/ts-types';
import { debug } from './debugger.js';

export type CommandExecutionOptions = {
  command: Partial<Command.Class>;
  argv: string[];
  config: Partial<Config>;
};

type PluginInfo = {
  name: Optional<string>;
  version: Optional<string>;
};

export class CommandExecution extends AsyncCreatable {
  public status?: number;
  private specifiedFlags: string[] = [];
  private specifiedFlagFullNames: string[] = [];
  private deprecatedFlagsUsed: string[] = [];
  private deprecatedCommandUsed?: string | null;
  private command: Partial<Command.Class>;
  private readonly argv: string[];
  private config: Partial<Config>;

  private orgId?: string | null;
  private devhubId?: string | null;
  private orgApiVersion?: string | null;
  private devhubApiVersion?: string | null;

  public constructor(options: CommandExecutionOptions) {
    super(options);

    this.command = options.command;
    this.argv = options.argv;
    this.config = options.config;
  }

  /**
   * @deprecated.  Will always return en empty string.
   */
  public static async resolveVCSInfo(): Promise<string> {
    return Promise.resolve('');
  }

  public toJson(): JsonMap {
    const pluginInfo = this.getPluginInfo();

    return {
      eventName: 'COMMAND_EXECUTION',
      // System information
      platform: this.config.platform,
      shell: this.config.shell,
      arch: this.config.arch,
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
      deprecatedFlagsUsed: this.deprecatedFlagsUsed.join(' '),
      deprecatedCommandUsed: this.deprecatedCommandUsed,
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

      // Salesforce Information
      orgId: this.orgId,
      devhubId: this.devhubId,
      orgApiVersion: this.orgApiVersion,
      devhubApiVersion: this.devhubApiVersion,
    };
  }

  public getPluginInfo(): PluginInfo {
    return {
      name: this.command.plugin?.name,
      version: this.command.plugin?.version,
    };
  }

  public getCommandName(): string | undefined {
    return this.command.id;
  }

  protected async init(): Promise<void> {
    const argv = this.argv;
    const flagDefinitions = {
      ...this.command.flags,
      ...this.command.baseFlags,
      ...(this.command.enableJsonFlag ? { json: Flags.boolean() } : {}),
    };

    // slice off node or bin path, and the executable path, and then remove anything that's been processed as a flag
    const typedCommand = process.argv
      .splice(2)
      .filter((arg) => !argv.includes(arg))
      .join(':');

    if (
      Boolean(this.command.deprecationOptions) ||
      (typedCommand !== this.command.id &&
        this.command.aliases?.includes(typedCommand) &&
        this.command.deprecateAliases)
    ) {
      // check the deprecationOptions for cases where we've used OCLIF to point to a replacement
      // check the aliases and deprecated aliases for where we're deprecating in place
      this.deprecatedCommandUsed = typedCommand;
    }

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

    this.orgId = flags['target-org'] ? (flags['target-org'] as unknown as Org).getOrgId() : null;
    this.devhubId = flags['target-dev-hub'] ? (flags['target-dev-hub'] as unknown as Org).getOrgId() : null;
    this.orgApiVersion = flags['target-org']
      ? (flags['target-org'] as unknown as Org).getConnection().getApiVersion()
      : null;
    this.devhubApiVersion = flags['target-dev-hub']
      ? (flags['target-dev-hub'] as unknown as Org).getConnection().getApiVersion()
      : null;
    this.determineSpecifiedFlags(argv, flags, flagDefinitions);
  }

  private determineSpecifiedFlags(argv: string[], flags: FlagInput, flagDefinitions: FlagInput): void {
    // Help won't be in the parsed flags
    const shortHelp = argv.find((arg) => /^-h$/.test(arg));
    const fullHelp = argv.find((arg) => /^--help$/.test(arg));
    if (Boolean(shortHelp) || fullHelp) {
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
        } else {
          // we can't find the flag as the key (long name) or short char, so it must be an alias

          // get present flags in argv, that is everything starting with `-`, then strip dashes from it.
          // e.g. ['-u', 'test', '--json'] -> [ 'u', undefined, 'json' ]
          const argvFlags = this.argv.map((a) => a.match(/-([a-zA-Z]+)/g)).map((a) => a?.[0].replace('-', ''));

          let possibleAliases = flagDefinitions[flagName].aliases ?? [];

          // charAliases is optional
          // this check also ensure compatibility with commands using oclif/core < 3 where `charAliases` isn't supported.
          if (flagDefinitions[flagName].charAliases) {
            possibleAliases = possibleAliases?.concat(flagDefinitions[flagName].charAliases as string[]);
          }

          // if you have a flag that sets a default value and has aliases
          // this check will ensure it only gets captured if the user specified it using aliases
          const specifiedFlag = possibleAliases.find((a) => argvFlags.includes(a));

          if (specifiedFlag) {
            // save flag with their original name instead of the typed alias
            this.specifiedFlagFullNames.push(flagName);
            this.specifiedFlags.push(flagName);

            // user typed a deprecated alias
            if (flagDefinitions[flagName].deprecateAliases) {
              this.deprecatedFlagsUsed.push(specifiedFlag);
            }
          }
        }
      });
    }
  }
}
