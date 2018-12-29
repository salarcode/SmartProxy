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
import { Messages } from "./definitions";

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

	static handleMessages(message: string, sender: any, sendResponse: Function) {

		Debug.log("core message> ", message);

		// --------------------
		// handling pac proxy messages
		if (sender.url == ProxyEngineFirefox.proxyScriptExtentionUrlFirefox) {
			if (message == Messages.PacProxySendRules) {

				if (sendResponse) {

					// let proxyInitData = internal.getDataForProxyScript();

					// // send the rules
					// sendResponse(proxyInitData);
				}
			}
			return;
		}

		// --------------------
		switch (message) {
			case Messages.PacProxySendRules:
				{

				}
				break;

			default:
				{

				}
				break;
		}

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
