var deepExtend = require('deep-extend');
var fs = require('fs');
var glob = require('glob');
var path = require('path');
var req = require('superagent-promise')(require('superagent'), Promise);
var Url = require('urlgray');
var urlJoin = require('url-join');
var yaml = require('js-yaml');

var config = require('./config');

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
      if (index === 0) { return; }  // No previous version.

      return componentsProcessed[index - 1].then(function fallback () {
        var oldAFrameVersion = AFRAME_VERSIONS[index - 1];

        if (!OUTPUT[oldAFrameVersion].components[npmName]) { return; }

        console.log(npmName, 'marked to fall back to', oldAFrameVersion, 'entry', 'for',
                    aframeVersion);
        var oldEntry = deepExtend({} , OUTPUT[oldAFrameVersion].components[npmName]);
        var component = OUTPUT[aframeVersion].components[npmName] = oldEntry;
        component.fallbackVersion = oldAFrameVersion;
      });
    }

    return fetchMetadata(npmName, component, aframeVersion).then(function (metadata) {
      OUTPUT[aframeVersion].components[npmName] = metadata;
    }, console.error);
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

/**
 * Fetch metadata from npm and GitHub.
 *
 * @param {string} npmName
 * @param {string} component
 * @returns {Promise}
 */
function fetchMetadata (npmName, component, aframeVersion) {
  var componentVersion = component.versions[aframeVersion].version;
  var packageRoot = urlJoin(CDN, npmName + '@' + componentVersion);

  return new Promise(function (resolve) {
    console.log('Fetching from npm', npmName, componentVersion, '...');
    fetchNpm(packageRoot).then(function (npmData) {
      fetchGithub(npmData).then(function (githubData) {
        console.log(npmName, 'registered to use', componentVersion, 'for', aframeVersion);
        resolve({
          author: npmData.author,
          description: npmData.description,
          file: urlJoin(packageRoot, component.versions[aframeVersion].path),
          githubCreated: githubData.created_at,
          githubUpdated: githubData.updated_at,
          githubUrl: githubData.html_url,
          githubStars: githubData.stargazers_count,
          homepage: npmData.homepage,
          license: npmData.license,
          name: component.name
        });
      }, console.error);
    }, console.error);
  });
}

/**
 * Fetch metadata from npm.
 *
 * @param {string} packageRoot
 * @returns {Promise}
 */
function fetchNpm (packageRoot) {
  // Build npm URL from component version and path.
  var packageJsonUrl = urlJoin(packageRoot, 'package.json');
  return new Promise(function (resolve, reject) {
    req
      .get(packageJsonUrl)
      .then(function metadataFetchedSuccess (res) {
        resolve(res.body);
      }, function metadataFetchedError (err) {
        console.error('Error fetching', npmName, packageJsonUrl);
        reject();
      });
  });
}

/**
 * Fetch metadata from GitHub.
 *
 * @param {Object} npmData - package.json metadata.
 * @returns {Promise}
 */
function fetchGithub (npmData) {
  var GITHUB_API = 'https://api.github.com/';
  var repo = inferGithubRepository(npmData.repository);

  if (!repo) { return new Promise.resolve({}); }

  var repoInfoUrl = addToken(urlJoin(GITHUB_API, 'repos/', repo));
  return new Promise(function (resolve, reject) {
    console.log('Fetching from GitHub', repo, '...');
    req
      .get(repoInfoUrl)
      .then(function metadataFetchedSuccess (res) {
        resolve(res.body);
      }, function metadataFetchedError (err) {
        console.error('Error fetching', githubUrl);
        reject();
      });
  });

  function addToken (url) {
    return Url(url).q({access_token: config.githubAccessToken}).url;
  }
}

/**
 * Try to infer GitHub repository from npm repository field.
 *
 * @param {string} repository - npm repository field.
 */
function inferGithubRepository (repository) {
  if (!repository) { return; }

  if (repository.constructor === String) {
    // GitHub slug (e.g., `aframevr/aframe`).
    if (repository.indexOf('http') === -1 && repository.indexOf('/') !== -1) {
      return repository;
    }
    // GitHub URL (e.g., `https://github.com/aframevr/aframe).
    if (repository.indexOf('github.com') !== -1) {
      return githubUrl.split('/').slice(-2).join('/');
    }
  } else if (repository.url) {
    // GitHub URL (e.g., `git+https://github.com/aframevr/aframe.git).
    return repository.url.replace(/.git$/, '').split('/').slice(-2).join('/');
  }
}
