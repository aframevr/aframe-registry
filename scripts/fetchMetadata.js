var fs = require('fs');
var glob = require('glob');
var path = require('path');
var req = require('superagent-promise')(require('superagent'), Promise);
var urlJoin = require('url-join');

var CDN = 'https://unpkg.com/';

glob.sync('src/*.json').forEach(function (jsonPath) {
  var components = {};
  var json;
  var metadataFetched;
  var outputPath;

  // Read JSON file.
  console.log('Processing', jsonPath, '...');
  json = require(path.resolve(jsonPath));

  // Fetch each component.
  metadataFetched = Object.keys(json.components).map(function (npmName) {
    var component = json.components[npmName];
    var packageRoot = urlJoin(CDN, npmName + '@' + component.version);
    var packageJsonUrl = urlJoin(packageRoot, 'package.json');
    console.log('Fetching', npmName, packageJsonUrl, '...');
    return req
      .get(packageJsonUrl)
      .end(function (err, res) {
        var npm = res.body;
        component.description = npm.description;
        component.file = urlJoin(packageRoot, component.path);
        delete component.path;
        components[component.name] = component;
      });
  });

  // Write JSON file.
  Promise.all(metadataFetched).then(function () {
    var output = JSON.stringify({components: components}, null, '  ');
    outputPath = path.join('build', path.basename(jsonPath));
    console.log('Writing', outputPath, '...');
    fs.writeFileSync(outputPath, output);
  });
});
