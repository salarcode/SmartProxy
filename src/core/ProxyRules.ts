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
import { ProxyRuleType, CompiledProxyRule, ProxyRule, CompiledProxyRuleType, SubscriptionProxyRule, ProxyRulesSubscriptionRuleType, CompiledProxyRuleSource } from "./definitions";
import { Utils } from "../lib/Utils";

export class ProxyRules {

	private static compiledRulesList: CompiledProxyRule[] = [];
	private static compiledWhitelistRulesList: CompiledProxyRule[] = [];

	public static getCompiledRulesList(): CompiledProxyRule[] {
		return ProxyRules.compiledRulesList;
	}

	public static getCompiledWhitelistRulesList(): CompiledProxyRule[] {
		return ProxyRules.compiledWhitelistRulesList;
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

		let rule = new ProxyRule();
		rule.ruleType = ProxyRuleType.DomainSubdomain;
		rule.ruleSearch = domain;
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
		let compiledInfo = ProxyRules.compileRulesInternal(settings.proxyRules);
		let compiledList = compiledInfo?.compiledList ?? [];
		let whiteListCompiledList = compiledInfo?.compiledWhiteList ?? [];

		// the subscription rules
		if (settings.proxyRulesSubscriptions && settings.proxyRulesSubscriptions.length > 0) {

			for (const subscription of settings.proxyRulesSubscriptions) {
				if (!subscription.enabled)
					continue;

				if (subscription.whitelistRules &&
					subscription.whitelistRules.length > 0) {

					let whitelistRules = ProxyRules.compileRulesSubscription(subscription.whitelistRules, true);
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

	private static compileRulesSubscription(rules: SubscriptionProxyRule[], markAsWhitelisted: boolean = null): CompiledProxyRule[] {
		if (!rules)
			return;

		let compiledList: CompiledProxyRule[] = [];
		for (const rule of rules) {

			let newCompiled = new CompiledProxyRule();
			newCompiled.search = rule.search;
			newCompiled.compiledRuleSource = CompiledProxyRuleSource.Subscriptions;

			if (markAsWhitelisted === true)
				newCompiled.whiteList = true;

			switch (rule.importedRuleType) {
				case ProxyRulesSubscriptionRuleType.RegexHost:
					newCompiled.regex = new RegExp(rule.regex);
					newCompiled.compiledRuleType = CompiledProxyRuleType.RegexHost;
					break;

				case ProxyRulesSubscriptionRuleType.RegexUrl:
					newCompiled.regex = new RegExp(rule.regex);
					newCompiled.compiledRuleType = CompiledProxyRuleType.RegexUrl;
					break;

				case ProxyRulesSubscriptionRuleType.SearchUrl:
					newCompiled.compiledRuleType = CompiledProxyRuleType.SearchUrl;
					break;

				case ProxyRulesSubscriptionRuleType.SearchDomain:
					newCompiled.compiledRuleType = CompiledProxyRuleType.SearchDomain;
					break;

				case ProxyRulesSubscriptionRuleType.SearchDomainSubdomain:
					newCompiled.compiledRuleType = CompiledProxyRuleType.SearchDomainSubdomain;
					break;

				case ProxyRulesSubscriptionRuleType.SearchDomainAndPath:
					newCompiled.compiledRuleType = CompiledProxyRuleType.SearchDomainAndPath;
					break;

				case ProxyRulesSubscriptionRuleType.SearchDomainSubdomainAndPath:
					newCompiled.compiledRuleType = CompiledProxyRuleType.SearchDomainSubdomainAndPath;
					break;

				default:
					Debug.error('compileRulesSubscription: Invalid importedRuleType of ' + rule.importedRuleType);
					continue;
			}
			compiledList.push(newCompiled);
		}

		return compiledList;
	}

	private static compileRulesInternal(proxyRules: ProxyRule[]): {
		compiledList: CompiledProxyRule[],
		compiledWhiteList: CompiledProxyRule[]
	} {
		if (!proxyRules)
			return;

		let compiledList: CompiledProxyRule[] = [];
		let compiledWhiteList: CompiledProxyRule[] = [];

		for (let i = 0; i < proxyRules.length; i++) {
			const rule = proxyRules[i];

			if (!rule.enabled) continue;

			let newCompiled = new CompiledProxyRule();

			newCompiled.whiteList = rule.whiteList;
			newCompiled.sourceDomain = rule.sourceDomain;
			newCompiled.proxy = rule.proxy;
			newCompiled.compiledRuleSource = CompiledProxyRuleSource.Manual;

			switch (rule.ruleType) {
				case ProxyRuleType.Exact:
					newCompiled.search = rule.ruleExact.toLowerCase();
					newCompiled.compiledRuleType = CompiledProxyRuleType.Exact;
					break;

				case ProxyRuleType.DomainSubdomain:
					newCompiled.search = rule.ruleSearch.toLowerCase();
					newCompiled.compiledRuleType = CompiledProxyRuleType.SearchDomainSubdomain;
					break;

				case ProxyRuleType.MatchPatternHost:
					{
						let regex = Utils.matchPatternToRegExp(rule.rulePattern, false);
						if (regex == null)
							continue;
						newCompiled.regex = regex;
						newCompiled.compiledRuleType = CompiledProxyRuleType.RegexHost;
					}
					break;

				case ProxyRuleType.MatchPatternUrl:
					{
						let regex = Utils.matchPatternToRegExp(rule.rulePattern, true);
						if (regex == null)
							continue;
						newCompiled.regex = regex;
						newCompiled.compiledRuleType = CompiledProxyRuleType.RegexUrl;
					}
					break;

				case ProxyRuleType.RegexHost:
					{
						// This simple construction is good enough. TODO: This ^(?:)$ is not needed?
						newCompiled.regex = new RegExp(rule.ruleRegex);
						newCompiled.compiledRuleType = CompiledProxyRuleType.RegexHost;
					}
					break;

				case ProxyRuleType.RegexUrl:
					{
						// This simple construction is good enough. TODO: This ^(?:)$ is not needed?
						newCompiled.regex = new RegExp(rule.ruleRegex);
						newCompiled.compiledRuleType = CompiledProxyRuleType.RegexUrl;
					}
					break;

				default:
					continue;
			}
			if (rule.whiteList) {
				compiledWhiteList.push(newCompiled);
			}
			else
				compiledList.push(newCompiled);
		}

		return {
			compiledList,
			compiledWhiteList
		};
	}


	public static findMatchForUrl(url: string): CompiledProxyRule | null {
		return ProxyRules.findMatchForUrlInternal(url, ProxyRules.compiledRulesList);
	}

	public static findWhitelistMatchForUrl(url: string): CompiledProxyRule | null {
		if (!ProxyRules.compiledWhitelistRulesList || ProxyRules.compiledWhitelistRulesList.length == 0)
			return null;
		return ProxyRules.findMatchForUrlInternal(url, ProxyRules.compiledWhitelistRulesList);
	}

	private static findMatchForUrlInternal(searchUrl: string, rules: CompiledProxyRule[]): CompiledProxyRule | null {
		let domainHost: string;
		let schemaLessUrl: string;
		let url = searchUrl.toLowerCase();

		try {
			for (let rule of rules) {

				switch (rule.compiledRuleType) {
					case CompiledProxyRuleType.Exact:

						if (url == rule.search)
							return rule;
						break;

					case CompiledProxyRuleType.RegexHost:

						if (domainHost == null) {
							domainHost = Utils.extractHostFromUrl(url);
							if (domainHost == null) {
								continue;
							}
						}

						if (rule.regex.test(domainHost))
							return rule;
						break;

					case CompiledProxyRuleType.RegexUrl:

						if (rule.regex.test(url))
							return rule;
						break;

					case CompiledProxyRuleType.SearchUrl:

						if (url.startsWith(rule.search))
							return rule;
						break;

					case CompiledProxyRuleType.SearchDomain:

						if (domainHost == null) {
							domainHost = Utils.extractHostFromUrl(url);
							if (domainHost == null) {
								continue;
							}
						}
						if (rule.search == domainHost)
							return rule;
						break;

					case CompiledProxyRuleType.SearchDomainSubdomain:

						if (domainHost == null) {
							domainHost = Utils.extractHostFromUrl(url);
							if (domainHost == null) {
								continue;
							}
						}
						// domain
						if (domainHost == rule.search)
							return rule;

						// subdomains
						if (domainHost.endsWith('.' + rule.search))
							return rule;

						break;

					case CompiledProxyRuleType.SearchDomainAndPath:

						if (schemaLessUrl == null) {
							schemaLessUrl = Utils.removeSchemaFromUrl(url);
							if (schemaLessUrl == null) {
								continue;
							}
						}
						if (schemaLessUrl.startsWith(rule.search))
							return rule;

						break;

					case CompiledProxyRuleType.SearchDomainSubdomainAndPath:

						if (schemaLessUrl == null) {
							schemaLessUrl = Utils.removeSchemaFromUrl(url);
							if (schemaLessUrl == null) {
								continue;
							}
						}
						if (schemaLessUrl.startsWith(rule.search))
							return rule;

						let ruleSearchHost = Utils.extractHostFromInvalidUrl(rule.search);
						if (ruleSearchHost != null) {

							if (domainHost == null) {
								domainHost = Utils.extractHostFromUrl(url);
								if (domainHost == null) {
									continue;
								}
							}

							// should be the same
							if (ruleSearchHost != domainHost && !domainHost.endsWith('.' + ruleSearchHost))
								continue;

							// after this state, we are sure that the url is for the same domain, now just checking the path
						}

						// subdomains
						if (schemaLessUrl.includes('.' + rule.search))
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
		rule: CompiledProxyRule
	} {
		return this.testSingleRuleInternal(domain, ProxyRules.compiledRulesList);
	}

	public static testSingleWhiteListRule(domain: string): {
		match: boolean,
		rule: CompiledProxyRule
	} {
		return this.testSingleRuleInternal(domain, ProxyRules.compiledWhitelistRulesList);
	}

	private static testSingleRuleInternal(domain: string, ruleList: CompiledProxyRule[]): {
		match: boolean,
		rule: CompiledProxyRule
	} {
		// the url should be complete
		let url = domain.toLowerCase();
		if (!url.includes(":/"))
			url = "http://" + url;
		let domainHost: string = null;
		let schemaLessUrl: string;

		for (let rule of ruleList) {

			switch (rule.compiledRuleType) {
				case CompiledProxyRuleType.Exact:
					if (url == rule.search)
						return {
							match: true,
							rule: rule
						};
					break;

				case CompiledProxyRuleType.RegexHost:

					if (domainHost == null) {
						domainHost = Utils.extractHostFromUrl(url);
						if (domainHost == null) {
							continue;
						}
					}

					if (rule.regex.test(domainHost))
						return {
							match: true,
							rule: rule
						};
					break;

				case CompiledProxyRuleType.RegexUrl:

					if (rule.regex.test(url))
						return {
							match: true,
							rule: rule
						};
					break;

				case CompiledProxyRuleType.SearchUrl:

					if (url.startsWith(rule.search))
						return {
							match: true,
							rule: rule
						};
					break;

				case CompiledProxyRuleType.SearchDomain:

					if (domainHost == null) {
						domainHost = Utils.extractHostFromUrl(url);
						if (domainHost == null) {
							continue;
						}
					}
					if (rule.search == domainHost)
						return {
							match: true,
							rule: rule
						};
					break;

				case CompiledProxyRuleType.SearchDomainSubdomain:

					if (domainHost == null) {
						domainHost = Utils.extractHostFromUrl(url);
						if (domainHost == null) {
							continue;
						}
					}
					// domain
					if (domainHost == rule.search)
						return {
							match: true,
							rule: rule
						};

					// subdomains
					if (domainHost.endsWith('.' + rule.search))
						return {
							match: true,
							rule: rule
						};

					break;

				case CompiledProxyRuleType.SearchDomainAndPath:

					if (schemaLessUrl == null) {
						schemaLessUrl = Utils.removeSchemaFromUrl(url);
						if (schemaLessUrl == null) {
							continue;
						}
					}

					if (schemaLessUrl.startsWith(rule.search))
						return {
							match: true,
							rule: rule
						};

					break;

				case CompiledProxyRuleType.SearchDomainSubdomainAndPath:

					if (schemaLessUrl == null) {
						schemaLessUrl = Utils.removeSchemaFromUrl(url);
						if (schemaLessUrl == null) {
							continue;
						}
					}

					if (schemaLessUrl.startsWith(rule.search))
						return {
							match: true,
							rule: rule
						};

					let ruleSearchHost = Utils.extractHostFromInvalidUrl(rule.search);
					if (ruleSearchHost != null) {

						if (domainHost == null) {
							domainHost = Utils.extractHostFromUrl(url);
							if (domainHost == null) {
								continue;
							}
						}

						// should be the same
						if (ruleSearchHost != domainHost && !domainHost.endsWith('.' + ruleSearchHost))
							continue;

						// after this state, we are sure that the url is for the same domain, now just checking the path
					}

					// subdomains
					if (schemaLessUrl.includes('.' + rule.search))
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
		rule: CompiledProxyRule
	}[] {
		let result = [];

		for (const domain of domainList) {
			let url = domain.toLowerCase();

			// the url should be complete
			if (!url.includes(":/"))
				url = "http://" + url;
			let domainHost: string = null;
			let schemaLessUrl: string;
			let matchFound = false;

			for (const rule of ProxyRules.compiledRulesList) {
				let matched = false;
				let sourceDomain: string;

				switch (rule.compiledRuleType) {
					case CompiledProxyRuleType.Exact:

						if (url == rule.search)
							matched = true;

						break;

					case CompiledProxyRuleType.RegexHost:

						if (domainHost == null) {
							domainHost = Utils.extractHostFromUrl(url);
							if (domainHost == null) {
								continue;
							}
						}

						if (rule.regex.test(domainHost))
							matched = true;

						break;

					case CompiledProxyRuleType.RegexUrl:

						if (rule.regex.test(url))
							matched = true;
						break;

					case CompiledProxyRuleType.SearchUrl:

						if (url.startsWith(rule.search))
							matched = true;
						break;

					case CompiledProxyRuleType.SearchDomain:

						if (domainHost == null) {
							domainHost = Utils.extractHostFromUrl(url);
							if (domainHost == null) {
								continue;
							}
						}

						if (rule.search == domainHost) {
							matched = true;
							sourceDomain = rule.search;
						}
						break;

					case CompiledProxyRuleType.SearchDomainSubdomain:

						if (domainHost == null) {
							domainHost = Utils.extractHostFromUrl(url);
							if (domainHost == null) {
								continue;
							}
						}

						// domain
						if (domainHost == rule.search) {
							matched = true;
							sourceDomain = rule.search;
						}
						// subdomains
						else if (domainHost.endsWith('.' + rule.search)) {
							matched = true;
							sourceDomain = rule.search;
						}

						break;

					case CompiledProxyRuleType.SearchDomainAndPath:

						if (schemaLessUrl == null) {
							schemaLessUrl = Utils.removeSchemaFromUrl(url);
							if (schemaLessUrl == null) {
								continue;
							}
						}

						if (schemaLessUrl.startsWith(rule.search))
							matched = true;

						break;

					case CompiledProxyRuleType.SearchDomainSubdomainAndPath:

						if (schemaLessUrl == null) {
							schemaLessUrl = Utils.removeSchemaFromUrl(url);
							if (schemaLessUrl == null) {
								continue;
							}
						}

						if (schemaLessUrl.startsWith(rule.search))
							matched = true;

						else {

							let ruleSearchHost = Utils.extractHostFromInvalidUrl(rule.search);
							if (ruleSearchHost != null) {

								if (domainHost == null) {
									domainHost = Utils.extractHostFromUrl(url);
									if (domainHost == null) {
										continue;
									}
								}

								// should be the same
								if (ruleSearchHost != domainHost && !domainHost.endsWith('.' + ruleSearchHost))
									continue;

								// after this state, we are sure that the url is for the same domain, now just checking the path
							}

							// subdomains
							if (schemaLessUrl.includes('.' + rule.search))
								matched = true;
						}
						break;
				}

				if (matched) {
					result.push({
						match: true,
						domain: domain,
						sourceDomain: rule.sourceDomain ?? sourceDomain,
						rule: rule
					});
					matchFound = true;
					break;
				}
			}

			// no matching rule found
			if (!matchFound) {
				result.push({
					domain: domain,
					match: false,
					sourceDomain: null,
					rule: null
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