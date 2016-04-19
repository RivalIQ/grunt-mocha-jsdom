/*
 * grunt-mocha-jsdom
 * https://github.com/RivalIQ/grunt-mocha-jsdom
 *
 * Copyright (c) 2016 Rival IQ 
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

    var path = require('path');
    var jsdom = require('jsdom');
    var Mocha = require('mocha');

    function resolvePath(p) {
        return path.resolve(__dirname, p).replace(path.resolve() + '/', '');
    }

    function makeScriptData() {
        var source = Array.prototype.reduce.call(arguments, function (memo, line) {
            return memo + line + '\n';
        }, '');

        return [
            'data:text/javascript;base64,',
            new Buffer(source).toString('base64')
        ].join('');
    }

    function getReporter(options) {
        var ctx = {};
        var reporter = options.reporter;
        try {
            Mocha.prototype.reporter.call(ctx, options.reporter);
        } catch(e) {
            // if Mocha failed to get the reporter try relative root modules
            if (typeof reporter === "string") {
                ctx._reporter = require(path.resolve('node_modules', reporter));
            }
        }
        return ctx._reporter;
    }

    function getWindow(sources, options, callback) {
        var mochaRunner = function () {
            window._mochaRunner = function () {
                mocha.checkLeaks();
                mocha.run();
            };

            if (!navigator.userAgent.match(/Node\.js/)) {
                window._mochaRunner();
            }
        };

        var scripts = [resolvePath('../node_modules/mocha/mocha.js')]
            .concat(options.vendor)
            .concat(sources)
            .concat(makeScriptData('mocha.setup("bdd");'))
            .concat(grunt.file.expand(options.specs))
            .concat(makeScriptData('(' + mochaRunner.toString() + '())'));

        jsdom.env({
            html: '<link rel="stylesheet" href="node_modules/mocha/mocha.css"><div id="mocha"/>',
            scripts: scripts,
            done: callback 
        });
    }

    grunt.registerMultiTask('mocha-jsdom', 'Run client side Mocha tests via jsdom.', function () {
        var me = this;

        var options = me.options({
            vendor: [],
            keepRunner: false,
            outfile: '_SpecRunner.html'
        });

        var done = me.async();

        getWindow(me.filesSrc, options, function (err, window) {
            window.mocha._reporter = function (runner, root) {
                var Reporter = getReporter(options);
                var reporter = new Reporter(runner, root);

                runner.on('end', function () {
                    if (options.keepRunner) {
                        var html = window.document.documentElement.outerHTML;
                        grunt.file.write(path.resolve(options.outfile), html);
                    }

                    process.nextTick(function () {
                        var stats = reporter.stats;
                        if (stats.failures > 0) {
                            grunt.fail.fatal(stats.failures + ' test failure(s)', 1);
                        }
                        done();
                    });
                });

                return reporter;
            };

            window._mochaRunner();
        });
    });

};
