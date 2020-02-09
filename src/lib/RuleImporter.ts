/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2020 Salar Khalilzadeh <salar2k@gmail.com>
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
import { Utils } from "./Utils";
import { browser } from "./environment";
import { ProxyRulesSubscription, ProxyRulesSubscriptionFormat } from "../core/definitions";
import { ProxyEngineSpecialRequests } from "../core/ProxyEngineSpecialRequests";

export const RuleImporter = {
	readFromServer(subscriptionDetail: ProxyRulesSubscription, success?: Function, fail?: Function) {
		if (!subscriptionDetail || !subscriptionDetail.url) {
			if (fail) fail();
			return;
		}
		if (!success) throw "onSuccess callback is mandatory";

		function ajaxSuccess(response: any) {
			if (!response)
				if (fail) fail();
			RuleImporter.importRulesBatch(response, null,
				false,
				null,
				(importResult: {
					success: boolean,
					message: string,
					result: {
						whiteList: string[],
						blackList: string[]
					}
				}) => {
					if (!importResult.success) {
						if (fail)
							fail(importResult);
						return;
					}
					if (success)
						success(importResult);
				},
				(error: Error) => {
					if (fail)
						fail(error);
				},
				subscriptionDetail);
		}

		if (subscriptionDetail.applyProxy !== null)
			// mark this request as special
			ProxyEngineSpecialRequests.setSpecialUrl(subscriptionDetail.url, subscriptionDetail.applyProxy);

		let xhr = new XMLHttpRequest();
		xhr.open("GET", subscriptionDetail.url);

		if (subscriptionDetail.username) {
			let pass = atob(subscriptionDetail.password);
			xhr.setRequestHeader("Authorization", "Basic " + btoa(subscriptionDetail.username + ":" + pass));
		}

		xhr.onload = () => {
			if (xhr.status === 200) {
				ajaxSuccess(xhr.responseText);
			}
			else {
				if (fail) fail(xhr.status);
			}
		};
		xhr.send();
	},
	importRulesBatch(text: string | ArrayBuffer, file: any, append: boolean, currentRules: any[], success: Function, fail?: Function, options?: ProxyRulesSubscription) {
		if (!file && !text) {
			if (fail) fail();
			return;
		}

		if (text) {
			try {
				doImport(text as string, options);
			} catch (e) {
				if (fail) fail(e);
			}
		}
		else {
			let reader = new FileReader();
			reader.onerror = event => {
				if (fail) fail(event);
			};
			reader.onload = event => {
				//let textFile = event.target;
				let fileText = reader.result;

				try {
					doImport(fileText as string, options);
				} catch (e) {
					if (fail) fail(e);
				}
			};
			reader.readAsText(file);
		}
		function doImport(text: string, options?: ProxyRulesSubscription) {
			if (options.obfuscation.toLowerCase() == "base64") {
				// decode base64
				text = Utils.b64DecodeUnicode(text);
			}

			let totalRules = 0;
			let rules: {
				whiteList: string[],
				blackList: string[]
			};

			if (options && options.format == ProxyRulesSubscriptionFormat.AutoProxy) {
				if (!externalAppRuleParser.GFWList.detect(text, false)) {
					if (fail) fail();
					return;
				}
				rules = externalAppRuleParser.GFWList.parse(text);
			}
			else {
				if (fail) fail();
				return;
			}

			if (append) {
				if (!currentRules)
					currentRules = [];
				// TODO: 

			}
			else {
				// Total of ${totalRules} rules are returned.<br>Don't forget to save the changes.
				let message = browser.i18n.getMessage("importerImportRulesSuccessAAAAAA")
					.replace("{0}", totalRules.toString());

				if (success) {
					// not need for any check, return straight away
					success({
						success: true,
						message: message,
						result: rules
					});
				}
			}
		}
	},
	importAutoProxy(file: any, append: any, currentRules: any, success: Function, fail: Function) {
		///<summary>
		/// Parses AutoProxy rules and *JUST* uses it as a way to extract domain list to be proxyfied
		/// Does not follow the rules of AutoProxy
		///</summary>
		if (!file) {
			if (fail) fail();
			return;
		}

		let reader = new FileReader();
		reader.onerror = event => {
			if (fail) fail(event);
		};
		reader.onload = event => {
			//let textFile = event.target;
			let fileText = reader.result;

			try {
				let parsedRuleList = externalAppRuleParser.AutoProxy.parse(fileText);

				let importedRuleList = [];

				for (let parsedRule of parsedRuleList) {
					let convertResult = RuleImporter.convertAutoProxyRule(parsedRule.condition.pattern, parsedRule.condition.conditionType);
					if (!convertResult.success) {
						//notImportedRules++;
						continue;
					}

					importedRuleList.push(
						{ pattern: convertResult.pattern, source: convertResult.source, enabled: true }
					);
				}

				// remove the duplicates from imported rules
				importedRuleList = Utils.removeDuplicates(importedRuleList, "pattern");

				// rules are ready
				if (append) {
					if (!currentRules)
						currentRules = [];

					// make a copy
					let appendedRuleList = currentRules.slice();
					let appendedRuleCount = 0;

					for (let importedRule of importedRuleList) {
						let ruleExists = currentRules.some((rule: any) => {
							rule.pattern == importedRule.pattern
						})
						if (ruleExists)
							continue;

						// append imported rule
						appendedRuleList.push(importedRule);
						appendedRuleCount++;
					}

					// Total ${appendedRuleCount} out of ${parsedRuleList.length} rules are appended.<br>Don't forget to save the changes.
					let message = browser.i18n.getMessage("importerImportSuccess")
						.replace("{0}", appendedRuleCount.toString())
						.replace("{1}", parsedRuleList.length.toString());

					if (success) {
						// not need for any check, return straight away
						success({
							success: true,
							message: message,
							result: appendedRuleList
						});
					}

				} else {

					// Total ${importedRuleList.length} out of ${parsedRuleList.length} rules are imported.<br>Don't forget to save the changes.
					let message = browser.i18n.getMessage("importerImportSuccess")
						.replace("{0}", importedRuleList.length.toString())
						.replace("{1}", parsedRuleList.length.toString());

					if (success) {
						// not need for any check, return straight away
						success({
							success: true,
							message: message,
							result: importedRuleList
						});
					}
				}

			} catch (e) {
				if (fail) fail(e);
			}
		};
		reader.readAsText(file);
	},
	convertAutoProxyRule(cleanCondition: any, conditionType: any) {
		let source = "";
		let pattern = "";

		switch (conditionType) {
			case "KeywordCondition":
				// no (*) character

				// NOTE: keyword type is supported as domain name
				// it also works for https as well as http

				if (cleanCondition[0] === ".") {
					cleanCondition = cleanCondition.substring(1);
				}
				source = cleanCondition;

				if (cleanCondition.endsWith("/"))
					// no extra slash
					source = cleanCondition.substring(0, cleanCondition.length - 2);

				pattern = `*://*.${source}/*`;
				break;

			case "HostWildcardCondition":
				if (cleanCondition[0] === ".") {
					cleanCondition = cleanCondition.substring(1);
				}
				// remove (*) chars
				cleanCondition = cleanCondition.replace(/\*/g, "");

				// remove (.) duplicates
				cleanCondition = cleanCondition.replace(/([.])\1+/g, ".");

				if (cleanCondition[0] === ".") {
					cleanCondition = cleanCondition.substring(1);
				}

				// source
				source = cleanCondition;

				if (cleanCondition.endsWith("/"))
					// no extra slash
					source = cleanCondition.substring(0, cleanCondition.length - 2);

				pattern = `*://*.${source}/*`;
				break;

			case "UrlWildcardCondition":
				// very restricted support
				if (cleanCondition[0] === "*") {
					// no problem
					cleanCondition = cleanCondition.substring(1);
				}
				if (cleanCondition[0] === ".") {
					cleanCondition = cleanCondition.substring(1);
				}

				if (cleanCondition.indexOf("*") !== -1) {

					let cleanConditionRemMiddle = cleanCondition;

					if (cleanConditionRemMiddle.indexOf("://*.") !== -1) {
						cleanConditionRemMiddle = cleanConditionRemMiddle.replace("//*.", "://");
					}

					if (cleanConditionRemMiddle.endsWith("*")) {
						cleanCondition = cleanCondition.substring(0, cleanCondition.length - 2);
						cleanConditionRemMiddle = cleanConditionRemMiddle.substring(0, cleanCondition.length - 2);
					}

					if (cleanConditionRemMiddle.indexOf("*") !== -1) {

						// (/*/) is supported, lets remove them and check again for other rules)
						cleanConditionRemMiddle = cleanCondition.replace(/\/\*\//g, "/");

						if (cleanConditionRemMiddle.indexOf("*") !== -1) {
							// still there is some left
							// * in middle is not supported

							return {
								success: false
							}
						}
					}
				}


				// source
				source = cleanCondition;

				if (cleanCondition.endsWith("/"))
					// no extra slash
					source = cleanCondition.substring(0, cleanCondition.length - 2);

				if (source.indexOf("://") !== -1) {
					pattern = `${source}/*`;
				} else {
					pattern = `*://*.${source}/*`;
				}

				break;

			case "UrlRegexCondition":
				// not supported
				return {
					success: false
				}
		}

		return {
			success: true,
			source: source,
			pattern: pattern,
			toString() {
				return `[${source} , ${pattern}]`;
			}
		}
	}
}


// -----------------------------------------------
// -----------------------------------------------
// -----------------------------------------------
/*

-----------------------------------------------
AutoProxy Rules, from: https://web.archive.org/web/20150318182040/https://autoproxy.org/en/Rules
-----------------------------------------------

Currently these formats are supported in rules:

example.com
Matching: http://www.example.com/foo
Matching: http://www.google.com/search?q=www.example.com
Not match: https://www.example.com/
Use when example.com is a URL keyword, any http connection (notincluding https)

||example.com
Matching: http://example.com/foo
Matching: https://subdomain.example.com/bar
Not matching: http://www.google.com/search?q=example.com
Match the whole domain and second-level domain no matter http or https, used when site's IP is blocked.

|https://ssl.example.com
Match all address beginning with https://ssl.example.com, used when some IP's HTTPS is specifically blocked.

|http://example.com
Match all address beginning with http://example.com, used for short domains, like URL shortening services to avoid "slow rules". Also a temporary fix for issue 117.

/^https?:\/\/[^\/]+example\.com/
Match domain including "example.com" chars, it's a regex, used when the chars are DNS poisoning keyword.

@@||example.com
The highest privilege rule, all websites matching ||example.com aren't proxied, sometimes used for websites in China mainland.

!Foo bar
Beginning with !, just for explanation.
*/
// -----------------------------------------------
/*!
 * This piece of code is from SwitchyOmega_Firefox <omega_pac.min.js>
 * Modified to return the not generalized pattern
 *
 * @source   https://github.com/FelisCatus/SwitchyOmega
 * @license  GPL3
 */
const externalAppRuleParser = {
	'AutoProxy': {
		magicPrefix: "W0F1dG9Qcm94",
		detect(text: string, acceptBase64: boolean = true): boolean {
			if (acceptBase64 && Utils.strStartsWith(text, externalAppRuleParser["AutoProxy"].magicPrefix)) {
				return true;
			} else if (Utils.strStartsWith(text, "[AutoProxy")) {
				return true;
			}
			return false;
		},
		preprocess(text: any) {
			if (Utils.strStartsWith(text, externalAppRuleParser["AutoProxy"].magicPrefix)) {
				text = Utils.b64DecodeUnicode(text);
				//text = new Buffer(text, "base64").toString("utf8");
			}
			return text;
		},
		parse(text: any, matchProfileName?: any, defaultProfileName?: any) {
			let cond, exclusive_rules: any[], line, list, normal_rules: any[], profile, source, _i, _len, _ref;
			normal_rules = [];
			exclusive_rules = [];
			_ref = text.split(/\n|\r/);
			for (_i = 0, _len = _ref.length; _i < _len; _i++) {
				line = _ref[_i];
				line = line.trim();
				if (line.length === 0 || line[0] === "!" || line[0] === "[") {
					continue;
				}
				source = line;
				profile = matchProfileName;
				list = normal_rules;
				if (line[0] === "@" && line[1] === "@") {
					profile = defaultProfileName;
					list = exclusive_rules;
					line = line.substring(2);
				}
				cond = line[0] === "/"
					? {
						conditionType: "UrlRegexCondition",
						pattern: line.substring(1, line.length - 1)
					}
					: line[0] === "|"
						? line[1] === "|"
							? {
								conditionType: "HostWildcardCondition",
								pattern: "*." + line.substring(2),
								cleanCondition: line.substring(2)
							}
							: {
								conditionType: "UrlWildcardCondition",
								pattern: line.substring(1) + "*",
								cleanCondition: line.substring(1)
							}
						: line.indexOf("*") < 0
							? {
								conditionType: "KeywordCondition",
								pattern: line,
								cleanCondition: line
							}
							: {
								conditionType: "UrlWildcardCondition",
								pattern: "http://*" + line + "*",
								cleanCondition: line
							};
				list.push({
					condition: cond,
					profileName: profile,
					source: source
				});
			}
			return exclusive_rules.concat(normal_rules);
		}
	},
	'GFWList': {
		detect(text: string, acceptBase64: boolean = true): boolean {
			if (acceptBase64 && Utils.strStartsWith(text, externalAppRuleParser["AutoProxy"].magicPrefix)) {
				return true;
			} else if (Utils.strStartsWith(text, "[AutoProxy")) {
				return true;
			}
			return false;
		},
		parse(text: any): {
			_debug: any[],
			whiteList: string[],
			blackList: string[]
		} {
			text = text.trim();

			let whiteList: string[] = [];
			let blackList: string[] = [];
			let _debug = [];

			for (var line of text.split(/\n|\r/)) {
				line = line.trim();
				if (!line[0] || line[0] == '!' || line[0] == '[')
					continue;

				var converted = externalAppRuleParser.GFWList.convertLineRegex(line);
				if (!converted) continue;

				_debug.push(line + '\n' + converted.regex + ' \t\t Name:' + converted.name + '\n\n');
				if (line.startsWith('@@'))
					whiteList.push(converted.regex);
				else
					blackList.push(converted.regex);

			}
			return {
				_debug: _debug,
				whiteList: whiteList,
				blackList: blackList
			};
		},
		convertLineRegex(line: string): {
			regex: string,
			name: string,
			makeNameRandom: boolean
		} {
			if (line.startsWith('@@'))
				// white-list is not handled here
				line = line.substring(2);

			if (line.startsWith('/') && line.endsWith('/')) {
				line = line.substring(1, line.length - 1);
				// this is a regex expression, doesn't need processing
				return {
					regex: line,
					name: 'Regex',
					makeNameRandom: true
				}
			}

			line = line.replace('*', '.+').replace('?', '\?');
			line = line.replace('(', '\(').replace(')', '\)');

			if (line.startsWith('||')) {
				line = line.substring(2);

				return {
					regex: `^(?:https?|ftps?|wss?):\\/\\/(?:.+\\.)?${line}(?:[.?#\\\/].*)?$`,
					name: line,
					makeNameRandom: false
				}
			}
			if (line.startsWith('|')) {
				line = line.substring(1);

				return {
					regex: `^${line}.*`,
					name: line,
					makeNameRandom: false
				}
			}
			if (line.endsWith('|')) {
				line = line.substring(0, line.length - 1);

				return {
					regex: `.*${line}$`,
					name: line,
					makeNameRandom: false
				}
			}
			else {
				return {
					regex: `.*${line}.*`,
					name: line,
					makeNameRandom: false
				}
			}
		}
	}
};

// -----------------------------------------------
// -----------------------------------------------
// -----------------------------------------------