'use strict';
var path = require('path');
var through = require('through2');
var Yazl = require('yazl');
var concatStream = require('concat-stream');
var request = require('request')
var fs = require('fs')

module.exports = function (opts) {
	opts = opts || {};

	var zip = new Yazl.ZipFile();

	return through.obj(function (file, enc, cb) {
		// because Windows...
		var pathname = file.relative.replace(/\\/g, '/');

		if (!pathname) {
			cb();
			return;
		}

		if (file.isNull() && file.stat && file.stat.isDirectory && file.stat.isDirectory()) {
			zip.addEmptyDirectory(pathname, {
				mtime: file.stat.mtime || new Date(),
				mode: file.stat.mode
			});
		} else {
			var stat = {
				compress: true,
				mtime: file.stat ? file.stat.mtime : new Date(),
				mode: file.stat ? file.stat.mode : null
			};

			if (file.isStream()) {
				zip.addReadStream(file.contents, pathname, stat);
			}

			if (file.isBuffer()) {
				zip.addBuffer(file.contents, pathname, stat);
			}
		}

		cb();
	}, function (cb) {
		zip.end(function () {
			zip.outputStream.pipe(concatStream(function (data) {
        request({
          method: 'POST',
          url: 'https://api.netlify.com/api/v1/sites/' + opts.site_id + '/deploys',
          body: data,
          headers: {
            'Content-Type': 'application/zip',
            'Authorization': 'Bearer ' + opts.access_token
          }
        }, function (err, response, body) {
          if (err) {
            return cb(err)
          }

          if (response.statusCode !== 200) {
            return cb(new Error("Netlify responded with " + response.statusCode))
          }

          cb();
        })
			}.bind(this)));
		}.bind(this));
	});
};
