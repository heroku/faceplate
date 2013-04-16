var qs = require('querystring')
function merge(obj1, obj2){
	for(x in obj2){
		if(obj2.hasOwnProperty(x)){
			obj1[x] = obj2[x];
		}
	}
}

function safeJSON(obj){
	if(typeof(obj) != 'string') return obj;
	try{return JSON.parse(obj)}catch(e){ return undefined}
}

function safeQS(obj){
	if(typeof(obj) != 'string') return obj;
	try{ return qs.parse(obj)}catch(e){ return undefined}
}

module.exports = {
	'merge': merge
	'safeQs': safeQs,
	'safeJSON': safeJson
};