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
import { PolyFill } from "../lib/PolyFill";
import { LiteEvent } from "../lib/LiteEvent";
import { CompiledProxyRule, FailedRequestType, ProxyServer, TabProxyStatus } from "./definitions";
import { api, environment } from "../lib/environment";
import { Settings } from "./Settings";
import { ProxyRules } from "./ProxyRules";

export class TabManager {

	private static tabs: { [index: string]: TabDataType } = {};

	private static currentTab: TabDataType;

	private static readonly onTabRemoved = new LiteEvent<TabDataType>();
	private static readonly onTabUpdated = new LiteEvent<TabDataType>();

	public static get TabRemoved() { return this.onTabRemoved.expose(); }
	public static get TabUpdated() { return this.onTabUpdated.expose(); }


	public static initializeTracking() {

		// listen to tab switching
		api.tabs.onActivated.addListener(TabManager.updateActiveTab);

		// update tab status
		api.tabs.onUpdated.addListener(TabManager.handleTabUpdated);
		// listen to tab URL changes
		api.tabs.onUpdated.addListener(TabManager.updateActiveTab);

		api.tabs.onRemoved.addListener(TabManager.handleTabRemoved);

		// listen for window switching
		if (api["windows"])
			api.windows.onFocusChanged.addListener(TabManager.updateActiveTab);

		// read the active tab
		TabManager.updateActiveTab();

	}

	/** Gets tab or adds it */
	public static getOrSetTab(tabId: number, loadTabData = true, initialUrl: string = null): TabDataType {
		let tabData = TabManager.tabs[tabId];
		if (tabData == null) {
			tabData = new TabDataType(tabId);
			TabManager.tabs[tabId] = tabData;
			if (initialUrl)
				tabData.url = initialUrl;

			if (loadTabData)
				TabManager.loadTabData(tabData);
		}
		return tabData;
	}

	/** Get tab only */
	public static getTab(tabId: number): TabDataType {
		return TabManager.tabs[tabId];
	}

	public static getCurrentTab(): TabDataType {
		return TabManager.currentTab;
	}

	public static updateTabData(tabData: TabDataType, tabInfo: any): TabDataType {
		if (!tabInfo) return null;

		let tabId = tabInfo.id;
		if (!tabData) {
			tabData = TabManager.getOrSetTab(tabId, false);
		}
		if (tabData.proxifiedParentDocumentUrl != tabInfo.url) {

			tabData.proxyServerFromRule = null;
			tabData.proxified = TabProxyStatus.None;

			// apply `proxified` value
			TabManager.setRuleForProxyPerOrigin(tabData, tabInfo.url);
		}
		tabData.updated = new Date();
		tabData.incognito = tabInfo.incognito;
		tabData.url = tabInfo.url;
		tabData.index = tabInfo.index;
		if (!tabData.proxifiedParentDocumentUrl)
			tabData.proxifiedParentDocumentUrl = tabInfo.url;

		// saving the tab in the storage
		TabManager.tabs[tabId] = tabData;

		TabManager.onTabUpdated.trigger(tabData);

		return tabData;
	}

	public static setTabDataProxied(tabData: TabDataType, requestUrl: string, matchedRule?: CompiledProxyRule) {
		if (matchedRule) {
			tabData.proxified = matchedRule.whiteList ?
				TabProxyStatus.Whitelisted :
				TabProxyStatus.Proxified;
			tabData.proxifiedParentDocumentUrl = requestUrl;
			tabData.proxyMatchedRule = matchedRule;
			tabData.proxyRuleHostName = matchedRule.hostName;

			if (matchedRule.proxy)
				tabData.proxyServerFromRule = matchedRule.proxy;
			else
				tabData.proxyServerFromRule = null;
		}
		else {
			tabData.proxyServerFromRule = null;
			tabData.proxified = TabProxyStatus.None;
		}
	}

	private static setRuleForProxyPerOrigin(tabData: TabDataType, newRequestUrl: string) {
		///** trying to set the proxified value */

		if (environment.chrome)
			// not supported in chromium browsers
			return;

		if (Settings.current.options?.proxyPerOrigin != true)
			// not enabled
			return;

		let settingsActive = Settings.active;
		if (!settingsActive)
			return;
		let activeSmartProfile = settingsActive.activeProfile;

		let testResult = ProxyRules.findMatchedUrlInRulesInfo(newRequestUrl, activeSmartProfile.compiledRules);
		if (testResult != null) {

			let matchedRule = testResult.compiledRule;

			// set `tabData.proxified = true` 
			TabManager.setTabDataProxied(tabData, newRequestUrl, matchedRule);
		}
	}

	private static updateActiveTab() {

		// query the active tab in active window
		PolyFill.tabsQuery(
			{ active: true, currentWindow: true },
			(tabs: any[]) => {
				if (!tabs || !tabs.length)
					return;
				let tab = tabs[0];

				// save tab log info
				let tabData = TabManager.updateTabData(null, tab);

				TabManager.currentTab = tabData;
			});
	}

	private static loadTabData(tabData: TabDataType) {

		PolyFill.tabsGet(tabData.tabId,
			(tabInfo: any) => {

				// save tab log info
				TabManager.updateTabData(tabData, tabInfo);
			});
	}

	private static handleTabRemoved(tabId: number) {
		let tabData = TabManager.tabs[tabId];
		if (tabData == null)
			return;

		delete TabManager.tabs[tabId];

		TabManager.onTabRemoved.trigger(tabData);

		tabData.clearFailedRequests();
	}

	private static handleTabUpdated(tabId: number, changeInfo: any, tabInfo: any) {
		// only if url of the page is changed

		let tabData = TabManager.tabs[tabId];
		let shouldResetHard = false;
		let shouldResetSoft = false;

		if (changeInfo["url"]) {

			if (tabData != null &&
				// only if url is changed
				changeInfo.url != tabData.url) {

				// reset
				shouldResetHard = true;
			}
		}
		if (!shouldResetHard && changeInfo["status"] === "loading") {
			shouldResetSoft = true;
		}
		let callOnUpdate = false;

		if (shouldResetSoft) {
			// reload the tab data

			if (tabData) {
				callOnUpdate = true;
				tabData.resetFailedRequests();
			}
		}
		if (shouldResetHard) {
			// reload the tab data

			if (tabData) {
				// reload tab data
				tabData.clearFailedRequests();
				TabManager.loadTabData(tabData);
				callOnUpdate = true;
			}
		}

		if (callOnUpdate)
			TabManager.onTabUpdated.trigger(tabData);
	}
}

export class TabDataType {
	constructor(tabId: number) {
		this.tabId = tabId;
		this.created = new Date();
		this.updated = new Date();
		this.url = "";
		this.incognito = false;
		this.failedRequests = new Map<string, FailedRequestType>();
		this.proxified = TabProxyStatus.None;
	}

	public tabId: number;
	public created: Date;
	public updated: Date;
	public url: string;
	public incognito: boolean;
	public failedRequests: Map<string, FailedRequestType>;
	public index: number;
	public proxified: TabProxyStatus;
	public proxifiedParentDocumentUrl: string;
	public proxyRuleHostName: string;
	public proxyMatchedRule?: CompiledProxyRule;
	public proxyServerFromRule: ProxyServer;

	/** Removes failed requests */
	public clearFailedRequests() {
		if (this.failedRequests)
			this.failedRequests.clear();
	}

	/** Resets failed requests Hit Count */
	public resetFailedRequests() {
		if (this.failedRequests)
			this.failedRequests.forEach((request, requestDomainKey, map) => {
				request.hitCount = 1;
			});
	}
}