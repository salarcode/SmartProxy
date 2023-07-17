/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2023 Salar Khalilzadeh <salar2k@gmail.com>
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
import { ProxyRuleType, CompiledProxyRule, ProxyRule, CompiledProxyRuleType, SubscriptionProxyRule, ProxyRulesSubscriptionRuleType, CompiledProxyRuleSource, CompiledProxyRulesInfo, CompiledProxyRulesMatchedSource, ProxyRuleSpecialProxyServer, SmartProfileBase } from "./definitions";
import { Utils } from "../lib/Utils";
import { SettingsOperation } from "./SettingsOperation";
import { api } from "../lib/environment";

export class ProxyRules {

	public static compileRules(profile: SmartProfileBase, proxyRules: ProxyRule[]): {
		compiledList: CompiledProxyRule[],
		compiledWhiteList: CompiledProxyRule[]
	} {
		if (!proxyRules)
			return;

		let compiledList: CompiledProxyRule[] = [];
		let compiledWhiteList: CompiledProxyRule[] = [];

		for (let i = 0; i < proxyRules.length; i++) {
			const rule = proxyRules[i];

			if (!rule.enabled)
				continue;

			let newCompiled = new CompiledProxyRule();

			newCompiled.ruleId = rule.ruleId;
			newCompiled.whiteList = rule.whiteList;
			newCompiled.hostName = rule.hostName;
			newCompiled.proxy = rule.proxy;
			if (rule.proxyServerId == ProxyRuleSpecialProxyServer.DefaultGeneral) {
				newCompiled.proxy = null;
			} else if (rule.proxyServerId == ProxyRuleSpecialProxyServer.ProfileProxy) {
				if (profile.profileProxyServerId) {
					// the proxy is derived from profile
					let profileProxy = SettingsOperation.findProxyServerById(profile.profileProxyServerId);
					if (profileProxy) {
						newCompiled.proxy = profileProxy;
					}
				}
			}

			newCompiled.compiledRuleSource = CompiledProxyRuleSource.Rules;

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

	public static compileRulesSubscription(rules: SubscriptionProxyRule[], markAsWhitelisted: boolean = null): CompiledProxyRule[] {
		if (!rules)
			return [];

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

	public static findMatchedDomainListInRulesInfo(domainList: string[], compiledRules: CompiledProxyRulesInfo): {
		compiledRule: CompiledProxyRule,
		matchedRuleSource: CompiledProxyRulesMatchedSource
	}[] {
		let result = [];
		for (const domain of domainList) {

			let matchResult = ProxyRules.findMatchedDomainInRulesInfo(domain, compiledRules);
			result.push(matchResult);
		}

		return result;
	}

	public static findMatchedDomainInRulesInfo(searchDomain: string, compiledRules: CompiledProxyRulesInfo): {
		compiledRule: CompiledProxyRule,
		matchedRuleSource: CompiledProxyRulesMatchedSource
	} | null {
		let url = searchDomain.toLowerCase();
		if (!url.includes(":/"))
			url = "http://" + url;

		return ProxyRules.findMatchedUrlInRulesInfo(url, compiledRules);
	}

	public static findMatchedUrlInRulesInfo(searchUrl: string, compiledRules: CompiledProxyRulesInfo): {
		compiledRule: CompiledProxyRule,
		matchedRuleSource: CompiledProxyRulesMatchedSource
	} | null {
		// user skip the bypass rules
		let userWhitelistMatchedRule = ProxyRules.findMatchedUrlInRules(searchUrl, compiledRules.WhitelistRules)
		if (userWhitelistMatchedRule) {
			return {
				compiledRule: userWhitelistMatchedRule,
				matchedRuleSource: CompiledProxyRulesMatchedSource.WhitelistRules
			};
		}

		// user bypass rules
		let userMatchedRule = ProxyRules.findMatchedUrlInRules(searchUrl, compiledRules.Rules);
		if (userMatchedRule) {
			return {
				compiledRule: userMatchedRule,
				matchedRuleSource: CompiledProxyRulesMatchedSource.Rules
			};
		}

		// subscription skip bypass rules
		let subWhitelistMatchedRule = ProxyRules.findMatchedUrlInRules(searchUrl, compiledRules.WhitelistSubscriptionRules)
		if (subWhitelistMatchedRule) {
			return {
				compiledRule: subWhitelistMatchedRule,
				matchedRuleSource: CompiledProxyRulesMatchedSource.WhitelistSubscriptionRules
			};
		}

		// subscription bypass rules
		let subMatchedRule = ProxyRules.findMatchedUrlInRules(searchUrl, compiledRules.SubscriptionRules);
		if (subMatchedRule) {
			return {
				compiledRule: subMatchedRule,
				matchedRuleSource: CompiledProxyRulesMatchedSource.SubscriptionRules
			};
		}

		return null;
	}

	public static findMatchedDomainRule(searchDomain: string, rules: CompiledProxyRule[]): CompiledProxyRule | null {
		let url = searchDomain.toLowerCase();
		if (!url.includes(":/"))
			url = "http://" + url;

		return ProxyRules.findMatchedUrlInRules(url, rules);
	}

	public static findMatchedUrlInRules(searchUrl: string, rules: CompiledProxyRule[]): CompiledProxyRule | null {
		if (rules == null || rules.length == 0)
			return null;

		let domainHost: string;
		let schemaLessUrl: string;
		let url = searchUrl.toLowerCase();

		try {
			for (let rule of rules) {

				switch (rule.compiledRuleType) {
					case CompiledProxyRuleType.SearchDomainSubdomain:

						if (domainHost == null) {
							domainHost = Utils.extractHostNameFromUrl(url);
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

					case CompiledProxyRuleType.Exact:

						if (url == rule.search)
							return rule;
						break;

					case CompiledProxyRuleType.RegexHost:

						if (domainHost == null) {
							domainHost = Utils.extractHostNameFromUrl(url);
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
							domainHost = Utils.extractHostNameFromUrl(url);
							if (domainHost == null) {
								continue;
							}
						}
						if (rule.search == domainHost)
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

						let ruleSearchHost = Utils.extractHostNameFromInvalidUrl(rule.search);
						if (ruleSearchHost != null) {

							if (domainHost == null) {
								domainHost = Utils.extractHostNameFromUrl(url);
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

			// if we have reached here no rule matched, but we might have a rule with domain and port
			// if we had a rule with domain, we need to check for port as well
			if (domainHost != null) {
				let domainHostWithPort = Utils.extractHostFromUrl(url);

				if (domainHostWithPort != domainHost) {

					// host has port part, doing a recheck
					domainHost = domainHostWithPort;

					for (let rule of rules) {

						// NOTE: Only rules that work on hostName should be checked, others can be ignored
						switch (rule.compiledRuleType) {

							case CompiledProxyRuleType.SearchDomainSubdomain:

								// domain
								if (domainHost == rule.search)
									return rule;

								// subdomains
								if (domainHost.endsWith('.' + rule.search))
									return rule;

								break;

							case CompiledProxyRuleType.RegexHost:

								if (rule.regex.test(domainHost))
									return rule;
								break;

							case CompiledProxyRuleType.SearchDomain:

								if (rule.search == domainHost)
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
									// should be the same
									if (ruleSearchHost != domainHost && !domainHost.endsWith('.' + ruleSearchHost))
										continue;

									// after this state, we are sure that the url is for the same domain, now just checking the path
								}

								// subdomains
								if (schemaLessUrl.includes('.' + rule.search))
									return rule;
								break;

							case CompiledProxyRuleType.Exact:
							case CompiledProxyRuleType.RegexUrl:
							case CompiledProxyRuleType.SearchUrl:
							case CompiledProxyRuleType.SearchDomainAndPath:
								break;
						}
					}
				}
			}
		} catch (e) {
			Debug.warn(`findMatchForUrl failed for ${url}`, e);
		}
		return null;
	}

	public static validateRule(rule: ProxyRule): {
		success: boolean, exist?: boolean, message?: string,
		result?: any
	} {
		if (rule.hostName) {
			if (!Utils.isValidHost(rule.hostName)) {
				// 'source' is not valid '${rule.source}
				return { success: false, message: api.i18n.getMessage("settingsRuleSourceInvalidFormat").replace("{0}", rule.hostName) };
			}
		}

		if (!rule.rule)
			// Rule doesn't have pattern defined
			return { success: false, message: api.i18n.getMessage("settingsRulePatternIsEmpty") };

		if (rule["enabled"] == null)
			rule.enabled = true;

		return { success: true };
	}
}