# aframe-registry

> Work in progress.

Curated collection of community A-Frame components.

## How It Works

A single registry file is maintained at `registry.yml`. The format of a component looks like:

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

Add or update your component in only the `registry.yml` file (do not touch
files in `build/`). Then make a pull request!

To build the output registry JSON files that correspond to each A-Frame version:

```bash
npm install
npm run build
```

## Guidelines

- Keep the components in alphabetical order.
- The component build should self-register the component with `AFRAME.registerComponent`.
