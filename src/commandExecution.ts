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

import fs from 'node:fs/promises';
import path from 'node:path';
import { Config, Command, Flags, Parser } from '@oclif/core';
import { Org, SfError } from '@salesforce/core';
import { AsyncCreatable } from '@salesforce/kit';
import { isNumber, JsonMap, Optional } from '@salesforce/ts-types';
import { parseVarArgs } from '@salesforce/sf-plugins-core';
import { debug } from './debugger.js';
import { getRelevantEnvs } from './gatherEnvs.js';

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
  private agentPseudoTypeUsed?: boolean | null;
  private orgApiVersion?: string | null;
  private devhubApiVersion?: string | null;
  private argKeys: string[] = [];
  private enableO11y?: boolean;
  private o11yUploadEndpoint?: string;

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
    const envs = getRelevantEnvs();
    return {
      eventName: 'COMMAND_EXECUTION',
      // System information
      platform: this.config.platform,
      shell: this.config.shell,
      arch: this.config.arch,
      nodeEnv: process.env.NODE_ENV,
      nodeVersion: process.version,
      processUptime: process.uptime() * 1000,
      enableO11y: this.enableO11y,
      o11yUploadEndpoint: this.o11yUploadEndpoint,

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
      specifiedFlags: this.specifiedFlags.sort().join(' '),
      // Flags the user specified, only the full names
      specifiedFlagFullNames: this.specifiedFlagFullNames.sort().join(' '),
      agentPseudoTypeUsed: this.agentPseudoTypeUsed ?? false,
      deprecatedFlagsUsed: this.deprecatedFlagsUsed.sort().join(' '),
      deprecatedCommandUsed: this.deprecatedCommandUsed,
      sfdxEnv: process.env.SFDX_ENV,
      s3HostOverride: process.env.SF_S3_HOST ?? process.env.SFDX_S3_HOST,
      npmRegistryOverride: process.env.SF_NPM_REGISTRY ?? process.env.SFDX_NPM_REGISTRY,
      tool: process.env.SFDX_TOOL,

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
      specifiedEnvs: envs.specifiedEnvs.join(' '),
      uniqueEnvs: envs.uniqueEnvs.join(' '),
      argKeys: this.argKeys.sort().join(' '),
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

    let flags: Parser.FlagInput = {};
    try {
      const parseResult = await Parser.parse(argv, {
        flags: flagDefinitions,
        args: this.command.args,
        // @ts-expect-error because varargs is not on SfCommand but is on SfdxCommand
        strict: this.command.strict ?? !this.command.varargs,
      });
      flags = parseResult.flags;
      this.agentPseudoTypeUsed =
        (flags['metadata'] as unknown as string[])?.some((metadata) => metadata.toLowerCase().startsWith('agent')) ??
        false;
      this.argKeys = [...new Set(Object.keys(parseVarArgs(parseResult.args, parseResult.argv as string[])))];
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

    // Read o11y configuration from the plugin's package.json (plugin that owns the command)
    const pluginRoot = this.command.plugin?.root;
    if (pluginRoot) {
      try {
        const pjsonPath = path.join(pluginRoot, 'package.json');
        const pjsonContents = await fs.readFile(pjsonPath, 'utf-8');
        const pjson = JSON.parse(pjsonContents) as Record<string, unknown>;
        const rawEnableO11y = pjson.enableO11y;
        this.enableO11y =
          typeof rawEnableO11y === 'boolean' ? rawEnableO11y : String(rawEnableO11y ?? '').toLowerCase() === 'true';
        const endpoint = pjson.o11yUploadEndpoint;
        this.o11yUploadEndpoint = typeof endpoint === 'string' && endpoint.length > 0 ? endpoint : undefined;
      } catch (err) {
        const error = SfError.wrap(err);
        debug('Could not read plugin package.json for o11y config', error.message);
      }
    }
  }

  private determineSpecifiedFlags(argv: string[], flags: Parser.FlagInput, flagDefinitions: Parser.FlagInput): void {
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

          const possibleAliases = [
            ...(flagDefinitions[flagName].aliases ?? []),
            // charAliases is optional.  Ensure compatibility with commands using oclif/core < 3 where `charAliases` isn't supported.
            ...(flagDefinitions[flagName].charAliases ?? []),
          ];

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
