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
import { Utils } from './Utils';
import { api } from './environment';
import {
	ProxyRulesSubscription,
	ProxyRulesSubscriptionFormat,
	ProxyRulesSubscriptionRuleType,
	SubscriptionProxyRule,
} from '../core/definitions';
import { ProxyEngineSpecialRequests } from '../core/ProxyEngineSpecialRequests';
import * as ruleImporterSwitchyScript from './RuleImporterSwitchy';

export const RuleImporter = {
	readFromServer(subscription: ProxyRulesSubscription, success?: Function, fail?: Function) {
		if (!subscription || !subscription.url) {
			if (fail) fail();
			return;
		}
		if (!success) throw 'onSuccess callback is mandatory';

		function ajaxSuccess(response: any) {
			if (!response) if (fail) fail();
			RuleImporter.importRulesBatch(
				response,
				null,
				false,
				null,
				(importResult: {
					success: boolean;
					message: string;
					result: {
						whiteList: SubscriptionProxyRule[];
						blackList: SubscriptionProxyRule[];
					};
				}) => {
					if (!importResult.success) {
						if (fail) fail(importResult);
						return;
					}
					if (success) success(importResult);
				},
				(error: Error) => {
					if (fail) fail(error);
				},
				subscription,
			);
		}

		if (subscription.applyProxy !== null)
			// mark this request as special
			ProxyEngineSpecialRequests.setSpecialUrl(subscription.url, subscription.applyProxy);

		let fetchRequest = {
			method: 'GET',
			headers: undefined,
		};
		if (subscription.username) {
			let pass = atob(subscription.password);
			fetchRequest.headers =
			{
				'Authorization': 'Basic ' + btoa(subscription.username + ':' + pass)
			};
		}
		fetch(subscription.url, fetchRequest)
			.then((response) => response.text())
			.then((result) => {
				ajaxSuccess(result);
			})
			.catch((error) => {
				if (fail) fail(error);
			});
	},
	importRulesBatch(
		text: string | ArrayBuffer,
		file: any,
		append: boolean,
		currentRules: any[],
		success: Function,
		fail?: Function,
		options?: ProxyRulesSubscription,
	) {
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
		} else {
			let reader = new FileReader();
			reader.onerror = (event) => {
				if (fail) fail(event);
			};
			reader.onload = (event) => {
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
			if (options.obfuscation.toLowerCase() == 'base64') {
				// decode base64
				text = Utils.b64DecodeUnicode(text);
			}

			let rules: {
				whiteList: SubscriptionProxyRule[];
				blackList: SubscriptionProxyRule[];
			};

			if (options && options.format == ProxyRulesSubscriptionFormat.AutoProxy) {
				if (!externalAppRuleParser.GFWList.detect(text, false)) {
					if (fail) fail();
					return;
				}
				rules = externalAppRuleParser.GFWList.parse(text);
			} else if (options && options.format == ProxyRulesSubscriptionFormat.SwitchyOmega) {
				let switchyRules = externalAppRuleParser.Switchy.parseAndCompile(text);

				if (!switchyRules || !switchyRules.compiled) {
					if (fail) fail();
					return;
				}
				let blackListRules = externalAppRuleParser.Switchy.convertToSmartProxy(switchyRules.compiled);
				rules = {
					blackList: blackListRules,
					whiteList: [],
				};
			} else {
				if (fail) fail();
				return;
			}

			if (append) {
				if (!currentRules) currentRules = [];
				// TODO:
			} else {
				// Total of {0} proxy rules and {1} white listed rules are returned.<br>Don't forget to save the changes.
				let message = api.i18n
					.getMessage('importerImportRulesSuccess')
					.replace('{0}', rules.blackList.length)
					.replace('{1}', rules.whiteList.length);

				if (success) {
					// not need for any check, return straight away
					success({
						success: true,
						message: message,
						result: rules,
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
		reader.onerror = (event) => {
			if (fail) fail(event);
		};
		reader.onload = (event) => {
			//let textFile = event.target;
			let fileText = reader.result;

			try {
				let parsedRuleList = externalAppRuleParser.AutoProxy.parse(fileText);

				let importedRuleList = [];

				for (let parsedRule of parsedRuleList) {
					let convertResult = RuleImporter.convertAutoProxyRule(
						parsedRule.condition.pattern,
						parsedRule.condition.conditionType,
					);
					if (!convertResult.success) {
						//notImportedRules++;
						continue;
					}

					importedRuleList.push({ pattern: convertResult.pattern, source: convertResult.source, enabled: true });
				}

				// remove the duplicates from imported rules
				importedRuleList = Utils.removeDuplicates(importedRuleList, 'pattern');

				// rules are ready
				if (append) {
					if (!currentRules) currentRules = [];

					// make a copy
					let appendedRuleList = currentRules.slice();
					let appendedRuleCount = 0;

					for (let importedRule of importedRuleList) {
						let ruleExists = currentRules.some((rule: any) => {
							rule.pattern == importedRule.pattern;
						});
						if (ruleExists) continue;

						// append imported rule
						appendedRuleList.push(importedRule);
						appendedRuleCount++;
					}

					// Total ${appendedRuleCount} out of ${parsedRuleList.length} rules are appended.<br>Don't forget to save the changes.
					let message = api.i18n
						.getMessage('importerImportSuccess')
						.replace('{0}', appendedRuleCount.toString())
						.replace('{1}', parsedRuleList.length.toString());

					if (success) {
						// not need for any check, return straight away
						success({
							success: true,
							message: message,
							result: appendedRuleList,
						});
					}
				} else {
					// Total ${importedRuleList.length} out of ${parsedRuleList.length} rules are imported.<br>Don't forget to save the changes.
					let message = api.i18n
						.getMessage('importerImportSuccess')
						.replace('{0}', importedRuleList.length.toString())
						.replace('{1}', parsedRuleList.length.toString());

					if (success) {
						// not need for any check, return straight away
						success({
							success: true,
							message: message,
							result: importedRuleList,
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
		let source = '';
		let pattern = '';

		switch (conditionType) {
			case 'KeywordCondition':
				// no (*) character

				// NOTE: keyword type is supported as domain name
				// it also works for https as well as http

				if (cleanCondition[0] === '.') {
					cleanCondition = cleanCondition.substring(1);
				}
				source = cleanCondition;

				if (cleanCondition.endsWith('/'))
					// no extra slash
					source = cleanCondition.substring(0, cleanCondition.length - 2);

				pattern = `*://*.${source}/*`;
				break;

			case 'HostWildcardCondition':
				if (cleanCondition[0] === '.') {
					cleanCondition = cleanCondition.substring(1);
				}
				// remove (*) chars
				cleanCondition = cleanCondition.replace(/\*/g, '');

				// remove (.) duplicates
				cleanCondition = cleanCondition.replace(/([.])\1+/g, '.');

				if (cleanCondition[0] === '.') {
					cleanCondition = cleanCondition.substring(1);
				}

				// source
				source = cleanCondition;

				if (cleanCondition.endsWith('/'))
					// no extra slash
					source = cleanCondition.substring(0, cleanCondition.length - 2);

				pattern = `*://*.${source}/*`;
				break;

			case 'UrlWildcardCondition':
				// very restricted support
				if (cleanCondition[0] === '*') {
					// no problem
					cleanCondition = cleanCondition.substring(1);
				}
				if (cleanCondition[0] === '.') {
					cleanCondition = cleanCondition.substring(1);
				}

				if (cleanCondition.indexOf('*') !== -1) {
					let cleanConditionRemMiddle = cleanCondition;

					if (cleanConditionRemMiddle.indexOf('://*.') !== -1) {
						cleanConditionRemMiddle = cleanConditionRemMiddle.replace('//*.', '://');
					}

					if (cleanConditionRemMiddle.endsWith('*')) {
						cleanCondition = cleanCondition.substring(0, cleanCondition.length - 2);
						cleanConditionRemMiddle = cleanConditionRemMiddle.substring(0, cleanCondition.length - 2);
					}

					if (cleanConditionRemMiddle.indexOf('*') !== -1) {
						// (/*/) is supported, lets remove them and check again for other rules)
						cleanConditionRemMiddle = cleanCondition.replace(/\/\*\//g, '/');

						if (cleanConditionRemMiddle.indexOf('*') !== -1) {
							// still there is some left
							// * in middle is not supported

							return {
								success: false,
							};
						}
					}
				}

				// source
				source = cleanCondition;

				if (cleanCondition.endsWith('/'))
					// no extra slash
					source = cleanCondition.substring(0, cleanCondition.length - 2);

				if (source.indexOf('://') !== -1) {
					pattern = `${source}/*`;
				} else {
					pattern = `*://*.${source}/*`;
				}

				break;

			case 'UrlRegexCondition':
				// not supported
				return {
					success: false,
				};
		}

		return {
			success: true,
			source: source,
			pattern: pattern,
			toString() {
				return `[${source} , ${pattern}]`;
			},
		};
	},
};

const externalAppRuleParser = {
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
	AutoProxy: {
		magicPrefix: 'W0F1dG9Qcm94',
		detect(text: string, acceptBase64: boolean = true): boolean {
			if (acceptBase64 && Utils.strStartsWith(text, externalAppRuleParser['AutoProxy'].magicPrefix)) {
				return true;
			} else if (Utils.strStartsWith(text, '[AutoProxy')) {
				return true;
			}
			return false;
		},
		preprocess(text: any) {
			if (Utils.strStartsWith(text, externalAppRuleParser['AutoProxy'].magicPrefix)) {
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
				if (line.length === 0 || line[0] === '!' || line[0] === '[') {
					continue;
				}
				source = line;
				profile = matchProfileName;
				list = normal_rules;
				if (line[0] === '@' && line[1] === '@') {
					profile = defaultProfileName;
					list = exclusive_rules;
					line = line.substring(2);
				}
				cond =
					line[0] === '/'
						? {
							conditionType: 'UrlRegexCondition',
							pattern: line.substring(1, line.length - 1),
						}
						: line[0] === '|'
							? line[1] === '|'
								? {
									conditionType: 'HostWildcardCondition',
									pattern: '*.' + line.substring(2),
									cleanCondition: line.substring(2),
								}
								: {
									conditionType: 'UrlWildcardCondition',
									pattern: line.substring(1) + '*',
									cleanCondition: line.substring(1),
								}
							: line.indexOf('*') < 0
								? {
									conditionType: 'KeywordCondition',
									pattern: line,
									cleanCondition: line,
								}
								: {
									conditionType: 'UrlWildcardCondition',
									pattern: 'http://*' + line + '*',
									cleanCondition: line,
								};
				list.push({
					condition: cond,
					profileName: profile,
					source: source,
				});
			}
			return exclusive_rules.concat(normal_rules);
		},
	},
	GFWList: {
		// -----------------------------------------------
		/*
		-----------------------------------------------
		AutoProxy Rules, from: https://github.com/gfwlist/gfwlist/wiki/Syntax
		-----------------------------------------------
		
		 GFWList syntax originated from ABP filters.
		
			|: Stands for matching from beginning (In URI, it's scheme): e.g.|http://example.com will match:
		
		http://example.com
		http://example.com/page
		http://example.com.co
		
		It will NOT match (replace www with any subdomain):
		
		http://www.example.com
		https://example.com/page
		https://example.com
		https://www.example.com
		https://example.com.co
		
		Same applied to |https://example.com.
		
			||: Stands for matching specific URI, in such a case, no need to write down scheme, e.g. ||example.com will match (replace www with any subdomain):
		
		http://example.com
		http://www.example.com
		https://example.com
		https://www.example.com
		
		It will NOT match:
		
		http://anotherexample.com
		https://anotherexample.com
		http://example.com.co
		https://example.com.co
		
		Note that ABP supports ||example.com/sample to block ADs in both HTTP and HTTPS, but GFWList doesn't absorb this.
		
			!: Stands for comments. Line started with ! means NOTHING. This is often useful for rules which need to be kept for future use, or statements for some purposes, examples:
		
		! Checksum: ...
		!---------
		!---
		!###
		!!
		
		Note: Any characters after ! are treated as NOTHING irrespective of how tricky, convoluted and far extended, they will NOT be parsed if in one line, but in order to keep the list sorted and regular, GFWList uses a variety of different comment styles.
		
			@@: Stands for whitelist rules. Although GFWList was designed to conform to the GFW mechanisms, it still has consideration of whitelist since sometimes there are some exceptions under special circumstances. Thus take a look at this example:
		
		.example.com
		@@|http://sub.example.com
		
		It means example.com is suffering a block while http://sub.example.com is not brought in.
		
		Imagine there is a domain example.org, it has 8 subdomains albeit 7 of them are blocked due to whatever reason, only sub.example.org is available. In such a case, rules can be written as:
		
		|http://1.example.org
		|http://2.example.org
		|http://3.example.org
		|http://4.example.org
		|http://5.example.org
		|http://6.example.org
		|http://7.example.org
		
		Granting that these above is correct, they are still not space saving. A better solution is:
		
		.example.org
		@@|http://8.example.org
		
		In stark contrast, the latter one is always better.
		
		---------------------------------------------------
		---------------------------------------------------
		In addition:

		--------
		Dot (.):
		A line starting with a dot (.) should match domain and its subdomains including the path.
		For example: ".example.com/quiz?no=1" should match the followings:
		
		http://example.com/quiz?no=1
		https://example.com/quiz?no=1&page=2
		http://www.example.com/quiz?no=1&page=2
		https://test.example.com/quiz?no=1

		Will not match:
		
		http://example.com.au/quiz?no=1
		https://example.com/quiz
		https://test.example.com/quiz

		------------
		Simple line:
		A line that has not any condition should match domain and its path.
		For example: "example.com/quiz?no=1" should match the followings:
		
		http://example.com/quiz?no=1
		https://example.com/quiz?no=1&page=2

		Will not match:
		
		http://example.com.au/quiz?no=1
		https://example.com/quiz
		https://test.example.com/quiz
		http://www.example.com/quiz?no=1&page=2
		https://test.example.com/quiz?no=1

		 */

		detect(text: string, acceptBase64: boolean = true): boolean {
			if (acceptBase64 && Utils.strStartsWith(text, externalAppRuleParser['AutoProxy'].magicPrefix)) {
				return true;
			} else if (Utils.strStartsWith(text, '[AutoProxy')) {
				return true;
			}
			return false;
		},
		parse(
			text: any,
		): {
			_debug: any[];
			whiteList: SubscriptionProxyRule[];
			blackList: SubscriptionProxyRule[];
		} {
			text = text.trim();

			let whiteList: SubscriptionProxyRule[] = [];
			let blackList: SubscriptionProxyRule[] = [];
			let _debug = [];

			for (var line of text.split(/\n|\r/)) {
				line = line.trim();
				if (!line[0] || line[0] == '!' || line[0] == '[')
					continue;

				var converted = externalAppRuleParser.GFWList.convertLineRegex(line);
				if (!converted)
					continue;

				_debug.push(line + '\n' + converted.regex + ' \t\t Name:' + converted.name + '\n\n');
				if (line.startsWith('@@'))
					whiteList.push(converted);
				else
					blackList.push(converted);
			}
			return {
				_debug: _debug,
				whiteList: whiteList,
				blackList: blackList,
			};
		},
		convertLineRegex_OLD(
			line: string,
		): {
			regex: string;
			name: string;
			makeNameRandom: boolean;
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
					makeNameRandom: true,
				};
			}

			line = line.replace('*', '.+').replace('?', '\\?');
			line = line.replace('(', '\\(').replace(')', '\\)');

			if (line.startsWith('||')) {
				line = line.substring(2);
				line = line.replace('.', '\\.');

				return {
					regex: `^(?:https?|ftps?|wss?):\\/\\/(?:.+\\.)?${line}(?:[?#\\\/].*)?$`,
					name: line,
					makeNameRandom: false,
				};
			}
			if (line.startsWith('|')) {
				line = line.substring(1);
				line = line.replace('.', '\\.');

				return {
					regex: `^${line}.*`,
					name: line,
					makeNameRandom: false,
				};
			}
			if (line.startsWith('.')) {
				line = line.substring(1);
				line = line.replace('.', '\\.');

				return {
					regex: `:\/\/(?:.+\\.)?${line}(?:[?#\\\/].*)?$`,
					name: line,
					makeNameRandom: false,
				};
			}
			if (line.endsWith('|')) {
				line = line.substring(0, line.length - 1);
				line = line.replace('.', '\\.');

				return {
					regex: `.*${line}$`,
					name: line,
					makeNameRandom: false,
				};
			} else {
				line = line.replace('.', '\\.');
				return {
					regex: `.*${line}(?:[.?#\\\/].*)?$`,
					name: line,
					makeNameRandom: false,
				};
			}
		},
		convertLineRegex(line: string): SubscriptionProxyRule {
			if (line.startsWith('@@'))
				// white-list is not handled here
				line = line.substring(2);

			if (line.startsWith('/') && line.endsWith('/')) {
				line = line.substring(1, line.length - 1);
				// this is a regex expression, doesn't need processing
				return {
					regex: line,
					name: 'Regex-' + line.replace(/[\d\\d]*\W*/g, '') /** keeping only characters */,
					importedRuleType: ProxyRulesSubscriptionRuleType.RegexUrl,
				};
			}

			let hasSpecialChars = line.includes('*') || line.includes('(');

			function rectifyRegexChars() {
				line = line.replace('*', '.+').replace('?', '\\?');
				line = line.replace('(', '\\(').replace(')', '\\)');
				line = line.replace('.', '\\.');
			}

			if (line.startsWith('||')) {
				line = line.substring(2);

				if (hasSpecialChars) {
					rectifyRegexChars();

					return {
						regex: `^(?:https?|ftps?|wss?):\\/\\/(?:.+\\.)?${line}(?:[?#\\\/].*)?$`,
						name: line,
						importedRuleType: ProxyRulesSubscriptionRuleType.RegexUrl,
					};
				} else {
					return {
						search: line,
						name: line,
						importedRuleType: ProxyRulesSubscriptionRuleType.SearchDomainSubdomain,
					};
				}
			}
			if (line.startsWith('|')) {
				line = line.substring(1);

				if (hasSpecialChars) {
					rectifyRegexChars();

					return {
						regex: `^${line}.*`,
						name: line,
						importedRuleType: ProxyRulesSubscriptionRuleType.RegexUrl,
					};
				} else {
					return {
						search: line,
						name: line,
						importedRuleType: ProxyRulesSubscriptionRuleType.SearchUrl,
					};
				}
			}
			if (line.endsWith('|')) {
				line = line.substring(0, line.length - 1);
				rectifyRegexChars();

				return {
					regex: `.*${line}$`,
					name: line,
					importedRuleType: ProxyRulesSubscriptionRuleType.RegexUrl,
				};
			}
			if (line.startsWith('.')) {
				line = line.substring(1);
				if (hasSpecialChars) {
					rectifyRegexChars();

					return {
						regex: `:\/\/(?:.+\\.)?${line}(?:[?#\\\/].*)?$`,
						name: line,
						importedRuleType: ProxyRulesSubscriptionRuleType.RegexUrl,
					};
				} else {
					return {
						search: line,
						name: line,
						importedRuleType: ProxyRulesSubscriptionRuleType.SearchDomainSubdomainAndPath,
					};
				}
			} else {
				if (hasSpecialChars) {
					rectifyRegexChars();

					return {
						regex: `.*${line}(?:[.?#\\\/].*)?$`,
						name: line,
						importedRuleType: ProxyRulesSubscriptionRuleType.RegexUrl,
					};
				} else {
					return {
						search: line,
						name: line,
						importedRuleType: ProxyRulesSubscriptionRuleType.SearchDomainAndPath,
					};
				}
			}
		},
	},
	Switchy: {
		parseAndCompile(text: string): any {
			let switchy = ruleImporterSwitchyScript.RuleImporterSwitchy.switchy;
			let compiler = ruleImporterSwitchyScript.RuleImporterSwitchy.compiler;

			var parserName = switchy.getParser(text);
			var parser = switchy[parserName];
			if (!parser) {
				return null;
			}
			var parsedRules = parser(text, 'profile-name', 'default-profile-name');

			var compiledRules = compiler.compile({
				defaultProfileName: 'default-profile-name',
				profileName: 'profile-name',
				profileType: 'SwitchProfile',
				rules: parsedRules,
			});
			return compiledRules;
		},
		convertToSmartProxy(switchyCompiled: any[]): SubscriptionProxyRule[] {
			if (!switchyCompiled || !switchyCompiled.length) return [];

			let result: SubscriptionProxyRule[] = [];

			for (const compiled of switchyCompiled) {
				// no more or less than one args
				if (!compiled.args || compiled.args.length != 1) continue;
				let type = compiled.args[0];

				let regexSource;
				if (compiled.expression instanceof RegExp) {
					regexSource = compiled.expression.source;
				}
				else {
					regexSource = compiled.expression;
				}

				if (type == 'host') {
					result.push({
						name: compiled.source,
						regex: regexSource,
						importedRuleType: ProxyRulesSubscriptionRuleType.RegexHost,
					});
				} else if (type == 'url') {
					result.push({
						name: compiled.source,
						regex: regexSource,
						importedRuleType: ProxyRulesSubscriptionRuleType.RegexUrl,
					});
				}
			}

			return result;
		},
	},
};
// -----------------------------------------------
// -----------------------------------------------
// -----------------------------------------------
