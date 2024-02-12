# Altis Accelerate

Welcome to the Altis Accelerate plugin repository, this is the installable WordPress plugin for access to the Altis Accelerate SaaS.

[You can read up on the background for this plugin on Notion here](https://www.notion.so/altis-dxp/Accelerate-d31acbefc7104ddc86eb583d758ed46c).

Related repositories for this product:

- [Accelerate Terraform](https://github.com/humanmade/accelerate-terraform): infrastructure code for the Accelerate backend
- [Vantage Backend](https://github.com/humanmade/vantage-backend): API endpoints for user sign ups and provisioning resources
- [Vantage](https://github.com/humanmade/vantage): Frontend landing page and dashboard for sign ups
- [Core Module](https://github.com/humanmade/altis-core): Altis helper functions & telemetry
- [Analytics Plugin](https://github.com/humanmade/aws-analytics): Analytics features, content explorer XBs, experiments etc...

This plugin integrates [Altis Reusable Blocks](https://github.com/humanmade/altis-reusable-blocks/) plugin functionality, including branding "Reusable Blocks" as "Global Blocks", to reflect the expected functionality within the Altis Accelerate plugin.

## Installation

Requirements:
- PHP 7.4+ (prefer 8.0)
- Node v14+ (prefer 14)

```
# Clone this repo down:
git clone git@github.com:humanmade/altis-accelerate.git accelerate
cd accelerate

# Install dependencies:
composer install
composer build-deps
```

## Bringing it online

You can run the development tools in two modes:

* Full local: Sets up a local copy of the analytics server as well as a local WordPress install for testing
* Server-only: Sets up just the analytics server

Server-only is intended for use when testing with development tools for other platforms. In most cases, use the full local setup for development.

### Full local

```
# To start the server:
composer start
# To stop the server:
composer stop
```

### Server-only

```
# To start the server:
composer start-server
# To stop the server:
composer stop-server
```

## Activate the plugin

For development, you can use the follow Altis Analytics Cloud configuration (WP Admin -> Settings -> Altis)

```
{"elasticsearch":{"url":"https:\/\/eu.accelerate.altis.cloud","access_key":"AKIASYQKASACSLWJGYNA","access_secret":"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","region":"eu-central-1","index_path":"plugin-dev--analytics-"},"cognito":{"identity_pool_id":"eu-central-1:151d23f2-0246-47f8-afe6-95af160776f6","region":"eu-central-1"},"pinpoint":{"app_id":"daa03aa6a53049559788bf070698c6c7","region":"eu-central-1"}}
```

### Local Development with ClickHouse

Use the following API key instead:

```
eu-central-1:82269f5487264c22aff5f66fe1c3e92c:
```

## Working on the Accelerate Plugin

The standard HM git workflow applies per the guidance here: https://engineering.hmn.md/how-we-work/process/development/

Key items:

- Deployable `main` branch - this goes for dependencies as well
- Always create a branch to do your work, commit and submit a PR
- Reference relevant GitHub issues, Notion documents and Slack discussions as appropriate in the commits or PR comment

If you are familiar with working on the Altis Cloud platform this plugin is essentially a standalone version of the Analytics module, with only the Altis Native Analytics features.

Pull requests should always be made against `develop` unless there's a good reason not to

### Backporting

Pull requests to `develop` can be backported to `main` in the case of mistakes, bug fixes or security patches using the label "backport main".

Once merged an automated PR is created to the `main` branch which can then be re-reviewed and merged.

### Working on dependencies

After following the installation steps your local checkout will have git checkouts for the following 2 dependencies:

- `vendor/altis/aws-analytics`
- `vendor/altis/core`

These are set to track the `master` branch by default. The same git workflow applies, create branches, and push PRs for review.

As of now this plugin is tracking the development versions of these dependencies, should we need to deviate in future or move to a more stable release cycle then we should switch to accelerate specific release branches for each dependency.

### WP CLI

To run CLI commands use the following shortcut, replacing `<command>` with your CLI command, and without `wp` at the start:

```
composer cli -- <command>

# E.g. to update the admin user's password:
composer cli -- update user admin --user_pass=password
```

### Viewing `debug.log` and WP files

Should you need to view `wp-content/debug.log` or make any edits etc... to core files like `wp-config.php` when debugging, WordPress itself is mounted to the `.wordpress` folder in your working directory.

## Release process

Releases are based on our 2 release branches:

- `main` - for stable releases
- `develop` - (default branch) used for beta releases

### Stable releases

To create a new stable release use the releases page of this repo and follow these steps:

- Choose the `main` branch to release from
- Enter the new tag name with an appropriate increment for patch or minor version
- Enter a description of the changes made
- Publish the release

For new major version releases, e.g. when the `develop` branch is ready to become the new stable version follow these steps:

- Merge `develop` into `main` and push to GitHub
- Create a new release from `main` following the above steps with the major version incremented

### Beta releases

- Choose the `develop` branch to release from
- Enter the new tag name with an increment of the beta version e.g. "1.0.0-beta.1" to "1.0.0-beta.2"
- Enter a description of the changes made
- Check the "This is a pre-release" checkbox
- Publish the release

### Versioning

Versioning will follow these rules:

- Tags created from `develop` are always one major version ahead of stable tags created from `main`. e.g. if main is "0.x", then develop is "1.0.0-beta.x"
- Tags created from `develop` must only ever increment the beta version, and not the major, minor or patch version e.g. "1.0.0-beta.x", where "x" is incremented
- Stable tags should have the

Users of the plugin are able to opt in to the beta release stream via a link on the plugins page.

## Working With Local Analytics Data

On local you may want to generate some analytics data. The dev install of this plugin provides the Analytics Demo Data Generator plugin.

1. Under the [tools menu look for "Analytics Demo"](http://localhost:8081/wp-admin/tools.php?page=analytics-demo).
1. Choose whether to import data for 7 or 14 days.
1. Trigger the background task manually by running `composer cli cron event run altis_analytics_import_demo_data`

Note we need to trigger this manually because the environment is not running Cavalcade, instead relying on default WP Cron.

## ClickHouse and Grafana

The dev environment provides a local instance of Clickhouse and also Grafana for exploring the data and testing queries.

To set up access in Grafana first you will need to enable the ClickHouse data source plugin:

1. Ensure the dev environment is running with `composer start` (if you already have it running but have just updated your local checkout, re-run it)
1. Go to the [add data source screen](http://localhost:3600/datasources/new)
1. Search for ClickHouse and click on it
1. Enter the following details:
   - Server URI: `clickhouse`
   - Server Port: `9000`
   - Toggle "Skip TLS verify" to on
1. Click "Save and Test"
1. You can now click "Explore" to start creating queries and dashboards for ClickHouse. [See the Grafana docs for more](https://grafana.com/docs/)

**Note:** You can also add Elasticsearch as a data source using the host `http://elasticsearch:9200` in Grafana however Kibana has more ES specific tools.
