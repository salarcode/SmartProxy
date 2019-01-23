/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2019 Salar Khalilzadeh <salar2k@gmail.com>
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
import { browser } from "./environment";
import { jQuery } from "./External";

export class Utils {
	public static removeDuplicates(originalArray: string[], prop: string) {
		//<reference path="https://stackoverflow.com/a/36744732/322446"/>
		return originalArray.filter(
			(thing, index, self) => self.findIndex((t) => {
				return t[prop] === thing[prop];
			}) === index);
	}

	public static removeDuplicatesFunc(originalArray: any[], areEqualFunc: Function) {
		//<reference path="https://stackoverflow.com/a/36744732/322446"/>
		return originalArray.filter(
			(thing, index, self) => self.findIndex((t) => {
				return areEqualFunc(t, thing);
			}) === index);
	}

	public static strStartsWith(str, prefix) {
		return str.substr(0, prefix.length) === prefix;
	}

	public static chunkString(str: string, length: number) {
		let index = 0;
		let endIndex = length;
		if (endIndex > str.length)
			endIndex = str.length;

		let result = new Array<string>();
		for (; ;) {
			result.push(str.slice(index, endIndex));

			if (endIndex >= str.length)
				break;

			index += length;
			endIndex += length;

			if (endIndex > str.length)
				endIndex = str.length;
		}

		return result;
	}

	public static b64EncodeUnicode(str: string): string {
		// first we use encodeURIComponent to get percent-encoded UTF-8,
		// then we convert the percent encodings into raw bytes which
		// can be fed into btoa.
		return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
			(match, p1: number) => String.fromCharCode(p1)));
	}

	public static b64DecodeUnicode(str: string): string {
		// Going backwards: from bytestream, to percent-encoding, to original string.
		return decodeURIComponent(atob(str)
			.split("")
			.map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
			.join(""));
	}

	public static isValidHost(host: string) {
		return (host && host.indexOf("about:") === -1);
	}

	public static isValidUrl(url: string) {
		try { new URL(url); return true; }
		catch (e) { return false; }
	}

	public static urlHasSchema(url): boolean { // note: this will accept like http:/example.org/ in Chrome and Firefox
		if (!url)
			return false;
		if (url.includes(":/"))
			return true;
		return false;
	}


	public static extractHostFromUrl(url: string): string | null {
		try {
			const u = new URL(url);
			const skip = ["moz-extension:", "chrome-extension:", "about:", "chrome:", "opera:"];
			if (skip.indexOf(u.protocol) >= 0)
				return null;
			let host = u.host;

			if (host.startsWith("www."))
				return host.substring(4, host.length);

			return host;
		}
		catch (e) { return null; }
	}

	public static extractSubdomainListFromUrl(url: string): string[] {
		let host = Utils.extractHostFromUrl(url);
		if (host === null)
			return [];

		return Utils.extractSubdomainListFromHost(host);
	}

	public static extractSubdomainListFromHost(host: string): string[] {
		let parts = host.split(".");
		if (parts.length <= 2)
			return [host];

		if (parts[0] === "www")
			parts.splice(0, 1);

		if (parts.length <= 2)
			return [parts.join(".")];

		let result = new Array<string>();
		for (let i = 0; i < parts.length; i++) {
			if (i == parts.length - 1)
				break;

			let sliced = parts.slice(i, parts.length);
			//if (sliced.length > 0)
			result.push(sliced.join("."));
		}

		result.reverse();
		return result;
	}

	public static hostToMatchPattern(host: string, completeUrl: boolean = true): string {

		// only convert to match pattern if it is just host address like 'google.com'
		if (host.indexOf(":") > -1)
			return host;

		if (completeUrl)
			return `*://*.${host}/*`;
		return `*.${host}/*`;
	}

	public static matchPatternToRegExp(pattern: string, completeUrl = true): RegExp | null {
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
		let matchPattern: RegExp;
		matchPattern = (/^(?:(\*|http|https|file|ftp|app):\/\/([^/]+|)\/?(.*))$/i);

		if (pattern === "<all_urls>") {
			//return (/^(?:https?|file|ftp|app):\/\//);
			return null;
		}
		if (!completeUrl) {
			if (!pattern.includes("://")) {
				pattern = "http://" + pattern;
			}
		}


		const match = matchPattern.exec(pattern);
		if (!match) {
			//throw new TypeError(`"${pattern}" is not a valid MatchPattern`);
			return null;
		}
		const [, scheme, host, path,] = match;

		if (completeUrl) {
			return new RegExp("^(?:"
				+ (scheme === "*" ? "https?" : escape(scheme)) + ":\\/\\/"
				+ (host === "*" ? "[^\\/]*" : escape(host).replace(/^\*\./g, "(?:[^\\/]+)?"))
				+ (path ? (path == "*" ? "(?:\\/.*)?" : ("\\/" + escape(path).replace(/\*/g, ".*"))) : "\\/?")
				+ ")$");
		}
		else {
			return new RegExp("^(?:"
				//+ (scheme === "*" ? "https?" : escape(scheme)) + ":\\/\\/"
				+ (host === "*" ? "[^\\/]*" : escape(host).replace(/^\*\./g, "(?:[^\\/]+)?"))
				+ (path ? (path == "*" ? "(?:\\/.*)?" : ("\\/" + escape(path).replace(/\*/g, ".*"))) : "\\/?")
				+ ")$");
		}
	}

	public static localizeHtmlPage() {

		function replace_i18n(obj, tag) {
			let msg = browser.i18n.getMessage(tag.trim());

			if (msg && msg != tag) obj.innerHTML = msg;
		}

		// page direction
		let dir = browser.i18n.getMessage("uiDirection");
		if (dir) {
			jQuery(document.body).addClass(dir).css("direction", dir);
		}

		// Localize using data-localize tags
		let data = window.document.querySelectorAll<HTMLElement>("[data-localize]");

		data.forEach(obj => {
			let tag = obj.dataset["localize"];

			replace_i18n(obj, tag);
		});
	}
}