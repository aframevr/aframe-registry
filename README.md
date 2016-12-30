# aframe-registry

Curated collection of community A-Frame components, shaders, and assets.

[VIEW SITE](https://aframevr.github.io/aframe-registry/)

<img src="https://rawgit.com/aframevr/aframe-registry/master/scripts/placeholder.svg" height="320">

## Introduction

A single registry file is maintained at `registry.yml`. The format of a
component looks like:

```yml
<npm package name>:
  names: [<component names (as used from HTML) included>]
  versions:
    <aframe major version series>:
      version: <npm package version>
      path: <relative path to component JS file from package root>
```

All other metadata will be fetched from npm, and the component build will be
served via `unpkg.com`, a CDN for npm.

This registry will then be processed and output to JSON files, one for each
major version of A-Frame. These JSON files will be consumed by tools,
libraries, and websites such as the [A-Frame
Inspector](https://github.com/aframevr/aframe-inspector).

### Versioning

Once A-Frame updates, all existing components will still work but are marked
with a compatibility warning until either the component's entry in the registry
is updated and compatibility confirmed. Here's how component compatibility is
determined in relation to A-Frame:

- If there is a component version explicitly listed for an A-Frame version, use that.
- If there is no component version listed for an A-Frame version, use the
  version registered for the previous A-Frame version if possible. Then set a
  flag in order to raise compatibility warnings.
- If a component version for an A-Frame version is explicitly set to `null`,
  exclude it.

### Excluding from the Inspector

Components may be more optimal to use straight from code instead of from visual
tools such as the Inspector. In such cases, specify `inspector: false`:

```
aframe-codey-component:
  names: codey
  inspector: false
  versions:
    0.4.0:
      version: 1.2.3
      path: dist/aframe-codey-component.min.js
```

## Submitting a Component

To submit a component, make a pull request adding your component to the
registry file in the format explained above.

### Component Requirements

1. Must be published to [npm](https://npmjs.com).
2. Must be published to [GitHub](https://github.com).
3. Must self-register themselves with `AFRAME.registerComponent`.
4. Must contain documentation on component properties and sample usage in the README.
5. Must contain at least one example published to GitHub Pages.

### Component Suggestions

- Should include an attractive preview image or GIF in your README for display.
- Should follow [semver](http://semver.org/) in your component versioning scheme, mirroring A-Frame's latest stable version.
- Use [angle](https://www.npmjs.com/package/angle), an A-Frame command-line tool, to bootstrap a component template for publishing.

## Updating the Registry

Add or update your module in the `registry.yml` file (not the files in
`build/`). Then make a pull request!

To build the output registry JSON files that correspond to each A-Frame version:

```bash
npm install
npm run config  # Local config. You will need to add your GitHub API token.
npm run build
```

If you want to see the registry in a more readable format:

```bash
npm run print
```

Try to keep the registry in alphabetical order.

## Local Development

If updating the build scripts, make sure you have `npm install`ed. Then you can
modify scripts and run `npm run test` to unit test or `npm run build` to do a
full run.

If updating the website, run `npm run site` to re-generate the templates. This
doesn't need to be done if just working on CSS.

Once deployed to master, the Registry's GitHub Pages will update.

