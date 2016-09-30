var path = require('path')
var through = require('through2')
var fs = require('fs')
var crypto = require('crypto')
var Promise = require('bluebird')
var request = Promise.promisify(require('request'))
var gutil = require('gulp-util')

var BASE_URL = 'https://api.netlify.com/api/v1'

var handleError = function (response) {
  if (response.statusCode !== 200) {
    var message = "Netlify responded with a non-200 status code, got " + response.statusCode
    if (response.body.message) {
      message += " " + response.body.message
    }

    throw new Error(message)
  }
}

var waitForReady = function (siteId, accessToken, deployId) {
  return request({
    method: 'GET',
    url: BASE_URL + "/sites/" + siteId + '/deploys/' + deployId,
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
    json: true
  })
  .then(function (response) {
    handleError(response)

    var state = response.body.state
    if (state !== "ready" && state !== "current") {
      return Promise.delay(1000).then(function () {
        return waitForReady(siteId, accessToken, deployId)
      })
    }
  })
}

var getFilesNeededToUpload = function (siteId, accessToken, shas) {
  return request({
    method: 'POST',
    url: BASE_URL + "/sites/" + siteId + '/deploys',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    },
    json: true,
    body: {
      files: shas
    }
  })
  .then(function (response) {
    handleError(response)

    gutil.log('Netlify Deploy ID', response.body.id)

    return {
      id: response.body.id,
      required: response.body.required
    }
  })
}

var uploadFile = function (siteId, accessToken, deployId, file) {
  gutil.log(file.shasum, file.pathname)

  // to ensure special characters in the path
  var filePath = file.pathname.split("/").map(function(segment) {
    return encodeURIComponent(segment)
  }).join("/")

  return request({
    method: 'PUT',
    url: BASE_URL + "/deploys/" + deployId + '/files' + filePath,
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/octet-stream'
    },
    body: file.file._contents
  })
  .then(function (response) {
    handleError(response)
  })
}

// this gets the SHASUM of the file that is
// needed to do a diff with Netlify
var getFileDigest = function (file) {
  var hash = crypto
    .createHash('sha1')
    .update(file._contents)
    .digest('hex')

    return hash
}

module.exports = function (opts) {
  opts = opts || {}

  var shas = {} // filename: sha
  var files = {} // sha: actual file stream

  return through.obj(function (file, enc, cb) {
    // this is so that we actually get a real
    // relative path from windows machines
    var pathname = file.relative.replace(/\\/g, '/');
    if (!pathname) {
      cb()
      return
    }

    // check to make sure that this is a file
    if (!file.isNull() || !(file.stat && file.stat.isDirectory && file.stat.isDirectory())) {
      var shasum = getFileDigest(file)
      shas["/" + pathname] = shasum
      files[shasum] = {
        shasum: shasum,
        pathname: "/" + pathname,
        file: file
      }
    }

    cb()
  }, function (cb) {
    Promise
      .bind({
        siteId: opts.site_id,
        accessToken: opts.access_token,
        deployId: null,
        uploadShas: []
      })
      .then(function () {
        return getFilesNeededToUpload(this.siteId, this.accessToken, shas)
      })
      .then(function (response) {
        this.deployId = response.id
        this.uploadShas = response.required
      })
      .then(function () {
        return this.uploadShas
      })
      .map(function (sha) {
        return uploadFile(this.siteId, this.accessToken, this.deployId, files[sha])
      })
      .then(function () {
        return waitForReady(this.siteId, this.accessToken, this.deployId)
      })
      .asCallback(cb)
  })
}
