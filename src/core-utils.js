var utils = {
	isValidHost: function (host) {
		if (!host)
			return false;
		if (host.indexOf("about:") > -1)
			return false;
		return true;
	},
	isValidUrl: function (url) {
		if (!url)
			return false;
		if (url.indexOf("://") == -1)
			return false;
		return true;
	},
	isFullUrl: function (host) {
		if (!host)
			return false;
		if (host.indexOf("://") > -1)
			return true;
		return false;
	},
	extractHostFromUrl: function (url) {
		// and extracts [ , scheme, host, path, ]
		const matchPattern = (/^(?:(\*|http|https|file|ftp|app):\/\/(\*|(?:\*\.)?[^\/\*]+|)\/?(.*))$/i);

		const match = matchPattern.exec(url);
		if (!match) {
			return null;
		}
		const [, scheme, host, path,] = match;
		return host;
	},
	extractSubdomainsFromUrl: function (url) {
		if (!url)
			return [];

		var host = utils.extractHostFromUrl(url);
		if (host == null)
			return [];

		return utils.extractSubdomainsFromHost(host);
	},
	extractSubdomainsFromHost: function (host) {
		///<summary></summary>
		var parts = host.split(".");
		if (parts.length <= 2)
			return [host];

		if (parts[0] === "www")
			parts.splice(0, 1);

		if (parts.length <= 2)
			return [parts.join(".")];

		var result = [];
		for (var i = 0; i < parts.length; i++) {
			if (i == parts.length - 1)
				break;

			var sliced = parts.slice(i, parts.length);
			//if (sliced.length > 0)
			result.push(sliced.join("."));
		}

		result.reverse();
		return result;
	},
	hostToMatchPattern: function (host) {

		// only convert to match pattern if it is just host address like 'google.com'
		if (host.indexOf(":") > -1)
			return host;

		return `*://*.${host}/*`;
	},
	matchPatternToRegExp: function (pattern) {
		// Source: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Match_patterns
		// Modified by Salar Khalilzadeh
		/**
		 * Transforms a valid match pattern into a regular expression
		 * which matches all URLs included by that pattern.
		 *
		 * @param  {string}  pattern  The pattern to transform.
		 * @return {RegExp}           The pattern's equivalent as a RegExp.
		 * @throws {TypeError}        If the pattern is not a valid MatchPattern
		 */

		// matches all valid match patterns (except '<all_urls>')
		// and extracts [ , scheme, host, path, ]
		const matchPattern = (/^(?:(\*|http|https|file|ftp|app):\/\/([^\/]+|)\/?(.*))$/i);

		if (pattern === '<all_urls>') {
			//return (/^(?:https?|file|ftp|app):\/\//);
			return null;
		}
		const match = matchPattern.exec(pattern);
		if (!match) {
			//throw new TypeError(`"${pattern}" is not a valid MatchPattern`);
			return null;
		}
		const [, scheme, host, path,] = match;

		return new RegExp('^(?:'
			+ (scheme === '*' ? 'https?' : escape(scheme)) + ':\\/\\/'
			+ (host === '*' ? "[^\\/]*" : escape(host).replace(/^\*\./g, '(?:[^\\/]+)?'))
			+ (path ? (path == '*' ? '(?:\\/.*)?' : ('\\/' + escape(path).replace(/\*/g, '.*'))) : '\\/?')
			+ ')$');
	}
}
