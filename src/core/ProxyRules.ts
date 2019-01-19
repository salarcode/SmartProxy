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
import { Debug } from "../lib/Debug";
import { ProxyRule } from "./Settings";
import { ProxyRuleType } from "./definitions";

export class ProxyRules {

	static compiledRulesList: CompiledRule[] = [];

	public static compileRules(proxyRules: ProxyRule[]) {
		if (!proxyRules)
			return;

		let compiledList: CompiledRule[] = [];

		for (let i = 0; i < proxyRules.length; i++) {
			const rule = proxyRules[i];

			if (!rule.enabled) continue;

			let newCompiled = new CompiledRule();
			Object.assign(newCompiled, rule);


			switch (rule.ruleType) {
				case ProxyRuleType.Exact:
					newCompiled.ruleExact = newCompiled.ruleExact.toLowerCase();
					break;

				case ProxyRuleType.MatchPattern:
					{
						let regex = this.matchPatternToRegExp(rule.rulePattern);
						if (regex == null)
							continue;
						newCompiled.regex = regex;
					}
					break;

				case ProxyRuleType.Regex:
					{
						// TODO: is this simple construction good enough? is ^(?:)$ needed?
						newCompiled.regex = new RegExp(rule.ruleRegex);
					}
					break;

				default:
					continue;
			}

			compiledList.push(newCompiled);
		}

		// apply the new rules
		ProxyRules.compiledRulesList = compiledList;

		// TODO: remove this
		console.log("DEL: compileRules> ", compiledList);
	}


	public static findMatchForUrl(url: string): ProxyRule | null {
		//var host = new URL(url).host;
		let lowerCaseUrl: string;

		try {
			for (let i = 0; i < this.compiledRulesList.length; i++) {
				let compiled = this.compiledRulesList[i];

				if (compiled.ruleType == ProxyRuleType.Exact) {
					if (lowerCaseUrl == null)
						lowerCaseUrl = url.toLowerCase();

					if (lowerCaseUrl == compiled.ruleExact)
						return compiled;
				}
				else {
					if (compiled.regex.test(url))
						return compiled;
				}
			}
		} catch (e) {
			Debug.warn(`findMatchForUrl failed for ${url}`, e);
		}
		return null;
	}

	private static matchPatternToRegExp(pattern: string): RegExp {
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

class CompiledRule extends ProxyRule {
	regex: RegExp;
}
