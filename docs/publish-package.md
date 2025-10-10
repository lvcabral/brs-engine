# How to Publish the Packages

## Publish a Pre-Release Package

- Run `npm publish --tag alpha` to publish the package under the `alpha` tag

## Publish a Release Package

- Run `npm publish --tag latest` to publish the package under the `latest` tag

## To check published versions

- Run `npm view --json` and see `versions` and `time`

## To update the badge image on Github

After the package `latest` tag is updated, run this command on your Terminal to make sure the npm badge is up to date:

```console
curl -X PURGE https://camo.githubusercontent.com/8134e08f7ee670486f1e16039625a28fc0dc88f5a667b80535dd630a7a86f0f0/68747470733a2f2f62616467652e667572792e696f2f6a732f6272732d656d752e7376673f7374796c653d666c6174
{ "status": "ok", "id": "8200116-1678720264-342697" }
```

## To force update a Tag if needed

```console
git checkout master
git pull origin master
git tag -f v1.0.0
git push origin -f v1.0.0
```
