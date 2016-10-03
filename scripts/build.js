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
var cheerio = require('cheerio');
var deepExtend = require('deep-extend');
var fs = require('fs');
var glob = require('glob');
var markdown = require('marked');
var moment = require('moment');
var path = require('path');
var req = require('superagent-promise')(require('superagent'), require('bluebird'));
var Url = require('urlgray');
var urlJoin = require('url-join');
var yaml = require('js-yaml');

var config = require('./config');

/**
 * Promise catcher.
 */
function handleError (err) {
  console.log(err.stack);
};

// Major versions.
var AFRAME_VERSIONS = ['0.2.0', '0.3.0'];
var CDN = 'https://unpkg.com/';

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

// Write JSON file.
Promise.all(metadataFetched).then(function writeOutput () {
  console.log('Registry processed, writing files...');
  Object.keys(OUTPUT).forEach(function (aframeVersion) {
    var output = JSON.stringify(OUTPUT[aframeVersion]);
    outputPath = path.join('build', aframeVersion + '.json');
    console.log('Writing', outputPath, '...');
    fs.writeFileSync(outputPath, output);
  });
  console.log('Processing complete!');
}).catch(handleError);

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

  return new Promise(function (resolve, reject) {
    console.log('Fetching from npm', npmName, componentVersion, '...');
    fetchNpm(packageRoot).then(function (npmData) {
      var getGitHub = fetchGithub(npmData);
      var getReadme = fetchReadme(packageRoot, component.versions[aframeVersion].image);
      Promise.all([getGitHub, getReadme]).then(function (data) {
        var githubData = data[0];
        var readmeData = data[1];

        console.log(npmName, 'registered to use', componentVersion, 'for', aframeVersion);
        resolve({
          author: npmData.author.trim(),
          authorName: npmData.author.split('<')[0].trim(),
          description: npmData.description,
          file: urlJoin(packageRoot, component.versions[aframeVersion].path),
          filename: path.basename(component.versions[aframeVersion].path),
          githubCreated: githubData.created_at,
          githubCreatedPretty: moment(githubData.created_at).format('MMMM Do YYYY'),
          githubUpdated: githubData.updated_at,
          githubUpdatedPretty: moment(githubData.updated_at).format('MMMM Do YYYY'),
          githubUrl: githubData.html_url,
          githubStars: githubData.stargazers_count,
          image: (component.versions[aframeVersion].image ||
                  parseImgFromText(readmeData.text, packageRoot)),
          license: npmData.license,
          name: component.name,
          npmUrl: urlJoin('https://npmjs/package/', npmName),
          readmeExcerpt: getReadmeExcerpt(readmeData.text),
          readmeUrl: readmeData.url
        });
      }).catch(handleError);
    }).catch(handleError);
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
      }).catch(handleError);
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
      }).catch(handleError);
  });

  function addToken (url) {
    return Url(url).q({access_token: config.githubAccessToken}).url;
  }
}

/**
 * Get README data by fetching from package root (via unpkg.com).
 */
function fetchReadme (packageRoot, image) {
  var readmeUrl = urlJoin(packageRoot, 'README.md');
  return new Promise(function (resolve, reject) {
    req
      .get(readmeUrl)
      .then(function (res) {
        resolve({
          text: res.text,
          url: readmeUrl
        });
      }).catch(handleError);
  });
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

/**
 * To parse image from README.
 */
var IMG_REGEX_HTML = /<\s*img\s*src="(.*?)".*?>/;
var IMG_REGEX_MD = /\!\[.*\]\((.*?)\)/;
function parseImgFromText (text, packageRoot) {
  var image;

  // Parse Markdown format.
  image = IMG_REGEX_MD.exec(text);

  // Parse HTML format.
  if (!image) { image = IMG_REGEX_HTML.exec(text); }

  // Couldn't find.
  if (!image) { return ''; }

  // Trim in case of weird formats like `![](/foo.png "Description")`.
  image = image[1].split(' ')[0];

  // Absolutify.
  if (image.indexOf('http') !== 0) { image = urlJoin(packageRoot, image); }

  return image;
}

/**
 * Get excerpt from README. First parse to HTML, then trim to first N elements
 * Exclude headers, images, and tables.
 */
function getReadmeExcerpt (text) {
  var html = markdown(text);
  var $ = cheerio.load(html);
  var excerpt = $('p').slice(0, 6);
  excerpt.find('h1').remove();
  excerpt.find('img').remove();
  excerpt.find('script').remove();
  return excerpt.toString();
}
