/*
  Everything involving fetching metadata.
*/
var cheerio = require('cheerio');
var marked = require('marked');
var moment = require('moment');
var path = require('path');
var urlJoin = require('url-join');

var config = require('./config');
var fetchers = require('./fetchers');
var CDN = config.CDN;

/**
 * Get and build metadata from various sources.
 *
 * @param {string} npmName
 * @param {string} component
 * @returns {Promise}
 */
function getMetadata (npmName, component, aframeVersion, stubFetchers) {
  var fetch = stubFetchers || fetchers;
  var componentVersionInfo = component.versions[aframeVersion];
  var componentVersion = componentVersionInfo.version;
  var packageRoot = urlJoin(CDN, npmName + '@' + componentVersion);

  return new Promise(function (resolve, reject) {
    console.log('Fetching from npm', npmName, componentVersion, '...');
    fetch.fetchNpm(packageRoot).then(function (npmData) {
      var getGitHub = fetch.fetchGithub(inferGithubRepo(npmData));
      var getReadme = fetch.fetchReadme(packageRoot);
      Promise.all([getGitHub, getReadme]).then(function (data) {
        var githubData = data[0];
        var readmeData = data[1];

        console.log(npmName, 'registered to use', componentVersion, 'for', aframeVersion);
        resolve({
          author: npmData.author.trim(),
          authorName: npmData.author.split('<')[0].trim(),
          description: npmData.description,
          file: urlJoin(packageRoot, componentVersionInfo.path),
          filename: path.basename(componentVersionInfo.path),
          githubCreated: moment(githubData.created_at).format('MMMM Do YYYY'),
          githubUpdated: moment(githubData.updated_at).format('MMMM Do YYYY'),
          githubUrl: githubData.html_url,
          githubStars: githubData.stargazers_count,
          image: (componentVersionInfo.image ||
                  parseImgFromText(readmeData.text, packageRoot)),
          license: npmData.license,
          name: component.name,
          npmName: component.npmName,
          npmUrl: urlJoin('https://npmjs.com/package/', npmName),
          readmeUrl: readmeData.url,
          version: componentVersion
        });
      }).catch(handleError);
    }).catch(handleError);
  });
}

/**
 * Try to infer GitHub repository from npm repository field.
 *
 * @param {string} npmData - npm package.json data.
 */
function inferGithubRepo (npmData) {
  var repository = npmData.repository;

  if (!repository) { return; }

  if (repository.constructor === String) {
    // GitHub slug (e.g., `aframevr/aframe`).
    if (repository.indexOf('github.com') === -1 && repository.indexOf('/') !== -1) {
      return repository;
    }
    // GitHub URL (e.g., `https://github.com/aframevr/aframe).
    return repository.replace(/.git$/, '').split('/').slice(-2).join('/');
  } else if (repository.url) {
    // GitHub URL (e.g., `git+https://github.com/aframevr/aframe.git).
    return repository.url.replace(/.git$/, '').split('/').slice(-2).join('/');
  }
}

/**
 * To parse image from README.
 */
function parseImgFromText (text, packageRoot) {
  var img = cheerio.load(marked(text))('img').get(0);
  var src;

  if (!img) { return ''; }
  src = img.attribs.src;

  // Absolutify.
  if (src.indexOf('http') !== 0) { src = urlJoin(packageRoot, src); }

  return src;
}

// Promise catcher.
function handleError (err) { console.log(err.stack); }

module.exports = {
  getMetadata: getMetadata,
  inferGithubRepo: inferGithubRepo,
  parseImgFromText: parseImgFromText
};
