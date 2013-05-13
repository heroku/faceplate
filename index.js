var b64url  = require('b64url');
var crypto  = require('crypto');
var qs      = require('querystring');
var restler = require('restler');
  

function safeParse(str){
//  console.log('parsing str: ', str)
  if(typeof(str) != 'string') return str;
  try{ return JSON.parse(str)}
  catch(e){
    return {error: e, response: str}
  }
}

var Faceplate = function(options) {

  var self = this;

  this.options = options || {};
  this.app_id  = this.options.app_id;
  this.secret  = this.options.secret;

  this.middleware = function() {
    return function(req, res, next) {

      if (req.body.signed_request) {
        self.parse_signed_request(req.body.signed_request, function(err, decoded_signed_request) {
          req.facebook = new FaceplateSession(self, decoded_signed_request);
          next();
        });
      } else if (req.cookies["fbsr_" + self.app_id]) {
        console.log('in')
        self.parse_signed_request(req.cookies["fbsr_" + self.app_id], function(err,decoded_signed_request){
          console.log('out')
          req.facebook = new FaceplateSession(self, decoded_signed_request);
          next();
        });
      } else {
        req.facebook = new FaceplateSession(self);
        next();
      }
    };
  };

  this.parse_signed_request = function(signed_request, cb) {
    var encoded_data = signed_request.split('.', 2);

    var sig  = encoded_data[0];
    var json = b64url.decode(encoded_data[1]);
    var data = safeParse(json);

    // check algorithm
    if (!data.algorithm || (data.algorithm.toUpperCase() != 'HMAC-SHA256')) {
      cb(new Error("unknown algorithm. expected HMAC-SHA256"));
    }

    // check signature
    var secret = self.secret;
    var expected_sig = crypto.createHmac('sha256', secret).update(encoded_data[1]).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace('=','');

    if (sig !== expected_sig)
      cb(new Error("bad signature"));

    // not logged in or not authorized
    if (!data.user_id) {
      console.log('no user id')
      cb(null,data);
      return;
    }
    var user_id = data.user_id;

    if (data.access_token || data.oauth_token) {
      console.log('has access token')
      cb(null,data);
      return;
    }

    if (!data.code)
      cb(new Error("no oauth token and no code to get one"));

    var params = {
      client_id:     self.app_id,
      client_secret: self.secret,
      redirect_uri:  '',
      code:          data.code
    };

    var request = restler.get('https://graph.facebook.com/oauth/access_token',
      { query:params });

    console.log('sending request')
    request.on('fail', function(data) {
      console.log('failed..')
      var result = safeParse(data);
      result.user_id = user_id
      cb(result);
    });

    request.on('success', function(data) {
      console.log('win...', data)
      data = qs.parse(data)
      data.user_id = user_id
      cb(null,data);
    });
  };
};

var FaceplateSession = function(plate, signed_request) {

  var self = this;

  this.plate = plate;
  //console.log('request: ', signed_request)
  if (signed_request) {
      this.token  = signed_request.access_token || signed_request.oauth_token;
      this.signed_request = signed_request;
  }
  console.log('token: ', this.token)

  this.app = function(cb) {
    self.get('/' + self.plate.app_id, function(err, app) {
      cb(err,app);
    });
  };

  this.me = function(cb) {
    if (self.token) {
      self.get('/me', function(err, me) {
        cb(err,me);
      });
    } else {
      cb(null,null);
    }
  };

  this.get = function(path, params, cb) {
    if (cb === undefined) {
      cb = params;
      params = {};
    }

    if (self.token)
      params.access_token = self.token;

    try {
        var request = restler.get('https://graph.facebook.com' + path,
          { query: params });
        request.on('fail', function(data) {
          console.log('fb fail ~> ', data)
          var result = safeParse(data);
          cb(result);
        });
        request.on('success', function(data) {
          var result = safeParse(data);
          console.log('fb ~>', data)
          cb(null, result);
        });
    } catch (err) {
      cb(err);
    }
  };

  this.fql = function(query, cb) {
    var params = { access_token: self.token, format:'json' };
    var method;
    var onComplete;

    if (typeof query == 'string') {
      method = 'fql.query';
      params.query = query;
      onComplete = function(res){
        var result = safeParse(res);
        cb(null, result.data ? result.data : result);
      };
    }
    else {
      method = 'fql.multiquery';
      params.queries = JSON.stringify(query);
      onComplete = function(res) {
        if (res.error_code)
          return cb(res);

        var data = {};
        res.forEach(function(q) {
          data[q.name] = q.fql_result_set;
        });
        cb(null,data);
      };
    }
    var request = restler.get('https://api.facebook.com/method/'+method,
      { query: params });
    request.on('fail', function(data) {
      var result = safeParse(data);
      cb(result);
    });
    request.on('success', onComplete);
  };

  this.post = function (params, cb) {
    var request = restler.post(
      'https://graph.facebook.com/me/feed',
      {query: {access_token: self.token}, data: params}
      );
    request.on('fail', function(data) {
      var result = safeParse(data);
      cb(result);
    });
    request.on('success', function (data) {
      var result = safeParse(data);
      cb(null, result.data ? result.data : result);
    });
  };
};

module.exports.middleware = function(options) {
  return new Faceplate(options).middleware();
};
