## Publish a Pre-Release Package

- Update `package.json`, set `version` to the desired version, e.g. `0.10.1-dev`, `0.11.0-rc1`, ...
- Run `npm publish --tag dev` to publish the package under the `dev` tag

## Publish a Release Package

- Update `package.json`, set `version` to the desired version, e.g. `0.10.3`
- Run `npm publish --tag latest` to publish the package under the `latest` tag

## To check published versions
 - Run `npm view --json` and see `versions` and `time`