# gulp-netlify

A gulp plugin that helps you upload your site to netlify. Especially useful
if you have a build and deployment structure already in place.

For example, instead of using netlify's build system which caps you at
whichever plan you currently are at, why not use CircleCI to do your builds
and have it deploy via netlify's API.

## Usage

```
npm install gulp-netlify --save
```

```
var netlify = require('gulp-netlify')
gulp.task('deploy', function () {
  gulp.src('./public/**/*')
    .pipe(netlify({
      site_id: NETLIFY_SITE_ID,
      access_token: NETLIFY_ACCESS_TOKEN
    }))
})
```

You can obtain your `NETLIFY_SITE_ID` from the "Site info" section on your
[site](https://app.netlify.com/sites)
can obtain your `NETLIFY_ACCESS_TOKEN` under
[Oauth apps](https://app.netlify.com/applications)

## License

MIT
