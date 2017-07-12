/*
  Component Steps:
    For each component:
      For each A-Frame version:
        Check if version is explicitly incompatible
        Check if version can fall back to old version, use its metadata
        Fetch metadata
          NPM
          GitHub
          README (hosted on unpkg)
  Write to JSON
*/
var deepExtend = require('deep-extend');
var fs = require('fs');
var path = require('path');
var yaml = require('js-yaml');

var config = require('./config');
var writeCache = require('./cache').write;
var getMetadata = require('./metadata.js').getMetadata;

// Major versions.
var AFRAME_VERSIONS = ['0.2.0', '0.3.0', '0.4.0', '0.5.0', '0.6.0'];

// Main function.
if (require.main === module) {
  if (!config.githubAccessToken) {
    throw new Error('Github API token required. ' +
                    'Set it via process.env.GITHUB_TOKEN or config.githubAccessToken.');
  }
  var registry = load('registry.yml');
  build(registry).then(write);
}

/**
 * Load registry from file into memory.
 *
 * @param {string} registryFilename - Path to registry file.
 */
function load (registryFilename) {
  // Load registry.
  console.log('Processing registry.yml...');
  return yaml.load(fs.readFileSync(registryFilename, 'utf-8'));
}

/**
 * Process and fetch metadata for each module and version.
 *
 * @param {object} REGISTRY - Complete registry object, preprocessed.
 * @returns {Promise} - Resolves complete registry object, processed.
 */
function build (REGISTRY, stubFetchers) {
  // The output object, keyed by A-Frame versions.
  var OUTPUT = {};

  // Populate with A-Frame versions.
  AFRAME_VERSIONS.forEach(function populate (aframeVersion) {
    OUTPUT[aframeVersion] = {
      components: {},
      shaders: {}
    };
  });

  var promises = [];
  ['components', 'shaders'].forEach(function processModules (type) {
    // Process each module.
    Object.keys(REGISTRY[type] || {}).forEach(function processModule (npmName) {
      var aframeVersionPromises = [];
      var aModule = REGISTRY[type][npmName];
      aModule.npmName = npmName;

      // Need to push promises one at a time so they can be referenced in case a component
      // is falling back to the previous version.
      AFRAME_VERSIONS.forEach(function pushPromise (aframeVersion, index) {
        var resolvePromise = resolveData(aModule, aframeVersion, AFRAME_VERSIONS[index - 1],
                                         aframeVersionPromises[index - 1], stubFetchers);
        resolvePromise.then(function (metadata) {
          if (!metadata) { return; }
          OUTPUT[aframeVersion][type][npmName] = metadata;
        });
        aframeVersionPromises.push(resolvePromise);
      });

      promises.push(Promise.all(aframeVersionPromises));
    });
  });

  return new Promise(function waitOnPromises (resolve) {
    Promise.all(promises).then(function done () {
      resolve(OUTPUT);
    }).catch(handleError);
  }).catch(handleError);
}

/**
 * Decide which version of the module should be linked to `aframeVersion`.
 * Generalized for components and shaders.
 *
 * @param {object} aModule - Component, shader, etc., that follows same metadata structure.
 * @param {string} aframeVersion - A-Frame major version (e.g., `0.3.0`).
 * @param {number} prevAframeVersion - Previous A-Frame major version (e.g., `0.2.0`).
 * @param {array} aframeVersionPromises - List of promises to process component.
 * @returns {Promise} - Resolve `null` if nothing to output, else data object.
 */
function resolveData (aModule, aframeVersion, prevAframeVersion, prevAframeVersionPromise,
                      stubFetchers) {
  var npmName = aModule.npmName;

  // Explicitly not compatible for this version of A-Frame.
  if (aframeVersion in aModule.versions && aModule.versions[aframeVersion] === null) {
    console.log(npmName, 'marked not compatible with', aframeVersion);
    return Promise.resolve(null);
  }

  // Explicit version listed for this version of A-Frame. Fetch metadata.
  if (aModule.versions[aframeVersion]) {
    return getMetadata(npmName, aModule, aframeVersion, stubFetchers);
  }

  // Nothing listed for the previous version of A-Frame.
  if (!prevAframeVersionPromise) {
    return Promise.resolve(null);
  }

  // Walk back to previous version of A-Frame. This can chain back more than one version.
  return new Promise(function (resolve) {
    prevAframeVersionPromise.then(function fallback (metadata) {
      if (!metadata) { resolve(null); }

      console.log(npmName, 'marked to fall back to', prevAframeVersion, 'entry for',
                  aframeVersion);
      resolve(deepExtend({
        fallbackVersion: prevAframeVersion
      }, metadata));
    });
  }, handleError);
}

function write (processedRegistry) {
  // Write JSON file.
  console.log('Registry processed, writing files...');
  Object.keys(processedRegistry).forEach(function (aframeVersion) {
    var output = JSON.stringify(processedRegistry[aframeVersion]);
    var outputPath = path.join('build', aframeVersion + '.json');
    console.log('Writing', outputPath, '...');
    fs.writeFileSync(outputPath, output);
  });
  console.log('Writing request cache...');
  writeCache();
  console.log('Processing complete!');
}

// Promise catcher.
function handleError (err) { console.log(err.stack); }

module.exports = {
  load: load,
  build: build,
  write: write
};
