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
import { Utils } from "./Utils";
import { api } from "./environment";
import { ProxyServerSubscription, ProxyServer, ProxyServerSubscriptionFormat } from "../core/definitions";
import { Debug } from "./Debug";
import { Settings } from "../core/Settings";
import { ProxyEngineSpecialRequests } from "../core/ProxyEngineSpecialRequests";

export const ProxyImporter = {
	readFromServer(serverDetail: ProxyServerSubscription, success?: Function, fail?: Function) {
		if (!serverDetail || !serverDetail.url) {
			if (fail) fail();
			return;
		}
		if (!success) throw "onSuccess callback is mandatory";

		function ajaxSuccess(response: any) {
			if (!response)
				if (fail) fail();
			ProxyImporter.importText(response,
				null,
				false,
				null,
				(importResult: {
					success: boolean,
					message: string,
					result: ProxyServer[]
				}) => {
					if (!importResult.success) {
						if (fail)
							fail(importResult);
						return;
					}
					if (success)
						success(importResult);
				},
				(error: Error) => {
					if (fail)
						fail(error);
				},
				serverDetail);
		}

		if (serverDetail.applyProxy !== null)
			// mark this request as special
			ProxyEngineSpecialRequests.setSpecialUrl(serverDetail.url, serverDetail.applyProxy);

		let xhr = new XMLHttpRequest();
		xhr.open("GET", serverDetail.url);

		if (serverDetail.username) {
			let pass = atob(serverDetail.password);
			xhr.setRequestHeader("Authorization", "Basic " + btoa(serverDetail.username + ":" + pass));
		}

		xhr.onload = () => {
			if (xhr.status === 200) {
				ajaxSuccess(xhr.responseText);
			}
			else {
				if (fail) fail(xhr.status);
			}
		};
		xhr.send();
	},
	importText(text: string | ArrayBuffer, file: any, append: boolean, currentProxies: ProxyServer[], success: Function, fail?: Function, options?: ProxyServerSubscription) {
		if (!file && !text) {
			if (fail) fail();
			return;
		}

		if (text) {
			doImport(text as string, options);
		}
		else {
			let reader = new FileReader();
			reader.onerror = event => {
				if (fail) fail(event);
			};
			reader.onload = event => {
				//let textFile = event.target;
				let fileText = reader.result;

				doImport(fileText as string, options);
			};
			reader.readAsText(file);
		}


		function doImport(text: string, options?: ProxyServerSubscription) {

			let parsedProxies: ProxyServer[];

			if (options && options.format == ProxyServerSubscriptionFormat.Json)
				parsedProxies = ProxyImporter.parseJson(text, options);
			else
				parsedProxies = ProxyImporter.parseText(text, options);

			if (parsedProxies == null) {
				if (fail) fail();
				return;
			}

			let importedProxies: ProxyServer[] = Utils.removeDuplicatesFunc(parsedProxies,
				(item1: ProxyServer, item2: ProxyServer) => item1.host == item2.host &&
					item1.port == item2.port &&
					item1.username == item2.username &&
					item1.password == item2.password);


			// proxies are ready
			if (append) {
				if (!currentProxies)
					currentProxies = [];

				// make a copy
				let appendedProxyList: ProxyServer[] = currentProxies.slice();
				let appendedProxyCount = 0;

				for (let importedProxy of importedProxies) {
					let proxyExists = currentProxies.some(cp => {
						return (cp.host == importedProxy.host &&
							cp.port == importedProxy.port &&
							cp.username == importedProxy.username &&
							cp.password == importedProxy.password)
					});
					if (proxyExists)
						continue;

					// append imported proxy
					appendedProxyList.push(importedProxy);
					appendedProxyCount++;
				}

				// Total ${appendedProxyCount} out of ${appendedProxyList.length} proxies are appended.<br>Don't forget to save the changes.
				let message = api.i18n.getMessage("importerImportProxySuccess")
					.replace("{0}", appendedProxyCount.toString())
					.replace("{1}", importedProxies.length.toString());

				if (success) {
					// not need for any check, return straight away
					success({
						success: true,
						message: message,
						result: appendedProxyList
					});
				}

			} else {

				// Total ${importedRuleList.length} out of ${parsedRuleList.length} proxies are imported.<br>Don't forget to save the changes.
				let message = api.i18n.getMessage("importerImportProxySuccess")
					.replace("{0}", importedProxies.length.toString())
					.replace("{1}", parsedProxies.length.toString());

				if (success) {
					// not need for any check, return straight away
					success({
						success: true,
						message: message,
						result: importedProxies
					});
				}
			}
		}

	},
	parseText: (proxyListText: string, options?: ProxyServerSubscription): ProxyServer[] => {
		///<summary>Parses the proxy</summary>
		if (!proxyListText || typeof (proxyListText) !== "string") return null;

		// ip or host:port [protocol] [name] [username] [password]
		const proxyRegex = /((?:[A-Za-z0-9-]+\.)+[A-Za-z0-9]{1,6})(?:(?::+|[\t\s,]+)(\d{2,5}))?(?:[\t\s]+\[(\w+)\][\t\s]+\[([\w\s\:\.-]+)\](?:[\t\s]+\[(.+)\][\t\s]+\[(.+)\])?)?/i;

		if (options && options.obfuscation) {
			try {
				if (options.obfuscation.toLowerCase() == "base64") {
					// decode base64
					proxyListText = atob(proxyListText);
				}
			} catch (e) {
				return null;
			}
		}

		let proxyListLines = proxyListText.split(/(\r|\n)/);
		let parsedProxies: ProxyServer[] = [];

		let defaultProxyProtocol = "HTTP";
		if (options && options.proxyProtocol)
			defaultProxyProtocol = options.proxyProtocol;

		for (let proxyLine of proxyListLines) {
			// simple check
			if (proxyLine.length < 4)
				continue;

			let match = proxyRegex.exec(proxyLine);
			if (!match) {
				continue;
			}

			let [, ip, port, protocol, name, username, password] = match;
			if (!ip || !port) {
				continue;
			}
			if (!protocol)
				protocol = defaultProxyProtocol;
			else
				protocol = protocol.toUpperCase();

			let proxy = new ProxyServer();

			proxy.name = name || `${ip}:${port}`;
			proxy.id = proxy.name; // id should be same as name, because id should be consistent between multiple reads
			proxy.host = ip;
			proxy.port = parseInt(port);
			proxy.protocol = protocol;
			proxy.username = username;
			proxy.password = password;

			parsedProxies.push(proxy);
		}

		return parsedProxies;
	},
	parseJson: (proxyListText: string, options?: ProxyServerSubscription): ProxyServer[] => {

		if (options && options.obfuscation) {
			try {
				if (options.obfuscation.toLowerCase() == "base64") {
					// decode base64
					proxyListText = atob(proxyListText);
				}
			} catch (e) {
				return null;
			}
		}

		let resultProxies: ProxyServer[] = [];
		try {
			let proxyJsonList = JSON.parse(proxyListText);
			if (!proxyJsonList)
				return null;

			if (!Array.isArray(proxyJsonList))
				proxyJsonList = [proxyJsonList];

			for (const proxy of proxyJsonList) {
				let item = new ProxyServer();

				item.name = proxy["name"] || ((proxy["country"] ? `${proxy["country"]} - ` : '') + `${proxy["ip"]}:${proxy["port"]}`);
				item.id = item.name; // id should be same as name, because id should be consistent between multiple reads
				item.host = proxy["ip"];
				item.port = parseInt(proxy["port"]);
				item.protocol = proxy["protocol"];
				item.username = proxy["username"];
				item.password = proxy["password"];

				if (!Settings.validateProxyServer(item).success)
					continue;

				resultProxies.push(item);
			}

			return resultProxies;

		} catch (error) {
			Debug.log("ProxyImporter.parseJson failed", error, proxyListText);
			return null;
		}
	}
}