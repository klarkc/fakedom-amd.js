var assert = require('assert');
var mocha = require('mocha');
var domloader = require('../domloader');

describe('test-module', function() {

    context('when the module has been loaded', function() {

        var window;
        var module;

        beforeEach(function(done) {
            domloader(null, 'fixture/test-module', function(w, m) {
                window = w;
                module = m;
                done();
            });
        });

        it('should greet me anonymously', function() {
            assert.equal(module.greet(), 'Hello, anonymous!');
        });

        context('when I identity as "world"', function() {

            beforeEach(function() {
                module.setName('world');
            });

            it('should greet me as me', function() {
                assert.equal(module.greet(), 'Hello, WORLD!');
            });

        });

    });

});
