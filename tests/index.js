/* global describe, it */
'use strict';
var assert = require('assert');
var extendDeep = require('deep-extend');
var urlJoin = require('url-join');

var Build = require('../scripts/build.js');
var Metadata = require('../scripts/metadata.js');
var config = require('../scripts/config.js');

var build = Build.build;
var inferGithubRepo = Metadata.inferGithubRepo;
var parseImgFromText = Metadata.parseImgFromText;
var CDN = config.CDN;

/**
 * Mock component entry in registry.
 *
 * @param {object} versions - Specify default `test` component versions.
 * @returns {object}
 */
function componentFactory (versions, names) {
  return {
    components: {
      test: {
        names: names || 'test',
        versions: versions || {
          '0.2.0': {path: 'dist/test.js', version: '1.2.3'}
        }
      }
    }
  };
}

/**
 * Mock shader entry in registry.
 *
 * @param {object} versions - Specify default `test` shader versions.
 * @returns {object}
 */
function shaderFactory (versions) {
  return {
    shaders: {
      test: {
        names: 'test',
        versions: versions || {
          '0.2.0': {path: 'dist/test.js', version: '1.2.3'}
        }
      }
    }
  };
}

/**
 * Mock XHR response bodies.
 *
 * @param {object} data - Extend default mock responses.
 * @returns {object}
 */
function fetcherFactory (data) {
  data = data || {};
  data.github = data.github || {};
  data.npm = data.npm || {};
  data.readme = data.readme || {};
  return {
    fetchGithub: () => Promise.resolve(extendDeep({
      created_at: '2000-01-01T12:00:00Z',
      html_url: 'https://github.com/aframevr/aframe',
      stargazers_count: '9001',
      updated_at: '2010-01-01T12:00:01Z'
    }, data.github)),
    fetchNpm: () => Promise.resolve(extendDeep({
      author: 'Test Test <test@test.com>',
      description: 'This is test',
      license: 'TEST'
    }, data.npm)),
    fetchReadme: () => Promise.resolve(extendDeep({
      text: 'This is my test',
      url: 'https://unpkg.io/aframe/README.md'
    }, data.readme))
  };
}

describe('build', () => {
  it('creates component entries for each A-Frame major version', done => {
    build({components: {}}).then(output => {
      assert.ok('0.2.0' in output);
      assert.ok('0.3.0' in output);
      assert.ok('components' in output['0.2.0']);
      assert.ok('components' in output['0.3.0']);
    }).then(done, done);
  });

  it('creates shader entries for each A-Frame major version', done => {
    build({components: {}}).then(output => {
      assert.ok('0.2.0' in output);
      assert.ok('0.3.0' in output);
      assert.ok('shaders' in output['0.2.0']);
      assert.ok('shaders' in output['0.3.0']);
    }).then(done, done);
  });

  it('registers component explicitly tied to an A-Frame version', done => {
    build(componentFactory(), fetcherFactory()).then(output => {
      var components020 = output['0.2.0'].components;
      assert.ok('test' in components020);
      assert.equal(components020.test.file, urlJoin(CDN, 'test@1.2.3/dist/test.js'));
    }).then(done, done);
  });

  it('registers component using previous registered version data', done => {
    build(componentFactory(), fetcherFactory()).then(output => {
      var components030 = output['0.3.0'].components;
      assert.ok('test' in components030);
      assert.equal(components030.test.fallbackVersion, '0.2.0');
      assert.equal(components030.test.file, urlJoin(CDN, 'test@1.2.3/dist/test.js'));
    }).then(done, done);
  });

  it('does not register component explicitly marked as incompatible', done => {
    var input = componentFactory({
      '0.2.0': {path: 'dist/test.js', version: '1.2.3'},
      '0.3.0': null
    });
    build(input, fetcherFactory()).then(output => {
      var components020 = output['0.2.0'].components;
      var components030 = output['0.3.0'].components;
      assert.ok('test' in components020);
      assert.ok(!('test' in components030));
    }).then(done, done);
  });

  it('registers shader explicitly tied to an A-Frame version', done => {
    build(shaderFactory(), fetcherFactory()).then(output => {
      var shaders020 = output['0.2.0'].shaders;
      assert.ok('test' in shaders020);
      assert.equal(shaders020.test.file, urlJoin(CDN, 'test@1.2.3/dist/test.js'));
    }).then(done, done);
  });

  it('registers shader using previous registered version data', done => {
    build(shaderFactory(), fetcherFactory()).then(output => {
      var shaders030 = output['0.3.0'].shaders;
      assert.ok('test' in shaders030);
      assert.equal(shaders030.test.fallbackVersion, '0.2.0');
      assert.equal(shaders030.test.file, urlJoin(CDN, 'test@1.2.3/dist/test.js'));
    }).then(done, done);
  });

  it('does not register shader explicitly marked as incompatible', done => {
    var input = shaderFactory({
      '0.2.0': {path: 'dist/test.js', version: '1.2.3'},
      '0.3.0': null
    });
    build(input, fetcherFactory()).then(output => {
      var shaders020 = output['0.2.0'].shaders;
      var shaders030 = output['0.3.0'].shaders;
      assert.ok('test' in shaders020);
      assert.ok(!('test' in shaders030));
    }).then(done, done);
  });
});

describe('metadata (base)', () => {
  it('gets file/filename via root', done => {
    var components = componentFactory({'0.5.0': {version: '1.2.3'}});
    components.components.test.path = 'dist/test.js';
    build(components, fetcherFactory()).then(output => {
      var component = output['0.5.0'].components.test;
      assert.equal(component.file, urlJoin(CDN, 'test@1.2.3/dist/test.js'));
      assert.equal(component.filename, 'test.js');
    }).then(done, done);
  });

  it('gets file/filename via version', done => {
    build(componentFactory(), fetcherFactory()).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.file, urlJoin(CDN, 'test@1.2.3/dist/test.js'));
      assert.equal(component.filename, 'test.js');
    }).then(done, done);
  });

  it('gets file/filename via version override', done => {
    var components = componentFactory();
    components.components.test.path = 'dist/testBase.js';
    build(componentFactory(), fetcherFactory()).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.file, urlJoin(CDN, 'test@1.2.3/dist/test.js'));
      assert.equal(component.filename, 'test.js');
    }).then(done, done);
  });

  it('gets name', done => {
    build(componentFactory(), fetcherFactory()).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.names.length, 1);
      assert.equal(component.names[0], 'test');
    }).then(done, done);
  });

  it('gets name for component group', done => {
    build(componentFactory(undefined, ['a', 'b', 'c']), fetcherFactory()).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.names.length, 3);
      assert.equal(component.names[0], 'a');
      assert.equal(component.names[1], 'b');
      assert.equal(component.names[2], 'c');
    }).then(done, done);
  });

  it('gets version', done => {
    build(componentFactory(), fetcherFactory()).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.version, '1.2.3');
    }).then(done, done);
  });

  it('gets defined image', done => {
    var components = componentFactory();
    components.components.test.image = 'foo.gif';
    build(components, fetcherFactory()).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.image, 'foo.gif');
    }).then(done, done);
  });
});

describe('metadata (github)', () => {
  it('gets created/updated dates', done => {
    build(componentFactory(), fetcherFactory()).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.githubCreated, 'January 1st 2000');
      assert.equal(component.githubUpdated, 'January 1st 2010');
    }).then(done, done);
  });

  it('gets stars', done => {
    build(componentFactory(), fetcherFactory()).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.githubStars, 9001);
    }).then(done, done);
  });

  it('gets url', done => {
    build(componentFactory(), fetcherFactory()).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.githubUrl, 'https://github.com/aframevr/aframe');
    }).then(done, done);
  });
});

describe('metadata (npm)', () => {
  it('gets author', done => {
    build(componentFactory(), fetcherFactory()).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.author, 'Test Test <test@test.com>');
      assert.equal(component.authorName, 'Test Test');
    }).then(done, done);
  });

  it('gets description', done => {
    build(componentFactory(), fetcherFactory()).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.description, 'This is test');
    }).then(done, done);
  });

  it('gets license', done => {
    build(componentFactory(), fetcherFactory()).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.license, 'TEST');
    }).then(done, done);
  });

  it('gets npmName', done => {
    build(componentFactory(), fetcherFactory()).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.npmName, 'test');
    }).then(done, done);
  });

  it('gets npmUrl', done => {
    build(componentFactory(), fetcherFactory()).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.npmUrl, 'https://npmjs.com/package/test');
    }).then(done, done);
  });
});

describe('metadata (readme)', () => {
  it('gets readmeUrl', done => {
    build(componentFactory(), fetcherFactory({
      readme: {url: urlJoin(CDN, 'test@1.2.3/README.md')}
    })).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.readmeUrl, urlJoin(CDN, 'test@1.2.3/README.md'));
    }).then(done, done);
  });

  it('gets image', done => {
    build(componentFactory(), fetcherFactory({
      readme: {text: 'test test \n ![test](https://test.com/test.png) \n test.'}
    })).then(output => {
      var component = output['0.2.0'].components.test;
      assert.equal(component.image, 'https://test.com/test.png');
    }).then(done, done);
  });
});

describe('inferGithubRepo', () => {
  it('determines GitHub repo slug from `repository.url`', () => {
    function infer (url) { return inferGithubRepo({repository: {url: url}}); }
    assert.equal(infer('git+https://github.com/aframevr/aframe.git'), 'aframevr/aframe');
    assert.equal(infer('git+https://github.com/aframevr/aframe'), 'aframevr/aframe');
    assert.equal(infer('https://github.com/aframevr/aframe'), 'aframevr/aframe');
    assert.equal(infer('github.com/aframevr/aframe'), 'aframevr/aframe');
    assert.equal(infer('aframevr/aframe'), 'aframevr/aframe');
  });

  it('determines GitHub repo slug from `repository`', () => {
    function infer (url) { return inferGithubRepo({repository: url}); }
    assert.equal(infer('git+https://github.com/aframevr/aframe.git'), 'aframevr/aframe');
    assert.equal(infer('git+https://github.com/aframevr/aframe'), 'aframevr/aframe');
    assert.equal(infer('https://github.com/aframevr/aframe'), 'aframevr/aframe');
    assert.equal(infer('github.com/aframevr/aframe'), 'aframevr/aframe');
    assert.equal(infer('aframevr/aframe'), 'aframevr/aframe');
  });
});

describe('parseImgFromReadme', () => {
  it('gets image from Markdown format', () => {
    var img = parseImgFromText('test test \n ![test](https://test.com/test.png) \n test.');
    assert.equal(img, 'https://test.com/test.png');
  });

  it('gets image from Markdown format with relative path', () => {
    var img = parseImgFromText('test test \n ![test](/test.png) \n test.',
                               urlJoin(CDN, 'test@1.2.3'));
    assert.equal(img, urlJoin(CDN, 'test@1.2.3/test.png'));
  });

  it('gets image from Markdown format with extra stuff', () => {
    var img = parseImgFromText('test test \n ![test](/test.png "TEST") \n test.',
                               urlJoin(CDN, 'test@1.2.3'));
    assert.equal(img, urlJoin(CDN, 'test@1.2.3/test.png'));
  });

  it('gets image from HTML format', () => {
    var img = parseImgFromText(
      'test test \n <img src="https://test.com/test.png" data=""> \n test.');
    assert.equal(img, 'https://test.com/test.png');
  });
});
