var proxyMode = "1";
var proxyHosts = [];
var activeProxyServer = null;
const proxyModeType = {
	direct: "1",
	smartProxy: "2",
	always: "3",
	systemProxy: "4"
};
var resultActiveProxy = "DIRECT";
const resultDirect = "DIRECT";
const resultSystem = "SYSTEM";

(function () {

	// start handling messages
	browser.runtime.onMessage.addListener(handleMessages);

	// signal proxy is ready
	initialize();


	function handleMessages(message, sender, sendResponse) {

		if (typeof (message) == "object") {
			var command = message["command"];

			browser.runtime.sendMessage('Proxy message incoming> ' + command);

			if (command == "proxyModeChanged" &&
				message["proxyMode"] != null) {

				let newProxyMode = message["proxyMode"];
				if (newProxyMode != null) {
					proxyMode = newProxyMode;
				}

			} else if (command == "activeProxyServerChanged" &&
				message["activeProxyServer"]!=null) {

				var newActiveProxyServer = message["activeProxyServer"];

				activeProxyServer = newActiveProxyServer;
				resultActiveProxy = convertActiveProxyServer(activeProxyServer);

			} else if (command == "proxyRulesChanged" &&
				message["proxyRules"] != null) {

				var newProxyRules = message["proxyRules"];

				proxyHosts = convertHosts(newProxyRules);

				browser.runtime.sendMessage('proxyRulesChanged > hosts: ' + newProxyRules.length + ' converted: ' + proxyHosts.length);
			}
		} else {

			browser.runtime.sendMessage('Proxy message incoming> ' + message);

		}
	}

	function initialize() {
		browser.runtime.sendMessage("init")
			.then(function (proxyInitData) {
				if (!proxyInitData) {
					browser.runtime.sendMessage('Init response received empty!!');
					return;
				}

				proxyHosts = convertHosts(proxyInitData.proxyRules);
				proxyMode = proxyInitData.proxyMode;

				activeProxyServer = proxyInitData.activeProxyServer;
				resultActiveProxy = convertActiveProxyServer(activeProxyServer);

				browser.runtime.sendMessage('Init response received > hosts: ' + proxyInitData.proxyRules.length + ' converted: ' + proxyHosts.length);

			})
			.catch(function (e) {
				browser.runtime.sendMessage('Init failed! > ' + e);
			});
	}

	function convertHosts(proxyRules) {
		if (!proxyRules || !proxyRules.length)
			return [];
		var result = [];

		//for (let rule of proxyRules) {
		for (let i = 0; i < proxyRules.length; i++) {
			let rule = proxyRules[i];

			if (!rule.enabled) continue;

			let regex = matchPatternToRegExp(rule.rule);
			if (regex != null)
				result.push(regex);
		}

		return result;
	}

	function convertActiveProxyServer(activeProxyServer) {

		// invalid active proxy server
		if (!activeProxyServer || !activeProxyServer.host || !activeProxyServer.protocol || !activeProxyServer.port)
			return resultDirect;

		switch (activeProxyServer.protocol) {
			case "HTTP":
				return `PROXY ${activeProxyServer.host}:${activeProxyServer.port}`;

			case "HTTPS":
				return `HTTPS ${activeProxyServer.host}:${activeProxyServer.port}`;

			case "SOCKS4":
				return `SOCKS4 ${activeProxyServer.host}:${activeProxyServer.port}`;

			case "SOCKS5":
				return `SOCKS5 ${activeProxyServer.host}:${activeProxyServer.port}`;
		}

		// invalid proxy protocol
		return resultDirect;
	}

	function toExpMatchRegex(pattern) {
		pattern = pattern.replace(/\\./g, '\\\\.');
		pattern = pattern.replace(/\\*/g, '.*');
		pattern = pattern.replace(/\\?/g, '.');
		return new RegExp('^' + pattern + '$');
	}

	function matchPatternToRegExp(pattern) {
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
})();

// -------------------------
// required PAC function that will be called to determine
// if a proxy should be used.
function FindProxyForURL(url, host) {

	// BUGFIX: we need implict convertion (==) instead of (===), since proxy mode comes from different places and i'm lazy to track it
	if (proxyMode == proxyModeType.direct)
		return resultDirect;

	if (proxyMode == proxyModeType.systemProxy)
		// TODO: system is not implemented by Firefox yet
		// TODO: https://bugzilla.mozilla.org/show_bug.cgi?id=1319630
		return resultSystem;

	// there should be active proxy
	if (activeProxyServer == null)
		return resultDirect;

	if (proxyMode == proxyModeType.always)
		return resultActiveProxy;

	try {

		for (let i = 0; i < proxyHosts.length; i++) {
			let hostRegex = proxyHosts[i];

			if (hostRegex.test(url)) {
				browser.runtime.sendMessage(`SmartProxy> ${url} with ${resultActiveProxy}`);
				return resultActiveProxy;
			}
		}

		return resultDirect;
	} catch (e) {
		browser.runtime.sendMessage('Error in FindProxyForURL for ' + url);
	}
}

if (typeof (shExpMatch) === "undefined")
	function shExpMatch(url, pattern) {
		pattern = pattern.replace(/\\./g, '\\\\.');
		pattern = pattern.replace(/\\*/g, '.*');
		pattern = pattern.replace(/\\?/g, '.');
		var newRe = new RegExp('^' + pattern + '$');
		return newRe.test(url);
	}

