var fs = require('fs');

var CACHE_NAME = '.requestcache';

var cache = {};
if (fs.existsSync(CACHE_NAME)) {
  cache = JSON.parse(fs.readFileSync(CACHE_NAME, 'utf-8')) || {};
}

function write () {
  fs.writeFileSync(CACHE_NAME, JSON.stringify(cache));
}

module.exports = {
  cache: cache,
  write: write
};
