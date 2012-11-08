var inherits = require('util').inherits;

function FacebookApiError(error) {
  Error.call(this); 
  Error.captureStackTrace(this, this.constructor); 

  this.name = this.constructor.name;
  for(x in error){
  	if(error.hasOwnProperty(x))
  		this[x] = error[x];
  } 

} 

inherits(FacebookApiError, Error);
module.exports = FacebookApiError;