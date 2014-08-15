/**
 * SLog, simple yet useful logger designed originally for debug purposes.
 * Feel free to customize it to your liking as everything is somewhat "public" :)
 *
 * Partially borrowed from Meteor "Logging" Package but should work elsewhere..
 **/

// The full set
var logLevels = ['trace', 'debug', 'info', 'warning', 'error', 'fatal'];

/**
 * @name: getCallerDetails
 * @params: none
 * @returns {Object: { line: Number, file: String }}
 **/
function getCallerDetails () {
	var getStack = function () {
		// We do NOT use Error.prepareStackTrace here (a V8 extension that gets us a
		// pre-parsed stack) since it's impossible to compose it with the use of
		// Error.prepareStackTrace used on the server for source maps.
		var err = new Error;
		var stack = err.stack;
		return stack;
	};

	var stack = getStack();

	if (!stack) return {};

	var lines = stack.split('\n');

	// Looking for the first two lines outside the logging package.
	// We can safely skip the first element as we know it is the Error object itself.
	var line;
	var inPackage = false;
	for (var i = 1; i < lines.length; ++i) {
		line = lines[i];

		// We break when we get outside our frame.
		if ( !line.match(/SLog/) ) {
			if( !inPackage ) {
				continue;
			} else {
				break;
			}
		} else {
			inPackage = true;
		}
	}

	var details = {
		current: {},
		caller : {}
	};

	var getDetails = function( type, lineToParse ) {
		// The format for FF is 'functionName@filePath:lineNumber'
		// The format for V8 is 'functionName (packages/logging/logging.js:81)' or
		//                      'packages/logging/logging.js:81'
		var match = /(?:[@(]| at )([^(]+?):([0-9:]+)(?:\)|$)/.exec(lineToParse);
		if (!match)
			return;

		// in case the matched block here is line:column
		details[type].line = match[2].split(':')[0];

		// Possible format: https://foo.bar.com/scripts/file.js?random=foobar
		// XXX: if you can write the following in better way, please do it
		// XXX: what about evals?
		details[type].file = match[1].split('/').slice(-1)[0].split('?')[0];
	}

	getDetails("current", line );
	line = lines[++i];
	getDetails("caller", line );

	return details;
};

/**
 * This tries to avoid TypeError: Converting circular structure to JSON.
 * By adding a filtering function which checks whether we have already been there.
 * Reference: http://stackoverflow.com/questions/11616630/json-stringify-avoid-typeerror-converting-circular-structure-to-json
 **/
function SafeStringify( obj, spaces ) {
	var cache = [];

	// We still can get exceptions here ..
	try {
		var stringified = JSON.stringify(obj, function(key, value) {
			if (typeof value === 'object' && value !== null) {
				if (cache.indexOf(value) !== -1) {
					// Circular reference found, discard key
					return;
				}
				// Store value in our collection
				cache.push(value);
			}
			return value;
		}, spaces);
	} catch(e) {
		//~ throw new Error("Could not stringify", obj);
	}

	cache = null; // Enable garbage collection
	return stringified;
}

/**
 * @name: logFn (core log function)
 * @params: can be anything, arguments will be evaluated and stringified if needed.
 * @returns: {string} - formatted string containing the parsed log.
 **/
function logFn(/*args*/) {
	var args = _.toArray( arguments );

	var stacktrace = getCallerDetails();

	var output = "[" + new Date().toISOString() + "] ";

	if( !stacktrace ) {
		throw new Error("Could not parse stacktrace !");
	}

	if( stacktrace.current.file ) {
		output += stacktrace.current.file + ":";
	}

	output += stacktrace.current.line ? stacktrace.current.line : 1;

	if( stacktrace.caller.file ) {
		output += " (called by "+ stacktrace.caller.file + ":";
		output += stacktrace.caller.line ? stacktrace.caller.line : 1;
		output += ")";
	}

	args.forEach(function(arg) {
		output += " ";
		if( _.isObject(arg) ) {
			output += SafeStringify( arg, 2 );
		} else {
			output += arg;
		}
	});

	return output;
}

/**
 * We use the default log level when called without a specific one
 **/

SLog = function() {
	SLog[SLog._defaultLogLevel].apply( SLog, arguments );
};

// These are defaults
SLog._defaultLogLevel = "info";
SLog._minLogLevel = "debug";

SLog.setup = function( minLogLevel, defaultLogLevel ) {
	this._defaultLogLevel = defaultLogLevel ? defaultLogLevel : minLogLevel;
	this._minLogLevel = minLogLevel;
}

/**
 * @name: outputFn (output - display function)
 * @param: level {string} - level/priority (one of the above)
 * @param: msg {string} - formatted text to handle
 **/
SLog.outputFn = function( level, msg ) {
	if ((typeof console !== 'undefined') && console[level]) {
		console[level](msg);
	}
}

// For each level, check if we reach the threshold and if so, call the log function and output
_.each( logLevels, function (level) {
	SLog[level] = function() {
		if( logLevels.indexOf( level ) >= logLevels.indexOf( this._minLogLevel ) ) {
			var output = logFn.apply( this, arguments );
			this.outputFn( level, output );
		}
	}
});
