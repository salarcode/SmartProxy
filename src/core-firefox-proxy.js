/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2017 Salar Khalilzadeh <salar2k@gmail.com>
 *
 * SmartProxy is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * SmartProxy is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with SmartProxy.  If not, see <http://www.gnu.org/licenses/>.
 */
var proxyMode = "1";
var compiledRules = [];
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

//-----------------------------
// Subset of polyfill api for proxy, since it doesn't have access to 'core-polyfill.js'
//-----------------------------
var environment = {
	chrome: false
};

// Google Chrome polyfill
if (typeof browser === "undefined") {
	browser = chrome;
	environment.chrome = true;
}

var polyfill = {
	lastError: function () {
		if (environment.chrome) {
			// chrome.extension.lastError Deprecated since Chrome 58
			return chrome.runtime.lastError;
		} else {
			return browser.runtime.lastError;
		}
	},

	runtimeSendMessage: function (message, success, fail, options, extensionId) {
		if (environment.chrome) {
			chrome.runtime.sendMessage(extensionId,
				message,
				options,
				function (response) {
					var error = polyfill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			browser.runtime.sendMessage(
				extensionId,
				message,
				options
			).then(success, fail);
		}
	}
};
//-----------------------------
//-----------------------------

(function () {

	// start handling messages
	browser.runtime.onMessage.addListener(handleMessages);

	// signal proxy is ready
	initialize();


	function handleMessages(message, sender, sendResponse) {

		if (typeof (message) == "object") {
			var command = message["command"];

			if (command == "proxyModeChanged" &&
				message["proxyMode"] != null) {

				let newProxyMode = message["proxyMode"];
				if (newProxyMode != null) {
					proxyMode = newProxyMode;
				}

			} else if (command == "activeProxyServerChanged" &&
				message["activeProxyServer"] != null) {

				var newActiveProxyServer = message["activeProxyServer"];

				activeProxyServer = newActiveProxyServer;
				resultActiveProxy = convertActiveProxyServer(activeProxyServer);

			} else if (command == "proxyRulesChanged" &&
				message["proxyRules"] != null) {

				var newProxyRules = message["proxyRules"];

				compiledRules = compileRules(newProxyRules);
			}
		}
	}

	function initialize() {
		polyfill.runtimeSendMessage("init",
			function (proxyInitData) {
				if (!proxyInitData) {
					polyfill.runtimeSendMessage('Init response received empty!!');
					return;
				}

				compiledRules = compileRules(proxyInitData.proxyRules);
				proxyMode = proxyInitData.proxyMode;

				activeProxyServer = proxyInitData.activeProxyServer;
				resultActiveProxy = convertActiveProxyServer(activeProxyServer);

			},
			function (e) {
				polyfill.runtimeSendMessage('PAC Init failed! > ' + e);
			});
	}

	function compileRules(proxyRules) {
		if (!proxyRules || !proxyRules.length)
			return [];
		var result = [];

		for (let rule of proxyRules) {
			if (!rule.enabled) continue;

			let regex = matchPatternToRegExp(rule.pattern);
			if (regex != null) {
				var proxyResult = null;
				if (rule.proxy) {
					proxyResult = convertActiveProxyServer(rule.proxy);
				}
				result.push({
					regex: regex,
					proxy: proxyResult
				});
			}
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
		// null is equal to "PASS" which lets the browser decide
		// in firefox due a bug "PASS" is not possible: https://bugzilla.mozilla.org/show_bug.cgi?id=1319634
		// return "PASS";
		return resultDirect;

	if (proxyMode == proxyModeType.always)
		return resultActiveProxy;

	try {

		for (let rule of compiledRules) {
			if (rule.regex.test(url)) {
				if (rule.proxy)
					// this rule has its own proxy setup
					return rule.proxy;
				return resultActiveProxy;
			}
		}
	} catch (e) {
		polyfill.runtimeSendMessage('Error in FindProxyForURL for ' + url);
	}

	// null is equal to "PASS" which lets the browser decide
	// in firefox due a bug "PASS" is not possible: https://bugzilla.mozilla.org/show_bug.cgi?id=1319634
	// return "PASS";
	return resultDirect;
}