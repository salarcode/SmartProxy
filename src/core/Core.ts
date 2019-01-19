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
import { Settings } from "./Settings";
import { browser, environment } from "../lib/environment";
import { ProxyEngineFirefox } from "./ProxyEngineFirefox";
import { ProxyAuthentication } from "./ProxyAuthentication";
import { Debug } from "../lib/Debug";
import { Messages, SettingsPageInternalDataType, PopupInternalDataType, ProxyModeType } from "./definitions";
import { SettingsOperation } from "./SettingsOperation";
import { ProxyEngine } from "./ProxyEngine";
import { PolyFill } from "../lib/PolyFill";
import { TabManager, TabDataType } from "./TabManager";
import { Utils } from "../lib/Utils";
import { UpdateManager } from "./UpdateManager";
import { ProxyRules } from "./ProxyRules";

export class Core {

	/** Start the application */
	public static initializeApp() {

		Settings.onInitialized = (() => {
			// on settings read success

			// register the proxy when config is ready
			ProxyEngine.registerEngine();

			// set the title
			Core.setBrowserActionStatus();

			//// update the timers
			//timerManagement.updateSubscriptions();

			// check for updates, only in unlisted version
			UpdateManager.readUpdateInfo();

			//// handle synced settings changes
			//browser.storage.onChanged.addListener(settingsOperation.syncOnChanged);
		});
		Settings.initialize();

		// start proxy authentication request check
		ProxyAuthentication.startMonitor();

		// start handling messages
		Core.registerMessageReader();

		// tracking active tab
		TabManager.initializeTracking();
	}

	static handleMessages(message: any, sender: any, sendResponse: Function) {

		Debug.log("core message> ", message);

		// --------------------
		// handling pac proxy messages
		if (sender.url == ProxyEngineFirefox.proxyScriptExtensionUrlFirefox) {
			if (message == Messages.PacProxySendRules) {

				if (!sendResponse)
					return;

				let pacScriptInitData = Core.getDataForProxyScript();

				// send the rules
				sendResponse(pacScriptInitData);
			}
			return;
		}

		let isCommand = false;
		let command: string;
		if (typeof message == "string")
			command = message;
		else {
			command = message["command"];
			isCommand = true;
		}

		if (!isCommand) {
			switch (message) {
				case Messages.PopupGetInitialData:
					{
						if (!sendResponse)
							return;

						let dataForPopup = Core.getPopupInitialData();

						// send the data
						sendResponse(dataForPopup);
						return;
					}
					break;

				case Messages.SettingsPageGetInitialData:
					{
						// if response method is available
						if (!sendResponse)
							return;
						let dataForSettingsUi = Core.getSettingsPageInitialData();

						// send the data
						sendResponse(dataForSettingsUi);
						return;
					}
					break;
			}
			return;
		}

		// --------------------
		switch (command) {
			case Messages.PacProxySendRules:
				{

				}
				break;

			case Messages.PopupChangeProxyMode:
				{
					if (message.proxyMode === null ||
						message.proxyMode === undefined)
						return;

					Settings.current.proxyMode = message.proxyMode;

					// save the changes
					SettingsOperation.saveProxyMode();
					SettingsOperation.saveAllSync();

					// send it to the proxy server
					ProxyEngine.notifyProxyModeChanged();

					// update active proxy tab status
					Core.setBrowserActionStatus();
					return;
				}

			case Messages.PopupChangeActiveProxyServer:
				{

				}
				break;

			case Messages.PopupToggleProxyForHost:
				{
					if (!message.host)
						return;

					let host = message.host;
					//TODO: proxyRules.toggleByDomain(domain);

					// notify the proxy script
					ProxyEngine.notifyProxyRulesChanged();

					// update active proxy tab status
					//updateTabDataProxyInfo();

					Core.setBrowserActionStatus();
				}
				break;

			case Messages.PopupAddDomainListToProxyRule:
				{

				}
				break;
			case Messages.SettingsPageSaveOptions:
				{
					if (!message.options)
						return;
					Settings.current.options = message.options;
					SettingsOperation.saveOptions();
					SettingsOperation.saveAllSync();

					// update proxy rules
					ProxyEngine.notifySettingsOptionsChanged();

					if (sendResponse) {
						sendResponse({
							success: true,
							// General options saved successfully.
							message: browser.i18n.getMessage("settingsSaveOptionsSuccess")
						});
					}
					return;
				}

			case Messages.SettingsPageSaveProxyServers:
				{
					if (!message.saveData)
						return;
					var saveData = message.saveData;

					Settings.current.proxyServers = saveData.proxyServers;
					Settings.current.activeProxyServer = message.saveData.activeProxyServer;

					SettingsOperation.saveProxyServers();
					SettingsOperation.saveActiveProxyServer();
					SettingsOperation.saveAllSync();

					// notify
					ProxyEngine.notifyActiveProxyServerChanged();

					if (sendResponse) {
						sendResponse({
							success: true,
							message: "Proxy servers saved successfully."
						});
					}
					return;
				}

			case Messages.SettingsPageSaveProxyRules:
				{
					if (!message.proxyRules)
						return;
					Settings.current.proxyRules = message.proxyRules;
					SettingsOperation.saveRules();
					SettingsOperation.saveAllSync();

					ProxyEngine.notifyProxyRulesChanged();

					// // update active proxy tab status
					// updateTabDataProxyInfo();
					Core.setBrowserActionStatus();

					if (sendResponse) {
						sendResponse({
							success: true,
							// Proxy rules saved successfully.
							message: browser.i18n.getMessage("settingsSaveProxyRulesSuccess"),
						});
					}

					return;
				}
			case Messages.SettingsPageSaveProxySubscriptions:
				{
					if (!message.proxyServerSubscriptions)
						return;
					Settings.current.proxyServerSubscriptions = message.proxyServerSubscriptions;
					SettingsOperation.saveProxyServerSubscriptions();
					SettingsOperation.saveAllSync();

					// // update the timers
					// timerManagement.updateSubscriptions();

					// it is possible that active proxy is changed
					ProxyEngine.notifyActiveProxyServerChanged();

					if (sendResponse) {
						sendResponse({
							success: true,
							// Proxy server subscriptions saved successfully.
							message: browser.i18n.getMessage("settingsSaveProxyServerSubscriptionsSuccess")
						});
					}
					return;
				}
			case Messages.SettingsPageSaveBypass:
				{
					if (!message.bypass)
						return;
					Settings.current.bypass = message.bypass;
					SettingsOperation.saveBypass();
					SettingsOperation.saveAllSync();

					ProxyEngine.notifyBypassChanged();

					if (sendResponse) {
						sendResponse({
							success: true,
							// Proxy server subscriptions saved successfully.
							message: browser.i18n.getMessage("settingsSaveBypassSuccess")
						});
					} return;
				}
			case Messages.SettingsPageRestoreSettings:
				{
					if (!message.fileData)
						return;
					let fileData = message.fileData;
					let result = SettingsOperation.restoreSettings(fileData);

					if (sendResponse) {
						sendResponse(result);
					}
					return;
				}
			default:
				{

				}
				break;
		}

	}

	static getDataForProxyScript() {
		return {
			proxyRules: Settings.current.proxyRules,
			proxyMode: Settings.current.proxyMode,
			activeProxyServer: Settings.current.activeProxyServer,
			useNewReturnFormat: !environment.chrome && (environment.version >= environment.bugFreeVersions.firefoxNewPacScriptReturnData),
			bypass: Settings.current.bypass
		};
	}

	static getSettingsPageInitialData(): SettingsPageInternalDataType {

		let dataForSettingsUi: SettingsPageInternalDataType = {
			settings: Settings.current,
			updateAvailableText: null,
			updateInfo: null
		};

		if (UpdateManager.updateIsAvailable) {
			// generate update text
			dataForSettingsUi.updateAvailableText =
				browser.i18n.getMessage("settingsTabUpdateText").replace("{0}", UpdateManager.updateInfo.versionName);
			dataForSettingsUi.updateInfo = UpdateManager.updateInfo;
		}

		return dataForSettingsUi;
	}

	static getPopupInitialData(): PopupInternalDataType {
		let dataForPopup = new PopupInternalDataType();
		dataForPopup.proxyableDomains = [];
		dataForPopup.proxyMode = Settings.current.proxyMode;
		dataForPopup.hasProxyServers = Settings.current.proxyServers.length > 0;
		dataForPopup.proxyServers = Settings.current.proxyServers;
		dataForPopup.activeProxyServer = Settings.current.activeProxyServer;
		dataForPopup.currentTabId = null;
		dataForPopup.currentTabIndex = null;
		//dataForPopup.proxyServersSubscribed = internal.getAllSubscribedProxyServers();
		dataForPopup.updateAvailableText = null;
		dataForPopup.updateInfo = null;
		dataForPopup.failedRequests = null;

		if (UpdateManager.updateIsAvailable) {
			// generate update text
			dataForPopup.updateAvailableText =
				browser.i18n.getMessage("popupUpdateText").replace("{0}", UpdateManager.updateInfo.versionName);
			dataForPopup.updateInfo = UpdateManager.updateInfo;
		}

		let currentTabData = TabManager.getCurrentTab();
		if (currentTabData == null)
			return dataForPopup;

		// tab info
		dataForPopup.currentTabId = currentTabData.tabId;
		dataForPopup.currentTabIndex = currentTabData.index;

		// failed requests
		//TODO: dataForPopup.failedRequests = convertFailedRequestsToArray(currentTabData.failedRequests);

		// get the host name from url
		let urlHost = Utils.extractHostFromUrl(currentTabData.url);

		//// TODO: REVERT THIS
		//urlHost = "test.blog.smartproxy-salarcode.com.au";

		// current url should be valid
		if (!Utils.isValidHost(urlHost))
			return dataForPopup;

		// extract list of domain and subdomain
		let proxyableDomainList = Utils.extractSubdomainListFromHost(urlHost);

		if (!proxyableDomainList || !proxyableDomainList.length)
			return dataForPopup;

		// check if there are rules for the domains
		if (proxyableDomainList.length == 1) {

			let testResult = ProxyRules.testSingleRule(proxyableDomainList[0]);
			let ruleIsForThisHost = testResult.match;

			// add the domain
			dataForPopup.proxyableDomains.push({
				domain: proxyableDomainList[0],
				//TODO: pattern: testResult.pattern /* only if match */,
				hasMatchingRule: testResult.match,
				ruleIsForThisHost: ruleIsForThisHost
			});

		} else {

			let multiTestResultList = ProxyRules.testMultipleRule(proxyableDomainList);

			for (let i = 0; i < multiTestResultList.length; i++) {
				let result = multiTestResultList[i];

				// TODO: ruleIsForThisHost needs tweaking
				let ruleIsForThisHost = result.match;
				// if (result.match) {
				// 	// check to see if the matched rule is for this host or not!
				// 	if (result.source == proxyableDomainList[i]) {
				// 		ruleIsForThisHost = true;
				// 	}
				// }

				// add the domain
				dataForPopup.proxyableDomains.push({
					domain: result.domain,
					//pattern: result.pattern /* only if match */,
					hasMatchingRule: result.match,
					ruleIsForThisHost: ruleIsForThisHost
				});
			}
		}
		return dataForPopup;
	}

	static setBrowserActionStatus(tabData?: TabDataType) {
		let extensionName = browser.i18n.getMessage("extensionName");
		let proxyTitle = "";

		switch (Settings.current.proxyMode) {

			case ProxyModeType.Direct:

				proxyTitle = `${extensionName} : ${browser.i18n.getMessage("popupNoProxy")}`;
				PolyFill.browserActionSetIcon({
					path: {
						16: "icons/proxymode-disabled-16.png",
						32: "icons/proxymode-disabled-32.png",
						48: "icons/proxymode-disabled-48.png"
					}
				});
				break;

			case ProxyModeType.Always:

				proxyTitle = `${extensionName} : ${browser.i18n.getMessage("popupAlwaysEnable")}`;
				PolyFill.browserActionSetIcon({
					path: {
						16: "icons/proxymode-always-16.png",
						32: "icons/proxymode-always-32.png",
						48: "icons/proxymode-always-48.png"
					}
				});
				break;

			case ProxyModeType.SystemProxy:

				proxyTitle = `${extensionName} : ${browser.i18n.getMessage("popupSystemProxy")}`;
				PolyFill.browserActionSetIcon({
					path: {
						16: "icons/proxymode-system-16.png",
						32: "icons/proxymode-system-32.png",
						48: "icons/proxymode-system-48.png"
					}
				});
				break;

			case ProxyModeType.SmartProxy:
			default:

				proxyTitle = `${extensionName} : ${browser.i18n.getMessage("popupSmartProxy")}`;
				PolyFill.browserActionSetIcon({
					path: {
						16: "icons/smartproxy-16.png",
						24: "icons/smartproxy-24.png",
						48: "icons/smartproxy-48.png",
						96: "icons/smartproxy-96.png"
					}
				});
				break;
		}

		// TODO: Because of bug #40 do not add additional 

		if (tabData == null)
			tabData = TabManager.getCurrentTab();


		// if (tabData) {
		// 	let failedCount = failedRequestsNotProxifiedCount(tabData.failedRequests);

		// 	if (failedCount > 0) {
		// 		browser.browserAction.setBadgeBackgroundColor({ color: "#f0ad4e" });
		// 		browser.browserAction.setBadgeText({
		// 			text: failedCount.toString(),
		// 			tabId: tabData.tabId
		// 		});
		// 	} else {
		// 		browser.browserAction.setBadgeText({
		// 			text: "",
		// 			tabId: tabData.tabId
		// 		});
		// 	}

		// 	if (tabData.proxified) {
		// 		proxyTitle += `\r\n${browser.i18n.getMessage("toolbarTooltipEffectiveRule")}  ${tabData.proxySource}`;
		// 	} else {
		// 		proxyTitle += `\r\n${browser.i18n.getMessage("toolbarTooltipEffectiveRuleNone")}`;
		// 	}

		// } else {
		// 	browser.browserAction.setBadgeText({
		// 		text: "",
		// 		tabId: tabData.tabId
		// 	});
		// }

		if (Settings.current.activeProxyServer) {
			proxyTitle += `\r\nProxy server: ${Settings.current.activeProxyServer.host} : ${Settings.current.activeProxyServer.port}`;
		}

		browser.browserAction.setTitle({ title: proxyTitle });
	}

	static registerMessageReader() {
		// start handling messages
		browser.runtime.onMessage.addListener(Core.handleMessages);
	}
}
// start the application
Core.initializeApp();
console.log("Core.ts initializeApp() DONE");
