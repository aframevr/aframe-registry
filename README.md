# aframe-registry

> Work in progress.

Curated collection of community A-Frame components, shaders, and assets.

[VIEW SITE](https://aframevr.github.io/aframe-registry/)

## How It Works

A single registry file is maintained at `registry.yml`. The format of a
component looks like:

```yml
<npm package name>:
  name: <component name as used from HTML>
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

## Updating the Registry

Add or update your module in the `registry.yml` file (not the files in
`build/`). Then make a pull request!

To build the output registry JSON files that correspond to each A-Frame version:

```bash
npm install
npm run build
```

If you want to see the registry in a more readable format:

```bash
npm run print
```

## Local Development

If updating the build scripts, make sure you have `npm install`ed. Then you can
modify scripts and run `npm run test` to unit test or `npm run build` to do a
full run.

If updating the website, run `npm run site` to re-generate the templates. This
doesn't need to be done if just working on CSS.

Once deployed to master, the Registry's GitHub Pages will update.

## Guidelines

- Keep the registry in alphabetical order.
- Component builds should self-register themselves with `AFRAME.registerComponent`.
- Components should be published to [GitHub](https://github.com).
- Components should be published to [npm](https://npmjs.com).
- Include a preview image or GIF in your README for display.
- Try to follow [semver](http://semver.org/) in your component versioning scheme.
