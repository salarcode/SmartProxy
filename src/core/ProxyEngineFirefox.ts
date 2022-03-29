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
import { browser, environment } from "../lib/environment";
import { Debug } from "../lib/Debug";
import { ProxyModeType, BrowserProxySettingsType, ProxyServer, SpecialRequestApplyProxyMode, ProxyableLogType, ProxyableLogDataType, CompiledProxyRule } from "./definitions";
import { ProxyRules } from "./ProxyRules";
import { TabManager } from "./TabManager";
import { PolyFill } from "../lib/PolyFill";
import { Settings } from "./Settings";
import { ProxyEngineSpecialRequests } from "./ProxyEngineSpecialRequests";
import { TabRequestLogger } from "./TabRequestLogger";

export class ProxyEngineFirefox {

	/** If Firefox API available, registers proxy */
	public static register(): boolean {
		if (browser["proxy"] && browser.proxy["onRequest"]) {

			// onRequest is Used for HTTP and HTTPS protocols only (WSS included), source: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/RequestFilter
			// Smart features are available here only
			browser.proxy.onRequest.addListener(ProxyEngineFirefox.handleProxyRequest,
				{ urls: ['*://*/*', 'ws://*/*', 'wss://*/*', 'ftp://*/*'] });

			browser.proxy.onError.addListener(ProxyEngineFirefox.onProxyError);

			return true;
		}
		return false;
	}

	public static updateFirefoxProxyConfig() {
		let settings = Settings.current;
		let proxySettings = {
			proxyType: BrowserProxySettingsType.system
		};

		switch (settings.proxyMode) {
			case ProxyModeType.Direct:
			case ProxyModeType.SmartProxy:
			case ProxyModeType.Always:
				proxySettings.proxyType = BrowserProxySettingsType.none;
				break;
			case ProxyModeType.SystemProxy:
				proxySettings.proxyType = BrowserProxySettingsType.system;
				break;
		}

		PolyFill.browserSetProxySettings(
			{
				value: proxySettings
			},
			function () {
				// reset the values
				environment.notSupported.setProxySettings = false;
				environment.notAllowed.setProxySettings = false;
			},
			function (error: Error) {
				Debug.error("updateFirefoxProxyConfig failed to set proxy settings", proxySettings, error?.message);
				if (error && error["message"]) {
					if (error.message.includes("not supported"))
						environment.notSupported.setProxySettings = true;
					if (error.message.includes("permission"))
						environment.notAllowed.setProxySettings = true;
				}
			});
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
		proxyLog.logType = ProxyableLogType.NoneMatched;

		let settings = Settings.current;
		let result = (() => {
			if (!requestDetails.url)
				return { type: "direct" };

			// Check if we should proxy the request because we're running in incognito mode
			if (settings.proxyMode != ProxyModeType.Direct
				&& settings.options.alwaysProxyIncognito
				&& TabManager.getTab(requestDetails.tabId).incognito) {
				proxyLog.logType = ProxyableLogType.AlwaysEnabledIncognito;
				return ProxyEngineFirefox.getResultProxyInfo(settings.activeProxyServer);
			}

			// checking if request is special
			let specialRequest = ProxyEngineSpecialRequests.getProxyMode(requestDetails.url, true);
			if (specialRequest !== null) {
				proxyLog.logType = ProxyableLogType.Special;

				if (specialRequest.applyMode == SpecialRequestApplyProxyMode.NoProxy)
					return { type: "direct" };

				if (specialRequest.applyMode == SpecialRequestApplyProxyMode.CurrentProxy) {
					if (settings.activeProxyServer)
						return ProxyEngineFirefox.getResultProxyInfo(settings.activeProxyServer);
					else
						return { type: "direct" };
				}

				if (specialRequest.applyMode == SpecialRequestApplyProxyMode.SelectedProxy
					&& specialRequest.selectedProxy) {
					return ProxyEngineFirefox.getResultProxyInfo(specialRequest.selectedProxy);
				}
			}

			if (settings.proxyMode == ProxyModeType.Direct ||
				!settings.activeProxyServer)
				return { type: "direct" };

			if (settings.proxyMode == ProxyModeType.Always) {
				// should bypass this host?
				if (settings.bypass.enableForAlways === true &&
					settings.bypass.bypassList.length > 0) {

					let host = new URL(requestDetails.url).host.toLowerCase();

					if (settings.bypass.bypassList.indexOf(host) !== -1) {
						proxyLog.logType = ProxyableLogType.ByPassed;
						proxyLog.hostName = host;
						return { type: "direct" };
					}
				}

				proxyLog.logType = ProxyableLogType.AlwaysEnabled;
				return ProxyEngineFirefox.getResultProxyInfo(settings.activeProxyServer);
			}

			let matchedWhitelistRule = ProxyRules.findWhitelistMatchForUrl(requestDetails.url);
			if (matchedWhitelistRule) {
				proxyLog.logType = ProxyableLogType.Whitelisted;
				proxyLog.applyFromRule(matchedWhitelistRule);
				proxyLog.hostName = matchedWhitelistRule.hostName;

				return { type: "direct" };
			}

			if (settings.proxyMode == ProxyModeType.SystemProxy) {
				// system proxy mode is not handled here
				proxyLog.logType = ProxyableLogType.SystemProxyApplied;
				return { type: "direct" };
			}

			if (settings.options.proxyPerOrigin &&
				requestDetails.tabId > -1) {

				let tabData = TabManager.getTab(requestDetails.tabId);
				if (tabData != null && tabData.proxified) {

					if (!requestDetails.documentUrl) {
						// document url is being changed, resetting the settings for that
						tabData.proxified = false;
						tabData.proxyServerFromRule = null;
						tabData.proxifiedParentDocumentUrl = null;
					}
					else {
						proxyLog.logType = ProxyableLogType.ProxyPerOrigin;
						proxyLog.hostName = tabData.proxyRuleHostName;
						proxyLog.proxied = true;

						if (tabData.proxyMatchedRule) {
							proxyLog.applyFromRule(tabData.proxyMatchedRule);
						}

						if (tabData.proxyServerFromRule) {
							if (tabData.proxyServerFromRule.username)
								// Requires authentication. Mark as special and store authentication info.
								ProxyEngineSpecialRequests.setSpecialUrl(`${tabData.proxyServerFromRule.host}:${tabData.proxyServerFromRule.port}`, null, tabData.proxyServerFromRule);

							return ProxyEngineFirefox.getResultProxyInfo(tabData.proxyServerFromRule);
						}

						return ProxyEngineFirefox.getResultProxyInfo(settings.activeProxyServer);
					}
				}
			}

			let matchedRule = ProxyRules.findMatchForUrl(requestDetails.url);
			if (matchedRule) {

				proxyLog.logType = ProxyableLogType.MatchedRule;
				proxyLog.applyFromRule(matchedRule);
				proxyLog.hostName = matchedRule.hostName;

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

				return ProxyEngineFirefox.getResultProxyInfo(settings.activeProxyServer);
			}

			proxyLog.logType = ProxyableLogType.NoneMatched;

			// nothing matched
			return { type: "direct" };
		})();

		// notify the logger
		TabRequestLogger.notifyProxyableLog(proxyLog);
		return result;
	}

	private static storeTabProxyDetail(requestDetails: any, matchedRule: CompiledProxyRule) {
		// check if this is the top level request
		if (requestDetails.type !== "main_frame") {
			return;
		}

		// tab is new, we need to create it
		let tabData = TabManager.getOrSetTab(requestDetails.tabId, true, requestDetails.url);
		if (tabData == null) {
			// never
			return;
		}

		// only the top-level
		if (requestDetails.url === tabData.url ||
			// on Firefox top-level doesn't have documentUrl
			!requestDetails.documentUrl) {

			tabData.proxified = true;
			tabData.proxifiedParentDocumentUrl = requestDetails.url;
			tabData.proxyMatchedRule = matchedRule;
			tabData.proxyRuleHostName = matchedRule.hostName;

			if (matchedRule.proxy)
				tabData.proxyServerFromRule = matchedRule.proxy;
			else
				tabData.proxyServerFromRule = null;
		}
	}

	private static getResultProxyInfo(proxyServer: ProxyServer): resultProxyInfo {
		switch (proxyServer.protocol) {
			case "SOCKS5":
				// "socks" refers to the SOCKS5 protocol
				return {
					type: "socks",
					host: proxyServer.host,
					port: proxyServer.port,
					proxyDNS: proxyServer.proxyDNS,
					username: proxyServer.username,
					password: proxyServer.password
				};

			default:
			case "HTTP":
			case "HTTPS":
			case "SOCKS4":
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
};