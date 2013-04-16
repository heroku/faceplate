var inherits = require('util').inherits;

function FacebookApiError(error) {
  Error.call(this); 
  Error.captureStackTrace(this, this.constructor); 

  this.name = this.constructor.name;
  if(typeof(error) == 'string' || !error){
  	this.message = error
  }else{
	  for(x in error){
		  	if(error.hasOwnProperty(x))
		  		this[x] = error[x];
		  } 
	}

} 

inherits(FacebookApiError, Error);
module.exports = FacebookApiError;