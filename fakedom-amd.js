var fs    = require('fs');
var path  = require('path');
var jsdom = require('jsdom').jsdom;
var nodeModulePath = require.resolve;

var sinon = global.sinon = require('sinon');
require("sinon/lib/sinon/util/event");
require("sinon/lib/sinon/util/fake_xml_http_request");


module.exports = fakedom;
/**
 * Options
 * Callback
 */
function fakedom(options, onInit) {
    if (arguments.length === 1) {
        onInit = options;
        options = {};
    }

    var window = getWindow(options.html, options.jsdomOptions);
    augmentWindow.call(
        this,
        window,
        options.disableConsole,
        options.disableXhr
    );

    initRequire(window, options.requireOptions, function(err) {
        if (!options.module) {
            return onInit(err, window);
        }

        this.amdrequire(options.module, function(err, module) {
            if (err) {
                return onInit(err);
            }
            return onInit(null, window, module);
        });
    }.bind(this));


    this.amdrequire = function(deps, onAmdLoad) {
        if (!window) {
            return onAmdLoad(new Error(
                'Could not require module because load() has not been run'
            ));
        }

        if (!window.require || typeof window.require !== 'function') {
            return onAmdLoad(new Error('requirejs failed to initialise'));
        }

        deps = Array.isArray(deps) ? deps : [ deps ];

        makeSetTimeoutSafe(window);

        // We need to inject script, because window globals is not node globals
        // Attach a callback function to window
        window.fakedomCallback = function() {
            restoreSetTimeout(window);

            var args = Array.prototype.slice.call(arguments);
            args.unshift(null);
            onAmdLoad.apply(null, args);
        };
        window.fakedomErrorCallback = function(evt) {
            onAmdLoad(evt.detail || evt); //can be a event or a script error
        };

        var script = window.document.createElement('script');
        script.innerHTML = 'window.require(' + JSON.stringify(deps) + ', window.fakedomCallback, window.fakedomErrorCallback);';
        script.onerror = window.fakedomCallback;
        window.document.body.appendChild(script);

        return this;
    }

    this.stub = function(name, module) {
        if (arguments.length === 2 ) {
            var stubs = {};
            stubs[name] = module;
            name = stubs;
        }

        Object.keys(name).forEach(function(moduleName) {
            window.define(moduleName, name[moduleName]);
        });

        return this;
    }
}

function getWindow(html, jsdomOptions) {
    html = html || '';
    if (html.indexOf('<body') === -1) {
        html = '<html><head></head><body>' + html + '</body></html>';
    }

    var level   = null; // defaults to 3
    var options = jsdomOptions || {};

    var doc = jsdom(html, options);
    return doc.parentWindow;
}

function augmentWindow(window, disableConsole, disableXhr) {
    // Allow AMD modules to use console to log to STDOUT/ERR
    if (!disableConsole) {
        window.console = console;
    }

    // Provide fake XHR
    if (!disableXhr) {
        this.requests = [];
        xhr = sinon.useFakeXMLHttpRequest();
        xhr.onCreate = function(req) {
            this.requests.push(req);
        }.bind(this);
        window.XMLHttpRequest = xhr;
    }
}

function initRequire(window, options, onRequireLoad) {
    // Set require.js options
    window.require = options;

    // Default path of requirejs points to bin/r.js, we must resolve the path
    // to require.js
    var requirePath = path.resolve(
      path.dirname(nodeModulePath('requirejs')),
      '../require.js'
    );

    fs.exists(requirePath, function(exists) {
        if (!exists) {
            var err = new Error(
                'Could not load require.js at path ' + requirePath
            );
            return onRequireLoad(err);
        }

        makeSetTimeoutSafe(window);

        var scriptEl = window.document.createElement('script');
        scriptEl.src = requirePath;
        scriptEl.onload = function() {
            restoreSetTimeout(window);
            onRequireLoad();
        }
        window.document.body.appendChild(scriptEl);
    });
}

// Nasty stuff to ensure that requirejs can still load modules even when
// setTimeout has been stubbed
var oldTimeout;

function makeSetTimeoutSafe(window) {
    oldTimeout = window.setTimeout;
    window.setTimeout = function(fn) {
        fn();
    }
}

function restoreSetTimeout(window) {
    window.setTimeout = oldTimeout;
}
