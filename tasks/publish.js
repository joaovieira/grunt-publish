/*
 * grunt-publish
 * https://github.com/maxleiko/grunt-publish
 *
 * Copyright (c) 2014 Maxime Tricoire
 * Licensed under the MIT license.
 */

'use strict';
var path            = require('path'),
  async           = require('async'),
  npm = require('npm');

module.exports = function(grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('publish', 'Automatically publish to NPM registry one or more modules', function() {
    var done    = this.async(),
      tasks   = [],
      errors  = [],
      success = [];

    // Merge task-specific and/or target-specific options with these defaults.
    var options = this.options({
      ignore: ['node_modules'],
      registry: null,
      auth: {},
      installBefore: false,
      forceInstall: false
    });

    /**
     * Validates "ignore" option for given path
     * @param filepath
     * @returns {*}
     */
    function getIgnored(filepath) {
      for (var i in options.ignore) {
        if (filepath.indexOf(options.ignore[i]) !== -1) {
          return options.ignore[i];
        }
      }
      return null;
    }

    /**
     * Tells whether or not, the given path is a valid directory (directory which contains a package.json)
     * @param filepath
     * @returns {*}
     */
    function isValidDir(filepath) {
      if (grunt.file.isDir(filepath)) {
        return grunt.file.exists(path.resolve(filepath, 'package.json'));
      }
      return false;
    }

    // Iterate over all specified file groups.
    this.files.forEach(function(f) {
      f.src.forEach(function (filepath) {
        var ignored = getIgnored(filepath);
        if (!ignored && isValidDir(filepath)) {
          var moduleName = grunt.file.readJSON(path.resolve(filepath, 'package.json')).name;
          grunt.log.ok('Publishing ' + moduleName + ' (' + filepath + ') ...');
          tasks.push(function (cb) {
            npmPublisher(filepath, options, function (err) {
              if (err) {
                grunt.log.error('Unable to publish ' + moduleName + ' (' + err.message.split('\n')[0] + ')');
                errors.push(moduleName + ' (' + err.message.split('\n')[0] + ')');
                return cb();
              }
              grunt.log.ok(moduleName + ' published successfully');
              success.push(moduleName);
              cb();
            });
          });
        }
      });
    });

    function npmPublisher (filepath, options, callback) {

      if (!callback) {
        callback = options;
        options = {};
      }

      var auth = options.auth;

      // load npm
      npm.load({}, function (err, doc) {
        if (err) {
          return callback(err);
        }

        if (options.registry) {
          npm.config.set('registry', options.registry);
        }

        function npmPublish() {
           npm.commands.publish([filepath], function (err) {
            if (err) {
              return callback(err);
            }

            callback();
          });
        }

        if (auth !== {}) {
          if (!(auth.username && auth.password && auth.email)) {
            return callback(new Error('Incomplete credentials.'))
          }
          var params = {
            auth: auth
          };

          npm.registry.adduser(
            npm.config.get('registry'),
            params,
            function(err, doc) {
              if (err) {
                return callback(err);
              } else {
                npm.config.set("email", auth.email);
                grunt.log.ok('Successfully authorised as "%s", attempting to publish.', auth.username);

                return npmPublish();
              }
            }
          );
        } else {
          grunt.log.ok('Attempting to publish without authorising.');

          return npmPublish();
        }
      });
    };

    async.parallel(tasks, function () {
      var i;
      if (success.length > 0) {
        grunt.log.subhead('Successfully published:');
        for (i in success) {
          grunt.log.ok(path.basename(success[i]));
        }
      }
      if (errors.length > 0) {
        grunt.log.subhead('Unable to publish:');
        for (i in errors) {
          grunt.log.error(path.basename(errors[i]));
        }
      }
      done();
    });
  });

};
