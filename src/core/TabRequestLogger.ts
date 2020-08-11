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
import { Messages, ProxyableLogDataType, ProxyableLogType, ProxyModeType } from "./definitions";
import { browser, environment } from "../lib/environment";
import { Settings } from "./Settings";

export class TabRequestLogger {

	private static subscribedTabList: number[] = [];

	public static startTracking() {
		// unsubscribing when tab got removed
		TabManager.TabRemoved.on(TabRequestLogger.handleTabRemovedInternal);

		if (environment.chrome) {
			// this is a Chrome specific way of logging

			browser.webRequest.onBeforeRequest.addListener(
				TabRequestLogger.onBeforeRequestLogRequestInternal,
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

	private static handleTabRemovedInternal(tabData: TabDataType) {

		// send notification first
		TabRequestLogger.notifyProxyableOriginTabRemoved(tabData.tabId);

		// then remove the tab from the notification list
		TabRequestLogger.unsubscribeProxyableLogs(tabData.tabId);
	}

	/** After handleProxyRequest -> this is a Firefox specific way of logging */
	public static async notifyProxyableLog(proxyLogData: ProxyableLogDataType) {
		// Note: the async/await is ignored to prevent a blocking call.

		if (TabRequestLogger.subscribedTabList.length == 0)
			return;

			// checking if this tab requested
		if (TabRequestLogger.subscribedTabList.indexOf(proxyLogData.tabId) == -1) {
			return;
		}

		TabRequestLogger.sendProxyableRequestLog(proxyLogData);
	}

	private static async sendProxyableRequestLog(logData: ProxyableLogDataType) {
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

	/** browser.webRequest.onBeforeRequest -> this is a Chrome specific way of logging */
	private static onBeforeRequestLogRequestInternal(requestDetails: any) {
		let tabId = requestDetails.tabId;
		if (!(tabId > -1))
			// only requests from tabs are logged
			return;

		if (TabRequestLogger.subscribedTabList.length == 0)
			return;

		// checking if this tab requested
		if (TabRequestLogger.subscribedTabList.indexOf(tabId) == -1) {
			return;
		}

		if (Utils.isValidUrl(requestDetails.url)) {
			TabRequestLogger.notifyProxyableLogRequestInternal(requestDetails.url, tabId);
		}
	}

	/** browser.webRequest.onBeforeRequest -> this is a Chrome specific way of logging */
	private static async notifyProxyableLogRequestInternal(url: string, tabId: number) {
		let proxyableData = TabRequestLogger.getProxyableDataForUrl(url);
		proxyableData.tabId = tabId;

		TabRequestLogger.sendProxyableRequestLog(proxyableData);
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

		let settings = Settings.current;

		let testResult = ProxyRules.testSingleRule(url);

		let result = new ProxyableLogDataType();

		result.url = url;
		result.sourceDomain = "";
		result.ruleText = "";
		result.logType = ProxyableLogType.NoneMatched;

		if (testResult.rule) {
			result.sourceDomain = testResult.rule.sourceDomain;
			result.ruleText = testResult.rule.ruleText;
			result.ruleSource = testResult.rule.compiledRuleSource;
			result.logType = ProxyableLogType.MatchedRule;
			result.whitelist = testResult.rule.whiteList;
		}
		else {
			testResult = ProxyRules.testSingleWhiteListRule(url);

			if (testResult.rule) {
				result.sourceDomain = testResult.rule.sourceDomain;
				result.ruleText = testResult.rule.ruleText;
				result.ruleSource = testResult.rule.compiledRuleSource;
				result.logType = ProxyableLogType.Whitelisted;
				result.whitelist = testResult.rule.whiteList;
			}
		}

		if (result.whitelist)
			result.proxied = false;
		else if (settings.proxyMode == ProxyModeType.Always)
			result.proxied = true;
		else if (settings.proxyMode == ProxyModeType.Direct ||
			settings.proxyMode == ProxyModeType.SystemProxy)
			result.proxied = false;

		return result;
	}
}
