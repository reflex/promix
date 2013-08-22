#Promix
###Mix promises with callbacks for improved control flow

Promix is a way to regain control of asynchronous code.

**Before:**
`````javascript
function handleError ( response, error ) {
	response.send(500, 'Internal server error');
}

server.get('/:user/posts', function ( request, response ) {
	getUser(request.params.user, function ( error, user ) {
		if ( error ) {
			return handleError(response, error);
		}
		getPostsForUser(request.params.user, function ( error, posts ) {
			if ( error ) {
				return handleError(response, error);
			}
			results.posts = posts;
			//only fetch comments for the first post:
			getCommentsForPost(posts [0], function ( error, comments ) {
				if ( error ) {
					return handleError(response, error);
				}
				return response.render('/views/posts', {
					user : user,
					posts : posts,
					comments : comments
				});
			});
		});
	});
`````
**After:**
`````javascript
server.get('/:users/posts', function route ( request, response ) {
	var
		chain = promix.chain();
		
	chain.and(getUser, request.params.user).as('user');
	chain.and(getPostsForUser, request.params.user).as('posts');
	//only fetch comments for the first post:
	chain.then(getCommentsForPost, chain.posts(0)).as('comments');
	chain.then(response.render, '/views/posts', promix.compose({
		user : chain.user,
		posts : chain.posts,
		comments  :chain.comments
	});
	chain.otherwise(response.send, 500, 'Internal server error');
});
`````


##Contents

1. [Install](#install)
2. [Introduction](#introduction)
4. [Examples](#examples)
	* [In the browser](#in-the-browser)
	* [In a service](#in-a-service)
	* [In a route](#in-a-route)
	* [As a generator](#as-a-generator)
3. [API](#api)
	* **< [Promix](#promix) >**
	* [promix.when](#promixwhen-) *
	* [promix.chain](#promixchain-) *
	* [promix.promise](#promixpromise)
	* [promix.handle](#promixhandle)
	* [promix.toString](#promixtostring)
	* [promix.toNumber](#promixtonumber)
	* [promix.toArray](#promixtoarray)
	* [promix.toObject](#promixtoobject)
	* 
	* **< [Chain](#chain) >**
	* [chain.and](#chainand)
	* [chain.then](#chainthen-) *
	* [chain.or](#chainor)
	* [chain.otherwise](#chainotherwise-) *
	* [chain.end](#chainend-) *
	* [chain.callback](#chaincallback-) *
	* [chain.until](#chainuntil-) *
	* [chain.assert](#chainassert-) *
	* [chain.as](#chainas)
	* [chain [label]](#chain-label)
	* [chain.reject](#chainreject)
	* [chain.stop](#chainstop-)
	* [chain.start](#chainstart)
	* [chain.break](#chainbreak)
	* [chain.suppress](#chainsuppress)
	* [chain.unsuppress](#chainunsuppress)
	* [chain.bind](#chainbind)
	* [chain.name](#chainname)
	* [chain.time](#chaintime)
	* 
	* **< [StringPromise](#stringpromise) >**
	* **< [NumberPromise](#numberpromise) >**
	* **< [ArrayPromise](#arraypromise) >**
	* **< [ObjectPromise](#objectpromise) >**
5. [License](#license)
6. [Notes](#notes)
	* [Breakpoints](#breakpoints)

\* will introduce a sequential breakpoint. See [Breakpoints](#breakpoints) below.



<br />

##Install

`````text
npm install promix
`````

<br />
##Introduction

With Promix, you can turn this:

`````javascript

function doAsyncStuff ( a, b, c, callback ) {
	asyncOne(a, function ( error, responseA ) {
		if ( error ) {
			return callback(error);	
		}
		asyncTwo(b, function ( error, responseB ) {
			if ( error ) {
				return callback(error);
			}
			asyncThree(c, function ( error, responseC ) {
				if ( error ) {
					return callback(error);
				}
				//All done!
				return callback(null, [
					responseA,
					responseB,
					responseC
				]);
			});
		});
	});
}
`````
into this:

`````javascript
function doAsyncStuff ( a, b, c, callback ) {
	promix.when(asyncOne, a).and(asyncTwo, b).and(asyncThree, c).end(callback);
}
`````

Promix is a control flow library for JavaScript that makes it easy to chain asynchronous operations together.
If you pass in a function that accepts a trailing callback argument, Promix will transform it into a promise and add it to the chain.
You can pass in your own promises, too, if that's your style. Promix lets you easily mix the two, and make it out of callback hell in one piece.


<br />
##Examples

<br />
###In the browser

`````javascript
var $wrapper = $('#wrapper');
var offset = 0;
var loading = false;
var wrapperHeight = 0;

function loadEntries ( category, start ) {
	return $.get('/news/' + category + '/entries/?start=' + start);
}

function loadImageFor ( entry ) {
	var promise = promix.promise();
	var image = new Image();
	image.onload = function ( ) {
		promise.fulfill();
	};
	image.src = '/images/' + entry.thumbnail;

	return promise;
}

function addEntries ( entries ) {
	$wrapper.append(Handlebars.templates.entries(entries));
	loading = false;
	wrapperHeight = $wrapper.height();
}

//Load the list of entries from the server,
//wait for the first image to load, then show the list:
function showNextEntries ( ) {
	loading = true;
	offset += 10;
	var chain = promix.when(loadEntries, 'javascript', offset).as('entries');
	chain.then(loadImageFor, chain.entries(0));
	chain.then(addEntries, chain.entries());
	chain.then($.fn.fadeIn).bind($wrapper).otherwise(showError);
}

showNextEntries();
`````

<br />
###In a service

`````javascript
//Return the 10 most recent entries:
function getEntries ( category, offset, callback ) {
	var query = [
		'SELECT uuid, title, thumbnail, author, description, body, date',
		'FROM Entries WHERE active = 1 AND category = ?',
		'ORDER BY date DESC LIMIT 10 OFFSET ?'
	];
	promix.when(sql.query, query.join(' '), [category, offset]).end(callback);
}
`````

<br />
###In a route
`````javascript
//Request entries and send them back as JSON:
router.get('/news/:category/entries/', function ( request, response, next ) {
	promix.when(getEntries, request.params.category, request.query.offset)
		.then(response.send).as('json')
		.otherwise(next);
});
`````

<br />
###As a generator
`````javascript
//Recycling the showNextEntries function from the first example:
var generator = promix.chain(showNextEntries).stop().until(false);
var $window = $(window);

$window.on('scroll', function ( event ) {
	if ( loading ) {
		return;
	}
	if ( $window.scrollTop() > wrapperHeight - 200 ) {
		generator.start();
	}
});
`````


<br />
##API

**NOTE:** The API examples in this section use the following functions in order to illustrate asynchronous behavior:

`````javascript
function asyncOne ( a, b, callback ) {
	setTimeout(function ( ) {
		return callback(null, a + b);
	}, 10);
}

function asyncTwo ( c, d, callback ) {
	setTimeout(function ( ) {
		return callback(null, c * d);
	}, 20);
}

function errorFn ( label, callback ) {
	setTimeout(function ( ) {
		return callback(new Error('This function throws errors (' + label + ')'));
	}, 30);
}
`````

<br />
##promix
The `promix` object exposes all of the functionality of the Promix library.

Require it in Node.js:
> **var promix = require('promix');**

Or load it in your browser:
> **&lt;script src="promix.min.js"&gt;&lt;/script&gt;**

<br />
###promix.when() [\*](#breakpoints)
Accept an optional promise or callback-accepting function, and return a new chain.


Usage:
> **promix.when( promise )**

> **promix.when( function [, arguments ] )**

Pass a callback-accepting function, with whatever arguments you want to supply (Promix creates the trailing callback argument for you):
`````javascript
var chain = promix.when(asyncOne, 1, 2);
`````

Or just pass in a preexisting promise:
`````javascripts
var promise = promix.promise();
var chain = promix.when(promise);
`````

<br />
###promix.chain() [\*](#breakpoints)
An alias for [promix.when()](#promixwhen-).

<br />
###promix.promise()
Create a new promise.

Usage:
> **promix.promise( [base object] )**

This promise is Promises/A+ compliant, meaning it exposes a `.then()` method that can be used to attach success and error handlers:
`````javascript
var promise = promix.promise();

function success ( result ) {
	console.log(result);

	//vaporeon
}

function failure ( error ) {
	//our promise wasn't rejected,
	//so we won't reach this
}

promise.then(success, failure);
promise.fulfill('vaporeon');
`````

You can pass an optional object to `.promise()`, and that object will inherit the `.then()`, `.fulfill()`, and `.reject()` methods.
`````javascript
var promise = promix.promise({
	foo : 'foo',
	bar : 'bar',
	baz : 'baz'
});

console.log(promise);

//	{
//		foo : 'foo',
//		bar : 'bar',
//		baz : 'baz',
//		then : [function then],
//		fulfill : [function fulfill],
//		reject : [function reject]
//	}
`````

<br />
###promix.handle()
Set the global error handler for uncaught promise/chain errors.

Usage:
> **promix.handle( function )**

If a promise is rejected with an error and has no error handler of its own to receive it, Promix will pass that error into the global handler specified with `.handler()`, if it exists. This will keep the error from being thrown:

`````javascript
var promise = promix.promise();
promix.handle(function ( error ) {
	console.log(error);

	//Error: An arbitrary error
});

//only supply a success handler:
promise.then(function ( result )  {
	//we will never reach this
});

promise.reject(new Error('An arbitrary error'));
`````

 Any uncaught errors within chains created with `promix.when()` will pass to the global handler, as well:
`````javascript
promix.handle(function ( error ) {
	console.log(error);

	//Error: This function throws errors (foo)
});

var chain = promix.when(errorFn, 'foo').then(function ( results ) {
	//we will never reach this
});
`````

###promix.toString()
Convert a standard promise to a StringPromise. A StringPromise allows you to manipulate a promise's eventual string value using familiar String methods. (See the [StringPromise API](#stringpromise) below.)

Usage:
> **promix.toString( promise )**

`````javascript
var promise = promix.promise();

setTimeout(function ( ) {
	promise.fulfill('foobarfoobaz');
}, 10);

promix.toString(promise).replace(/foo/g, 'wat').then(function ( result ) {
	console.log(result);
	
	//watbarwatbaz
});
`````

###promix.toNumber()
Convert a standard promise to a NumberPromise. A NumberPromise allows you to manipulate a promise's eventual number value using familiar methods. (See the [NumberPromise API](#numberpromise) below.)

Usage:
> **promix.toNumber( promise )**

`````javascript
var promise = promix.promise();

setTimeout(function ( ) {
	promise.fulfill(26.56);
}, 10);

promix.toNumber(promise).round().then(function ( result ) {
	console.log(result);
	
	//27
});
`````


###promix.toArray()
Convert a standard promise to an ArrayPromise. An ArrayPromise allows you to manipulate a promise's eventual array value using familiar Array methods. (See the [NumberPromise API](#numberpromise) below.)

Usage:
> **promix.toArray( promise )**

`````javascript
var promise = promix.promise();

setTimeout(function ( ) {
	promise.fulfill(['foo', 'wat', 'baz', 'bar']);
}, 10);

promix.toArray(promise).sort().join('-').then(function ( result ) {
	console.log(result);

	//bar-baz-foo-wat
});
`````

###promix.toObject()
Convert a standard promise to an ObjectPromise. An ObjectPromise allows you to get and set properties, and transform the promise to other Promise types. (See the [ObjectPromise API](#objectpromise) below.)

Usage:
> **promix.toObject( promise )**

`````javascript
var promise = promix.promise();

setTimeout(function ( ) {
	promise.fulfill({
		foo : 1,
		bar : 2
	});
}, 10);

promix.toObject(promise).get('foo').toNumber().plus(5).then(function ( result ) {
	console.log(result);

	//7
});
`````

##Chain
A chain is used to collect the eventual outcomes of asynchronous JavaScript actions. It consolidates the successful results of these actions, and notifies us of any error that occurs during completion of its steps.
This allows us to assign one callback for the entire chain.

<br />
###chain.and()
Add a new promise or callback-accepting function as a parallel step in the chain.

Usage:
> **chain.and( promise )**

> **chain.and( function [, arguments ] )**

`````javascript
var promise = promix.promise();
promix.when(asyncOne, 1, 2)
	.and(asyncTwo, 3, 4)
	.and(promise)
	.and(...)
	//continue adding things as need be
`````

<br />
###chain.then() [\*](#breakpoints)
Add a new promise or function as a sequential step in the chain. All prior steps must complete before this step is evaluated.

Usage:
> **chain.then( promise )**

> **chain.then( function [, arguments ] )**


If you pass a function to `chain.then()` as the only argument,
the function will be passed an array of results from all earlier steps in the chain:

`````javascript
var chain = promix.when(asyncOne, 1, 2).and(asyncTwo, 3, 4).then(function ( results ) {
	console.log(results);

	//[3, 12]
});
`````

If you supply additional arguments to `.then()`, those arguments, as well as a trailing callback created by promix, will be passed to the function **instead of** the results object:

`````javascript
function someFn ( v1, v2, callback ) {
	setTimeout(function ( ) {
		return callback(v1 + v1 + v1 + ' ' + v2 + v2 + v2);
	}, 50);
}

promix.when(asyncOne, 1, 2).and(asyncTwo, 3, 4).then(someFn, 'a', 'b').then(function ( results ) {
	console.log(results);

	//[3, 12, 'aaa bbb']
});
````` 
In the above case, the chain continues because `someOtherFn` calls the `callback` argument supplied by Promix.

If you pass a promise to `chain.then()`, the chain will wait until that promise has been resolved (or rejected) before continuing:

`````javascript
var promise = promix.promise();

setTimeout(function ( ) {
	promise.fulfill(5000);
}, 40);

var chain = promix.when(asyncOne, 1, 2).and(asyncTwo, 3, 4).then(promise).then(function ( results ) {
	console.log(results);
	
	//[3, 12, 5000]
});
`````

A function passed to `chain.then()` can also directly return a promise in order to continue the promise chain.

For example:
````javascript
function someOtherfn ( results, callback ) {
	var promise = promix.promise();

	setTimeout(function ( ) {
		promise.fulfill(results [1] - results [0]);
	}, 50);

	return promise;
}

promix.when(asyncOne, 1, 2).and(asyncTwo, 3, 4).then(someFn).then(function ( results ) {
	console.log(results);
	
	//[3, 12, 9]
});
`````

<br />	
###chain.or()
Add a new promise or callback-accepting function as a sibling of the current step.

Usage:
> **chain.or( promise )**

> **chain.or( function [, arguments ] )**

Only the first sibling to complete will be added to the list of results:
`````javascript
var chain = promix.when(asyncTwo, 3, 4).or(asyncOne, 1, 2).then(function ( results ) {
	//asyncOne completes first (see above);
	//we only receive asyncOne's result:
	console.log(results [0]);
	console.log(results [1]);

	//3
	//undefined
});
`````

<br />
###chain.otherwise() [\*](#breakpoints)
Add a new error handler to the chain.

Usage:
> **chain.otherwise( function )**

Any errors that occur will break the chain, preventing execution of further steps, and pass to the nearest handler.
`````javascript
var chain = promix.when(asyncOne, 1, 2).and(errorFn, 'foo').then(function ( results ) {
	//we will never reach this point, because errorFn threw an error
}).otherwise(function ( error ) {
	console.log(error);

	//Error: This function throws errors (foo)
});
`````

**NOTE**

If you do not attach an error handler using `chain.otherwise()` or `chain.end()` (see [chain.end](#chainend-)), the error will be thrown.
You can disable this feature by explicitly suppressing errors for your chain (see [chain.suppress](#chainsuppress)).

<br />
###chain.end() [\*](#breakpoints)
Add a promise or callback-accepting function to the current chain.

Usage:
> **chain.end( promise )**

> **chain.end( function [, arguments] )**

If a callback is supplied, it will not be passed a trailing callback parameter, as is normally done when adding a function as a new step in the chain:

`````javascript
when(asyncOne, 1, 2).and(asyncTwo, 3, 4).end(function ( a, b, callback ) {
	console.log(arguments);
	console.log(callback);

	//5, 6
	//undefined
}, 5, 6);
`````

<br />
###chain.callback() [\*](#breakpoints)
Add a single callback to the end of the chain. This callback also acts as an error handler.

Usage:
> **chain.callback( function )**

Callbacks in Node.js often take the form `function ( error, result ) { }`.
`chain.callback()` allows you to pass a single function of this signature into the chain;
Promix will fork it into a `.then ( results ) { }` success handler and a `.otherwise ( error ) { }` error handler behind the scenes:

`````javascript
function typicalCallback ( error, result ) {
	if ( error ) {
		throw error;
	}
	else {
		console.log(result);

		//[3, 12]
	}
}

promix.when(asyncOne, 1, 2).and(asyncTwo, 3, 4).callback(typicalCallback);
`````

<br />
###chain.until() [\*](#breakpoints)
Repeat the current step until its result equals the supplied value, or the supplied promise completes.

Usage:
> **chain.until( value || promise )**

If you supply a value, the step in the chain before `.until()` will be repeated until its result matches the value (or it produces an error):
`````javascript
var i = 0;

function loop ( callback ) {
	i ++;
	setTimeout(function ( ) {
		return callback(null, i);
	}, 1000);
}
promix.when(asyncOne, 1, 2).and(loop).until(5).then(function ( results ) {
	console.log(results);
	
	//[3, 5]
});
`````

If you supply a promise, the prior step will be repeated until the supplied promise is resolved (or rejected).
This is useful because the promise supplied to `until()` will not be enumerated on the results object:
`````javascript
var promise = promix.promise();
var i = 0;

function loop ( callback ) {
	i ++;
	setTimeout(function ( ) {
		return callback(null, i);
	}, 100);
}

setTimeout(function ( ) {
	promise.fulfill(true);
}, 1001);

promix.when(asyncOne, 1, 2).and(loop).until(promise).then(function ( results ) {
	console.log(results);

	//[3, 10]
});
`````


<br />
###chain.assert() [\*](#breakpoints)

Usage:
> **chain.assert( function )**

Add an assert function to the chain.
This function will receive the results from any earlier steps for you to test.
If your assert function returns `true`, the chain will continue:
`````javascript
promix.when(asyncOne, 1, 2).assert(function ( results ) {
	console.log(results);

	//[3]

	return results [0] === 3;
}).then(asyncTwo, 3, 4).then(function ( results ) {
	console.log(results);

	//[3, 12]
});
`````

If your assert function returns `false`, the chain will break, and an error will be passed to the nearest error handler:
`````javascript
var chain = promix.when(asyncOne, 1, 2);

chain.assert(function ( results ) {
	return results [0] === 4;
});
chain.then(function ( results ) {
	//we will never reach this point
});
chain.otherwise(function ( error ) {
	console.log(error);

	//Error: Chain failed assertion
});
`````

<br />
###chain.as()
Assign a label to the current step in the chain.

Usage:
> **chain.as( label )**

`````javascript
var chain = promix.when(foo, 1, 2).as('foo');
`````
In addition to living at the current step index on the results array,
results from steps labelled with `.as()` will be aliased as a property on the results object passed to downstream functions:
`````javascript
var chain = promise.when(foo, 1, 2).as('foo');
chain.then(function ( results ) {
	//results [0] === results.foo
	console.log(results [0]);
	console.log(results.foo);

	//3
	//3
});
`````

If you call `chain.as()` after an `.assert()`, you will label that assertion.
If the assertion returns false, the error that Promix creates from the failed assertion will be given the label that you passed into `.as()`:

`````javascript
var chain = promix.when(asyncOne, 1, 2).and(asyncTwo, 3, 4);

chain.assert(function ( results ) {
	return results [1] === 14;
}).as('Checking to make sure asyncTwo returned 14');

chain.otherwise(function ( error ) {
	console.log(error);
	
	//Error: Chain failed assertion: Checking to make sure asyncTwo returned 14
});
`````

The `chain.as()` method will also assign a new promise property on the chain itself representing the state of the current step. See [chain \[label\]] below. You can also use this property to create promises that return results from the labelled step. See [chain \[label\]()](#label) below.

<br />
###chain \[label\]
An alias to a promise representing the state of a specific step in the chain, as designated by `chain.as()`.

When a step in the chain is either fulfilled or rejected, the promise stored at this property will be completed with the result (or error) from that step:
`````javascript
var chain = when(asyncOne, 1, 2).as('foo');
chain.and(asyncTwo, 3, 4).as('bar');


//chain.bar is now a standard promise:
chain.bar.then(function ( result ) {
	console.log(result);

	//12
}, function ( error ) {
	//We won't reach this
});
````` 

<br />
###chain \[label\]()

Usage:
> **chain \[label\]( [key] )**

Create a promise to return a specific property of the chain result specified by `label`. When the specified result is ready, this promise will be fulfilled with the property at the key you specified. If no property is specified, the entire result will be returned:
`````javascript

function asyncArray ( callback ) {
	setTimeout(function ( ) {
		return callback(null, [ 'pikachu', 'charizard' ]);
	});
}

function asyncObject ( callback ) {
	setTimeout(function ( ) {
		return callback(null, {
			leaf : 'bulbasaur',
			water : 'vaporeon'
		});
	});
}

function additionalFn ( val1, val2, val3 ) {
	console.log(val1);
	console.log(val2);
	console.log(val3);
}

var chain = promix.when(asyncOne, 1, 2).as('one');
chain.and(asyncArray).as('array')
chain.and(asyncObject).as('object');
chain.then(additionalFn, chain.one(), chain.array(1), chain.object('water'));

//3
//'charizard'
//'vaporeon'
`````

<br />	
###chain.reject()

Usage:
> **chain.reject( error )**

> **chain.reject( label )**

Explicitly rejects the current chain with the supplied error.

You can pass a string, and Promix will create an error for you:

`````javascript
var chain = promix.when(asyncOne, 1, 2);
chain.then(function ( results ) {
	chain.reject(new Error('No good reason'));
	//or just
	chain.reject('No good reason');
}).otherwise(function ( error ) {
	console.log(error);

	//Error: No good reason
});
`````

<br />
###chain.stop() [\*](#breakpoints)
Stop the execution of any future steps in the chain.

This method is useful if you want to break the chain without introducing an error:
`````javascript
var chain = promix.when(asyncOne, 1, 2);

chain.then(function ( results ) {
	console.log(results);
	
	//[3]
	
	chain.stop();
});

chain.then(function ( results ) {
	//we will not reach this point
});
`````

Note that after calling `chain.stop()`, you can still restart the chain at a later time (see [chain.start](#start)).
If you want to **permanently** halt execution of the chain, ensuring no future steps are executed, use [chain.break](#break).

<br />
###chain.start()
Restart a chain that has been stopped. If `chain.stop()` has not been called, this method has no effect.

This method is useful for controlling when sequential steps are executed:
`````javascript
var chain = promix.when(asyncOne, 1, 2).stop();
chain.and(asyncTwo, 3, 4).then(function ( results ) {
	console.log(results);

	//[3, 12]
});

//the chain will be resumed after 2 seconds:
setTimeout(chain.start, 2000);
`````

<br />
###chain.break()
Permanently break the chain, preventing the execution of any subsequent steps.

`````javascript
var chain = promix.when(asyncOne, 1, 2);

chain.then(function ( results ) {
	chain.break();
});

chain.then(function ( results ) {
	//we will never reach this point
});
`````

<br />
###chain.suppress()
Prevent the default behavior of errors that occur within the chain.

Usage:
> **chain.suppress( [number || label] )**

If an error occurs at a step in the chain, this method will prevent that error from being passed to the associated error handler.

Calling `chain.suppress()` with no argument will suppress the behavior of all errors on the chain:

`````javascript
var chain = promise.when(asyncOne, 1, 2).suppress();

chain.reject(new Error('This error will be suppressed'));

//no error thrown
`````

You can specify an optional number of future errors to suppress. Additional errors after that number will be treated as normal.
`````javascript
var chain = promise.when(errorFn, 'foo').as('almostError');
chain.and(asyncOne, 1, 2);
chain.suppress(1).then(function ( results ) {
	//the error from errorFn was suppressed, so we make it here
	console.log(results);
	console.log(results.almostError);

	//[3]
	//null
}).then(errorFn, 'bar');
chain.otherwise(function ( error ) {
	//the second error was not suppressed, so the error handler is called
	console.log(error);
	
	//Error: This function throws errors (bar)
});
`````

You can also suppress errors that originate within a specific step of the chain by passing in the string identifier for that step (see [chain.as](#as)):
`````javascript
var chain = promix.when(asyncOne, 1, 2).and(errorFn, 'foo').as('errorFn');
chain.suppress('errorFn').then(function ( results ) {
	console.log(results);
	
	//[3]
});
`````

<br />
###chain.unsuppress()
Reenable the normal treatment of errors introduced within the chain.

Usage:
> **chain.unsuppress( [label] )**

Calling `chain.unsuppress()` with no arguments will cause future errors introduced on the chain to be treated as normal:
`````javascript
var chain = promix.when(asyncOne, 1, 2).and(errorFn, 'foo').suppress();
chain.then(asyncTwo, 3, 4).and(errorFn, 'bar').unsuppress();
chain.otherwise(function ( error ) {
	console.log(error);

	//Error: This function throws errors (bar)
});
`````

You can also specify an optional string label to `chain.unsuppress()` that reenables error treatment for a specific step in the chain as designated by the label (see [domain.as](#as)). Other suppressed steps will not be affected:
`````javascript
var chain = promix.when(asyncOne, 1, 2);
chain.and(errorFn, 'foo').as('errorOne');
chain.and(errorFn, 'bar').as('errorTwo');
chain.suppress();
chain.unsuppress('errorTwo');
chain.otherwise(function ( error ) {
	console.log(error);
	
	//Error: This function throws errors (bar)
});
`````

<br />
###chain.bind()
Bind the execution context of the current step in the chain.

Usage:
> **chain.bind(context)**

Some functions depend on the context on which they are called. Using `chain.bind()`, we can supply this execution context for specific steps in the chain:
`````javascript
var someObj = {
	transform : function ( text, callback ) {
		setTimeout(function ( ) {
			return callback(null, text.split('').reverse().join(''));
		}, 50);	
	},
	getName : function ( text, callback ) {
		this.transform(text, callback);
	}
};

when(someObj.getName, 'pikachu').then(function ( results ) {
	//we will not reach this
}).otherwise(function ( error ) {
	console.log(Error);

	//Uncaught TypeError: Object [Object] has no method 'transform'
});

//let's try again, using chain.bind():
when(someObj.getName, 'pikachu').bind(someObj).then(function ( results ) {
	console.log(results);
	
	//['uhcakip']
}).otherwise(function ( error ) {
	//we will not reach this
});

`````

<br />
###chain.name()
Assign a name to the chain. This is handy for identifying which chain threw an error, for instance.

Usage:
> **chain.name( label )**

<br />
###chain.time()
Retrieve the amount of time that the chain has taken to complete, in milliseconds.

Usage:
> **chain.time( [label] )**

If no label is supplied to `chain.time()`, the method will return the total amount of time that the chain has spent in an active state (ie, waiting for callbacks and promises to complete):

`````javascript
function oneSecond ( callback ) {
	setTimeout(callback, 1000);
}

function twoSeconds ( callback ) {
	setTimeout(callback, 2000);
}

var chain = promix.when(oneSecond).and(twoSeconds).then(function ( results ) {
	//notice that the requests are in parallel, and therefore overlap:
	console.log(chain.time());
		
	//2000
});
`````

If you pass a label for a step in the chain (see [chain.as](#chainas)) to `chain.time()`, the method will re
turn the amount of time spent waiting for just that step to complete:
`````javascript
function oneSecond ( callback ) {
	setTimeout(callback, 1000);
}

function twoSeconds ( callback ) {
	setTimeout(callback, 2000);
}

var chain = promix.when(oneSecond).as('one').and(twoSeconds).as('two');
chain.then(function ( results ) {
	console.log(chain.time('one'));
	console.log(chain.time('two'));
		
	//1000
	//2000
});
`````

<br />
##StringPromise
StringPromises allow us to mutate the eventual String result of a promise that has yet to complete.
StringPromises are returned from calling `promix.toString()`, as well as from any method on the other promise types that implicitly casts the promise value to a String (eg, `ArrayPromise.join()`).

StringPromises expose the methods common to all Promix typed promises ([get](#objectpromiseget), [set](#objectpromiseset), [delete](#objectpromisedelete), [keys](#objectpromisekeys), [toJSON](#objectpromisetojson)), as well as the following additional methods:

<br />
###StringPromise.charAt()
Return a 1-character string containing the character at the supplied index.

Usage:
>**StringPromise.charAt( index )**

Returns:
>**StringPromise**

<br />
###StringPromise.concat()
Concatenate the current string and all the supplied arguments, and return the resulting string.

Usage:
>**StringPromise.concat( arg1 [, arg2, arg3 .... ] )**

Returns:
>**StringPromise**

<br />
###StringPromise.indexOf()
Find the numeric index of the first instance of the supplied substring within the current string, if it exists.

Usage:
>**StringPromise.indexOf( substring )**

Returns:
>**NumberPromise**

<br />
###StringPromise.length()

Return the character length of the current string.

Usage:
>**StringPromise.length()**

Returns:
>**NumberPromise**

<br />
###StringPromise.match()
Return an array of matches against a string or regex argument.

Usage:
>**StringPromise.match( string | regex )**

Returns:
>**ArrayPromise**

<br />
###StringPromise.replace()
Replaces the search term with the replacement term, and returns a new string.

Usage:
>**StringPromise.replace( string | regex, replacement string )**

Returns:
>**StringPromise**

<br />
###StringPromise.split()
Splits the current string on every instance of the supplied delimiter, and returns the resulting array.

Usage:
>**StringPromise.split( delimiter )**

Returns:
>**ArrayPromise**

<br />
###StringPromise.slice()
Returns the portion of the current string between the start and ending positions.

Usage:
>**StringPromise.slice( start, end )**

Returns:
>**StringPromise**

<br />
###StringPromise.substr()
Returns the portion of the current string beginning at the start position and extending the specified number of characters.

Usage:
>**StringPromise.substr( start, length )**

Returns:
>**StringPromise**

<br />
###StringPromise.substring()
Returns the portion of the current string between the start and end positions.

Usage:
>**StringPromise.substring( start, end )**

Returns:
>**StringPromise**

<br />
###StringPromise.toLowerCase()
Converts the current string to lowercase.

Usage:
>**StringPromise.toLowerCase()**

Returns:
>**StringPromise**

<br />
###StringPromise.toUpperCase()
Converts the current string to UPPERCASE.

Usage:
>**StringPromise.toUpperCase()**

Returns:
>**StringPromise**

<br />
###StringPromise.trim()
Trims whitespace from both ends of the current string.

Usage:
>**StringPromise.trim()**

Returns:
>**StringPromise**

<br />
###StringPromise.parseInt()
Parses the current string and returns an integer in the specified base.

Usage:
>**StringPromise.parseInt( base )**

Returns:
>**NumberPromise**

<br />
###StringPromise.toInt()
Alias for [StringPromise.parseInt](#stringpromiseparseint).

<br />
###StringPromise.parseFloat()
Parses the current string and returns a float.

Usage:
>**StringPromise.parseFloat()**

Returns:

>**NumberPromise**

<br />
###StringPromise.toFloat()
Alias for [StringPromise.parseFloat](#stringpromiseparsefloat).

<br />
###StringPromise.parseJSON()
Parses the current string as JSON, and returns the result.

Usage:
>**StringPromise.parseJSON()**

Returns:
>**ObjectPromise**

<br />
###StringPromise.json()
Alias for [StringPromise.parseJSON](#stringpromiseparsejson).

<br />
##NumberPromise
NumberPromises allow us to mutate the eventual Number result of a promise that has yet to complete.
NumberPromises are returned from calling `promix.toNumber()`, as well as from any method on the other promise types that implicitly casts the promise value to a Number (eg, `ArrayPromise.length()`).

NumberPromises expose the methods common to all Promix typed promises (), as well as the following additional methods:

<br />
###NumberPromise.add()
Adds the supplied numbers to the current value.

Usage:
>**NumberPromise.add( number [, number, number, ... ] )**

Returns:
>**NumberPromise**

<br />
###NumberPromise.plus()
Alias for [NumberPromise.add](#numberpromiseadd).

<br />
###NumberPromise.subtract()
Subtracts the supplied numbers from the current value.

Usage:
>**NumberPromise.subtract( number [, number, number, ... ] )**

Returns:
>**NumberPromise**

<br />
###NumberPromise.minus()
Alias for [NumberPromise.subtract](#numberpromisesubtract).

<br />
###NumberPromise.multiply()
Multiplies the current value by the supplied numbers.

Usage:
>**NumberPromise.multiply( number [, number, number, ... ] )**

Returns:
>**NumberPromise**

<br />
###NumberPromise.times()
Alias for [NumberPromise.multiply](#numberpromisemultiply).

<br />
###NumberPromise.divide()
Divides the current value by the supplied numbers.

Usage:
>**NumberPromise.divide( number [, number, number, ... ] )**

Returns:
>**NumberPromise**

<br />
###NumberPromise.divideBy()
Alias for [NumberPromise.divide](#numberpromisedivide).

###NumberPromise.round()
Rounds the current value to the nearest whole number.

Usage:
>**NumberPromise.round()**

Returns:
>**NumberPromise**

<br />
###NumberPromise.ceil()
Returns the smallest whole number that is greater than or equal to the current value.

Usage:
>**NumberPromise.ceil()**

Returns:
>**NumberPromise**

<br />
###NumberPromise.floor()
Returns the largest whole number that is less than or equal to the current value.

Usage:
>**NumberPromise.floor()**

Returns:
>**NumberPromise**

<br />
###NumberPromise.average()
Finds the average of the current value and all supplied values.

Usage:
>**NumberPromise.average( number [, number, number, ... ] )**

Returns:
>**NumberPromise**

<br />
###NumberPromise.modulus()
Returns the remainder of dividing the current value by the supplied number.

Usage:
>**NumberPromise.modulus( number )**

Returns:
>**NumberPromise**

<br />
###NumberPromise.pow()
Raises the current value to the supplied power.

Usage:
>**NumberPromise.pow( number )**

Returns:
>**NumberPromise**

<br />
###NumberPromise.raiseTo()
Alias of [NumberPromise.pow](#numberpromisepow)

<br />
###NumberPromise.abs()
Finds the absolute value of the current value.

Usage:
>**NumberPromise.abs()**

Returns:
>**NumberPromise**

<br />
###NumberPromise.min()
Finds the least value among the current value and the supplied arguments.

Usage:
>**NumberPromise.min( number [, number, number, ... ] )**

Returns:
>**NumberPromise**

<br />
###NumberPromise.max()
Finds the greatest value among the current value and the supplied arguments.

Usage:
>**NumberPromise.max( number [, number, number, ... ] )**

Returns:
>**NumberPromise**

<br />
###NumberPromise.toFixed()
Returns the current value expressed to the specified number of decimal places.

Usage:
>**NumberPromise.toFixed( number )**

Returns:
>**StringPromise**

<br />
###NumberPromise.toExponential()
Returns the current value expressed in scientific notation (one digit to the left of the decimal point).

Usage:
>**NumberPromise.toExponential()**

Returns:
>**StringPromise**

<br />
###NumberPromise.toPrecision()
Returns the current value expressed with the specified number of significant digits.

Usage:
>**NumberPromise.toPrecision()**

Returns:
>**StringPromise**

<br />
###NumberPromise.toString()
Casts the current value to a string.

Usage:
>**NumberPromise.toString()**

Returns:
>**StringPromise** 

<br />
##ArrayPromise
ArrayPromises allow us to mutate the eventual Array result of a promise that has yet to complete.
ArrayPromises are returned from calling `promix.toArray()`, as well as from any method on the other promise types that implicitly casts the promise value to an Array (eg, `StringPromise.split()`).

ArrayPromises expose the methods common to all Promix typed promises (), as well as the following additional methods:

<br />
###ArrayPromise.concat()
Returns a new array combining the elements of the current array and any supplied arguments.

Usage:
>**ArrayPromise.concat(item [, item, item, ...])**

Returns:
>**ArrayPromise** 

<br />
###ArrayPromise.filter()
Returns a new array by filtering each current element through the filter callback function. If the callback returns true for a specific item, it will be included in the new array.

Usage:
>**ArrayPromise.filter(callback [, context])**

Returns:
>**ArrayPromise** 

<br />
###ArrayPromise.forEach()
Executes the specified callback function for each element in the array. The callback receives the current element and the current array index as arguments. This method returns the original array.

Usage:
>**ArrayPromise.forEach(callback [, context])**

Returns:
>**ArrayPromise**

<br />
###ArrayPromise.indexOf()
Returns the numeric index of the first occurrence of the supplied value within the array, or -1 if the value does not exist in the array.

Usage:
>**ArrayPromise.indexOf(value)**

Returns:
>**NumberPromise**

<br />
###ArrayPromise.join()
Returns the concatenated .toString() representation of all elements in the array, separated by delimiter or ','.

Usage:
>**ArrayPromise.join([delimiter])**

Returns:
>**StringPromise**

<br />
###ArrayPromise.lastIndexOf()
Returns the numeric index of the last occurrence of the supplied value within the array, or -1 if the value does not exist in the array.

Usage:
>**ArrayPromise.lastIndexOf(value)**

Returns:
>**NumberPromise**

<br />
###ArrayPromise.map()
Invokes the callback for each element of the current array, and returns a new array containing each of values returned from the callback.

Usage:
>**ArrayPromise.map(callback [, context])**

Returns:
>**ArrayPromise**

<br />
###ArrayPromise.pop()
Removes the last element from the array and returns it as a new ObjectPromise.

Usage:
>**ArrayPromise.pop()**

Returns:
>**ObjectPromise**

<br />
###ArrayPromise.push()
Adds elements to the tail of the array, and returns the array's new length.

Usage:
>**ArrayPromise.push()**

Returns:
>**NumberPromise**

<br />
###ArrayPromise.reverse()
Returns a new array with the order of elements reversed.

Usage:
>**ArrayPromise.reverse()**

Returns:
>**ArrayPromise**

<br />
###ArrayPromise.shift()
Removes the element at the head of the array and returns it as a new ObjectPromise.

Usage:
>**ArrayPromise.shift()**

Returns:
>**ObjectPromise**

<br />
###ArrayPromise.slice()
Returns a new array consisting of the elements in the current array between the start and end indices.

Usage:
>**ArrayPromise.slice(start, end)**

Returns:
>**ArrayPromise**

<br />
###ArrayPromise.sort()
Returns a new array with the elements sorted by the specified callback. If no callback is supplied, elements will be sorted alphabetically.

Usage:
>**ArrayPromise.sort([callback])**

Returns:
>**ArrayPromise**

<br />
###ArrayPromise.splice()
Removes `count` number of elements from the array starting at position `offset`, and inserts any trailing elements after `offset`. This method returns a new array containing any removed elements.

Usage:
>**ArrayPromise.splice(offset, count [, element, element, ...])**

Returns:
>**ArrayPromise**

<br />
###ArrayPromise.toString()
Returns a string representation of the current array.

Usage:
>**ArrayPromise.toString()**

Returns:
>**StringPromise**

<br />
###ArrayPromise.unshift()
Adds the specified elements to the head of the array, and returns the new array length.

Usage:
>**ArrayPromise.unshift(element [, element, element, ...])**

Returns:
>**NumberPromise**

<br />
##ObjectPromise
ObjectPromises allow us to perform generic object mutations on a promise that has yet to complete.
ObjectPromises are returned from any method on the other promise types with an indeterminate return type (eg `ArrayPromise.pop()`, where we are unsure what type of value exists at index 0).

ObjectPromises expose the following methods:

<br />
###ObjectPromise.get()
Promise to get the value of the given property.

Usage:
>**ObjectPromise.get(property)**

Returns:
>**ObjectPromise**


<br />
###ObjectPromise.set()
Promise to set the property name to the given value.

Usage:
>**ObjectPromise.set(property, value)**

Returns:
>**ObjectPromise**


<br />
###ObjectPromise.delete()
Promise to delete the property at the supplied identifier.

Usage:
>**ObjectPromise.delete(identifier)**

Returns:
>**ObjectPromise**


<br />
###ObjectPromise.keys()
Promise to return an array of the property identifiers belonging to the promise result.

Usage:
>**ObjectPromise.keys()**

Returns:
>**ArrayPromise**


<br />
###ObjectPromise.toJSON()
Promise to return a serialized JSON representation of the current promise.

Usage:
>**ObjectPromise.toJSON()**

Returns:
>**StringPromise**


<br />
##License

Promix is MIT licensed. You can read the license [here](https://raw.github.com/reflex/promix/master/license).

<br />
##Notes
###Breakpoints

Certain Promix chain methods act as chain breakpoints. 
These methods are designated with an asterisk (\*) throughout this documentation.
A breakpoint is a step in the execution of a chain that necessarily introduces sequential behavior.

For instance, in the following example:
`````javascript
promix.when(foo).and(bar).and(baz).then(wat);
`````
The `.then(wat)` step is a breakpoint, because it requires everything before it to be completed before it will execute.


 
