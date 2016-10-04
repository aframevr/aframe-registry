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
var glob = require('glob');
var path = require('path');
var Url = require('urlgray');
var urlJoin = require('url-join');
var yaml = require('js-yaml');

var fetchMetadata = require('./metadata.js').fetchMetadata;

// Major versions.
var AFRAME_VERSIONS = ['0.2.0', '0.3.0'];

// Main function.
if (require.main === module) {
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
};

/**
 * Process and fetch metadata for each component and version.
 *
 * @param {object} REGISTRY - Complete registry object, pre-processed.
 * @returns {Promise} - Resolves complete registry object, processed.
 */
function build (REGISTRY) {
  // The output object, keyed by A-Frame versions.
  var OUTPUT = {};
  AFRAME_VERSIONS.forEach(function (version) {
    OUTPUT[version] = {components: {}};
  });

  // Fetch each component.
  var componentNpmNames = Object.keys(REGISTRY.components);
  var metadataFetched = componentNpmNames.map(function processComponent (npmName) {
    var component = REGISTRY.components[npmName];
    component.npmName = npmName;

    // Go through each A-Frame version and build component metadata for that version.
    // Need to memoize the promises since newer versions of components may be falling back
    // on older versions of components, which require that they have been processed.
    var aframeVersionPromises = [];
    AFRAME_VERSIONS.forEach(function pushPromise (aframeVersion, index) {
      // Resolve version.
      var resolved = processVersion(
        OUTPUT[aframeVersion].components, component, aframeVersion,
        AFRAME_VERSIONS[index - 1], aframeVersionPromises[index - 1]);

      if (resolved) {
        aframeVersionPromises.push(Promise.resolve());
        return;
      }

      // If not resolved, must fetch.
      aframeVersionPromises.push(
        fetchMetadata(npmName, component, aframeVersion).then(function (metadata) {
          OUTPUT[aframeVersion].components[npmName] = metadata;
        }, handleError)
      );
    });
    return Promise.all(aframeVersionPromises);

  });

  return new Promise(function (resolve) {
    Promise.all(metadataFetched).then(function () {
      resolve(OUTPUT);
    }).catch(handleError);
  }).catch(handleError);
};

/**
 * Decide which version of the module should be linked to `aframeVersion`.
 * Generalized for components and shaders.
 *
 * @param {object} versionOutput - e.g., `registry['0.3.0'].components`.
 * @param {object} aModule - Component, shader, etc., that follows same metadata structure.
 * @param {string} aframeVersion - A-Frame major version (e.g., `0.3.0`).
 * @param {number} prevAframeVersion - Previous A-Frame major version (e.g., `0.2.0`).
 * @param {array} aframeVersionPromises
 * @returns {Promise} - Resolve if version is resolved, else reject to fetch metadata.
 */
function processVersion (versionOutput, aModule, aframeVersion, prevAframeVersion,
                         prevAframeVersionPromise) {
  // Module marked as explicitly not compatible with this version of A-Frame.
  if (aModule.versions[aframeVersion] && aModule.versions[aframeVersion] === null) {
    console.log(npmName, 'marked not compatible with', aframeVersion);
    return true;
  }

  // No module version registered for this version of A-Frame. Walk backwards.
  if (!aModule.versions[aframeVersion]) {
    if (!prevAframeVersion) { return true; }  // No previous version.

    prevAframeVersionPromise.then(function fallback () {
      if (!versionOutput[aModule.npmName]) { return; }

      console.log(npmName, 'marked to fall back to', prevAframeVersion, 'entry', 'for',
                  aframeVersion);
      var oldEntry = deepExtend({} , versionOutput[npmName]);
      var aModule = versionOutput[npmName] = oldEntry;
      aModule.fallbackVersion = oldAFrameVersion;
    }, handleError);
    return true;
  }

  return false;
}

function write (processedRegistry) {
  // Write JSON file.
  console.log('Registry processed, writing files...');
  Object.keys(processedRegistry).forEach(function (aframeVersion) {
    var output = JSON.stringify(processedRegistry[aframeVersion]);
    outputPath = path.join('build', aframeVersion + '.json');
    console.log('Writing', outputPath, '...');
    fs.writeFileSync(outputPath, output);
  });
  console.log('Processing complete!');
}

// Promise catcher.
function handleError (err) { console.log(err.stack); };

module.exports = {
  load: load,
  build: build,
  write: write
};
