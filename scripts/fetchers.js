var req = require('superagent-promise')(require('superagent'), require('bluebird'));
var Url = require('urlgray');
var urlJoin = require('url-join');

var cache = require('./cache').cache;
var config = require('./config');

/**
 * Fetch metadata from npm.
 *
 * @param {string} packageRoot
 * @returns {Promise}
 */
function fetchNpm (packageRoot) {
  // Build npm URL from component version and path.
  var packageJsonUrl = urlJoin(packageRoot, 'package.json');

  // Grab from cache.
  if (cache[packageJsonUrl]) { return Promise.resolve(cache[packageJsonUrl]); }

  return new Promise(function (resolve, reject) {
    req
      .get(packageJsonUrl)
      .then(function metadataFetchedSuccess (res) {
        cache[packageJsonUrl] = res.body;
        resolve(res.body);
      }).catch(handleError);
  });
}

/**
 * Fetch metadata from GitHub.
 *
 * @param {Object} repo - GitHub repository slug.
 * @returns {Promise}
 */
function fetchGithub (repo) {
  var GITHUB_API = 'https://api.github.com/';

  if (!repo) { return Promise.resolve({}); }

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
    console.log('ACCESS TOKEN', config.githubAccessToken);
    return Url(url).q({access_token: config.githubAccessToken}).url;
  }
}

/**
 * Get README data by fetching from package root (via unpkg.com).
 */
function fetchReadme (packageRoot) {
  var readmeUrl = urlJoin(packageRoot, 'README.md');

  // Grab from cache.
  if (cache[readmeUrl]) { return Promise.resolve(cache[readmeUrl]); }

  return new Promise(function (resolve, reject) {
    req
      .get(readmeUrl)
      .then(function (res) {
        var data = {
          text: res.text,
          url: readmeUrl
        };
        cache[readmeUrl] = data;
        resolve(data);
      }).catch(handleError);
  });
}

// Promise catcher.
function handleError (err) { console.log(err.stack); }

module.exports = {
  cache: cache,
  fetchGithub: fetchGithub,
  fetchNpm: fetchNpm,
  fetchReadme: fetchReadme
};
