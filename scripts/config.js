var deepExtend = require('deep-extend');

module.exports = deepExtend({
  CDN: 'https://unpkg.com/'
}, require('./config.local.js'));
