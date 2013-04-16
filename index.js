var b64url  = require('b64url');
var crypto  = require('crypto');
var qs      = require('querystring');
var restler = require('restler');
var util    = require('util');
var tools   = require('./tools');
var fbError = require('./FacebookApiError');
var merge   = tools.merge;


var Faceplate = function(options) {

  var self = this;

  this.options = options || {};
  this.app_id  = this.options.app_id;
  this.secret  = this.options.secret;

  this.middleware = function() {
    return function faceplate(req, res, next) {
      if (req.body.signed_request) {
        self.parse_signed_request(req.body.signed_request, function(err, decoded_signed_request) {
          req.facebook = new FaceplateSession(self, decoded_signed_request);
          next();
        });
      } else if (req.cookies["fbsr_" + self.app_id]) {
        self.parse_signed_request(req.cookies["fbsr_" + self.app_id], function(err, decoded_signed_request) {
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
    var data = tools.safeJSON(json);
    if(!data) return cb(new Error('invalid json in signed request'))

    // check algorithm
    if (!data.algorithm || (data.algorithm.toUpperCase() != 'HMAC-SHA256')) {
      cb(new Error("unknown algorithm. expected HMAC-SHA256"));
      return;
    }

    // check signature
    var secret = self.secret;
    var expected_sig = crypto.createHmac('sha256', secret).update(encoded_data[1]).digest('base64').replace(/\+/g,'-').replace(/\//g,'_').replace('=','');

    if (sig !== expected_sig) {
      cb(new Error("bad signature"));
      return;
    }

    // not logged in or not authorized
    if (!data.user_id) {
      cb(null,data);
      return;
    }

    if (data.access_token || data.oauth_token) {
      cb(null,data);
      return;
    }
    var user_id = data.user_id

    if (!data.code) {
      cb(new Error("no oauth token and no code to get one"));
      return;
    }

    var params = {
      client_id:     self.app_id,
      client_secret: self.secret,
      redirect_uri:  '',
      code:          data.code
    };

    var request = restler.get('https://graph.facebook.com/oauth/access_token',
      { query:params });

    request.on('fail', function(data) {
      var result = tools.safeJSON(data) || result;
      result.user_id = user_id
      cb(result);
    });

    request.on('success', function(data) {
      data = tools.safeQS(data) || data
      data.user_id = user_id 
      cb(null,data);
    });
  };
};

var FaceplateSession = function(plate, signed_request) {

  var self = this;

  this.plate = plate;
  if (signed_request) {
      this.token  = signed_request.access_token || signed_request.oauth_token;
      this.signed_request = signed_request;
  }

  function _handleAPIResult(result, cb){
      if(result.error){
        cb(new fbError(result.error), result);
      }else{
        cb(null, result && result.data ? result.data : result);
      }
  }

  this.appSession = function(cb){
    var params = {
      client_id: self.plate.app_id,
      client_secret: self.plate.secret,
      grant_type: 'client_credentials'
    };
    try{
      restler.post('https://graph.facebook.com/oauth/access_token',{
        data: params
      }).on('complete', function(data){
          var result = tools.safeQS(data)
          if(result && result.access_token){
            var session = new FaceplateSession(self.plate, self.signed_request);
            session.token = result.access_token;
            cb(null, session);
          }else{
            result = tools.safeJSON(result) || result
            cb(new fbError(result && result.error), result);
          }

      });
    }catch(err){
      cb(err);
    }
  }

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

  this.request = function(method,path, params, cb) {
    if (cb === undefined) {
      cb = params;
      params = {};
    }

    params = merge({access_token: self.token}, params || {});

    try {
        var opts = {}
        opts[method == 'get' ? 'query' : 'data'] = params
        var request = restler[method]('https://graph.facebook.com' + path, opts);
        request.on('fail', function(data) {
          data = tools.safeJSON(data) || data
          _handleAPIResult({error: data}, cb)
        });
        request.on('success', function(data) {
          _handleAPIResult(data, cb)
        });
     } catch (err) {
      cb(err);
    }
  };

  this.get = function(path, params, cb){
    return this.request('get', params, cb)
  }

  this.post = function(path, params, cb){
    return this.request('post', params, cb)
  }

  this.fql = function(query, cb) {
    var params = { access_token: self.token, format:'json' };
    var method;
    var onComplete;

    if (typeof query == 'string') {
      method = 'fql.query';
      params.query = query;
      onComplete = function(res){
        var result = tools.safeJSON(res) || result;
        _handleAPIResult(result, cb)
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
      var result = tools.safeJSON(data) || data
      _handleAPIResult({error: result}, cb)
    });
    request.on('success', onComplete);
  };



module.exports.middleware = function(options) {
  return new Faceplate(options).middleware();
};
