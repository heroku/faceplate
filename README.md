# faceplate

A Node.js wrapper for Facebook authentication and API

## Usage

Install as a connect middleware

    :::javascript
	// create an express webserver
	var app = require('express').createServer(
	  express.bodyParser(),
	  express.cookieParser(),
	  require('faceplate').middleware({
	    app_id: process.env.FACEBOOK_APP_ID,
	    secret: process.env.FACEBOOK_SECRET,
	    scope:  'user_likes,user_photos,user_photo_video_tags'
	  })
	);

	// show friends
	app.get('/friends', function(req, res) {
      req.facebook.get('/me/friends', { limit: 4 }, function(result) {
		req.send('friends: ' + require('util').inspect(result.data));
      });
	});

	// use fql
	app.fql('SELECT uid, name, is_app_user, pic_square FROM user WHERE uid in (SELECT uid2 FROM friend WHERE uid1 = me()) AND is_app_user = 1', function(friends_using_app) {
		req.send('friends using app: ' + require('util').inspect(friends_using_app));
	});

## License

MIT
