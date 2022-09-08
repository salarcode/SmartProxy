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
import { TabManager, TabDataType } from "./TabManager";
import { Utils } from "../lib/Utils";
import { PolyFill } from "../lib/PolyFill";
import { Debug } from "../lib/Debug";
import { ProxyRules } from "./ProxyRules";
import { CommandMessages, ProxyableLogDataType, CompiledProxyRulesMatchedSource, SmartProfileType, monitorUrlsSchemaFilter, ProxyableProxifiedStatus, ProxyableMatchedRuleStatus, CompiledProxyRuleSource } from "./definitions";
import { api, environment } from "../lib/environment";
import { Settings } from "./Settings";

export class TabRequestLogger {

	private static subscribedTabList: number[] = [];

	public static startTracking() {
		// unsubscribing when tab got removed
		TabManager.TabRemoved.on(TabRequestLogger.handleTabRemovedInternal);

		if (environment.chrome) {
			// this is a Chrome specific way of logging

			api.webRequest.onBeforeRequest.addListener(
				TabRequestLogger.onBeforeRequestLogRequestInternal,
				{ urls: monitorUrlsSchemaFilter }
			);
		}
	}

	public static subscribeProxyableLogs(tabId: number) {
		let index = TabRequestLogger.subscribedTabList.indexOf(tabId);

		// allowing only one instance for a tab at a time
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
				command: CommandMessages.ProxyableRequestLog,
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

	/** api.webRequest.onBeforeRequest -> this is a Chrome specific way of logging */
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

	/** api.webRequest.onBeforeRequest -> this is a Chrome specific way of logging */
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
				command: CommandMessages.ProxyableOriginTabRemoved,
				tabId: tabId
			},
			null,
			(error: Error) => {
				Debug.error("notifyProxyableOriginTabRemoved failed for ", tabId, error);
			});
	}

	//** get proxyable log info -> this is a Chrome specific way of logging */
	private static getProxyableDataForUrl(url: string): ProxyableLogDataType {

		// TODO: This method needs to be removed/replaced with a better implementation that shares the logic between Firefox and Chrome

		let settingsActive = Settings.active;

		let activeSmartProfile = settingsActive.activeProfile;
		if (!activeSmartProfile) {

			let result = new ProxyableLogDataType();
			result.url = url;
			result.ruleHostName = "";
			result.rulePatternText = "";
			result.proxifiedStatus = ProxyableProxifiedStatus.NoProxy;
			result.matchedRuleStatus = ProxyableMatchedRuleStatus.NoneMatched;

			return result;
		}

		let testResultInfo = ProxyRules.findMatchedUrlInRulesInfo(url, activeSmartProfile.compiledRules);
		let testResultRule = testResultInfo?.compiledRule;

		let result = new ProxyableLogDataType();
		result.url = url;
		result.ruleHostName = "";
		result.rulePatternText = "";
		result.proxifiedStatus = ProxyableProxifiedStatus.NoProxy;
		result.matchedRuleStatus = ProxyableMatchedRuleStatus.NoneMatched;

		if (testResultRule != null) {
			result.applyFromRule(testResultRule);
			result.ruleHostName = testResultRule.hostName;
			result.proxifiedStatus = ProxyableProxifiedStatus.MatchedRule;
			result.matchedRuleStatus = ProxyableMatchedRuleStatus.MatchedRule;
			result.ruleSource = CompiledProxyRuleSource.Rules;

			if (testResultRule.whiteList) {
				result.matchedRuleStatus = ProxyableMatchedRuleStatus.Whitelisted;
				result.proxifiedStatus = ProxyableProxifiedStatus.NoProxy;
			}
			if (activeSmartProfile.profileType == SmartProfileType.AlwaysEnabledBypassRules) {
				result.matchedRuleStatus = ProxyableMatchedRuleStatus.AlwaysEnabledByPassed;
			}

			if (testResultInfo.matchedRuleSource == CompiledProxyRulesMatchedSource.SubscriptionRules ||
				testResultInfo.matchedRuleSource == CompiledProxyRulesMatchedSource.WhitelistSubscriptionRules) {
				result.ruleSource = CompiledProxyRuleSource.Subscriptions;
			}
		}

		if (activeSmartProfile.profileType == SmartProfileType.SystemProxy) {
			result.proxifiedStatus = ProxyableProxifiedStatus.SystemProxyApplied;
		}

		return result;
	}
}
