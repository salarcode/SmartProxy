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
import { api, environment } from "../lib/environment";
import { Settings } from "./Settings";
import { monitorUrlsSchemaFilter, SmartProfileType } from "./definitions";
import { ProxyEngineSpecialRequests } from "./ProxyEngineSpecialRequests";

const apiLib = api;
const environmentLib = environment;

export class ProxyAuthentication {
	private static pendingRequests: { [index: string]: any } = {};

	public static startMonitor() {

		if (environmentLib.chrome) {
			if (environmentLib.manifestV3) {
				// In manifest v3 it is not possible to block, so this is useless mostly I think.
				apiLib.webRequest.onAuthRequired.addListener(ProxyAuthentication.onAuthRequiredChromeAsync,
					{ urls: monitorUrlsSchemaFilter }
				);
			}
			else {
				// chrome supports asyncBlocking
				apiLib.webRequest.onAuthRequired.addListener(ProxyAuthentication.onAuthRequiredChromeAsync,
					{ urls: monitorUrlsSchemaFilter },
					["asyncBlocking"]
				);
			}
		} else {
			apiLib.webRequest.onAuthRequired.addListener(ProxyAuthentication.onAuthRequired,
				{ urls: monitorUrlsSchemaFilter },
				["blocking"]
			);
		}
		apiLib.webRequest.onCompleted.addListener(
			ProxyAuthentication.onRequestFinished,
			{ urls: monitorUrlsSchemaFilter }
		);

		apiLib.webRequest.onErrorOccurred.addListener(
			ProxyAuthentication.onRequestFinished,
			{ urls: monitorUrlsSchemaFilter }
		);
	}

	private static onAuthRequiredChromeAsync(requestDetails: any, asyncCallback: Function): any {
		if (!requestDetails.isProxy) {
			asyncCallback({});
			return {};
		}
		let settingsActive = Settings.active;
		let currentProxy = settingsActive.currentProxyServer;

		if (!currentProxy) {
			if (asyncCallback)
				asyncCallback({});
			return {};
		}
		let activeProfile = settingsActive.activeProfile;
		let applyAuthentication = (activeProfile != null) &&
			(activeProfile.profileType !== SmartProfileType.Direct) &&
			(activeProfile.profileType !== SmartProfileType.SystemProxy);

		if (applyAuthentication &&
			currentProxy.username)
			applyAuthentication = true;
		else
			applyAuthentication = false;

		// TODO: find a way to proxy authentication for proxy selected in the rule

		if (asyncCallback) {
			// this is chrome

			// check if authentication is required
			if (!applyAuthentication) {

				asyncCallback({});
				return {};
			}

			// check if authentication is already provided
			if (ProxyAuthentication.pendingRequests[requestDetails.requestId]) {

				asyncCallback({ cancel: true });
				return { cancel: true };
			}

			// add this request to pending list
			ProxyAuthentication.pendingRequests[requestDetails.requestId] = true;

			asyncCallback({
				authCredentials: { username: currentProxy.username, password: currentProxy.password }
			});
		} else {
			// check if authentication is required
			if (!applyAuthentication) {
				return {};
			}

			// check if authentication is already provided
			if (ProxyAuthentication.pendingRequests[requestDetails.requestId]) {
				return { cancel: true };
			}

			// add this request to pending list
			ProxyAuthentication.pendingRequests[requestDetails.requestId] = true;

			return {
				authCredentials: { username: currentProxy.username, password: currentProxy.password }
			};
		}
	}

	private static onAuthRequired(requestDetails: any): any {
		if (!requestDetails.isProxy) {
			return {};
		}

		// check if authentication is already provided
		if (ProxyAuthentication.pendingRequests[requestDetails.requestId]) {
			return { cancel: true };
		}
		let settingsActive = Settings.active;
		let activeProfile = settingsActive.activeProfile;
		let applyAuthentication = (activeProfile != null) &&
			(activeProfile.profileType !== SmartProfileType.Direct) &&
			(activeProfile.profileType !== SmartProfileType.SystemProxy);
		let currentProxy = settingsActive.currentProxyServer;

		if (requestDetails.challenger) {
			var serverHost = requestDetails.challenger.host + ":" + requestDetails.challenger.port;

			let specialRequest = ProxyEngineSpecialRequests.retrieveSpecialUrlMode(serverHost, true);
			if (specialRequest !== null) {

				// value of `specialRequest.applyMode` is ignored, because this request is done by proxy handler itself

				if (specialRequest.selectedProxy) {
					// add this request to pending list
					ProxyAuthentication.pendingRequests[requestDetails.requestId] = true;

					return {
						authCredentials: { username: specialRequest.selectedProxy.username, password: specialRequest.selectedProxy.password }
					};
				}
			}
		}

		if (!currentProxy) {
			return {};
		}

		if (applyAuthentication &&
			currentProxy &&
			currentProxy.username)
			applyAuthentication = true;
		else
			applyAuthentication = false;

		// check if authentication is required
		if (!applyAuthentication) {
			return {};
		}

		// add this request to pending list
		ProxyAuthentication.pendingRequests[requestDetails.requestId] = true;

		return {
			authCredentials: { username: currentProxy.username, password: currentProxy.password }
		};
	}
	private static onRequestFinished(requestDetails: any) {
		delete ProxyAuthentication.pendingRequests[requestDetails.requestId];
	}
}