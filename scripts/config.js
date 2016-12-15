var deepExtend = require('deep-extend');

module.exports = deepExtend({
  CDN: 'https://unpkg.com/',
  placeholderImage: 'https://rawgit.com/aframevr/aframe-registry/master/scripts/placeholder.svg'
}, require('./config.local.js'));
