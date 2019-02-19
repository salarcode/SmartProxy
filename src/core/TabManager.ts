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
import { PolyFill } from "../lib/PolyFill";
import { LiteEvent } from "../lib/LiteEvent";
import { FailedRequestType, ProxyServer } from "./definitions";
import { browser } from "../lib/environment";

export class TabManager {

	private static tabs = {};

	private static currentTab: TabDataType;

	private static readonly onTabRemoved = new LiteEvent<TabDataType>();
	private static readonly onTabUpdated = new LiteEvent<TabDataType>();

	public static get TabRemoved() { return this.onTabRemoved.expose(); }
	public static get TabUpdated() { return this.onTabUpdated.expose(); }


	public static initializeTracking() {

		// listen to tab switching
		browser.tabs.onActivated.addListener(TabManager.updateActiveTab);

		// update tab status
		browser.tabs.onUpdated.addListener(TabManager.handleTabUpdated);
		// listen to tab URL changes
		browser.tabs.onUpdated.addListener(TabManager.updateActiveTab);

		browser.tabs.onRemoved.addListener(TabManager.handleTabRemoved);

		// listen for window switching
		browser.windows.onFocusChanged.addListener(TabManager.updateActiveTab);

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
		tabData.updated = new Date();
		tabData.incognito = tabInfo.incognito;
		tabData.url = tabInfo.url;
		tabData.index = tabInfo.index;

		// saving the tab in the storage
		TabManager.tabs[tabId] = tabData;

		TabManager.onTabUpdated.trigger(tabData);

		return tabData;
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
			tabInfo => {

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

		tabData.cleanup();
	}

	private static handleTabUpdated(tabId: number, changeInfo: any, tabInfo: any) {
		// only if url of the page is changed

		let tabData = TabManager.tabs[tabId];
		let shouldResetSoft = false;
		let shouldResetHard = false;
		if (changeInfo["status"] === "loading") {
			shouldResetHard = true;
		}
		if (changeInfo["url"]) {

			if (tabData != null &&
				// only if url is changed
				changeInfo.url != tabData.url) {

				// reset
				shouldResetSoft = true;
			}
		}

		let callOnUpdate = false;

		if (shouldResetHard) {
			// reload the tab data

			if (tabData) {
				callOnUpdate = true;
				tabData.cleanup();
			}
		}
		if (shouldResetSoft) {
			// reload the tab data

			if (tabData) {
				// reload tab data
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
		this.requests = new Set();
		this.url = "";
		this.incognito = false;
		this.failedRequests = new Map<string, FailedRequestType>();
		this.proxified = false;
	}

	public tabId: number;
	public created: Date;
	public updated: Date;
	public requests: Set<string>;
	public url: string;
	public incognito: boolean;
	public failedRequests: Map<string, FailedRequestType>;
	public index: number;
	public proxified: boolean;
	public proxySourceDomain: string;
	public proxyServerFromRule: ProxyServer;

	public cleanup() {
		if (this.requests)
			this.requests.clear();
		if (this.failedRequests)
			this.failedRequests.clear();
	}
}