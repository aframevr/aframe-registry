var fs = require('fs');
var nunjucks = require('nunjucks');

var aframeVersion = require('../package.json').aframe_version;

nunjucks.configure('site');

// Read registry.
let registry = JSON.parse(fs.readFileSync(`./build/${aframeVersion}.json`, 'utf-8'));

// Create something easy to loop over.
registry.componentNames = Object.keys(registry.components);

// Build pretty name.
registry.componentNames.forEach(componentName => {
  var siteName = registry.components[componentName].siteName = componentName
    .replace('aframe-', '')
    .replace('-components', '')
    .replace('-component', '')
    .replace(/-/g, ' ')
    .replace(/\./g, ': ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/Ui /g, 'UI ')
    .replace(/vr/g, 'VR')
    .replace(/ Vr/g, ' VR');

  if (siteName.indexOf('/') !== -1) {
    registry.components[componentName].siteName = siteName.split('/')[1];
  }
});

// Sort.
registry.componentNames.sort(function (a, b) {
  if (registry.components[a].siteName < registry.components[b].siteName) {
    return -1;
  }
  return 1;
});

const indexHtml = nunjucks.render('index.html', registry);
fs.writeFileSync('index.html', indexHtml);
