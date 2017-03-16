# aframe-registry

[angle]: https://npmjs.com/package/angle

Curated collection of community A-Frame components.

[VIEW SITE](https://aframe.io/registry/)

<img src="https://rawgit.com/aframevr/aframe-registry/master/scripts/placeholder.svg" height="320">

## Introduction

The Registry collects components from the community. We curate them to make
sure they work for the versions of A-Frame they say they work. We also try to
improve the components as they come in with code review and API suggestions.
Versioning is handled so you don't have to look for which version of the
component works with your version of A-Frame. As a component repository,
the Registry is similar to the Unity Asset Store or npm.

### Usage

You can install or try out components from the Registry in one of several ways.

#### angle

[angle](https://npmjs.com/package/angle) is a command-line interface (CLI)
for A-Frame. You can install components through this CLI straight into your
HTML file. angle will inject the appropriate `<script>` tag pointing to a CDN
depending on your version of A-Frame:

```
npm install -g angle && angle install aframe-physics-system
```

#### Download

If you [browse the Registry's website](https://aframe.io/registry/), you'll see
download links for components. The Registry will currently show builds for the
latest versions of A-Frame for now. You can either download the file locally,
or copy and paste the URLs and reference from a `<script>` tag in your HTML.

#### Inspector

If you open any A-Frame scene using [the visual
Inspector](https://github.com/aframevr/aframe-inspector) with `<ctrl> + <alt> +
i`, you'll find components from the Registry in the Inspector's dropdowns when
adding a component to an entity. Straight from the Inspector, you can do things
such as select animations, physics, or mountains from the dropdown straight
from the Registry.

## Maintaining the Registry

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

We recommend using [angle's][angle] component template to get started on a component:

```
npm install -g angle
angle initcomponent
```

### Component Requirements

1. Must be published to [npm](https://npmjs.com).
2. Must be published to [GitHub](https://github.com).
3. Must self-register themselves with `AFRAME.registerComponent`.
4. Must contain documentation on component properties and sample usage in the README.
5. Must contain at least one example published to GitHub Pages.
6. A link to the examples must be added as the GitHub repository's Website next
   to the GitHub repository's Description.
7. Must make sense in the context of a WebVR application. This can change
   later, but the initial components of the Registry will be under strict
   curation.

### Component Suggestions

- Should include an attractive preview image or GIF in your README for display.
- Should follow [semver](http://semver.org/) in your component versioning scheme, mirroring A-Frame's latest stable version.
- Use [angle](https://www.npmjs.com/package/angle), an A-Frame command-line tool, to bootstrap a component template for publishing.
- Add A-Frame Registry maintainer [Kevin Ngo](https://github.com/ngokevin/) as
  a collaborator to your GitHub repository and as an owner to your npm package
  (`npm owner add ngokevin`) if you want help maintaining your component.

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

