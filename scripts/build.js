var deepExtend = require('deep-extend');
var fs = require('fs');
var glob = require('glob');
var path = require('path');
var req = require('superagent-promise')(require('superagent'), Promise);
var urlJoin = require('url-join');
var yaml = require('js-yaml');

var CDN = 'https://unpkg.com/';

// Major versions.
var AFRAME_VERSIONS = ['0.2.0', '0.3.0'];

// The output object, keyed by A-Frame versions.
var OUTPUT = {};
AFRAME_VERSIONS.forEach(function (version) {
  OUTPUT[version] = {components: {}};
});

// Load registry.
console.log('Processing registry.yml...');
var REGISTRY = yaml.load(fs.readFileSync('registry.yml', 'utf-8'));

// Fetch each component.
var componentNpmNames = Object.keys(REGISTRY.components);
var metadataFetched = componentNpmNames.map(function processComponent (npmName) {
  var component = REGISTRY.components[npmName];

  // Go through each A-Frame version and build component metadata for that version.
  // Need to memoize the promises since newer versions of components may be falling back
  // on older versions of components, which require that they have been processed.
  var componentsProcessed = [];
  AFRAME_VERSIONS.forEach(function pushPromise (aframeVersion, index) {
    componentsProcessed.push(processVersion(aframeVersion, index));
  });
  return Promise.all(componentsProcessed);

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
      return componentsProcessed[index - 1].then(function () {
        var oldAFrameVersion = AFRAME_VERSIONS[index - 1];
        if (OUTPUT[oldAFrameVersion].components[npmName]) {
          console.log(npmName, 'marked to fall back to', oldAFrameVersion, 'entry', 'for',
                      aframeVersion);
          var oldEntry = deepExtend({} , OUTPUT[oldAFrameVersion].components[npmName]);
          var component = OUTPUT[aframeVersion].components[npmName] = oldEntry;
          component.fallbackVersion = oldAFrameVersion;
          return;
        }
      });
    }

    // Build URL from component version and path.
    var componentVersion = component.versions[aframeVersion].version;
    var packageRoot = urlJoin(CDN, npmName + '@' + componentVersion);
    var packageJsonUrl = urlJoin(packageRoot, 'package.json');

    console.log('Fetching', npmName, componentVersion, '...');
    return req
      .get(packageJsonUrl)
      .then(function metadataFetchedSuccess (res) {
        // Gather metadata.
        var npm = res.body;
        console.log(npmName, 'registered to use', componentVersion, 'for', aframeVersion);
        OUTPUT[aframeVersion].components[npmName] = {
          description: npm.description,
          file: urlJoin(packageRoot, component.versions[aframeVersion].path),
          name: component.name
        };
      }, function metadataFetchedError (err) {
        console.error('Error fetching', npmName, packageJsonUrl);
      });
  }
});

// Write JSON file.
Promise.all(metadataFetched).then(function writeOutput () {
  console.log('Registry processed, writing files...');
  Object.keys(OUTPUT).forEach(function (aframeVersion) {
    var output = JSON.stringify(OUTPUT[aframeVersion], null, '  ');
    outputPath = path.join('build', aframeVersion + '.json');
    console.log('Writing', outputPath, '...');
    fs.writeFileSync(outputPath, output);
  });
  console.log('Processing complete!');
}, function error (err) {
  console.log(err);
});
