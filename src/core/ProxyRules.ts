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
import { ProxyRuleType, CompiledProxyRule, ProxyRule, CompiledProxyRuleType, SubscriptionProxyRule, CompiledProxyRuleSource, CompiledProxyRulesInfo, CompiledProxyRulesMatchedSource, ProxyRuleSpecialProxyServer, SmartProfileBase } from "./definitions";
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
						let regex = Utils.matchPatternToRegExp(rule.rulePattern, false, true);
						if (regex == null)
							continue;
						newCompiled.regex = regex;
						newCompiled.compiledRuleType = CompiledProxyRuleType.RegexHost;
					}
					break;

				case ProxyRuleType.MatchPatternUrl:
					{
						let regex = Utils.matchPatternToRegExp(rule.rulePattern, true, false);
						if (regex == null)
							continue;
						newCompiled.regex = regex;
						newCompiled.compiledRuleType = CompiledProxyRuleType.RegexUrl;
					}
					break;

				case ProxyRuleType.RegexHost:
					{
						// This simple construction is good enough. TODO: This ^(?:)$ is not needed?
						newCompiled.regex = new RegExp(rule.ruleRegex, "i");
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

				case ProxyRuleType.DomainExact:
					newCompiled.search = rule.ruleSearch.toLowerCase();
					newCompiled.compiledRuleType = CompiledProxyRuleType.SearchDomain;
					break;

				case ProxyRuleType.DomainAndPath:
					newCompiled.search = rule.ruleSearch.toLowerCase();
					newCompiled.compiledRuleType = CompiledProxyRuleType.SearchDomainAndPath;
					break;

				case ProxyRuleType.DomainSubdomainAndPath:
					newCompiled.search = rule.ruleSearch.toLowerCase();
					newCompiled.compiledRuleType = CompiledProxyRuleType.SearchDomainSubdomainAndPath;
					break;

				case ProxyRuleType.SearchUrl:
					newCompiled.search = rule.ruleSearch.toLowerCase();
					newCompiled.compiledRuleType = CompiledProxyRuleType.SearchUrl;
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

			newCompiled.compiledRuleType = rule.importedRuleType;

			switch (rule.importedRuleType) {
				case CompiledProxyRuleType.RegexHost:
					newCompiled.regex = new RegExp(rule.regex, "i");
					break;

				case CompiledProxyRuleType.RegexUrl:
					newCompiled.regex = new RegExp(rule.regex);
					break;

				case CompiledProxyRuleType.Exact:
				case CompiledProxyRuleType.SearchUrl:
				case CompiledProxyRuleType.SearchDomain:
				case CompiledProxyRuleType.SearchDomainSubdomain:
				case CompiledProxyRuleType.SearchDomainAndPath:
				case CompiledProxyRuleType.SearchDomainSubdomainAndPath:
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

		let domainHostLowerCase: string;
		let schemaLessUrlLowerCase: string;
		let lowerCaseUrl = searchUrl.toLowerCase();

		try {
			for (let rule of rules) {

				switch (rule.compiledRuleType) {
					case CompiledProxyRuleType.SearchDomainSubdomain:

						if (domainHostLowerCase == null) {
							domainHostLowerCase = Utils.extractHostNameFromUrl(lowerCaseUrl);
							if (domainHostLowerCase == null) {
								continue;
							}
						}
						// domain
						if (domainHostLowerCase == rule.search)
							return rule;

						// subdomains
						if (domainHostLowerCase.endsWith('.' + rule.search))
							return rule;

						break;

					case CompiledProxyRuleType.Exact:

						if (lowerCaseUrl == rule.search)
							return rule;
						break;

					case CompiledProxyRuleType.RegexHost:

						if (domainHostLowerCase == null) {
							domainHostLowerCase = Utils.extractHostNameFromUrl(lowerCaseUrl);
							if (domainHostLowerCase == null) {
								continue;
							}
						}

						if (rule.regex.test(domainHostLowerCase))
							return rule;
						break;

					case CompiledProxyRuleType.RegexUrl:
						// Using original url with case sensitivity
						if (rule.regex.test(searchUrl))
							return rule;
						break;

					case CompiledProxyRuleType.SearchUrl:

						if (lowerCaseUrl.startsWith(rule.search))
							return rule;
						break;

					case CompiledProxyRuleType.SearchDomain:

						if (domainHostLowerCase == null) {
							domainHostLowerCase = Utils.extractHostNameFromUrl(lowerCaseUrl);
							if (domainHostLowerCase == null) {
								continue;
							}
						}
						if (rule.search == domainHostLowerCase)
							return rule;
						break;

					case CompiledProxyRuleType.SearchDomainAndPath:

						if (schemaLessUrlLowerCase == null) {
							schemaLessUrlLowerCase = Utils.removeSchemaFromUrl(lowerCaseUrl);
							if (schemaLessUrlLowerCase == null) {
								continue;
							}
						}
						if (schemaLessUrlLowerCase.startsWith(rule.search))
							return rule;

						break;

					case CompiledProxyRuleType.SearchDomainSubdomainAndPath:

						if (schemaLessUrlLowerCase == null) {
							schemaLessUrlLowerCase = Utils.removeSchemaFromUrl(lowerCaseUrl);
							if (schemaLessUrlLowerCase == null) {
								continue;
							}
						}
						if (schemaLessUrlLowerCase.startsWith(rule.search))
							return rule;

						let ruleSearchHost = Utils.extractHostNameFromInvalidUrl(rule.search);
						if (ruleSearchHost != null) {

							if (domainHostLowerCase == null) {
								domainHostLowerCase = Utils.extractHostNameFromUrl(lowerCaseUrl);
								if (domainHostLowerCase == null) {
									continue;
								}
							}

							// should be the same
							if (ruleSearchHost != domainHostLowerCase && !domainHostLowerCase.endsWith('.' + ruleSearchHost))
								continue;

							// after this state, we are sure that the url is for the same domain, now just checking the path
						}

						// subdomains
						if (schemaLessUrlLowerCase.includes('.' + rule.search))
							return rule;
						break;
				}
			}

			// if we have reached here no rule matched, but we might have a rule with domain and port
			// if we had a rule with domain, we need to check for port as well
			if (domainHostLowerCase != null) {
				let domainHostWithPort = Utils.extractHostFromUrl(lowerCaseUrl);

				if (domainHostWithPort != domainHostLowerCase) {

					// host has port part, doing a recheck
					domainHostLowerCase = domainHostWithPort;

					for (let rule of rules) {

						// NOTE: Only rules that work on hostName should be checked, others can be ignored
						switch (rule.compiledRuleType) {

							case CompiledProxyRuleType.SearchDomainSubdomain:

								// domain
								if (domainHostLowerCase == rule.search)
									return rule;

								// subdomains
								if (domainHostLowerCase.endsWith('.' + rule.search))
									return rule;

								break;

							case CompiledProxyRuleType.RegexHost:

								if (rule.regex.test(domainHostLowerCase))
									return rule;
								break;

							case CompiledProxyRuleType.SearchDomain:

								if (rule.search == domainHostLowerCase)
									return rule;
								break;

							case CompiledProxyRuleType.SearchDomainSubdomainAndPath:

								if (schemaLessUrlLowerCase == null) {
									schemaLessUrlLowerCase = Utils.removeSchemaFromUrl(lowerCaseUrl);
									if (schemaLessUrlLowerCase == null) {
										continue;
									}
								}
								if (schemaLessUrlLowerCase.startsWith(rule.search))
									return rule;

								let ruleSearchHost = Utils.extractHostFromInvalidUrl(rule.search);
								if (ruleSearchHost != null) {
									// should be the same
									if (ruleSearchHost != domainHostLowerCase && !domainHostLowerCase.endsWith('.' + ruleSearchHost))
										continue;

									// after this state, we are sure that the url is for the same domain, now just checking the path
								}

								// subdomains
								if (schemaLessUrlLowerCase.includes('.' + rule.search))
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
			Debug.warn(`findMatchForUrl failed for ${searchUrl}`, e);
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