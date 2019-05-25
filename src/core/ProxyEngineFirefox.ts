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
import { browser, environment } from "../lib/environment";
import { Debug } from "../lib/Debug";
import { ProxyModeType, BrowserProxySettingsType, ProxyRule, ProxyServer } from "./definitions";
import { ProxyRules } from "./ProxyRules";
import { TabManager } from "./TabManager";
import { PolyFill } from "../lib/PolyFill";
import { Settings } from "./Settings";

export class ProxyEngineFirefox {
	private static proxyScriptUrlFirefox = "core-engine-ff-pac.js";
	public static proxyScriptExtensionUrlFirefox = browser.runtime.getURL("core-engine-ff-pac.js");

	/** If Firefox API available, registers proxy */
	public static register(): boolean {
		if (browser["proxy"] && browser.proxy["onRequest"]) {

			// onRequest is Used for HTTP and HTTPS protocols only (WSS included), source: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/RequestFilter
			// Smart features are available here only
			browser.proxy.onRequest.addListener(ProxyEngineFirefox.handleProxyRequest, { urls: ["<all_urls>"] });

			// PAC script is used for Ftp and other protocols
			if (browser.proxy["register"])
				browser.proxy.register(ProxyEngineFirefox.proxyScriptUrlFirefox);

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
			null,
			function (error: Error) {
				Debug.log("updateFirefoxProxyConfig failed to set proxy settings", proxySettings, error);
				if (error && error["message"] &&
					error.message.includes("not supported")) {
					environment.notSupported.setProxySettings = true;
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
		/** new URL()->
			hash: ""
			​host: "socialshare.ir"
			​hostname: "socialshare.ir"
			​href: "http://socialshare.ir/admin/comment/comment-list?grdAdminComment-sort=CommentBody-asc"
			​origin: "http://socialshare.ir"
			​password: ""
			​pathname: "/admin/comment/comment-list"
			​port: ""
			​protocol: "http:"
			​search: "?grdAdminComment-sort=CommentBody-asc"
			​searchParams: URLSearchParams {  }
			​username: ""
		 */
		let settings = Settings.current;

		if (!requestDetails.url ||
			settings.proxyMode == ProxyModeType.Direct)
			return [{ type: "direct" }];

		if (settings.proxyMode == ProxyModeType.SystemProxy)
			// system proxy mode is not handled here
			return [{ type: "direct" }];

		if (!settings.activeProxyServer)
			return [{ type: "direct" }];

		if (settings.proxyMode == ProxyModeType.Always) {
			// should bypass this host?
			if (settings.bypass.enableForAlways === true) {

				let host = new URL(requestDetails.url).host.toLowerCase();

				if (settings.bypass.bypassList.indexOf(host) !== -1)
					return [{ type: "direct" }];
			}

			return ProxyEngineFirefox.getResultProxyInfo(settings.activeProxyServer);
		}

		if (settings.options.proxyPerOrigin &&
			requestDetails.tabId > -1) {

			let tabData = TabManager.getTab(requestDetails.tabId);
			if (tabData != null && tabData.proxified) {

				if (tabData.proxyServerFromRule)
					return ProxyEngineFirefox.getResultProxyInfo(tabData.proxyServerFromRule);

				return ProxyEngineFirefox.getResultProxyInfo(settings.activeProxyServer);
			}
		}

		let matchedRule = ProxyRules.findMatchForUrl(requestDetails.url);
		if (matchedRule) {

			if (requestDetails.tabId > -1) {
				// storing the proxy & rule in tab
				ProxyEngineFirefox.storeTabProxyDetail(requestDetails, matchedRule);
			}

			if (matchedRule.proxy)
				return ProxyEngineFirefox.getResultProxyInfo(matchedRule.proxy);

			return ProxyEngineFirefox.getResultProxyInfo(settings.activeProxyServer);
		}

		// nothing matched
		return [{ type: "direct" }];
	}

	private static storeTabProxyDetail(requestDetails: any, matchedRule: ProxyRule) {
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
		if (requestDetails.url === tabData.url) {

			tabData.proxified = true;
			tabData.proxySourceDomain = matchedRule.sourceDomain;
			if (matchedRule.proxy)
				tabData.proxyServerFromRule = matchedRule.proxy;
			else
				tabData.proxyServerFromRule = null;
		}
	}

	private static getResultProxyInfo(proxyServer: ProxyServer) {
		switch (proxyServer.protocol) {
			case "SOCKS5":
				// "socks" refers to the SOCKS5 protocol
				return [{
					type: "socks",
					host: proxyServer.host,
					port: proxyServer.port,
					proxyDNS: proxyServer.proxyDNS,
					username: proxyServer.username,
					password: proxyServer.password
				}];

			default:
			case "HTTP":
			case "HTTPS":
			case "SOCKS4":
				return [{
					type: proxyServer.protocol,
					host: proxyServer.host,
					port: proxyServer.port,
					proxyDNS: proxyServer.proxyDNS
				}];
		}
	}

	private static onProxyError(error: Error) {
		Debug.error(`Proxy error: ${error.message}`, error);
	}
}