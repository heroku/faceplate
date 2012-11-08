function merge(obj1, obj2){
	for(x in obj2){
		if(obj2.hasOwnProperty(x)){
			obj1[x] = obj2[x];
		}
	}
}


module.exports = {
	'merge': merge
};