/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2022 Salar Khalilzadeh <salar2k@gmail.com>
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
import { api, environment } from '../lib/environment';
import { Debug, DiagDebug } from '../lib/Debug';
import {
	BrowserProxySettingsType as FirefoxProxySettingsType,
	ProxyServer,
	SpecialRequestApplyProxyMode,
	ProxyableLogDataType,
	CompiledProxyRule,
	SmartProfileType,
	ProxyableProxifiedStatus,
	ProxyableMatchedRuleStatus,
	CompiledProxyRuleSource,
} from './definitions';
import { ProxyRules } from './ProxyRules';
import { TabDataType, TabManager } from './TabManager';
import { PolyFill } from '../lib/PolyFill';
import { Settings } from './Settings';
import { ProxyEngineSpecialRequests } from './ProxyEngineSpecialRequests';
import { TabRequestLogger } from './TabRequestLogger';

const apiLib = api;

export class ProxyEngineFirefox {
	/** If Firefox API available, registers proxy */
	public static register(): boolean {
		if (apiLib['proxy'] && apiLib.proxy['onRequest']) {
			// onRequest is Used for HTTP and HTTPS protocols only (WSS included), source: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/RequestFilter
			// Smart features are available here only
			apiLib.proxy.onRequest.addListener(ProxyEngineFirefox.handleProxyRequest, {
				urls: ['*://*/*', 'ws://*/*', 'wss://*/*', 'ftp://*/*'],
			});

			apiLib.proxy.onError.addListener(ProxyEngineFirefox.onProxyError);

			return true;
		}
		return false;
	}

	public static updateFirefoxProxyConfig() {
		let settingsActive = Settings.active;

		let proxySettings = {
			proxyType: FirefoxProxySettingsType.system,
		};

		switch (settingsActive.activeProfile.profileType) {
			case SmartProfileType.Direct:
			case SmartProfileType.SmartRules:
			case SmartProfileType.AlwaysEnabledBypassRules:
			case SmartProfileType.IgnoreFailureRules:
				proxySettings.proxyType = FirefoxProxySettingsType.none;
				break;

			case SmartProfileType.SystemProxy:
				proxySettings.proxyType = FirefoxProxySettingsType.system;
				break;
		}

		if (environment.notAllowed.setProxySettings)
			return;

		PolyFill.browserSetProxySettings(
			{
				value: proxySettings,
			},
			function () {
				// reset the values
				environment.notSupported.setProxySettings = false;
				environment.notAllowed.setProxySettings = false;
			},
			function (error: Error) {
				Debug.error('updateFirefoxProxyConfig failed to set proxy settings', proxySettings, error?.message);
				if (error && error['message']) {
					if (error.message.includes('not supported'))
						environment.notSupported.setProxySettings = true;
					if (error.message.includes('permission'))
						environment.notAllowed.setProxySettings = true;
				}
			}
		);
	}

	private static handleProxyRequest(requestDetails: any) {
		/* requestDetails->
			documentUrl: "http://socialshare.ir/admin/media-promote"
			frameAncestors: undefined
			frameId: 0
			fromCache: false
			method: "GET"
			originUrl: "http://socialshare.ir/admin/media-promote"
			parentFrameId: -1
			requestId: "2752"
			tabId: -1
			timeStamp: 1545452060641
			type: "speculative"
			url: "http://socialshare.ir/admin/media-promote"
			*/

		let proxyLog: ProxyableLogDataType = new ProxyableLogDataType();
		proxyLog.tabId = requestDetails.tabId;
		proxyLog.url = requestDetails.url;
		proxyLog.matchedRuleStatus = ProxyableMatchedRuleStatus.NoneMatched;
		proxyLog.proxifiedStatus = ProxyableProxifiedStatus.NoProxy;

		let settings = Settings.current;
		let settingsActive = Settings.active;
		let currentProxyServer = settingsActive.currentProxyServer;

		let result = (() => {
			if (!requestDetails.url)
				return { type: 'direct' };

			let activeProfile = settingsActive.activeProfile;
			let activeProfileType = activeProfile.profileType;

			// checking if request is special
			let specialRequest = ProxyEngineSpecialRequests.retrieveSpecialUrlMode(requestDetails.url, true);
			if (specialRequest !== null) {
				proxyLog.matchedRuleStatus = ProxyableMatchedRuleStatus.Special;
				proxyLog.proxifiedStatus = ProxyableProxifiedStatus.NoProxy;


				if (specialRequest.applyMode == SpecialRequestApplyProxyMode.NoProxy)
					return { type: 'direct' };

				if (specialRequest.applyMode == SpecialRequestApplyProxyMode.CurrentProxy) {
					if (currentProxyServer) {
						proxyLog.proxifiedStatus = ProxyableProxifiedStatus.Special;
						return ProxyEngineFirefox.getResultProxyInfo(currentProxyServer);
					} else {
						return { type: 'direct' };
					}
				}

				if (specialRequest.applyMode == SpecialRequestApplyProxyMode.SelectedProxy && specialRequest.selectedProxy) {
					proxyLog.proxifiedStatus = ProxyableProxifiedStatus.Special;
					return ProxyEngineFirefox.getResultProxyInfo(specialRequest.selectedProxy);
				}
			}

			let tabData: TabDataType = null;
			if (requestDetails.tabId > -1) {
				tabData = TabManager.getTab(requestDetails.tabId);

				if (tabData != null && tabData.incognito && settingsActive.activeIncognitoProfile != null) {
					const activeIncognitoProfile = settingsActive.activeIncognitoProfile;

					// in incognito tab/window switching to use the specified profile
					activeProfile = activeIncognitoProfile;
					activeProfileType = activeIncognitoProfile.profileType;
				}
			}

			if (activeProfileType === SmartProfileType.Direct ||
				// Direct proxy profile is selected or
				// if there is no active server, skip everything
				!currentProxyServer)
				return { type: 'direct' };

			if (activeProfileType === SmartProfileType.SystemProxy) {
				// system proxy mode is not handled here
				proxyLog.matchedRuleStatus = ProxyableMatchedRuleStatus.NoneMatched;
				proxyLog.proxifiedStatus = ProxyableProxifiedStatus.SystemProxyApplied;
				return { type: 'direct' };
			}

			// applying ProxyPerOrigin
			if (tabData != null && settings.options.proxyPerOrigin) {

				if (tabData != null && tabData.proxified) {
					if (!requestDetails.documentUrl) {
						// document url is being changed, resetting the settings for that
						tabData.proxified = false;
						tabData.proxyServerFromRule = null;
						tabData.proxifiedParentDocumentUrl = null;
					} else {

						proxyLog.ruleHostName = tabData.proxyRuleHostName;

						if (tabData.proxyMatchedRule) {
							proxyLog.ruleSource = CompiledProxyRuleSource.Rules;

							proxyLog.applyFromRule(tabData.proxyMatchedRule);
						}

						if (tabData.proxyServerFromRule) {
							if (tabData.proxyServerFromRule.username)
								// Requires authentication. Mark as special and store authentication info.
								ProxyEngineSpecialRequests.setSpecialUrl(
									`${tabData.proxyServerFromRule.host}:${tabData.proxyServerFromRule.port}`,
									null,
									tabData.proxyServerFromRule,
								);

							// changing the active proxy server
							currentProxyServer = tabData.proxyServerFromRule;
						}

						proxyLog.matchedRuleStatus = ProxyableMatchedRuleStatus.ProxyPerOrigin;
						proxyLog.proxifiedStatus = ProxyableProxifiedStatus.ProxyPerOrigin;

						// TODO: since we do not return here anymore, check effects of `proxyLog.proxied = true`
						return ProxyEngineFirefox.getResultProxyInfo(currentProxyServer);
					}
				}
			}

			if (activeProfileType == SmartProfileType.AlwaysEnabledBypassRules) {
				// NOTE: by default a proxy is applied in AlwaysEnabled profile

				let compiledRules = settingsActive.activeProfile.compiledRules;

				// user skip the bypass rules/ don't apply proxy
				let userMatchedRule = ProxyRules.findMatchedUrlInRules(requestDetails.url, compiledRules.Rules);
				if (userMatchedRule) {
					proxyLog.ruleSource = CompiledProxyRuleSource.Rules;
					return makeResultForAlwaysEnabledForced(userMatchedRule)
				}

				// user bypass rules/ apply proxy by force
				let userWhitelistMatchedRule = ProxyRules.findMatchedUrlInRules(requestDetails.url, compiledRules.WhitelistRules)
				if (userWhitelistMatchedRule) {
					proxyLog.ruleSource = CompiledProxyRuleSource.Rules;
					return makeResultForAlwaysEnabledBypassed(userWhitelistMatchedRule)
				}

				// subscription skip bypass rules/ don't apply proxy
				let subMatchedRule = ProxyRules.findMatchedUrlInRules(requestDetails.url, compiledRules.SubscriptionRules);
				if (subMatchedRule) {
					proxyLog.ruleSource = CompiledProxyRuleSource.Subscriptions;
					return makeResultForAlwaysEnabledForced(subMatchedRule)
				}

				// subscription bypass rules/ apply proxy by force
				let subWhitelistMatchedRule = ProxyRules.findMatchedUrlInRules(requestDetails.url, compiledRules.WhitelistSubscriptionRules)
				if (subWhitelistMatchedRule) {
					proxyLog.ruleSource = CompiledProxyRuleSource.Subscriptions;
					return makeResultForAlwaysEnabledBypassed(subWhitelistMatchedRule)
				}

				//** Always Enabled is forced by a rule, so other rules can't skip it */
				function makeResultForAlwaysEnabledForced(matchedRule: CompiledProxyRule): resultProxyInfo {

					proxyLog.matchedRuleStatus = ProxyableMatchedRuleStatus.AlwaysEnabledForcedByRules;
					proxyLog.proxifiedStatus = ProxyableProxifiedStatus.MatchedRule;
					proxyLog.applyFromRule(matchedRule);

					if (requestDetails.tabId > -1) {
						// storing the proxy & rule in tab
						ProxyEngineFirefox.storeTabProxyDetail(requestDetails, matchedRule);
					}

					if (matchedRule.proxy) {
						if (matchedRule.proxy.username)
							// Requires authentication. Mark as special and store authentication info.
							// TODO: use proxyAuthorizationHeader
							ProxyEngineSpecialRequests.setSpecialUrl(`${matchedRule.proxy.host}:${matchedRule.proxy.port}`, null, matchedRule.proxy);

						return ProxyEngineFirefox.getResultProxyInfo(matchedRule.proxy);
					}

					return ProxyEngineFirefox.getResultProxyInfo(currentProxyServer);
				}

				//** Always Enabled is bypassed by a rule */
				function makeResultForAlwaysEnabledBypassed(matchedRule: CompiledProxyRule): any {

					proxyLog.matchedRuleStatus = ProxyableMatchedRuleStatus.AlwaysEnabledByPassed;
					proxyLog.proxifiedStatus = ProxyableProxifiedStatus.NoProxy;
					proxyLog.applyFromRule(matchedRule);
					return { type: "direct" };
				}

				// no rule is matched, going with proxy
				proxyLog.matchedRuleStatus = ProxyableMatchedRuleStatus.NoneMatched;
				proxyLog.proxifiedStatus = ProxyableProxifiedStatus.AlwaysEnabled;
				return ProxyEngineFirefox.getResultProxyInfo(currentProxyServer);
			}

			if (activeProfileType == SmartProfileType.SmartRules) {
				// NOTE: by default no proxy is applied in SmartRules profile

				let compiledRules = settingsActive.activeProfile.compiledRules;

				// user whitelist rules/ don't apply proxy
				let userWhitelistMatchedRule = ProxyRules.findMatchedUrlInRules(requestDetails.url, compiledRules.WhitelistRules)
				if (userWhitelistMatchedRule) {
					proxyLog.ruleSource = CompiledProxyRuleSource.Rules;
					return makeResultForWhitelistRule(userWhitelistMatchedRule);
				}

				// user rules/ apply proxy
				let userMatchedRule = ProxyRules.findMatchedUrlInRules(requestDetails.url, compiledRules.Rules);
				if (userMatchedRule) {
					proxyLog.ruleSource = CompiledProxyRuleSource.Rules;
					return makeResultForMatchedRule(userMatchedRule);
				}

				// subscription whitelist rules/ dont' apply proxy
				let subWhitelistMatchedRule = ProxyRules.findMatchedUrlInRules(requestDetails.url, compiledRules.WhitelistSubscriptionRules)
				if (subWhitelistMatchedRule) {
					proxyLog.ruleSource = CompiledProxyRuleSource.Subscriptions;
					return makeResultForWhitelistRule(subWhitelistMatchedRule);
				}

				// subscription rules/ apply proxy
				let subMatchedRule = ProxyRules.findMatchedUrlInRules(requestDetails.url, compiledRules.SubscriptionRules);
				if (subMatchedRule) {
					proxyLog.ruleSource = CompiledProxyRuleSource.Subscriptions;
					return makeResultForMatchedRule(subMatchedRule);
				}

				/**
				 * Generate result for matched whitelist rule
				 */
				function makeResultForWhitelistRule(whitelistMatchedRule: CompiledProxyRule): any {
					proxyLog.matchedRuleStatus = ProxyableMatchedRuleStatus.Whitelisted;
					proxyLog.proxifiedStatus = ProxyableProxifiedStatus.NoProxy;
					proxyLog.applyFromRule(whitelistMatchedRule);

					return { type: 'direct' };
				}

				/**
				 * Generate result for matched proxy rule
				 */
				function makeResultForMatchedRule(matchedRule: CompiledProxyRule): resultProxyInfo {

					proxyLog.matchedRuleStatus = ProxyableMatchedRuleStatus.MatchedRule;
					proxyLog.proxifiedStatus = ProxyableProxifiedStatus.MatchedRule;
					proxyLog.applyFromRule(matchedRule);

					if (requestDetails.tabId > -1) {
						// storing the proxy & rule in tab
						ProxyEngineFirefox.storeTabProxyDetail(requestDetails, matchedRule);
					}

					if (matchedRule.proxy) {
						if (matchedRule.proxy.username)
							// Requires authentication. Mark as special and store authentication info.
							// TODO: use proxyAuthorizationHeader
							ProxyEngineSpecialRequests.setSpecialUrl(`${matchedRule.proxy.host}:${matchedRule.proxy.port}`, null, matchedRule.proxy);

						return ProxyEngineFirefox.getResultProxyInfo(matchedRule.proxy);
					}

					return ProxyEngineFirefox.getResultProxyInfo(currentProxyServer);
				}
			}

			if (activeProfileType == SmartProfileType.IgnoreFailureRules) {
				// NOTE: this is not a proxy profile, it is used elsewhere
				// No logic is needed here
			}

			proxyLog.matchedRuleStatus = ProxyableMatchedRuleStatus.NoneMatched;
			proxyLog.proxifiedStatus = ProxyableProxifiedStatus.NoProxy;

			// nothing matched
			return { type: 'direct' };
		})();

		DiagDebug?.trace("FF.handleProxyRequest", proxyLog.tabId, result, proxyLog.url, SmartProfileType[settingsActive.activeProfile?.profileType]);

		// notify the logger
		TabRequestLogger.notifyProxyableLog(proxyLog);
		return result;
	}

	private static storeTabProxyDetail(requestDetails: any, matchedRule: CompiledProxyRule) {
		// check if this is the top level request
		if (requestDetails.type !== 'main_frame') {
			return;
		}

		// tab is new, we need to create it
		let tabData = TabManager.getOrSetTab(requestDetails.tabId, true, requestDetails.url);
		if (tabData == null) {
			// never
			return;
		}

		// only the top-level
		if (
			requestDetails.url === tabData.url ||
			// on Firefox top-level doesn't have documentUrl
			!requestDetails.documentUrl
		) {

			// set `tabData.proxified = true` 
			TabManager.setTabDataProxied(tabData, requestDetails.url, matchedRule);
		}
	}

	private static getResultProxyInfo(proxyServer: ProxyServer): resultProxyInfo {
		switch (proxyServer.protocol) {
			case 'SOCKS5':
				// "socks" refers to the SOCKS5 protocol
				return {
					type: 'socks',
					host: proxyServer.host,
					port: proxyServer.port,
					proxyDNS: proxyServer.proxyDNS,
					username: proxyServer.username,
					password: proxyServer.password,
				};

			default:
			case 'HTTP':
			case 'HTTPS':
			case 'SOCKS4':
				return {
					type: proxyServer.protocol,
					host: proxyServer.host,
					port: proxyServer.port
				};
		}
	}

	private static onProxyError(error: Error) {
		Debug.error(`Proxy error: ${error.message}`, error);
	}
}

export interface resultProxyInfo {
	type: string;
	host: string;
	port: number;
	proxyDNS?: boolean;
	username?: string;
	password?: string;
	proxyAuthorizationHeader?: string;
}
