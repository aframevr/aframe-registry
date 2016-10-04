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

    // Go through each A-Frame version and build component metadata for that version.
    // Need to memoize the promises since newer versions of components may be falling back
    // on older versions of components, which require that they have been processed.
    var aframeVersionPromises = [];
    AFRAME_VERSIONS.forEach(function pushPromise (aframeVersion, index) {
      var promise = processVersion(aframeVersion, index);
      aframeVersionPromises.push(promise);
    });
    return Promise.all(aframeVersionPromises);

    function processVersion (aframeVersion, index) {
      // Component marked as explicitly not compatible with this version of A-Frame.
      if (component.versions[aframeVersion] &&
          component.versions[aframeVersion] === null) {
        console.log(npmName, 'marked not compatible with', aframeVersion);
        return Promise.resolve();
      }

      // No component version registered for this version of A-Frame. Walk backwards.
      // Cascading effect.
      if (!component.versions[aframeVersion]) {
        if (index === 0) { return Promise.resolve(); }  // No previous version.

        return aframeVersionPromises[index - 1].then(function fallback () {
          var oldAFrameVersion = AFRAME_VERSIONS[index - 1];

          if (!OUTPUT[oldAFrameVersion].components[npmName]) { return; }

          console.log(npmName, 'marked to fall back to', oldAFrameVersion, 'entry', 'for',
                      aframeVersion);
          var oldEntry = deepExtend({} , OUTPUT[oldAFrameVersion].components[npmName]);
          var component = OUTPUT[aframeVersion].components[npmName] = oldEntry;
          component.fallbackVersion = oldAFrameVersion;
        });
      }

      return new Promise(function (resolve, reject) {
        fetchMetadata(npmName, component, aframeVersion).then(function (metadata) {
          OUTPUT[aframeVersion].components[npmName] = metadata;
          resolve();
        }).catch(handleError);
      });
    }
  });

  return new Promise(function (resolve) {
    Promise.all(metadataFetched).then(function () {
      resolve(OUTPUT);
    }).catch(handleError);
  }).catch(handleError);
};

function write () {
  // Write JSON file.
  console.log('Registry processed, writing files...');
  Object.keys(OUTPUT).forEach(function (aframeVersion) {
    var output = JSON.stringify(OUTPUT[aframeVersion]);
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
