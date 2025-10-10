# Contributions Welcome

Any contributions you're willing to make are _super_ appreciated. That includes a wide variety of things &ndash; not just code!

## Types of Contributions

Since this project is still maturing, many of its initial contributions will take the form of new features or bug fixes. Even if you're not familiar with TypeScript, you can still help make `brs-engine` a more accurate interpreter for the BrightScript language.  You can:

1. Improve documentation for BrightScript's quirks (even minor typos fixes are helpful!)
2. File issues demonstrating where this implementation diverges from the reference one (i.e. on a Roku device)
3. Add end-to-end tests in BrightScript to help exercise find bugs
4. Use `brs-engine` and tell your friends about it

## How to Contribute

## Submitting Issues

If you find something wrong with `brs-engine`, or something doesn't seem right, feel free to [open a new issue](https://github.com/lvcabral/brs-engine/issues/new).
Please try to avoid "how do I X in BrightScript" questions however &mdash; those are best suited for [Slack Community](https://join.slack.com/t/rokudevelopers/shared_invite/zt-4vw7rg6v-NH46oY7hTktpRIBM_zGvwA) or similar Q&A sites.

### Bug Reports

When opening a bug report, please include the following:

1. A description of the bug
1. A BrightScript file that reproduces the issue
1. What you expected to happen
1. What actually happened
1. How consistently you saw the behavior (10%? 90%? Every time?)
1. The versions of `brs-engine` and `node` you found the bug in
1. Your operating system and version

### Feature Requests

Have you found something that this project is missing?  That's great!  We'd love to hear about it.  Please provide the following:

1. A description of the new or missing feature
1. A sample BrightScript file that uses the feature
1. How you expect the feature to behave, or a link to the BrightScript documentation describing its behavior

## Fixing Issues / Adding Features

Regardless of whether you're fixing bugs or implementing new features, there's a few things you'll want to do make the process as easy as possible:

1. Comment on the issue and tell us that you're interested in working on it.  This should lower the (admittedly rare) chances of someone stealing your that bug/feature from you :smile:.
1. Create a fork of this repo if you haven't already
1. Send us a [pull request](https://github.com/lvcabral/brs-engine/pulls)!

## What We Look For in a Pull Request

There aren't to many mandatory things for pull requests, besides what you'd expect from any open-source project (e.g. "don't delete all the code", "don't delete a user's home directory at runtime").  The most important project-specific "must-haves" that we'll look for that are:

1. Pull requests should be based on a pretty recent version of the `master` branch, to minimize merge conflicts.
1. All tests should pass (run `npm test`).
1. End to end tests written in BrightScript should be present to exercise the bug or new feature.  These don't need to be exhaustive &mdash; just enough to ensure that the major use-cases are covered.  More in-depth testing can happen via unit test.
