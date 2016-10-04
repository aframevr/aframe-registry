/*
  Everything involving fetching metadata.
*/
var cheerio = require('cheerio');
var markdown = require('marked');
var moment = require('moment');
var path = require('path');
var req = require('superagent-promise')(require('superagent'), require('bluebird'));
var Url = require('urlgray');
var urlJoin = require('url-join');

var config = require('./config');
var CDN = config.CDN;

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
          npmUrl: urlJoin('https://npmjs.com/package/', npmName),
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

// Promise catcher.
function handleError (err) { console.log(err.stack); };

module.exports = {
  fetchMetadata: fetchMetadata
}
