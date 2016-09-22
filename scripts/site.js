var fs = require('fs');
var nunjucks = require('nunjucks');

nunjucks.configure('scripts/templates');

var registry = JSON.parse(fs.readFileSync('./build/0.3.0.json', 'utf-8'));
registry.componentNames = Object.keys(registry.components);

var indexHtml = nunjucks.render('index.html', registry);
fs.writeFileSync('index.html', indexHtml);
