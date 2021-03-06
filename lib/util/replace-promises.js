var isPromise = require('./is-promise'),
	bind = require('./bind');

function whenAllPromisesResolve(promises, callback) {
	var index = 0,
		promise,
		results = [ ],
		complete = 0;

	function handleFulfilled(index, result) {
		results[index] = result;

		complete++;

		if (complete === promises.length) {
			return void callback(null, results);
		}
	}

	while (index < promises.length) {
		promise = promises[index];

		promise.then(bind(handleFulfilled, this, index), callback);

		index++;
	}
}

function replacePromises(array, callback) {
	var promises = array.filter(isPromise);

	// We can just return immediately if there are no promises:
	if (!promises.length) {
		return void callback(null, array);
	}

	whenAllPromisesResolve(promises, function handler(error, results) {
		if (error) {
			return void callback(error);
		}

		var index = 0,
			item;

		while (index < array.length) {
			item = array[index];

			if (isPromise(item)) {
				array[index] = results.shift();
			}

			index++;
		}

		return void callback(null, array);
	});
}

module.exports = replacePromises;
