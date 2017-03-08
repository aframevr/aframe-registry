var fs = require('fs');
var nunjucks = require('nunjucks');

var aframeVersion = require('../package.json').aframe_version;

nunjucks.configure('site');

// Read registry.
let registry = JSON.parse(fs.readFileSync(`./build/${aframeVersion}.json`, 'utf-8'));

// Create something easy to loop over.
registry.componentNames = Object.keys(registry.components).sort();

// Build pretty name.
registry.componentNames.forEach(componentName => {
  registry.components[componentName].siteName = componentName
    .replace('aframe-', '')
    .replace('-component', '')
    .replace(/-/g, ' ')
    .replace(/\./g, ': ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/Ui /g, 'UI ')
    .replace(/vr/g, 'VR')
    .replace(/ Vr/g, ' VR');
});

const indexHtml = nunjucks.render('index.html', registry);
fs.writeFileSync('index.html', indexHtml);
