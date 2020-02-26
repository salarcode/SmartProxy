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
import { TabManager, TabDataType } from "./TabManager";
import { Utils } from "../lib/Utils";
import { PolyFill } from "../lib/PolyFill";
import { Debug } from "../lib/Debug";
import { ProxyRules } from "./ProxyRules";
import { Messages, ProxyableDataType as ProxyableLogDataType, ProxyableLogType, ProxyableDataType } from "./definitions";
import { browser, environment } from "../lib/environment";

export class TabRequestLogger {

	private static subscribedTabList: number[] = [];

	public static startTracking() {
		// unsubscribing when tab got removed
		TabManager.TabRemoved.on(TabRequestLogger.handleTabRemovedInternal);

		if (environment.chrome) {
			// this is a Chrome specific way of logging

			browser.webRequest.onBeforeRequest.addListener(
				TabRequestLogger.logRequestInternal,
				{ urls: ['*://*/*', 'ws://*/*', 'wss://*/*', 'ftp://*/*'] }
			);
		}
	}

	public static subscribeProxyableLogs(tabId: number) {
		let index = TabRequestLogger.subscribedTabList.indexOf(tabId);

		// only one instance
		if (index == -1) {
			TabRequestLogger.subscribedTabList.push(tabId);
		}
	}

	public static unsubscribeProxyableLogs(tabId: number) {
		let index = TabRequestLogger.subscribedTabList.indexOf(tabId);
		if (index > -1) {
			TabRequestLogger.subscribedTabList.splice(index, 1);
		}
	}

	public static async notifyProxyableLog(proxyLogData: ProxyableLogDataType) {
		// Note: the async/await is ignored to prevent a blocking call.

		// checking if this tab requested
		if (TabRequestLogger.subscribedTabList.indexOf(proxyLogData.tabId) == -1) {
			return;
		}

		TabRequestLogger.sendProxyableRequestLog(proxyLogData);
	}

	private static logRequestInternal(requestDetails: any) {
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
			TabRequestLogger.notifyProxyableLogRequestInternal(requestDetails.url, tabId);
		}
	}

	private static handleTabRemovedInternal(tabData: TabDataType) {

		// send notification first
		TabRequestLogger.notifyProxyableOriginTabRemoved(tabData.tabId);

		// then remove the tab from the notification list
		TabRequestLogger.unsubscribeProxyableLogs(tabData.tabId);
	}

	private static async notifyProxyableLogRequestInternal(url: string, tabId: number) {
		let proxyableData = TabRequestLogger.getProxyableDataForUrl(url);

		PolyFill.runtimeSendMessage(
			{
				command: Messages.ProxyableRequestLog,
				tabId: tabId,
				logInfo: proxyableData
			},
			null,
			(error: Error) => {
				// no more logging for this tab
				TabRequestLogger.unsubscribeProxyableLogs(tabId);

				Debug.error("notifyProxyableLogRequestInternal failed for ", tabId, error);
			});
	}
	private static async sendProxyableRequestLog(logData: ProxyableDataType) {
		PolyFill.runtimeSendMessage(
			{
				command: Messages.ProxyableRequestLog,
				tabId: logData.tabId,
				logInfo: logData
			},
			null,
			(error: Error) => {
				// no more logging for this tab
				TabRequestLogger.unsubscribeProxyableLogs(logData.tabId);

				Debug.error("sendProxyableRequestLog failed for ", logData.tabId, error);
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
			(error: Error) => {
				Debug.error("notifyProxyableOriginTabRemoved failed for ", tabId, error);
			});
	}

	private static getProxyableDataForUrl(url: string): ProxyableLogDataType {

		let testResult = ProxyRules.testSingleRule(url);
		let result = new ProxyableLogDataType();

		result.url = url;
		result.enabled = testResult.match;
		result.sourceDomain = "";
		result.rule = "";
		result.logType = ProxyableLogType.NoneMatched;

		if (testResult.rule) {
			result.sourceDomain = testResult.rule.sourceDomain;
			result.rule = testResult.rule.rule;
			result.logType = ProxyableLogType.MatchedRule;
		}
		return result;
	}
}
