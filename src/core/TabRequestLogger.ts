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
import { TabManager, TabDataType } from "./TabManager";
import { Utils } from "../lib/Utils";
import { PolyFill } from "../lib/PolyFill";
import { Debug } from "../lib/Debug";
import { ProxyRules } from "./ProxyRules";
import { Messages, ProxyableDataType } from "./definitions";
import { browser } from "../lib/environment";

export class TabRequestLogger {

	private static subscribedTabList: any[] = [];

	public static startTracking() {
		browser.webRequest.onBeforeRequest.addListener(
			TabRequestLogger.logRequest,
			{ urls: ["<all_urls>"] }
		);

		TabManager.TabRemoved.on(TabRequestLogger.handleTabRemoved);
	}

	public static addToProxyableLogIdList(tabId: number) {
		let index = TabRequestLogger.subscribedTabList.indexOf(tabId);

		// only one instance
		if (index == -1) {
			TabRequestLogger.subscribedTabList.push(tabId);
		}
	}

	public static removeFromProxyableLogIdList(tabId: number) {
		let index = TabRequestLogger.subscribedTabList.indexOf(tabId);
		if (index > -1) {
			TabRequestLogger.subscribedTabList.splice(index, 1);
		}
	}

	private static logRequest(requestDetails: any) {
		let tabId = requestDetails.tabId;
		if (!(tabId > -1))
			// only requests from tabs are logged
			return;

		if (TabRequestLogger.subscribedTabList.length == 0)
			return;

		// this tab is not requested
		if (TabRequestLogger.subscribedTabList.indexOf(tabId) == -1) {
			return;
		}

		if (Utils.isValidUrl(requestDetails.url)) {
			let tabData = TabManager.getOrSetTab(tabId, false);
			tabData.requests.add(requestDetails.url);

			TabRequestLogger.notifyProxyableLogRequest(requestDetails.url, tabId);
		}
	}

	private static handleTabRemoved(tabData: TabDataType) {

		tabData.requests = null;

		// send notification first
		TabRequestLogger.notifyProxyableOriginTabRemoved(tabData.tabId);

		// then remove the tab from the notification list
		TabRequestLogger.removeFromProxyableLogIdList(tabData.tabId);
	}

	private static notifyProxyableLogRequest(url: string, tabId: number) {
		let proxyableData = TabRequestLogger.getProxyableDataForUrl(url);

		PolyFill.runtimeSendMessage(
			{
				command: Messages.ProxyableRequestLog,
				tabId: tabId,
				logInfo: proxyableData
			},
			null,
			error => {
				// no more logging for this tab
				TabRequestLogger.removeFromProxyableLogIdList(tabId);

				Debug.error("notifyProxyableLogRequest failed for ", tabId, error);
			});
	}

	private static notifyProxyableOriginTabRemoved(tabId: number) {

		let index = TabRequestLogger.subscribedTabList.indexOf(tabId);
		if (index == -1) {
			return;
		}

		PolyFill.runtimeSendMessage(
			{
				command: Messages.ProxyableOriginTabRemoved,
				tabId: tabId
			},
			null,
			error => {
				Debug.error("notifyProxyableOriginTabRemoved failed for ", tabId, error);
			});
	}

	private static getProxyableDataForUrl(url: string): ProxyableDataType {

		let testResult = ProxyRules.testSingleRule(url);
		let result = new ProxyableDataType();

		result.url = url;
		result.enabled = testResult.match;
		result.sourceDomain = "";
		result.rule = "";

		if (testResult.rule) {
			result.sourceDomain = testResult.rule.sourceDomain;
			result.rule = testResult.rule.rule;
		}
		return result;
	}

	public static getProxyableDataForUrlList(requests: Set<string> | string[]): ProxyableDataType[] {

		let reqArray: string[];
		if (!Array.isArray(requests))
			reqArray = Array.from(requests);
		else
			reqArray = requests;

		let multiTestResultList = ProxyRules.testMultipleRule(reqArray);
		let proxyableResult: ProxyableDataType[] = [];

		for (let i = 0; i < multiTestResultList.length; i++) {
			let testResult = multiTestResultList[i];

			let result = new ProxyableDataType();

			result.url = reqArray[i];
			result.enabled = testResult.match;
			result.sourceDomain = testResult.sourceDomain;
			result.rule = testResult.ruleText;

			proxyableResult.push(result);
		}

		return proxyableResult;
	}
}
