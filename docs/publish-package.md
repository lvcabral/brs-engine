# How to Publish the Packages

The monorepo publishes three packages, on two version lines:

| Package | Workspace | Version line | Git tag |
| --- | --- | --- | --- |
| `brs-engine` | `packages/browser` | shared with `brs-node` | `vX.Y.Z` |
| `brs-node` | `packages/node` | shared with `brs-engine` | `vX.Y.Z` |
| `brs-scenegraph` | `packages/scenegraph` | independent | `brs-sg-vX.Y.Z` |

## Release Checklist

1. Bump the versions, all in the same commit:
   - `package.json` (workspace root), `packages/browser/package.json` and `packages/node/package.json` to the new `X.Y.Z`.
   - `packages/scenegraph/package.json` to its own new version, **and** its `peerDependencies.brs-engine` range to `^X.Y.Z`.
   - Refresh the lock file with `npm install --package-lock-only`.
2. Update `CHANGELOG.md` (engine and node) and `packages/scenegraph/CHANGELOG.md` (extension), adding the new
   version section and its reference link at the bottom of each file.
3. Run `npm run prettier:write`, `npm run lint` and `npm test`.
4. Commit as `Bump to vX.Y.Z (core) and v0.Y.Z (rsg)`, then tag that same commit twice: `vX.Y.Z` and `brs-sg-vX.Y.Z`.
5. Build the production bundles with `npm run release` (the `prepublishOnly` script of each package also does this).
6. Publish each package (see below).

## Publish a Release Package

- Run `npm publish -w <package-name> --tag latest` to publish the package under the `latest` tag

## Publish a Pre-Release Package

- Run `npm publish -w <package-name> --tag alpha` to publish the package under the `alpha` tag
- Run `npm publish -w <package-name> --tag beta` to publish the package under the `beta` tag — this is the
  current tag used by `brs-scenegraph` while the SceneGraph extension is in beta

## To check published versions

- Run `npm view --json` and see `versions` and `time`

## To update the badge image on Github

The README badges are served by [shields.io](https://shields.io) and read the published version straight from
npm, so they refresh on their own. If GitHub's image proxy is serving a stale copy, purge it by requesting the
`camo.githubusercontent.com` URL of the badge (right-click the badge → copy image address) with `PURGE`:

```console
curl -X PURGE https://camo.githubusercontent.com/<hash-of-the-badge-url>
{ "status": "ok", "id": "8200116-1678720264-342697" }
```

## To force update a Tag if needed

```console
git checkout master
git pull origin master
git tag -f v1.0.0
git push origin -f v1.0.0
```
