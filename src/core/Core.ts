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
import { Messages, SettingsPageInternalDataType, ResultHolder } from "./definitions";
import { SettingsOperation } from "./SettingsOperation";
import { ProxyRules } from "./ProxyRules";
import { ProxyEngine } from "./ProxyEngine";

export class Core {


	/** Start the application */
	public static initializeApp() {

		Settings.onInitialized.on(() => {
			// on settings read success

			// register the proxy when config is ready
			this.registerProxy();

			//// set the title
			//internal.setBrowserActionStatus();

			//// update the timers
			//timerManagement.updateSubscriptions();

			//// check for updates, only in unlisted version
			//updateManager.readUpdateInfo();

			//// handle synced settings changes
			//browser.storage.onChanged.addListener(settingsOperation.syncOnChanged);
		});
		Settings.initialize();

		// start proxy authentication request check
		ProxyAuthentication.startMonitor();

		// start handling messages
		this.registerMessageReader();
	}

	static handleMessages(message: any, sender: any, sendResponse: Function) {

		Debug.log("core message> ", message);

		// --------------------
		// handling pac proxy messages
		if (sender.url == ProxyEngineFirefox.proxyScriptExtensionUrlFirefox) {
			if (message == Messages.PacProxySendRules) {

				if (sendResponse) {

					// let proxyInitData = internal.getDataForProxyScript();

					// // send the rules
					// sendResponse(proxyInitData);
				}
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

					}
					break;

				case Messages.SettingsPageGetInitialData:
					{
						// if response method is available
						if (!sendResponse)
							return;
						let dataForSettingsUi = Core.getSettingsPageGetInitialData();

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

				}
				break;
			case Messages.PopupChangeActiveProxyServer:
				{

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
					ProxyEngine.updateChromeProxyConfig();

					if (sendResponse) {
						sendResponse({
							success: true,
							// General options saved successfully.
							message: browser.i18n.getMessage("settingsSaveOptionsSuccess")
						});
					}
					return;
				}
				break;
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

					// TODO: notify
					//ProxyRules.notifyActiveProxyServerChange();

					// update proxy rules
					// TODO: notify
					//ProxyRules.updateChromeProxyConfig();

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

					// ProxyRules.notifyProxyRulesChange();

					// // update proxy rules
					// ProxyRules.updateChromeProxyConfig();

					// // update active proxy tab status
					// updateTabDataProxyInfo();
					// internal.setBrowserActionStatus();

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

					// // it is possible that active proxy is changed
					// proxyRules.notifyActiveProxyServerChange();

					// // update proxy rules
					// proxyRules.updateChromeProxyConfig();

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

					// proxyRules.notifyBypassChanged();

					// // update proxy rules
					// proxyRules.updateChromeProxyConfig();

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


	static getSettingsPageGetInitialData(): SettingsPageInternalDataType {

		let dataForSettingsUi: SettingsPageInternalDataType = {
			settings: Settings.current,
			updateAvailableText: null,
			updateInfo: null
		};

		// if (UpdateManager.updateIsAvailable) {
		// 	// generate update text
		// 	dataForSettingsUi.updateAvailableText =
		// 		browser.i18n.getMessage("settingsTabUpdateText").replace("{0}", UpdateManager.updateInfo.versionName);
		// 	dataForSettingsUi.updateInfo = UpdateManager.updateInfo;
		// }

		return dataForSettingsUi;
	}

	/** Registring the PAC proxy script */
	static registerProxy() {

		if (environment.chrome) {

		}
		else {
			ProxyEngineFirefox.register();
		}
	}

	static registerMessageReader() {
		// start handling messages
		browser.runtime.onMessage.addListener(this.handleMessages);
	}
}
// start the application
Core.initializeApp();
console.log("Core.ts initializeApp() DONE");
