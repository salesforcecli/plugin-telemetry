# plugin-telemetry

[![NPM](https://img.shields.io/npm/v/@salesforce/plugin-telemetry.svg?label=@salesforce/plugin-telemetry)](https://www.npmjs.com/package/@salesforce/plugin-telemetry) [![Downloads/week](https://img.shields.io/npm/dw/@salesforce/plugin-telemetry.svg)](https://npmjs.org/package/@salesforce/plugin-telemetry) [![License](https://img.shields.io/badge/License-BSD%203--Clause-brightgreen.svg)](https://raw.githubusercontent.com/salesforcecli/plugin-telemetry/main/LICENSE.txt)

A plugin to record command usage and error telemetry for the Salesforce CLI.

This plugin is bundled with the CLI and will automatically collect usage data on all commands and plugins. To disable data collection, see [this help document](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_dev_cli_telemetry.htm).

**Note: This plugin should be included at a CLI level ONLY. No CLI plugins should include or depend on this plugin.**

All command usage is recorded by initializing on the `init` oclif hook, recording all events to a log file, then spawning a process on exit to send the data to appinsights.

To debug the telemetry spawned process, run a command with the environment variables `SF_TELEMETRY_DEBUG=true` and `DEBUG=sf:telemetry`.

```bash
SF_TELEMETRY_DEBUG=true DEBUG=sf:telemetry* ./bin/dev telemetry
```

## Getting Started

To build the plugin locally, make sure to have yarn installed and run the following commands:

```bash
# Clone the repository
git clone git@github.com:salesforcecli/plugin-telemetry

# Install the dependencies and compile
yarn install
yarn build
```

To use your plugin, run using the local `./bin/dev` or `./bin/dev.cmd` file.

```bash
# Run using local run file.
./bin/dev telemetry
```

There should be no differences when running via the Salesforce CLI or using the local run file. However, it can be useful to link the plugin to do some additional testing or run your commands from anywhere on your machine.

```bash
# Link your plugin to the sfdx cli
sf plugins:link .
# To verify
sf plugins
```
