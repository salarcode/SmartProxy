import { ProxyServer, CompiledProxyRule, SmartProfileType } from "./definitions";
import { api } from "../lib/environment";
import { Debug } from "../lib/Debug";
import { Settings } from "./Settings";

export class ProxyEngineChrome {

	/**  Chrome only. Updating Chrome proxy config. */
	public static updateChromeProxyConfig() {
		let settingsActive = Settings.active;
		
		if (settingsActive.activeProfile.profileType == SmartProfileType.SystemProxy) {

			let config = {
				mode: "system"
			};
			api.proxy.settings.set(
				{ value: config, scope: "regular" },
				function () {
					if (api.runtime.lastError) {
						Debug.error("updateChromeProxyConfig failed with ", api.runtime.lastError);
					}
				});
			return;
		}
		else if (settingsActive.activeProfile.profileType == SmartProfileType.Direct) {
			let config = {
				mode: "direct"
			};
			api.proxy.settings.set(
				{ value: config, scope: "regular" },
				function () {
					if (api.runtime.lastError) {
						Debug.error("updateChromeProxyConfig failed with ", api.runtime.lastError);
					}
				});
			return;
		}
		// generate PAC script specific to Chrome
		let pacScript = this.generateChromePacScript();

		let config = {
			mode: "pac_script",
			pacScript: {
				data: pacScript
			}
		};
		api.proxy.settings.set(
			{ value: config, scope: "regular" },
			function () {
				if (api.runtime.lastError) {
					Debug.error("updateChromeProxyConfig failed with ", api.runtime.lastError);
				}
			});
	}

	private static generateChromePacScript(): string {
		//let settings = Settings.current;
		let settingsActive = Settings.active;

		let profileType = settingsActive.activeProfile.profileType;
		let resultCurrentProxyServer = this.convertActiveProxyServer(settingsActive.currentProxyServer);

		let compiledRules = settingsActive.activeProfile.compiledRules;
		let compiledRules_WhitelistRules = this.regexHostArrayToString(compiledRules.WhitelistRules).join(",");
		let compiledRules_Rules = this.regexHostArrayToString(compiledRules.Rules).join(",");
		let compiledRules_WhitelistSubscriptionRules = this.regexHostArrayToString(compiledRules.WhitelistSubscriptionRules).join(",");
		let compiledRules_SubscriptionRules = this.regexHostArrayToString(compiledRules.SubscriptionRules).join(",");

		let pacTemplateString = `
const compiledRules = {
	/** User defined whitelist rules. P2 */
	WhitelistRules: [${compiledRules_WhitelistRules}],
	/** User defined rules. P1 */
	Rules: [${compiledRules_Rules}],
	/** Subscription whitelist rules. P3  */
	WhitelistSubscriptionRules: [${compiledRules_WhitelistSubscriptionRules}],
	/** Subscription rules. P4 */
	SubscriptionRules: [${compiledRules_SubscriptionRules}]
};
const SmartProfileType = {
	Direct: 0,
	SystemProxy: 1,
	SmartRules: 2,
	AlwaysEnabledBypassRules: 3,
	IgnoreFailureRules: 4,
}
const CompiledProxyRuleType = {
	RegexHost: 0,
	RegexUrl: 1,
	Exact: 2,
	SearchUrl: 3,
	SearchDomain: 4,
	SearchDomainSubdomain: 5,
	SearchDomainAndPath: 6,
	SearchDomainSubdomainAndPath: 7
}
const activeProfileType = +'${profileType}';
const currentProxyServer = "${resultCurrentProxyServer}";
const resultDirect = "DIRECT";
const resultSystem = "SYSTEM";
const verboseDiagnostics = false; // uncomment for verbose logs using chrome flag. https://support.google.com/chrome/a/answer/6271171?hl=en#zippy=%2Cview-network-data%2Cget-network-logs
// -------------------------
// required PAC function that will be called to determine
// if a proxy should be used.
function FindProxyForURL(url, host, noDiagnostics) {
	if (verboseDiagnostics && !noDiagnostics) {
		let finalResult = FindProxyForURL(url, host, true);
		alert('SmartProxy-FindProxyForURL-Result=' + finalResult + '; host=' + host + '; url=' + url + '; activeProfile=' + activeProfileType);
		return finalResult;
	}

	if (activeProfileType == SmartProfileType.SystemProxy)
		return resultSystem;

	if (activeProfileType == SmartProfileType.Direct)
		return resultDirect;

	// applying ProxyPerOrigin
	// not applicable for Chromium

	if (activeProfileType == SmartProfileType.AlwaysEnabledBypassRules) {

		// user skip the bypass rules/ don't apply proxy
		let userMatchedRule = findMatchedUrlInRules(url, host, compiledRules.Rules);
		if (userMatchedRule) {
			return makeResultForAlwaysEnabledForced(userMatchedRule)
		}

		// user bypass rules/ apply proxy by force
		let userWhitelistMatchedRule = findMatchedUrlInRules(url, host, compiledRules.WhitelistRules)
		if (userWhitelistMatchedRule) {
			return resultDirect;
		}

		// subscription skip bypass rules/ don't apply proxy
		let subMatchedRule = findMatchedUrlInRules(url, host, compiledRules.SubscriptionRules);
		if (subMatchedRule) {
			return makeResultForAlwaysEnabledForced(userMatchedRule)
		}

		// subscription bypass rules/ apply proxy by force
		let subWhitelistMatchedRule = findMatchedUrlInRules(url, host, compiledRules.WhitelistSubscriptionRules)
		if (subWhitelistMatchedRule) {
			return resultDirect;
		}

		//** Always Enabled is forced by a rule, so other rules can't skip it */
		function makeResultForAlwaysEnabledForced(matchedRule) {

			if (matchedRule.proxy)
				// this rule has its own proxy setup
				return matchedRule.proxy;
			return currentProxyServer;
		}

		// no rule is matched, going with proxy
		return currentProxyServer;
	}

	if (activeProfileType == SmartProfileType.SmartRules) {

		// user whitelist rules/ don't apply proxy
		let userWhitelistMatchedRule = findMatchedUrlInRules(url, host, compiledRules.WhitelistRules)
		if (userWhitelistMatchedRule) {
			return makeResultForWhitelistRule(userWhitelistMatchedRule);
		}

		// user rules/ apply proxy
		let userMatchedRule = findMatchedUrlInRules(url, host, compiledRules.Rules);
		if (userMatchedRule) {
			return makeResultForMatchedRule(userMatchedRule);
		}

		// subscription whitelist rules/ don't apply proxy
		let subWhitelistMatchedRule = findMatchedUrlInRules(url, host, compiledRules.WhitelistSubscriptionRules)
		if (subWhitelistMatchedRule) {
			return makeResultForWhitelistRule(subWhitelistMatchedRule);
		}

		// subscription rules/ apply proxy
		let subMatchedRule = findMatchedUrlInRules(url, host, compiledRules.SubscriptionRules);
		if (subMatchedRule) {
			return makeResultForMatchedRule(subMatchedRule);
		}

		/**
		 * Generate result for matched whitelist rule
		 */
		const makeResultForWhitelistRule = () => {
			return resultDirect;
		}

		/**
		 * Generate result for matched proxy rule
		 */
		function makeResultForMatchedRule(matchedRule) {
			if (matchedRule.proxy)
				// this rule has its own proxy setup
				return matchedRule.proxy;
			return currentProxyServer;
		}
	}

	if (activeProfileType == SmartProfileType.IgnoreFailureRules) {
		// NOTE: this is not a proxy profile, it is used elsewhere
		// No logic is needed here
	}

	// let the browser decide
	return "";
}

function findMatchedUrlInRules(searchUrl, domainHost, rules) {
	if (searchUrl == null || rules == null || rules.length == 0)
		return null;

	let schemaLessUrl = null;
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
						continue;
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
						continue;
					}
					if (rule.search == domainHost)
						return rule;
					break;

				case CompiledProxyRuleType.SearchDomainSubdomain:

					if (domainHost == null) {
						continue;
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
						schemaLessUrl = removeSchemaFromUrl(url);
						if (schemaLessUrl == null) {
							continue;
						}
					}
					if (schemaLessUrl.startsWith(rule.search))
						return rule;

					break;

				case CompiledProxyRuleType.SearchDomainSubdomainAndPath:
					{
						if (schemaLessUrl == null) {
							schemaLessUrl = removeSchemaFromUrl(url);
							if (schemaLessUrl == null) {
								continue;
							}
						}
						if (schemaLessUrl.startsWith(rule.search))
							return rule;

						let ruleSearchHost = extractHostFromInvalidUrl(rule.search);
						if (ruleSearchHost != null) {

							if (domainHost == null) {
								continue;
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
		}
	} catch (e) {
		console.warn('SmartProxy> findMatchForUrl failed for ' + url, e);
	}
	return null;
}

function removeSchemaFromUrl(url) {
	if (url == null)
		return url;
	const schemaSep = '://';
	let index = url.indexOf(schemaSep);
	if (index > -1)
		return url.substring(index + schemaSep.length, url.length);
	else
		return url;
}
function extractHostFromInvalidUrl(url) {
	try {
		if (!url.includes(":/"))
			url = 'http://' + url;

		return extractHostFromUrl(url);
	}
	catch (e) { return null; }
}
function extractHostFromUrl(url) {
	const matchPattern = (/^/i);

	const match = matchPattern.exec(url);
	if (!match) {
		return null;
	}
	const [, host] = match;
	return host;
}`;
		return pacTemplateString;
	};

	private static convertActiveProxyServer(proxyServer: ProxyServer): string {
		const resultDirect = "DIRECT";

		// invalid active proxy server
		if (!proxyServer || !proxyServer.host || !proxyServer.protocol || !proxyServer.port)
			return resultDirect;

		switch (proxyServer.protocol) {
			case "HTTP":
				return `PROXY ${proxyServer.host}:${proxyServer.port}`;

			case "HTTPS":
				return `HTTPS ${proxyServer.host}:${proxyServer.port}`;

			case "SOCKS4":
				return `SOCKS4 ${proxyServer.host}:${proxyServer.port}`;

			case "SOCKS5":
				return `SOCKS5 ${proxyServer.host}:${proxyServer.port}`;
		}

		// invalid proxy protocol
		return resultDirect;
	}

	private static regexHostArrayToString(compiledRules: CompiledProxyRule[]) {
		let compiledRulesAsStringArray = [];
		for (let index = 0; index < compiledRules.length; index++) {
			let rule = compiledRules[index];

			let search: string;
			if (rule.search) {
				search = `unescape('${escape(rule.search)}')`;
			}
			else
				search = 'null';

			if (rule.proxy) {
				compiledRulesAsStringArray.push(`{search:${search},regex:${rule.regex?.toString() || 'null'},compiledRuleType:${rule.compiledRuleType},proxy:"${this.convertActiveProxyServer(rule.proxy)}"}`);
			} else {
				compiledRulesAsStringArray.push(`{search:${search},regex:${rule.regex?.toString() || 'null'},compiledRuleType:${rule.compiledRuleType}}`);
			}
		}
		return compiledRulesAsStringArray;
	}
}