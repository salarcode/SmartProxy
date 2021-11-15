import { ProxyServer, CompiledProxyRule, SmartProfileType } from "./definitions";
import { chrome } from "../lib/environment";
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
			chrome.proxy.settings.set(
				{ value: config, scope: "regular" },
				function () {
					if (chrome.runtime.lastError) {
						Debug.error("updateChromeProxyConfig failed with ", chrome.runtime.lastError);
					}
				});
			return;
		}
		else if (settingsActive.activeProfile.profileType == SmartProfileType.Direct) {
			let config = {
				mode: "direct"
			};
			chrome.proxy.settings.set(
				{ value: config, scope: "regular" },
				function () {
					if (chrome.runtime.lastError) {
						Debug.error("updateChromeProxyConfig failed with ", chrome.runtime.lastError);
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
		chrome.proxy.settings.set(
			{ value: config, scope: "regular" },
			function () {
				if (chrome.runtime.lastError) {
					Debug.error("updateChromeProxyConfig failed with ", chrome.runtime.lastError);
				}
			});
	}

	private static generateChromePacScript(): string {
		//let settings = Settings.current;
		let settingsActive = Settings.active;

		//let compiledRules = settingsActive.activeProfile.compiledRules;
		let profileType = settingsActive.activeProfile.profileType;
		let resultActiveProxy = this.convertActiveProxyServer(settingsActive.activeProfile.profileProxyServer);

		let compiledRulesAsString = this.regexHostArrayToString([]).join(",");
		let compiledWhitelistAsString = this.regexHostArrayToString([]).join(",");
		let compiledBypass = '{}';
		let pacTemplateString = `const proxyMode = +"${profileType}";
const compiledRules = [${compiledRulesAsString}];
const compiledWhitelistRules = [${compiledWhitelistAsString}];
const bypass = ${compiledBypass};
const hasActiveProxyServer = ${((settingsActive.activeProfile.profileProxyServer) ? "true" : "false")};
const ProxyModeType = {
    Direct: 0,
    SmartProxy: 1,
    Always: 2,
    SystemProxy: 3
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
const resultActiveProxy = "${resultActiveProxy}";
const resultDirect = "DIRECT";
const resultSystem = "SYSTEM";
// -------------------------
// required PAC function that will be called to determine
// if a proxy should be used.
function FindProxyForURL(url, host) {
	// BUGFIX: we need implicit conversion (==) instead of (===), since proxy mode comes from different places and i'm lazy to track it
	if (proxyMode == ProxyModeType.Direct)
		return resultDirect;

	host = host.toLowerCase();

	if (proxyMode == ProxyModeType.Always) {
		// should bypass this host?
		if (bypass.enableForAlways === true &&
			bypass.bypassList.indexOf(host) !== -1)
			return resultDirect;
		else
			return resultActiveProxy;
	}

	try {
		if (compiledWhitelistRules.length > 0) {
			let matchedRule = FindProxyForUrlInternal(url, host, compiledWhitelistRules);
			if (matchedRule)
				return resultDirect;
		}
	} catch (e) {
		return "";
	}

	// in chrome system mode is not controlled here
	if (proxyMode == ProxyModeType.SystemProxy)
		// bypass list should be checked here if Chrome supported this model
		return resultSystem;

	// there should be active proxy
	if (!hasActiveProxyServer)
		// let the browser decide
		return "";

	try {
		let matchedRule = FindProxyForUrlInternal(url, host, compiledRules);
		if (matchedRule) {
			if (matchedRule.proxy)
				// this rule has its own proxy setup
				return matchedRule.proxy;
			return resultActiveProxy;
		}

	} catch (e) {
		return "";
	}

	// let the browser decide
	return "";
}

function FindProxyForUrlInternal(url, host, compiledRules) {
	if (!compiledRules)
		return null;

	let lowerCaseUrl;
	let schemaLessUrl;
	for (let i = 0; i < compiledRules.length; i++) {
		let rule = compiledRules[i];
		let matched = false;

		switch (+rule.ruleType) {
			case CompiledProxyRuleType.Exact:
				if (lowerCaseUrl == null)
					lowerCaseUrl = url.toLowerCase();

				if (lowerCaseUrl == rule.search)
					matched = true;
				break;

			case CompiledProxyRuleType.RegexHost:

				if (rule.regex.test(host))
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

				if (rule.search == host)
					matched = true;
				break;

			case CompiledProxyRuleType.SearchDomainSubdomain:

				// domain
				if (host == rule.search)
					matched = true;

				// subdomains
				else if (host.endsWith('.' + rule.search))
					matched = true;

				break;

			case CompiledProxyRuleType.SearchDomainAndPath:

				if (schemaLessUrl == null) {
					schemaLessUrl = removeSchemaFromUrl(url);
					if (schemaLessUrl == null) {
						continue;
					}
					schemaLessUrl = schemaLessUrl.toLowerCase();
				}

				if (schemaLessUrl.startsWith(rule.search))
					matched = true;

				break;

			case CompiledProxyRuleType.SearchDomainSubdomainAndPath:

				if (schemaLessUrl == null) {
					schemaLessUrl = removeSchemaFromUrl(url);
					if (schemaLessUrl == null) {
						continue;
					}
					schemaLessUrl = schemaLessUrl.toLowerCase();
				}

				if (schemaLessUrl.startsWith(rule.search))
					matched = true;

				else {

					let ruleSearchHost = extractHostFromInvalidUrl(rule.search);
					if (ruleSearchHost != null) {

						// should be the same
						if (ruleSearchHost != host && !host.endsWith('.' + ruleSearchHost))
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
			return rule;
		}
	}
	// nothing found
	return null;
}

function removeSchemaFromUrl(url) {
	if (url == null)
		return url;
	const schemaSep = '://';
	const schemaSepLength = 3;
	let index = url.indexOf(schemaSep);
	if (index > -1)
		return url.substr(index + schemaSepLength, url.length - (index + schemaSepLength));
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
	const matchPattern = (/^(?:(?:\\*|https?|file|ftp|app):\\/\\/(\\*|(?:\\*\\.)?[^\\/\\*?&#]+|)\\/?(?:.*))$/i);

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
				compiledRulesAsStringArray.push(`{search:${search},regex:${rule.regex?.toString() ?? 'null'},ruleType:${rule.compiledRuleType},proxy:"${this.convertActiveProxyServer(rule.proxy)}"}`);
			} else {
				compiledRulesAsStringArray.push(`{search:${search},regex:${rule.regex?.toString() ?? 'null'},ruleType:${rule.compiledRuleType}}`);
			}
		}
		return compiledRulesAsStringArray;
	}
}