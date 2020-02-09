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
import { Settings } from "./Settings";
import { ProxyRuleType, CompiledRule, ProxyRule } from "./definitions";
import { Utils } from "../lib/Utils";

export class ProxyRules {

	private static compiledRulesList: CompiledRule[] = [];
	private static compiledWhitelistRulesList: CompiledRule[] = [];

	public static getCompiledRulesList(): CompiledRule[] {
		return ProxyRules.compiledRulesList;
	}

	public static toggleRuleByDomain(domain: string) {

		// the domain should be the source
		let rule = ProxyRules.getRuleBySource(domain);

		if (rule == null) {
			if (!Utils.isValidHost(domain))
				// this is an extra check!
				return;

			ProxyRules.addRuleByDomain(domain);
		} else {
			ProxyRules.removeRule(rule);
		}
	}
	public static enableByDomainList(domainList: string[]) {
		if (!domainList || !domainList.length)
			return;
		for (let domain of domainList) {
			ProxyRules.enableByDomain(domain);
		}
	}
	public static enableByDomain(domain: string): {
		success: boolean,
		message: string,
		rule: ProxyRule
	} {

		// current url should be valid
		if (!Utils.isValidHost(domain))
			// The selected domain is not valid
			return {
				success: false,
				message: browser.i18n.getMessage("settingsEnableByDomainInvalid"),
				rule: null
			};

		// the domain should be the source
		let rule: ProxyRule = ProxyRules.getRuleBySource(domain);

		if (rule != null) {
			// Rule for the domain already exists
			return {
				success: true,
				message: browser.i18n.getMessage("settingsEnableByDomainExists"),
				rule: rule
			};
		}

		rule = ProxyRules.addRuleByDomain(domain);

		return {
			success: true,
			message: null,
			rule: rule
		};
	}

	public static removeBySource(source: string): {
		success: boolean,
		message: string,
		rule: ProxyRule
	} {

		// get the rule for the source
		let rule: ProxyRule = ProxyRules.getRuleBySource(source);

		if (rule != null) {
			ProxyRules.removeRule(rule);

			return {
				success: true,
				message: null,
				rule: rule
			};
		}
		return {
			success: false,
			message: browser.i18n.getMessage("settingsNoRuleFoundForDomain").replace("{0}", source),
			rule: null
		};
	}

	/** >Finds the defined rule for the host */
	private static getRuleBySource(sourceDomain: string): ProxyRule {
		return Settings.current.proxyRules.find(rule => rule.sourceDomain == sourceDomain);
	}

	private static addRuleByDomain(domain: string): ProxyRule {

		let domainPattern = Utils.hostToMatchPattern(domain, false);

		let rule = new ProxyRule();
		rule.ruleType = ProxyRuleType.MatchPatternHost;
		rule.rulePattern = domainPattern;
		rule.autoGeneratePattern = true;
		rule.sourceDomain = domain;
		rule.enabled = true;
		rule.proxy = null;

		// add and save it
		ProxyRules.addRule(rule);

		return rule;
	}

	private static addRule(rule: ProxyRule) {
		Settings.current.proxyRules.push(rule);
	}

	private static removeRule(rule: ProxyRule) {
		let itemIndex = Settings.current.proxyRules.indexOf(rule);
		if (itemIndex > -1) {
			Settings.current.proxyRules.splice(itemIndex, 1);
		}
	}
	public static compileRules() {
		let settings = Settings.current;

		// the default rules
		let compiledList = ProxyRules.compileRulesInternal(settings.proxyRules);
		let whiteListCompiledList: CompiledRule[] = [];

		// the subscription rules
		if (settings.proxyRulesSubscriptions && settings.proxyRulesSubscriptions.length > 0) {

			for (const subscription of settings.proxyRulesSubscriptions) {

				if (subscription.whitelistRules &&
					subscription.whitelistRules.length > 0) {

					let whitelistRules = ProxyRules.compileRulesSubscription(subscription.whitelistRules);
					whiteListCompiledList = whitelistRules.concat(whiteListCompiledList);
				}

				if (subscription.proxyRules &&
					subscription.proxyRules.length > 0) {

					let proxyRules = ProxyRules.compileRulesSubscription(subscription.proxyRules);
					compiledList = compiledList.concat(proxyRules);
				}
			}
		}

		// apply the new rules
		ProxyRules.compiledRulesList = compiledList;
		ProxyRules.compiledWhitelistRulesList = whiteListCompiledList;
	}

	private static compileRulesSubscription(rules: string[]): CompiledRule[] {
		if (!rules)
			return;

		let compiledList: CompiledRule[] = [];
		for (const rule of rules) {

			let newCompiled = new CompiledRule();
			newCompiled.enabled = true;
			newCompiled.ruleType = ProxyRuleType.RegexUrl;

			newCompiled.regex = new RegExp(rule);

			compiledList.push(newCompiled);
		}

		return compiledList;
	}

	private static compileRulesInternal(proxyRules: ProxyRule[]): CompiledRule[] {
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

				case ProxyRuleType.MatchPatternHost:
					{
						let regex = Utils.matchPatternToRegExp(rule.rulePattern, false);
						if (regex == null)
							continue;
						newCompiled.regex = regex;
					}
					break;

				case ProxyRuleType.MatchPatternUrl:
					{
						let regex = Utils.matchPatternToRegExp(rule.rulePattern, true);
						if (regex == null)
							continue;
						newCompiled.regex = regex;
					}
					break;

				case ProxyRuleType.RegexHost:
				case ProxyRuleType.RegexUrl:
					{
						// This simple construction is good enough. This ^(?:)$ is not needed?
						newCompiled.regex = new RegExp(rule.ruleRegex);
					}
					break;

				default:
					continue;
			}

			compiledList.push(newCompiled);
		}

		return compiledList;
	}


	public static findMatchForUrl(url: string): ProxyRule | null {
		return ProxyRules.findMatchForUrlInternal(url, ProxyRules.compiledRulesList);
	}

	public static findWhitelistMatchForUrl(url: string): ProxyRule | null {
		if (!ProxyRules.compiledWhitelistRulesList || ProxyRules.compiledWhitelistRulesList.length == 0)
			return null;
		return ProxyRules.findMatchForUrlInternal(url, ProxyRules.compiledWhitelistRulesList);
	}

	private static findMatchForUrlInternal(url: string, rules: CompiledRule[]): ProxyRule | null {
		//var host = new URL(url).host;
		let lowerCaseUrl: string;
		let domainHost: string;

		try {
			for (let rule of rules) {

				switch (rule.ruleType) {
					case ProxyRuleType.Exact:
						if (lowerCaseUrl == null)
							lowerCaseUrl = url.toLowerCase();

						if (lowerCaseUrl == rule.ruleExact)
							return rule;
						break;

					case ProxyRuleType.MatchPatternHost:
					case ProxyRuleType.RegexHost:

						if (domainHost == null) {
							let urlHost = Utils.extractHostFromUrl(url);
							if (urlHost == null) {
								continue;
							}
							domainHost = urlHost.toLowerCase();
						}

						if (rule.regex.test(domainHost))
							return rule;
						break;

					case ProxyRuleType.MatchPatternUrl:
					case ProxyRuleType.RegexUrl:

						if (rule.regex.test(url))
							return rule;
						break;
				}
			}
		} catch (e) {
			Debug.warn(`findMatchForUrl failed for ${url}`, e);
		}
		return null;
	}

	public static testSingleRule(domain: string): {
		match: boolean,
		rule: ProxyRule
	} {
		// the url should be complete
		let url = domain;
		if (!url.includes(":/"))
			url = "http://" + url;
		let lowerCaseUrl: string;
		let domainHost: string = null;

		for (let rule of ProxyRules.compiledRulesList) {

			switch (rule.ruleType) {
				case ProxyRuleType.Exact:
					if (lowerCaseUrl == null)
						lowerCaseUrl = url.toLowerCase();
					if (lowerCaseUrl == rule.ruleExact)
						return {
							match: true,
							rule: rule
						};
					break;

				case ProxyRuleType.MatchPatternHost:
				case ProxyRuleType.RegexHost:

					if (domainHost == null) {
						let urlHost = Utils.extractHostFromUrl(url);
						if (urlHost == null) {
							continue;
						}
						domainHost = urlHost.toLowerCase();
					}

					if (rule.regex.test(domainHost))
						return {
							match: true,
							rule: rule
						};
					break;

				case ProxyRuleType.MatchPatternUrl:
				case ProxyRuleType.RegexUrl:

					if (rule.regex.test(url))
						return {
							match: true,
							rule: rule
						};
					break;
			}
		}
		return {
			match: false,
			rule: null
		}
	}

	public static testMultipleRule(domainList: string[]): {
		match: boolean,
		domain: string,
		sourceDomain: string,
		ruleText: string
	}[] {
		let result = [];

		for (const domain of domainList) {
			let url = domain;
			let lowerCaseUrl: string;

			// the url should be complete
			if (!url.includes(":/"))
				url = "http://" + url;
			let domainHost: string = null;
			let matchFound = false;

			for (const rule of ProxyRules.compiledRulesList) {

				switch (rule.ruleType) {
					case ProxyRuleType.Exact:
						if (lowerCaseUrl == null)
							lowerCaseUrl = url.toLowerCase();
						if (lowerCaseUrl == rule.ruleExact) {
							result.push({
								match: true,
								domain: domain,
								sourceDomain: rule.sourceDomain,
								ruleText: rule.rule
							});
							matchFound = true;
						}
						break;

					case ProxyRuleType.MatchPatternHost:
					case ProxyRuleType.RegexHost:

						if (domainHost == null) {
							let urlHost = Utils.extractHostFromUrl(url);
							if (urlHost == null) {
								continue;
							}
							domainHost = urlHost.toLowerCase();
						}

						if (rule.regex.test(domainHost)) {
							result.push({
								domain: domain,
								match: true,
								sourceDomain: rule.sourceDomain,
								ruleText: rule.rule
							});
							matchFound = true;
						}
						break;

					case ProxyRuleType.MatchPatternUrl:
					case ProxyRuleType.RegexUrl:

						if (rule.regex.test(url)) {
							result.push({
								domain: domain,
								match: true,
								sourceDomain: rule.sourceDomain,
								ruleText: rule.rule
							});
							matchFound = true;
						}
						break;
				}
			}

			// no matching rule found
			if (!matchFound) {
				result.push({
					domain: domain,
					match: false,
					sourceDomain: null,
					ruleText: null
				});
			}
		}

		return result;
	}

	public static validateRule(rule: ProxyRule): {
		success: boolean, exist?: boolean, message?: string,
		result?: any
	} {
		// 	proxyRules: [{ rule: "rule", host: "host", enabled: false }],
		if (!rule.sourceDomain) {
			// Rule 'source' is empty
			return { success: false, message: browser.i18n.getMessage("settingsRuleSourceIsEmpty") };
		} else {

			if (!Utils.isValidHost(rule.sourceDomain)) {
				// 'source' is not valid '${rule.source}
				return { success: false, message: browser.i18n.getMessage("settingsRuleSourceInvalidFormat").replace("{0}", rule.sourceDomain) };
			}
		}

		if (!rule.rule)
			// Rule doesn't have pattern defined
			return { success: false, message: browser.i18n.getMessage("settingsRulePatternIsEmpty") };

		if (rule["enabled"] == null)
			rule.enabled = true;

		return { success: true };
	}
}