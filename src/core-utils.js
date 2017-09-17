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
const utils = {
	removeDuplicates: function (originalArray, prop) {
		///<reference path="https://stackoverflow.com/a/36744732/322446"/>
		return originalArray.filter(
			(thing, index, self) => self.findIndex((t) => {
				return t[prop] === thing[prop];
			}) === index);
	},
	removeDuplicatesFunc: function (originalArray, areEqualFunc) {
		///<reference path="https://stackoverflow.com/a/36744732/322446"/>
		return originalArray.filter(
			(thing, index, self) => self.findIndex((t) => {
				return areEqualFunc(t,thing);
			}) === index);
	},
	strStartsWith: function (str, prefix) {
		return str.substr(0, prefix.length) === prefix;
	},
	isValidHost: function (host) {
		return (host && host.indexOf("about:") === -1);
	},
	isValidUrl: function (url) {
		try { new URL(url); return true; }
		catch (e) { return false; }
	},
	isFullUrl: function (host) { // note: allow like http:/example.org/ in Chrome and Firefox
		return this.isValidUrl(host);
	},
	extractHostFromUrl: function (url) {
		try {
			let u = new URL(url)
			if (u.protocol in "moz-extension:|chrome-extension:") return null;
			return u.host
		}
		catch (e) { return null; }
	},
	extractSubdomainsFromUrl: function (url) {
		let host = utils.extractHostFromUrl(url);
		if (host === null)
			return [];

		return utils.extractSubdomainsFromHost(host);
	},
	extractSubdomainsFromHost: function (host) {
		///<summary></summary>
		let parts = host.split(".");
		if (parts.length <= 2)
			return [host];

		if (parts[0] === "www")
			parts.splice(0, 1);

		if (parts.length <= 2)
			return [parts.join(".")];

		let result = [];
		for (let i = 0; i < parts.length; i++) {
			if (i == parts.length - 1)
				break;

			let sliced = parts.slice(i, parts.length);
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
		const matchPattern = (/^(?:(\*|http|https|file|ftp|app):\/\/([^/]+|)\/?(.*))$/i);

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


function localizeHtmlPage() {
	///<summary></summary>
	function replace_i18n(obj, tag) {
		let msg = browser.i18n.getMessage(tag.trim());

		if (msg && msg != tag) obj.innerHTML = msg;
	}

	// Localize using data-localize tags
	let data = document.querySelectorAll('[data-localize]');

	for (let obj of data) {
		let tag = obj.dataset['localize'];

		replace_i18n(obj, tag);
	}

	// page direction
	let dir = browser.i18n.getMessage("uiDirection");
	if (dir) {
		$(document.body).addClass(dir).css("direction", dir);
	}
}