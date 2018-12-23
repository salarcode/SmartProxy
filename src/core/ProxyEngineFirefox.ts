import { browser } from "../lib/environment";
import { Debug } from "../lib/Debug";
import { Settings, ProxyServer } from "../core/Settings";
import { ProxyModeType } from "./definitions";
import { ProxyRules } from "./ProxyRules";

export class ProxyEngineFirefox {
	static proxyScriptUrlFirefox = "core-firefox-proxy.js";
	static proxyScriptExtentionUrlFirefox = browser.runtime.getURL("core-firefox-proxy.js");

	/** If Firefox API available, registers proxy */
	public static register(): boolean {
		if (browser["proxy"] && browser.proxy["onRequest"]) {

			// onRequest is Used for HTTP and HTTPS protocols only
			// Smart features are available here only
			browser.proxy.onRequest.addListener(this.handleProxyRequest, { urls: ["<all_urls>"] });

			// PAC script is used for Ftp and other protocols
			browser.proxy.register(this.proxyScriptUrlFirefox);

			browser.proxy.onError.addListener(this.onProxyError);

			return true;
		}
		return false;
	}

	private static handleProxyRequest(requestDetails) {
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
		var settings = Settings.current;

		if (!requestDetails.url ||
			settings.proxyMode == ProxyModeType.Direct)
			return { type: "direct" };

		if (settings.proxyMode == ProxyModeType.SystemProxy)
			// system proxy mode is not handled here
			return { type: "direct" };

		if (!settings.activeProxyServer)
			return { type: "direct" };

		if (settings.proxyMode == ProxyModeType.Always) {
			// should bypass this host?
			if (settings.bypass.enableForAlways === true) {

				let host = new URL(requestDetails.url).host.toLowerCase();

				if (settings.bypass.bypassList.indexOf(host) !== -1)
					return { type: "direct" };
			}

			return this.getResultProxyInfo(settings.activeProxyServer);
		}

		if (settings.options.proxyPerOrigin &&
			requestDetails.tabId > -1) {

			// TODO: Reading the active tab proxy status
			// var tabProxyRule = TabsManager.isTabProxifiedRule(requestDetails.tabId);
			// if (tabProxyRule) {
			// 	if (matchedRule.proxy)
			// 		return this.getResultProxyInfo(matchedRule.proxy);

			// 	return this.getResultProxyInfo(settings.activeProxyServer);
			// }
		}

		var matchedRule = ProxyRules.findMatchForUrl(requestDetails.url);
		if (matchedRule) {
			if (matchedRule.proxy)
				return this.getResultProxyInfo(matchedRule.proxy);

			return this.getResultProxyInfo(settings.activeProxyServer);
		}

		// nothing matched
		return { type: "direct" };
	}

	private static getResultProxyInfo(proxyServer: ProxyServer) {
		switch (activeProxyServer.protocol) {
			case "SOCKS5":
				// "socks" refers to the SOCKS5 protocol
				return {
					type: "socks",
					host: activeProxyServer.host,
					port: activeProxyServer.port,
					proxyDNS: activeProxyServer.proxyDNS,
					username: activeProxyServer.username,
					password: activeProxyServer.password
				};

			default:
			case "HTTP":
			case "HTTPS":
			case "SOCKS4":
				return {
					type: activeProxyServer.protocol,
					host: activeProxyServer.host,
					port: activeProxyServer.port,
					proxyDNS: activeProxyServer.proxyDNS
				};
		}
	}

	private static onProxyError(error) {
		Debug.error(`Proxy error: ${error.message}`, error);
	}
}