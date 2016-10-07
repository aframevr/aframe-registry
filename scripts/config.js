var deepExtend = require('deep-extend');

module.exports = deepExtend({
  CDN: 'https://unpkg.com/',
  placeholderImage: 'https://cloud.githubusercontent.com/assets/674727/19178879/5a499302-8c0c-11e6-9bc8-5e6a130cb82e.png'
}, require('./config.local.js'));
