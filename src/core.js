/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2017 Salar Khalilzadeh <salar2k@gmail.com>
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
"use strict";
const changesRerquireRestart = true;
var loggedRequests = {};
var tabPorxyableLogIdList = [];
var restartRequired = false;
var settings = {
	proxyMode: "1",
	// patterns can be https://mozilla.org/*/b/*/ or https://mozilla.org/path/*
	proxyRules: [{ pattern: "*://*.salarcode.com/*", source: "salarcode.com", proxy: null, enabled: false }],
	activeProxyServer: null,
	proxyServers: [
		{
			name: 'name',
			host: 'host',
			port: 8080,
			protocol: 'HTTP',
			username: null,
			password: null,
			// proxyDNS can only be true for SOCKS proxy servers
			proxyDNS: false,
			failoverTimeout: null
		}
	],
	proxyServerSubscriptions: [
		{
			name: null,
			url: null,
			enabled: false,
			// same as proxyServerProtocols
			proxyProtocol: null,
			// in minutes
			refreshRate: 0,
			// types stored in proxyServerSubscriptionObfuscate
			obfuscation: null,
			// number of proxies in the list
			totalCount: 0,
			username: null,
			password: null,
			// the loaded proxies
			proxies: []
		}
	]
};

(function () {
	const proxyScriptURL = "core-firefox-proxy.js";
	const proxyScriptExtentionURL = browser.runtime.getURL(proxyScriptURL);
	var currentTab = null;

	// -------------------------
	function setDebug(isDebug) {
		if (isDebug) {
			window.debug = {
				log: window.console.log.bind(window.console),
				error: window.console.error.bind(window.console),
				info: window.console.info.bind(window.console),
				warn: window.console.warn.bind(window.console)
			};
		} else {
			var noOp = function () { };

			window.debug = {
				log: noOp,
				error: noOp,
				warn: noOp,
				info: noOp
			}
		}
	}

	// Uncomment when debugging
	setDebug(true);
	//setDebug(false);

	// -------------------------
	function handleMessages(message, sender, sendResponse) {
		///<summary>The main message handler</summary>

		debug.log("core.js incoming> ", message);

		if (sender.url == proxyScriptExtentionURL) {
			// only handle messages from the proxy script

			// initlialize the proxy
			if (message === "init") {

				// if response method is available
				if (sendResponse) {

					var proxyInitData = internal.getDataForProxyScript();

					// send the rules
					sendResponse(proxyInitData);
				}
			} else {
				// after the init message the only other messages are status messages
				debug.log(message);
			}
			return;
		}
		if (message == "getDataForPopup") {

			let dataForPopup = internal.getDataForPopup();

			// if response method is available
			if (sendResponse) {

				// send the data
				sendResponse(dataForPopup);
			}
			return;
		}

		if (message == "getDataForSettingsUi") {

			let dataForSettingsUi = internal.getDataForSettingsUi();

			// if response method is available
			if (sendResponse) {

				// send the data
				sendResponse(dataForSettingsUi);
			}
			return;
		}


		// message is object
		if (typeof (message) == "object") {
			var commad = message["command"];

			if (commad == "changeProxyMode" &&
				message["proxyMode"] != null) {

				let newProxyMode = message["proxyMode"];

				settings.proxyMode = newProxyMode;

				// save the changes
				settingsOperation.saveProxyMode();

				// send it to the proxy server
				proxyRules.notifyProxyModeChange();

				// update proxy rules
				proxyRules.updateChromeProxyConfig();
				return;
			}
			if (commad == "changeActiveProxyServer" &&
				message["name"] != null) {

				let proxyName = message["name"];
				let proxy = settingsOperation.findProxyServerByName(proxyName);
				if (proxy != null) {

					settings.activeProxyServer = proxy;
					settingsOperation.saveActiveProxyServer();

					// send it to the proxy server
					proxyRules.notifyActiveProxyServerChange();

					// update proxy rules
					proxyRules.updateChromeProxyConfig();

					if (sendResponse) {
						sendResponse({
							success: true,
							restartRequired: restartRequired
						});
					}
				} else {
					if (sendResponse) {
						sendResponse({
							success: false,
							restartRequired: restartRequired
						});
					}
				}
				return;
			}

			if (commad == "toggleProxyForDomain" &&
				message["domain"] != null) {

				let domain = message["domain"];
				proxyRules.toggleByDomain(domain);

				// notify the proxy script
				proxyRules.notifyProxyRulesChange();

				// update proxy rules
				proxyRules.updateChromeProxyConfig();

				return;
			}

			if (commad == "toggleProxyableRequest+returnRule" &&
				(message["enableByDomain"] != null || message["removeBySource"] != null)) {

				let enableByDomain = message.enableByDomain;
				let removeBySource = message.removeBySource;

				let result;

				// apply
				if (enableByDomain)
					result = proxyRules.enableByDomain(enableByDomain);
				else
					result = proxyRules.removeBySource(removeBySource);

				// send the responses
				if (result != null && sendResponse) {
					sendResponse(result);
				}

				// notify the proxy script
				proxyRules.notifyProxyRulesChange();

				// update proxy rules
				proxyRules.updateChromeProxyConfig();

				return;
			}

			if (commad == "requestProxyableLog" &&
				message["tabId"] != null) {

				let tabId = message["tabId"];
				requestLogger.addToPorxyableLogIdList(tabId);

				return;
			}

			if (commad == "removeProxyableLog" &&
				message["tabId"] != null) {

				let tabId = message["tabId"];
				requestLogger.removeFromPorxyableLogIdList(tabId);

				return;
			}

			if (commad == "settingsSaveProxyServers" &&
				message["saveData"] != null) {

				//// TODO: validate the proxy servers
				//if (!validate) {
				//	if (sendResponse) {
				//		sendResponse({
				//			success: false,
				//			message: 'Proxy servers are invalid.'
				//		});
				//	}
				//}

				settings.proxyServers = message.saveData.proxyServers;
				settings.activeProxyServer = message.saveData.activeProxyServer;

				settingsOperation.saveProxyServers();
				settingsOperation.saveActiveProxyServer();

				proxyRules.notifyActiveProxyServerChange();

				// update proxy rules
				proxyRules.updateChromeProxyConfig();

				if (sendResponse) {
					sendResponse({
						success: true,
						message: 'Proxy servers saved successfully.',
						restartRequired: restartRequired
					});
				}
				return;
			}

			if (commad == "settingsSaveProxyRules" &&
				message["proxyRules"] != null) {

				//// TODO: validate the proxy servers
				//if (!validate) {
				//	if (sendResponse) {
				//		sendResponse({
				//			success: false,
				//			message: 'Proxy servers are invalid.'
				//		});
				//	}
				//}

				settings.proxyRules = message.proxyRules;
				settingsOperation.saveRules();

				proxyRules.notifyProxyRulesChange();

				// update proxy rules
				proxyRules.updateChromeProxyConfig();

				if (sendResponse) {
					sendResponse({
						success: true,
						// Proxy rules saved successfully.
						message: browser.i18n.getMessage("settingsSaveProxyRulesSuccess"),
						restartRequired: restartRequired
					});
				}
				return;
			}

			if (commad == "settingsSaveProxySubscriptions" &&
				message["proxyServerSubscriptions"] != null) {

				//// TODO: validate the proxy servers
				//if (!validate) {
				//	if (sendResponse) {
				//		sendResponse({
				//			success: false,
				//			message: 'Proxy servers are invalid.'
				//		});
				//	}
				//}

				settings.proxyServerSubscriptions = message.proxyServerSubscriptions;
				settingsOperation.saveProxyServerSubscriptions();

				// update the timers
				timerManagement.updateSubscriptions();

				// it is possible that active proxy is changed
				proxyRules.notifyActiveProxyServerChange();

				// update proxy rules
				proxyRules.updateChromeProxyConfig();

				if (sendResponse) {
					sendResponse({
						success: true,
						// Proxy server subscriptions saved successfully.
						message: browser.i18n.getMessage("settingsSaveProxyServerSubscriptionsSuccess"),
						restartRequired: restartRequired
					});
				}
				return;
			}
			if (commad == "restoreSettings" &&
				message["fileData"] != null) {

				let fileData = message.fileData;
				var result = settingsOperation.restoreSettings(fileData);

				if (sendResponse) {
					sendResponse(result);
				}
				return;
			}
		}
	}

	function registerProxy() {
		///<summary>Registring the PAC proxy script</summary>

		if (browser.proxy["register"])
			browser.proxy.register(proxyScriptURL);

		else if (browser.proxy["registerProxyScript"])
			// support for older firefox versions
			browser.proxy.registerProxyScript(proxyScriptURL);
		else {

			// just set the rules
			proxyRules.updateChromeProxyConfig();
		}

		polyfill.onProxyError().addListener(onProxyError);
	}

	function onProxyError(error) {
		debug.error(`Proxy error: ${error.message}`, error);
	}

	function saveLoggedTabInfo(tabData, tabInfo) {
		if (!tabInfo) return null;

		let tabId = tabInfo.id;
		if (!tabData)
			tabData = loggedRequests[tabId];

		if (!tabData)
			tabData = {
				tabId: tabId,
				created: new Date(),
				updated: new Date(),
				requests: new Set(),
				url: '',
				incognito: false
			};

		tabData.updated = new Date();
		tabData.incognito = tabInfo.incognito;
		tabData.url = tabInfo.url;

		// saveing the tab in the storage
		loggedRequests[tabId] = tabData;

		return tabData;
	}

	var requestLogger = {

		startLogger: function () {

			browser.webRequest.onBeforeRequest.addListener(
				requestLogger.logRequest,
				{ urls: ["<all_urls>"] }
			);
			browser.tabs.onRemoved.addListener(requestLogger.handleTabRemoved);
			browser.tabs.onUpdated.addListener(requestLogger.handleTabUpdated);
		},
		logRequest: function (requestDetails) {
			var tabId = requestDetails.tabId;
			if (!(tabId > -1))
				// only requests from tabs are logged
				return;

			let tabData = loggedRequests[tabId];
			if (tabData == null) {
				tabData = {
					tabId: tabId,
					created: new Date(),
					updated: new Date(),
					requests: new Set(),
					url: '',
					incognito: false
				};

				polyfill.tabsGet(tabId,
					function (tabInfo) {

						// saveing the tab in the storage
						saveLoggedTabInfo(tabData, tabInfo);
					});
			}

			if (tabPorxyableLogIdList.length == 0)
				return;

			// this tab is not requested
			if (tabPorxyableLogIdList.indexOf(tabId) == -1) {
				return;
			}

			tabData.requests.add(requestDetails.url);

			if (utils.isValidUrl(requestDetails.url))
				// notify if it is a valid host
				requestLogger.notifyProxyableLogRequest(requestDetails.url, tabId);
		},
		notifyProxyableLogRequest: function (url, tabId) {
			var proxyableData = requestLogger.getProxyableDataForUrl(url);

			polyfill.runtimeSendMessage(
				{
					command: "notifyProxyableLogRequest",
					tabId: tabId,
					logInfo: proxyableData
				},
				null,
				function (error) {

					// no more logging for this tab
					requestLogger.removeFromPorxyableLogIdList(tabId);

					debug.error("notifyProxyableLogRequest failed for ", tabId, error);
				});
		},
		notifyProxyableOriginTabRemoved: function (tabId) {
			var index = tabPorxyableLogIdList.indexOf(tabId);
			if (index == -1) {
				return;
			}

			polyfill.runtimeSendMessage(
				{
					command: "notifyProxyableOriginTabRemoved",
					tabId: tabId
				},
				null,
				function (error) {
					debug.error("notifyProxyableOriginTabRemoved failed for ", tabId, error);
				});
		},
		getProxyableDataForUrl: function (url) {

			var testRuesult = proxyRules.testSingleRule(url);

			return {
				url: url,
				enabled: testRuesult.match,
				source: testRuesult.source,
				pattern: testRuesult.pattern
			}
		},
		addToPorxyableLogIdList: function (tabId) {
			///<summary>remove from summary list</summary>
			var index = tabPorxyableLogIdList.indexOf(tabId);

			// only one instance
			if (index == -1) {
				tabPorxyableLogIdList.push(tabId);
			}
		},
		removeFromPorxyableLogIdList: function (tabId) {
			///<summary>remove from summary list</summary>
			var index = tabPorxyableLogIdList.indexOf(tabId);
			if (index > -1) {
				tabPorxyableLogIdList.splice(index, 1);
			}
		},
		handleTabRemoved: function (tabId) {
			let tabData = loggedRequests[tabId];
			if (tabData != null) {

				tabData.requests = null;
				delete loggedRequests[tabId];

				// send notification first
				requestLogger.notifyProxyableOriginTabRemoved(tabId);

				// then remove the tab from the notification list
				requestLogger.removeFromPorxyableLogIdList(tabId);
			}
		},
		handleTabUpdated: function (tabId, changeInfo, tabInfo) {
			// only if url of the page is changed
			// TODO: history changes? # tags?
			if (changeInfo["url"]) {

				let tabData = loggedRequests[tabId];
				if (tabData != null) {
					tabData.requests.clear();
					delete loggedRequests[tabId];
				}
			}
		}

	}

	function trackActiveTab() {
		///<summary>Always updating the latest tab</summary>
		function updateActiveTab() {

			function updateTab(tabs) {
				if (!tabs || !tabs[0])
					return;
				currentTab = tabs[0];

				// save tab log info
				saveLoggedTabInfo(null, currentTab);
			}

			// query the active tab in active window
			polyfill.tabsQuery({ active: true, currentWindow: true }, updateTab);
		}


		// listen to tab URL changes
		browser.tabs.onUpdated.addListener(updateActiveTab);

		// listen to tab switching
		browser.tabs.onActivated.addListener(updateActiveTab);

		// listen for window switching
		browser.windows.onFocusChanged.addListener(updateActiveTab);

		// initial update
		updateActiveTab();
	}

	var settingsOperation = {
		setDefaultSettins: function (settingObj) {

			if (settingObj["proxyRules"] == null || !Array.isArray(settingObj.proxyRules)) {
				settingObj.proxyRules = [];
			}
			if (settingObj["proxyMode"] == null) {
				settingObj.proxyMode = 1;
			}
			if (settingObj["proxyServers"] == null || !Array.isArray(settingObj.proxyServers)) {
				settingObj.proxyServers = [];
			}
			if (settingObj["proxyServerSubscriptions"] == null || !Array.isArray(settingObj.proxyServerSubscriptions)) {
				settingObj.proxyServerSubscriptions = [];
			}
			if (settingObj["activeProxyServer"] == null) {
				settingObj.activeProxyServer = null;
			}
			settingObj.product = "SmartProxy";

			polyfill.managementGetSelf(function (info) {
				settingObj.version = info.version;
			});
		},
		initialize: function (success) {
			///<summary>The initialization method</summary>
			function onGetLocalData(data) {
				// all the settings
				settings = migrateFromOldVersion(data);
				settingsOperation.setDefaultSettins(settings);

				if (success) {
					success();
				}
			}
			function onGetLocalError(error) {
				debug.error(`settingsOperation.initialize error: ${error.message}`);
			}
			function migrateFromOldVersion(data) {
				///<summary>Temporary migration for old version of this addon in Firefox. This method will be removed in the future</summary>
				if (!data) return data;

				if (data.proxyRules &&
					data.proxyRules.length > 0 &&
					// the old property
					data.proxyRules[0].rule) {

					var newProxyRules = [];
					for (let i = 0; i < data.proxyRules.length; i++) {
						var oldRule = data.proxyRules[i];
						newProxyRules.push(
							{
								pattern: oldRule.rule,
								source: oldRule.host,
								enabled: oldRule.enabled
							});
					}
					data.proxyRules = newProxyRules;
				}
				return data;
			}

			polyfill.storageLocalGet(null,
				onGetLocalData,
				onGetLocalError);

		},
		findProxyServerByName: function (name) {
			for (var i = 0; i < settings.proxyServers.length; i++) {
				var item = settings.proxyServers[i];
				if (item.name === name) {
					return item;
				}
			}

			for (var i = 0; i < settings.proxyServerSubscriptions.length; i++) {
				var subscription = settings.proxyServerSubscriptions[i];

				for (var j = 0; j < subscription.proxies.length; j++) {
					var item = subscription.proxies[j];
					if (item.name === name) {
						return item;
					}
				}
			}
			return null;
		},
		saveAll: function () {
			polyfill.storageLocalSet(settings,
				null,
				function (error) {
					debug.error(`settingsOperation.saveAll error: ${error.message}`);
				});
		},
		saveRules: function () {
			polyfill.storageLocalSet({ proxyRules: settings.proxyRules },
				null,
				function (error) {
					debug.error(`settingsOperation.saveRules error: ${error.message}`);
				});
		},
		saveProxyServers: function () {
			polyfill.storageLocalSet({ proxyServers: settings.proxyServers },
				null,
				function (error) {
					debug.error(`settingsOperation.saveRules error: ${error.message}`);
				});
		},
		saveProxyServerSubscriptions: function () {
			polyfill.storageLocalSet({ proxyServerSubscriptions: settings.proxyServerSubscriptions },
				null,
				function (error) {
					debug.error(`settingsOperation.proxyServerSubscriptions error: ${error.message}`);
				});
		},
		saveActiveProxyServer: function () {
			polyfill.storageLocalSet({ activeProxyServer: settings.activeProxyServer },
				null,
				function (error) {
					debug.error(`settingsOperation.saveRules error: ${error.message}`);
				});
		},
		saveProxyMode: function () {
			internal.setBrowserActionStatus();

			polyfill.storageLocalSet({ proxyMode: settings.proxyMode },
				null,
				function (error) {
					debug.error(`settingsOperation.saveProxyMode error: ${error.message}`);
				});
		},
		validateProxyServer: function (server) {
			if (server.port <= 0 || server.port >= 65535) {
				return {
					success: false,
					message: browser.i18n.getMessage("settingsServerPortInvalid").replace("{0}", `${server.host}:${server.port}`)
				};
			}

			if (!server.host || !utils.isValidHost(server.host)) {
				return {
					success: false,
					message: browser.i18n.getMessage("settingsServerHostInvalid").replace("{0}", `${server.host}:${server.port}`)
				};
			}

			if (!server.name) {
				return { success: false, message: browser.i18n.getMessage("settingsServerNameRequired") };
			} else {

				//var currentServers = settings.proxyServers;

				//for (let sindex = 0; sindex < currentServers.length; sindex++) {
				//	var cserver = currentServers[sindex];

				//	if (cserver.name == server.name) {

				//		return { success: false, exist: true, message: `Server name ${server.name} already exists` };
				//	}
				//}
			}

			if (!server.protocol) {
				server.protocol = "HTTP";
			} else {
				if (proxyServerProtocols.indexOf(server.protocol) == -1) {
					// not valid protocol, resetting
					server.protocol = "HTTP";
				}
			}

			return { success: true };
		},
		restoreSettings: function (fileData) {
			if (fileData == null)
				return { success: false, message: "Invalid data" };

			function restoreServers(backupServers) {
				var upcomingServers = [];
				for (let i = 0; i < backupServers.length; i++) {

					var server = backupServers[i];

					let validateResult = settingsOperation.validateProxyServer(server);
					if (!validateResult.success) {
						// if validation failed

						//if (validateResult.exist) {
						//	continue;
						//}
						// not exist, then failed
						return validateResult;
					}

					// good
					upcomingServers.push(server);
				}

				return { success: true, result: upcomingServers };
			}

			function restoreRules(backupRules) {
				var upcomingRules = [];
				for (let i = 0; i < backupRules.length; i++) {

					var rule = backupRules[i];

					let validateResult = proxyRules.validateRule(rule);
					if (!validateResult.success) {
						// if validation failed

						//if (validateResult.exist) {
						//	continue;
						//}
						// not exist, then failed
						return validateResult;
					}

					// good
					upcomingRules.push(rule);
				}

				return { success: true, result: upcomingRules };
			}

			function restoreActiveServer(backupActiveProxyServer) {

				let validateResult = settingsOperation.validateProxyServer(backupActiveProxyServer);
				if (!validateResult.success) {
					// if validation failed

					//if (validateResult.exist) {
					//	continue;
					//}
					// not exist, then failed
					return validateResult;
				}
				return { success: true, result: backupActiveProxyServer };
			}

			function restoreProxyMode(backupProxyMode) {

				if (backupProxyMode == null ||
					backupProxyMode <= 0) {
					return { success: false, message: browser.i18n.getMessage("settingsProxyModeInvalid") };
				}
				return { success: true, result: backupProxyMode };
			}

			try {
				var backupData = JSON.parse(fileData);
				var backupServers;
				var backupRules;
				var backupActiveServer;
				var backupProxyMode;

				if (backupData["proxyServers"] != null &&
					Array.isArray(backupData.proxyServers)) {

					let restoreServersResult = restoreServers(backupData.proxyServers);

					if (!restoreServersResult.success)
						return restoreServersResult;

					backupServers = restoreServersResult.result;
				}

				if (backupData["proxyRules"] != null &&
					Array.isArray(backupData.proxyRules)) {

					let restoreRulesResult = restoreRules(backupData.proxyRules);

					if (!restoreRulesResult.success)
						return restoreRulesResult;

					backupRules = restoreRulesResult.result;
				}

				if (backupData["activeProxyServer"] != null &&
					typeof (backupData.activeProxyServer) == "object") {

					let restoreActiveServerResult = restoreActiveServer(backupData.activeProxyServer);

					if (!restoreActiveServerResult.success)
						return restoreActiveServerResult;

					backupActiveServer = restoreActiveServerResult.result;
				}

				if (backupData["proxyMode"] != null &&
					typeof (backupData.proxyMode) == "string") {

					let restoreProxyModeResult = restoreProxyMode(backupData.proxyMode);

					if (!restoreProxyModeResult.success)
						return restoreProxyModeResult;

					backupProxyMode = restoreProxyModeResult.result;
				}


				// everything is fine so far
				// so start restoring
				if (backupServers != null) {
					settings.proxyServers = backupServers;

					settingsOperation.saveProxyServers();

				}

				if (backupRules != null) {

					settings.proxyRules = backupRules;

					settingsOperation.saveRules();
					proxyRules.notifyProxyRulesChange();
				}

				if (backupActiveServer != null) {

					settings.activeProxyServer = backupActiveServer;

					settingsOperation.saveActiveProxyServer();
					proxyRules.notifyActiveProxyServerChange();
				}

				if (backupProxyMode != null) {

					settings.proxyMode = backupProxyMode;

					settingsOperation.saveProxyMode();
					proxyRules.notifyProxyModeChange();
				}

				// update proxy rules
				proxyRules.updateChromeProxyConfig();

				return { success: true, message: browser.i18n.getMessage("settingsRestoreSettingsSuccess") }


			} catch (e) {
				return { success: false, message: browser.i18n.getMessage("settingsRestoreSettingsFailed") };
			}
		}
	}
	var proxyRules = {
		updateChromeProxyConfig: function () {
			///<summary>Chrome only. Updating Chrome proxy config.</summary>

			// this code should run only in Chrome
			if (!environment.chrome)
				return;

			if (settings.proxyMode == proxyModeType.systemProxy) {
				// No need to generate PAC since this code does the job

				let config = {
					mode: "system"
				};
				chrome.proxy.settings.set(
					{ value: config, scope: "regular" },
					function () {
						if (chrome.runtime.lastError) {
							debug.error("updateChromeProxyConfig failed with ", chrome.runtime.lastError);
						}
					});
				return;
			}

			// generate PAC script specific to Chrome
			let pacScript = chromeProxy.generateChromePacScript(settings);

			let config = {
				mode: "pac_script",
				pacScript: {
					data: pacScript
				}
			};
			chrome.proxy.settings.set(
				{ value: config, scope: "regular" },
				function () {
					if (chrome.runtime.lastError) {
						debug.error("updateChromeProxyConfig failed with ", chrome.runtime.lastError);
					}
				});
		},
		notifyProxyModeChange: function () {

			// only for Firefox
			if (environment.chrome)
				return;

			if (environment.version < environment.bugFreeVersions.firefoxToProxyScript)
				// in these version this bug requires restart
				restartRequired = changesRerquireRestart;

			polyfill.runtimeSendMessage(
				{
					command: "proxyModeChanged",
					proxyMode: settings.proxyMode
				},
				null,
				function (error) {
					if (!environment.chrome)
						// browser.runtime.sendMessage with toProxyScript fails on Windows
						// https://bugzilla.mozilla.org/show_bug.cgi?id=1389718
						// Error: Could not establish connection. Receiving end does not exist.
						restartRequired = true;

					debug.error("notifyProxyModeChange failed with ", error);
				},
				{
					toProxyScript: true
				});
		},
		notifyProxyRulesChange: function () {

			// only for Firefox
			if (environment.chrome)
				return;

			if (environment.version < environment.bugFreeVersions.firefoxToProxyScript)
				// in these version this bug requires restart
				restartRequired = changesRerquireRestart;

			polyfill.runtimeSendMessage(
				{
					command: "proxyRulesChanged",
					proxyRules: settings.proxyRules
				},
				null,
				function (error) {
					if (!environment.chrome)
						// browser.runtime.sendMessage with toProxyScript fails on Windows
						// https://bugzilla.mozilla.org/show_bug.cgi?id=1389718
						// Error: Could not establish connection. Receiving end does not exist.
						restartRequired = true;

					debug.error("notifyProxyRulesChange failed with ", error);
				},
				{
					toProxyScript: true
				});
		},
		notifyActiveProxyServerChange: function () {

			// only for Firefox
			if (environment.chrome)
				return;

			if (environment.version < environment.bugFreeVersions.firefoxToProxyScript)
				// in these version this bug requires restart
				restartRequired = changesRerquireRestart;

			polyfill.runtimeSendMessage(
				{
					command: "activeProxyServerChanged",
					activeProxyServer: settings.activeProxyServer
				},
				null,
				function (error) {
					if (!environment.chrome)
						// browser.runtime.sendMessage with toProxyScript fails on Windows
						// https://bugzilla.mozilla.org/show_bug.cgi?id=1389718
						// Error: Could not establish connection. Receiving end does not exist.
						restartRequired = true;

					debug.error("notifyActiveProxyServerChange failed with ", error);
				},
				{
					toProxyScript: true
				});
		},
		enableByDomain: function (domain) {

			// current url should be valid
			if (!utils.isValidHost(domain))
				// The selected domain is not valid
				return { success: false, message: browser.i18n.getMessage("settingsEnableByDomainInvalid"), domain: domain };

			// the domain should be the source
			var rule = proxyRules.getRuleBySource(domain);

			if (rule != null) {
				// Rule for the domain already exists
				return { success: true, message: browser.i18n.getMessage("settingsEnableByDomainExists"), rule: rule };
			}

			rule = proxyRules.addDomain(domain);

			return { success: true, rule: rule };
		},
		removeBySource: function (source) {

			// get the rule for the source
			var rule = proxyRules.getRuleBySource(source);

			if (rule != null) {
				proxyRules.remove(rule);

				return { success: true, rule: rule };
			}
			return {
				success: false,
				message: browser.i18n.getMessage("settingsNoRuleFoundForDomain").replace("{0}", source),
				source: source
			};
		},
		toggleByDomain: function (domain) {

			// the domain should be the source
			var rule = proxyRules.getRuleBySource(domain);

			if (rule == null) {
				if (!utils.isValidHost(domain))
					// this is an extra check!
					return;

				proxyRules.addDomain(domain);
			} else {
				proxyRules.remove(rule);
			}
		},
		addDomain: function (domain) {

			var pattern = utils.hostToMatchPattern(domain);

			var rule = {
				pattern: pattern,
				source: domain,
				enabled: true
			};

			// add and save it
			proxyRules.add(rule);

			return rule;
		},
		add: function (ruleObject) {
			settings.proxyRules.push(ruleObject);
			settingsOperation.saveRules();
		},
		remove: function (ruleObject) {

			var itemIndex = settings.proxyRules.indexOf(ruleObject);
			if (itemIndex > -1) {
				settings.proxyRules.splice(itemIndex, 1);
			}
			//settings.proxyRules.delete(ruleObject);

			settingsOperation.saveRules();
		},
		testSingleRule: function (url) {
			// the url should be complete
			if (url.indexOf(":") == -1)
				url = "http://" + url;

			for (let i = 0; i < settings.proxyRules.length; i++) {
				let rule = settings.proxyRules[i];
				//for (let rule of settings.proxyRules) {
				if (!rule.enabled) continue;

				let regex = utils.matchPatternToRegExp(rule.pattern);

				if (regex && regex.test(url)) {
					return {
						match: true,
						source: rule.source,
						pattern: rule.pattern
					};
				}
			}
			return {
				match: false
			};
		},
		testMultipleRule: function (domainArray) {
			// the url should be complete
			var cachedRegexes = [];
			var result = [];
			for (var uindex = 0; uindex < domainArray.length; uindex++) {
				var domain = domainArray[uindex];
				var url = domain;

				if (url.indexOf(":") == -1)
					url = "http://" + url;

				for (let rindex = 0; rindex < settings.proxyRules.length; rindex++) {
					let rule = settings.proxyRules[rindex];
					if (!rule.enabled) continue;

					let regex = cachedRegexes[rindex];
					if (regex == null) {
						regex = utils.matchPatternToRegExp(rule.pattern);

						cachedRegexes[rindex] = regex;
					}

					if (regex && regex.test(url)) {
						result[uindex] = {
							domain: domain,
							pattern: rule.pattern,
							source: rule.source,
							match: true
						};
						break;
					}
				}

				// no atching rule found
				if (result[uindex] == null) {
					result[uindex] = {
						domain: domain,
						match: false
					};
				}
			}

			return result;
		},
		getRuleBySource: function (source) {
			///<summary>Finds the defined rule for the host</summary>
			for (var i = 0; i < settings.proxyRules.length; i++) {
				var rule = settings.proxyRules[i];

				if (rule.source == source) {
					return rule;
				}
			}
			return null;
		},
		validateRule: function (rule) {
			// 	proxyRules: [{ rule: "rule", host: "host", enabled: false }],
			if (!rule.source) {
				// Rule 'source' is empty
				return { success: false, message: browser.i18n.getMessage("settingsRuleSourceIsEmpty") };
			} else {

				if (!utils.isValidHost(rule.source)) {
					// 'source' is not valid '${rule.source}
					return { success: false, message: browser.i18n.getMessage("settingsRuleSourceInvalidFormat").replace("{0}", rule.source) };
				}
			}

			if (!rule.pattern)
				// just in case that pattern was empty
				rule.pattern = utils.hostToMatchPattern(rule.source);

			if (rule["enabled"] == null)
				rule.enabled = true;

			return { success: true };
		}
	};
	var timerManagement = {
		serverSubscriptionTimers: [{ id: null, name: null, refreshRate: null }],
		rulesSubscriptionTimers: [{ id: null, name: null, refreshRate: null }],
		updateSubscriptions: function () {

			// -------------------------
			// Proxy Server Subscriptions
			var serverExistingNames = [];
			for (let i = 0; i < settings.proxyServerSubscriptions.length; i++) {
				let subscription = settings.proxyServerSubscriptions[i];
				if (!subscription.enabled) continue;

				// refresh is not requested
				if (!(subscription.refreshRate > 0))
					continue;

				// it should be active, don't remove it
				serverExistingNames.push(subscription.name);

				let shouldCreate = false;
				let serverTimerInfo = timerManagement.getServerSubscriptionTimer(subscription.name);
				if (serverTimerInfo == null) {
					// should be created
					shouldCreate = true;
				} else {

					// should be updated if rates are changed
					if (serverTimerInfo.timer.refreshRate != subscription.refreshRate) {
						shouldCreate = true;
						clearInterval(serverTimerInfo.timer.id);

						// remove from array
						timerManagement.serverSubscriptionTimers.splice(serverTimerInfo.index, 1);
					}
				}

				if (shouldCreate) {
					let internval = subscription.refreshRate * 60 * 1000;
					//internval = 1000;
					let id = setInterval(
						timerManagement.readServerSubscription,
						internval,
						subscription.name);

					timerManagement.serverSubscriptionTimers.push({
						id: id,
						name: subscription.name,
						refreshRate: subscription.refreshRate
					});
				}
			}
			// remove the remaining timers
			for (let i = timerManagement.serverSubscriptionTimers.length - 1; i >= 0; i--) {
				var timer = timerManagement.serverSubscriptionTimers[i];

				// it is created or updated, don't remove it
				if (serverExistingNames.indexOf(timer.name) !== -1) {
					continue;
				}

				// not used or removed. Just unregister it then remove it
				clearInterval(timer.id);

				// remove from array
				timerManagement.serverSubscriptionTimers.splice(i, 1);
			}

			// -------------------------
			// Proxy Rules Subscriptions
			// TODO
		},
		readServerSubscription: function (subscriptionName) {
			debug.log("readServerSubscription", subscriptionName);
			if (!subscriptionName)
				return;


			var subscription = null;
			for (var i = 0; i < settings.proxyServerSubscriptions.length; i++) {
				var item = settings.proxyServerSubscriptions[i];
				if (item.name == subscriptionName) {
					subscription = item;
					break;
				}
			}
			if (subscription == null) {
				// the subscription is removed.
				//remove the timer
				let serverTimerInfo = timerManagement.getServerSubscriptionTimer(subscriptionName);

				if (!serverTimerInfo)
					return;

				clearInterval(serverTimerInfo.timer.id);
				timerManagement.serverSubscriptionTimers.splice(serverTimerInfo.index, 1);
				return;
			}

			proxyImporter.readFromServer(subscription,
				function (response) {
					if (!response) return;

					if (response.success) {

						var count = response.result.length;

						subscription.proxies = response.result;
						subscription.totalCount = count;

						settingsOperation.saveProxyServerSubscriptions();

					} else {
						debug.warn("Failed to read proxy server subscription: " + subscriptionName);
					}
				},
				function (ex) {
					debug.warn("Failed to read proxy server subscription: " + subscriptionName, subscription, ex);
				});
		},
		getServerSubscriptionTimer: function (name) {
			for (var i = 0; i < timerManagement.serverSubscriptionTimers.length; i++) {
				var timer = timerManagement.serverSubscriptionTimers[i];

				if (timer.name == name)
					return {
						timer: timer,
						index: i
					};
			}
			return null;
		},
		getRulesSubscriptionTimersTimer: function (name) {
			for (var i = 0; i < timerManagement.rulesSubscriptionTimers.length; i++) {
				var timer = timerManagement.rulesSubscriptionTimers[i];

				if (timer.name == name)
					return {
						timer: timer,
						index: i
					};
			}
			return null;
		}
	};
	var internal = {
		getDataForProxyScript: function () {

			return {
				proxyRules: settings.proxyRules,
				proxyMode: settings.proxyMode,
				activeProxyServer: settings.activeProxyServer
			};
		},
		getDataForSettingsUi: function () {

			return settings;
		},
		getAllSubscribedProxyServers: function () {

			if (!settings.proxyServerSubscriptions || !settings.proxyServerSubscriptions.length)
				return [];
			var result = [];

			for (let i = 0; i < settings.proxyServerSubscriptions.length; i++) {
				var subsription = settings.proxyServerSubscriptions[i];
				if (!subsription.enabled) continue;;

				for (var pindex = 0; pindex < subsription.proxies.length; pindex++) {
					var proxy = subsription.proxies[pindex];

					result.push(proxy);
				}
			}
			return result;
		},
		getDataForPopup: function () {
			///<summary>The data that is required for the popup</summary>
			var dataForPopup = {
				proxiableDomains: [],
				proxyMode: settings.proxyMode,
				hasProxyServers: settings.proxyServers.length > 0,
				proxyServers: settings.proxyServers,
				activeProxyServer: settings.activeProxyServer,
				restartRequired: restartRequired,
				currentTabId: null,
				currentTabIndex: null,
				proxyServersSubscribed: internal.getAllSubscribedProxyServers()
			};

			if (currentTab == null)
				return dataForPopup;

			let tabId = currentTab.id;
			let tabData = loggedRequests[tabId];
			if (tabData == null)
				return dataForPopup;

			// tab info
			dataForPopup.currentTabId = currentTab.id;
			dataForPopup.currentTabIndex = currentTab.index;

			// get the host name from url
			let urlHost = utils.extractHostFromUrl(tabData.url);

			// current url should be valid
			if (!utils.isValidHost(urlHost))
				return dataForPopup;

			// extract list of domain and subdomains
			var proxiableDomainList = utils.extractSubdomainsFromHost(urlHost);

			if (!proxiableDomainList || !proxiableDomainList.length)
				return dataForPopup;

			// check if there are rules for the domains
			if (proxiableDomainList.length == 1) {

				let testResult = proxyRules.testSingleRule(proxiableDomainList[0]);
				let ruleIsForThisHost = false;

				if (testResult.match) {
					// check to see if the matched rule is for this host or not!
					// sources are same
					if (testResult.source == proxiableDomainList[0]) {
						ruleIsForThisHost = true;
					}
				}

				// add the domain
				dataForPopup.proxiableDomains.push({
					domain: proxiableDomainList[0],
					pattern: testResult.pattern /* only if match */,
					hasMatchingRule: testResult.match,
					ruleIsForThisHost: ruleIsForThisHost
				});

			} else {

				var multiTestResultList = proxyRules.testMultipleRule(proxiableDomainList);

				for (var i = 0; i < multiTestResultList.length; i++) {
					var result = multiTestResultList[i];

					let ruleIsForThisHost = false;
					if (result.match) {
						// check to see if the matched rule is for this host or not!
						if (result.source == proxiableDomainList[i]) {
							ruleIsForThisHost = true;
						}
					}

					// add the domain
					dataForPopup.proxiableDomains.push({
						domain: result.domain,
						pattern: result.pattern /* only if match */,
						hasMatchingRule: result.match,
						ruleIsForThisHost: ruleIsForThisHost
					});
				}
			}
			return dataForPopup;
		},
		setBrowserActionStatus: function () {
			var extensionName = browser.i18n.getMessage("extensionName");

			switch (settings.proxyMode) {

				case proxyModeType.direct:

					browser.browserAction.setTitle({ title: `${extensionName} : ${browser.i18n.getMessage("popupNoProxy")}` });
					polyfill.browserActionSetIcon({
						path: {
							16: "icons/proxymode-disabled-16.png",
							32: "icons/proxymode-disabled-32.png",
							48: "icons/proxymode-disabled-48.png"
						}
					});
					break;

				case proxyModeType.always:

					browser.browserAction.setTitle({ title: `${extensionName} : ${browser.i18n.getMessage("popupAlwaysEnable")}` });
					polyfill.browserActionSetIcon({
						path: {
							16: "icons/proxymode-always-16.png",
							32: "icons/proxymode-always-32.png",
							48: "icons/proxymode-always-48.png"
						}
					});
					break;

				case proxyModeType.systemProxy:

					browser.browserAction.setTitle({ title: `${extensionName} : ${browser.i18n.getMessage("popupSystemProxy")}` });
					polyfill.browserActionSetIcon({
						path: {
							16: "icons/proxymode-system-16.png",
							32: "icons/proxymode-system-32.png",
							48: "icons/proxymode-system-48.png"
						}
					});
					break;

				case proxyModeType.smartProxy:
				default:

					browser.browserAction.setTitle({ title: `${extensionName} : ${browser.i18n.getMessage("popupSmartProxy")}` });
					polyfill.browserActionSetIcon({
						path: {
							16: "icons/smartproxy-16.png",
							24: "icons/smartproxy-24.png",
							48: "icons/smartproxy-48.png",
							96: "icons/smartproxy-96.png"
						}
					});
					break;
			}
		}
	};

	// --------------------------------------
	// the starting point

	// read the settings
	settingsOperation.initialize(function () {
		// on settings read success

		// register the proxy when config is ready
		registerProxy();

		// set the title
		internal.setBrowserActionStatus();

		// update the timers
		timerManagement.updateSubscriptions();
	});

	// start handling messages
	browser.runtime.onMessage.addListener(handleMessages);

	// register the request logger
	requestLogger.startLogger();

	// always knowing who is active
	trackActiveTab();

})();
