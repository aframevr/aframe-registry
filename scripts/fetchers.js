const req = require('superagent-promise')(require('superagent'), require('bluebird'));
const Url = require('urlgray');
const urlJoin = require('url-join');

const cache = require('./cache').cache;
const config = require('./config');

/**
 * Fetch metadata from npm.
 *
 * @param {string} packageRoot
 * @returns {Promise}
 */
function fetchNpm (packageRoot) {
  // Build npm URL from component version and path.
  const packageJsonUrl = urlJoin(packageRoot, 'package.json');

  // Grab from cache.
  if (cache[packageJsonUrl]) { return Promise.resolve(cache[packageJsonUrl]); }

  return new Promise((resolve, reject) => {
    req
      .get(packageJsonUrl)
      .then(function metadataFetchedSuccess (res) {
        cache[packageJsonUrl] = res.body;
        resolve(res.body);
      }).catch(err => {
        console.error(`Error fetching ${packageJsonUrl}`);
        console.error(err.stack);
      });
  });
}

/**
 * Fetch metadata from GitHub.
 *
 * @param {Object} repo - GitHub repository slug.
 * @returns {Promise}
 */
function fetchGithub (repo) {
  const GITHUB_API = 'https://api.github.com/';

  if (!repo) { return Promise.resolve({}); }

  const repoInfoUrl = addToken(urlJoin(GITHUB_API, 'repos/', repo));
  return new Promise((resolve, reject) => {
    console.log('Fetching from GitHub', repo, '...');
    req
      .get(repoInfoUrl)
      .then(function metadataFetchedSuccess (res) {
        resolve(res.body);
      }).catch(err => {
        console.error(`Error fetching ${repoInfoUrl}`);
        console.error(err.stack);
      });
  });

  function addToken (url) {
    return Url(url).q({access_token: config.githubAccessToken}).url;
  }
}

/**
 * Get README data by fetching from package root (via unpkg.com).
 * Attempt each valid README filename.
 */
function fetchReadme (packageRoot) {
  const readmeFilenames = [
    'README.md', 'readme.md', 'Readme.md', 'README.markdown',
    'readme.markdown', 'README.mkd', 'readme.mkd'];

  // Grab from cache.
  for (let i = 0; i < readmeFilenames.length; i++) {
    let readmeUrl = urlJoin(packageRoot, readmeFilenames[i]);
    if (cache[readmeUrl]) { return Promise.resolve(cache[readmeUrl]); }
  }

  /**
   * Helper function to make multiple attempts for each valid README filename.
   */
  function fetchReadme (i, resolve) {
    const readmeUrl = urlJoin(packageRoot, readmeFilenames[i]);
    req
      .get(readmeUrl)
      .then(function (res) {
        const data = {
          text: res.text,
          url: readmeUrl
        };
        cache[readmeUrl] = data;
        resolve(data);
      }, function (err) {
        if (err) { console.error(err); }
        if (i + 1 < readmeFilenames.length) {
          fetchReadme(i + 1, resolve);
        } else {
          console.error('Error fetching README', packageRoot);
        }
      });
  }

  return new Promise((resolve, reject) => {
    fetchReadme(0, resolve);
  });
}

module.exports = {
  cache: cache,
  fetchGithub: fetchGithub,
  fetchNpm: fetchNpm,
  fetchReadme: fetchReadme
};
