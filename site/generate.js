var fs = require('fs');
var nunjucks = require('nunjucks');

nunjucks.configure('site');

var aframeVersion = require('../package.json').aframe_version;

var registry = JSON.parse(fs.readFileSync(`./build/${aframeVersion}.json`, 'utf-8'));
registry.componentNames = Object.keys(registry.components).sort();

var indexHtml = nunjucks.render('index.html', registry);
fs.writeFileSync('index.html', indexHtml);
