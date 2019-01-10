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
import { Messages, SettingsPageInternalDataType } from "./definitions";
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
					var saveData = message.saveData;

				}
				break;
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
