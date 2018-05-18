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
let loggedRequests = {};
let tabPorxyableLogIdList = [];
let restartRequired = false;
let settings = {
	proxyMode: "1",
	// patterns can be https://mozilla.org/*/b/*/ or https://mozilla.org/path/*
	proxyRules: [{ pattern: "*://*.salarcode.com/*", source: "salarcode.com", proxy: null, enabled: false }],
	activeProxyServer: null,
	options: {
		syncSettings: false,
		detectRequestFailures: false,
		displayFailedOnBadge: false,
		displayAppliedProxyOnBadge: false
	},
	proxyServers: [
		{
			name: "name",
			host: "host",
			port: 8080,
			protocol: "HTTP",
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
	],
	bypass: {
		enableForAlways: false,
		enableForSystem: false,
		bypassList: ["127.0.0.1", "localhost", "::1"]
	}
};

(function () {
	const proxyScriptURL = "core-firefox-proxy.js";
	const proxyScriptExtentionURL = browser.runtime.getURL(proxyScriptURL);
	let currentTab = null;
	let currentOptionsSyncSettings = false;

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
			let noOp = function () { };

			window.debug = {
				log: noOp,
				error: noOp,
				warn: noOp,
				info: noOp
			}
		}
	}

	// Uncomment when debugging
	//setDebug(true);
	setDebug(false);

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

					let proxyInitData = internal.getDataForProxyScript();

					// send the rules
					sendResponse(proxyInitData);
				}
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
			let commad = message["command"];

			if (commad == "changeProxyMode" &&
				message["proxyMode"] != null) {

				let newProxyMode = message["proxyMode"];

				settings.proxyMode = newProxyMode;

				// save the changes
				settingsOperation.saveProxyMode();
				settingsOperation.saveAllSync();

				// send it to the proxy server
				proxyRules.notifyProxyModeChange();

				// update proxy rules
				proxyRules.updateChromeProxyConfig();

				// update active proxy tab status
				internal.setBrowserActionStatus();

				return;
			}
			if (commad == "changeActiveProxyServer" &&
				message["name"] != null) {

				let proxyName = message["name"];
				let proxy = settingsOperation.findProxyServerByName(proxyName);
				if (proxy != null) {

					settings.activeProxyServer = proxy;
					settingsOperation.saveActiveProxyServer();
					settingsOperation.saveAllSync();

					// send it to the proxy server
					proxyRules.notifyActiveProxyServerChange();

					// update proxy rules
					proxyRules.updateChromeProxyConfig();

					// update active proxy tab status
					internal.setBrowserActionStatus();

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

				// update active proxy tab status
				updateTabDataProxyInfo();
				internal.setBrowserActionStatus();

				return;
			}

			if (commad == "addDomainListToProxyRuleFromTab" &&
				message["domainList"] != null) {

				let domainList = message["domainList"];
				let tabId = message["tabId"];


				proxyRules.addDomainList(domainList);

				let updatedFailedRequests = removeDomainsFromtabFailedRequests(tabId, domainList);

				// notify the proxy script
				proxyRules.notifyProxyRulesChange();

				// update proxy rules
				proxyRules.updateChromeProxyConfig();

				// update active proxy tab status
				updateTabDataProxyInfo();
				internal.setBrowserActionStatus();

				// send the responses
				if (updatedFailedRequests != null && sendResponse) {
					sendResponse({
						failedRequests: updatedFailedRequests
					});
				}

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

				// update active proxy tab status
				updateTabDataProxyInfo();
				internal.setBrowserActionStatus();

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
				settingsOperation.saveAllSync();

				proxyRules.notifyActiveProxyServerChange();

				// update proxy rules
				proxyRules.updateChromeProxyConfig();

				if (sendResponse) {
					sendResponse({
						success: true,
						message: "Proxy servers saved successfully.",
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
				settingsOperation.saveAllSync();

				proxyRules.notifyProxyRulesChange();

				// update proxy rules
				proxyRules.updateChromeProxyConfig();

				// update active proxy tab status
				updateTabDataProxyInfo();
				internal.setBrowserActionStatus();

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
				settingsOperation.saveAllSync();

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

			if (commad == "settingsSaveBypass" &&
				message["bypass"] != null) {

				settings.bypass = message.bypass;
				settingsOperation.saveBypass();
				settingsOperation.saveAllSync();

				proxyRules.notifyBypassChanged();

				// update proxy rules
				proxyRules.updateChromeProxyConfig();

				if (sendResponse) {
					sendResponse({
						success: true,
						// Proxy server subscriptions saved successfully.
						message: browser.i18n.getMessage("settingsSaveBypassSuccess"),
						restartRequired: restartRequired
					});
				}
				return;
			}

			if (commad == "settingsSaveOptions" &&
				message["options"] != null) {

				settings.options = message.options;
				settingsOperation.saveOptions();
				settingsOperation.saveAllSync();

				// update proxy rules
				proxyRules.updateChromeProxyConfig();

				if (sendResponse) {
					sendResponse({
						success: true,
						// General options saved successfully.
						message: browser.i18n.getMessage("settingsSaveOptionsSuccess"),
						restartRequired: restartRequired
					});
				}
				return;
			}

			if (commad == "restoreSettings" &&
				message["fileData"] != null) {

				let fileData = message.fileData;
				let result = settingsOperation.restoreSettings(fileData);

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
				url: "",
				incognito: false,
				failedRequests: new Map()
			};

		// check proxy rule
		if (tabData.url != tabInfo.url ||
			tabData.proxified == null) {

			tabData.url = tabInfo.url;

			updateTabDataProxyInfo(tabData);
			internal.setBrowserActionStatus(tabData);
		}

		tabData.updated = new Date();
		tabData.incognito = tabInfo.incognito;
		tabData.url = tabInfo.url;

		// saveing the tab in the storage
		loggedRequests[tabId] = tabData;

		return tabData;
	}

	function updateTabDataProxyInfo(tabData) {
		if (!tabData) {
			if (!currentTab)
				return;
			let tabId = currentTab.tabId;
			tabData = loggedRequests[tabId];

			if (!tabData)
				return;
		}

		if (!tabData.url)
			return;

		let proxyResult = proxyRules.testSingleRule(tabData.url);

		if (proxyResult.match) {
			tabData.proxified = true;
			tabData.proxySource = proxyResult.source;
		} else {
			tabData.proxified = false;
			tabData.proxySource = null;
		}
	}

	function convertFailedRequestsToArray(failedRequests) {
		///<summary>Converts failed to array</summary>
		let result = [];

		failedRequests.forEach(function (value, key, map) {
			result.push(value);
		});

		return result;
	}

	function failedRequestsNotProxifiedCount(failedRequests) {
		///<summary>Number of not proxified requests</summary>
		let failedCount = 0;

		failedRequests.forEach(function (request, key, map) {

			if (request.hasRule)
				return;

			if (request.isMain)
				failedCount += request.hitCount;
		});

		return failedCount;
	}

	function requestMonitorCallback(event, requestDetails) {
		let tabId = requestDetails.tabId;
		let tabData = loggedRequests[tabId];

		if (!tabData)
			return;

		let requestId = requestDetails.requestId;
		let requestUrl = requestDetails.url;
		let requestHost = utils.extractHostFromUrl(requestUrl);

		let failedRequests = tabData.failedRequests || (tabData.failedRequests = new Map());

		switch (event) {
			case webRequestMonitor.eventTypes.requestComplete:
			case webRequestMonitor.eventTypes.requestRevertTimeout:
				{
					// remove the log
					var removed = failedRequests.delete(requestHost);

					if (removed) {
						// if there was an entry

						// send message to the tab
						polyfill.runtimeSendMessage(
							{
								command: "webRequestMonitor",
								tabId: tabId,
								failedRequests: convertFailedRequestsToArray(failedRequests),
								failedInfo: null
							});

						internal.setBrowserActionStatus(tabData);
					}
					break;
				}

			case webRequestMonitor.eventTypes.requestRedirected:
				{
					// here we check that the redirected location is in black-listed urls or not
					// if it is black-listed then it should be considered to be added to filter suggestions
					// BUG No #37: https://github.com/salarcode/SmartProxy/issues/37

					// TODO: Implement in vFuture
					let redirectUrl = requestDetails.redirectUrl;


					let failedInfo = failedRequests.get(requestHost);
					if (!failedInfo) {

						// remove the log
						failedRequests.delete(requestHost);

						// send message to the tab
						polyfill.runtimeSendMessage(
							{
								command: "webRequestMonitor",
								tabId: tabId,
								failedRequests: convertFailedRequestsToArray(failedRequests),
								failedInfo: failedInfo
							});

						internal.setBrowserActionStatus(tabData);
					}

					break;
				}

			case webRequestMonitor.eventTypes.requestTimeoutAborted:
				{
					// request is either aborted or timeout, doesn't matter
					// it should not be considered as failed.

					let failedInfo = failedRequests.get(requestHost);
					if (!failedInfo) {

						// remove the log
						failedRequests.delete(requestHost);

						// send message to the tab
						polyfill.runtimeSendMessage(
							{
								command: "webRequestMonitor",
								tabId: tabId,
								failedRequests: convertFailedRequestsToArray(failedRequests),
								failedInfo: failedInfo
							});

						internal.setBrowserActionStatus(tabData);
					}

					break;
				}

			case webRequestMonitor.eventTypes.requestTimeout:
			case webRequestMonitor.eventTypes.requestError:
				{
					let failedInfo = failedRequests.get(requestHost);
					if (!failedInfo) {

						let shouldNotify = false;
						let requestHostSubDomains = utils.extractSubdomainsFromHost(requestHost);
						if (requestHostSubDomains && requestHostSubDomains.length > 1) {

							let multiTestResultList = proxyRules.testMultipleRule(requestHostSubDomains);
							let requestHostHasRule = false;

							// checking if the request itself has rule or not
							for (let result of multiTestResultList) {
								if (result.domain == requestHost &&
									result.match) {

									requestHostHasRule = true;
									break;
								}
							}

							// add only if the request doesn't have rule
							if (!requestHostHasRule) { // adding the subdomains and top-level domain all together
								for (let i = 0; i < multiTestResultList.length; i++) {
									let result = multiTestResultList[i];

									let ruleIsForThisHost = false;
									// check to see if the matched rule is for this host or not!
									if (result.source == requestHostSubDomains[i]) {
										ruleIsForThisHost = true;
									}

									failedInfo = {
										url: requestDetails.url,
										domain: result.domain,
										hitCount: 1,
										hasRule: result.match,
										ruleIsForThisHost: ruleIsForThisHost,
										isMain: requestHost == result.domain
									};

									// add to the list
									failedRequests.set(result.domain, failedInfo);
									if (!result.match)
										shouldNotify = true;
								}
							} else {
								// the root has match, just add it to prevent further checks
								failedInfo = {
									url: requestDetails.url,
									domain: requestHost,
									hitCount: 1,
									hasRule: true
								};

								// add to the list
								failedRequests.set(requestHost, failedInfo);
							}

							if (shouldNotify) {
								// send message to the tab
								// only on the first hit
								polyfill.runtimeSendMessage(
									{
										command: "webRequestMonitor",
										tabId: tabId,
										failedRequests: convertFailedRequestsToArray(failedRequests),
										failedInfo: failedInfo
									});

								internal.setBrowserActionStatus(tabData);
							}

						} else {
							failedInfo = {
								url: requestDetails.url,
								domain: requestHost,
								hitCount: 1,
								hasRule: false
							};

							let testRuesult = proxyRules.testSingleRule(requestUrl);
							if (testRuesult.match) {
								// there is a rule for this url, so don't bother
								// we are just adding this to prevent
								// further call to 'proxyRules.testSingleRule' which is expensive
								failedInfo.hasRule = true;
							}

							// add to the list
							failedRequests.set(requestHost, failedInfo);

							// send only if there is no rule
							if (!failedInfo.hasRule) {
								// send message to the tab
								// only on the first hit
								polyfill.runtimeSendMessage(
									{
										command: "webRequestMonitor",
										tabId: tabId,
										failedRequests: convertFailedRequestsToArray(failedRequests),
										failedInfo: failedInfo
									});

								internal.setBrowserActionStatus(tabData);
							}
						}

					} else {
						if (event === webRequestMonitor.eventTypes.requestError ||
							event === webRequestMonitor.eventTypes.requestTimeoutAborted) {

							// only on error increase hit count
							failedInfo.hitCount += 1;
						}
					}
				}
		}

	}

	function removeDomainsFromtabFailedRequests(tabId, domainList) {
		if (!(tabId > -1))
			return null;
		if (!domainList || !domainList.length)
			return null;

		let tabData = loggedRequests[tabId];

		if (!tabData) return null;

		let failedRequests = tabData.failedRequests;
		if (!failedRequests) return null;

		for (let domain of domainList) {
			failedRequests.delete(domain);
		}

		// rechecking the failed requests
		failedRequests.forEach(function (request, key, map) {
			let testRuesult = proxyRules.testSingleRule(request.domain);

			if (testRuesult.match) {
				failedRequests.delete(request.domain);
			}
		});

		return failedRequests;
	}

	const requestLogger = {

		startLogger: function () {

			browser.webRequest.onBeforeRequest.addListener(
				requestLogger.logRequest,
				{ urls: ["<all_urls>"] }
			);
			browser.tabs.onRemoved.addListener(requestLogger.handleTabRemoved);
			browser.tabs.onUpdated.addListener(requestLogger.handleTabUpdated);
		},
		logRequest: function (requestDetails) {
			let tabId = requestDetails.tabId;
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
					url: "",
					incognito: false,
					failedRequests: new Map()
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
			let proxyableData = requestLogger.getProxyableDataForUrl(url);

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
			let index = tabPorxyableLogIdList.indexOf(tabId);
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

			let testRuesult = proxyRules.testSingleRule(url);

			return {
				url: url,
				enabled: testRuesult.match,
				source: testRuesult.source,
				pattern: testRuesult.pattern
			}
		},
		addToPorxyableLogIdList: function (tabId) {
			///<summary>remove from summary list</summary>
			let index = tabPorxyableLogIdList.indexOf(tabId);

			// only one instance
			if (index == -1) {
				tabPorxyableLogIdList.push(tabId);
			}
		},
		removeFromPorxyableLogIdList: function (tabId) {
			///<summary>remove from summary list</summary>
			let index = tabPorxyableLogIdList.indexOf(tabId);
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

			let tabData = loggedRequests[tabId];
			let shouldReset = false;

			if (changeInfo["status"] === "loading") {
				shouldReset = true;
			}
			else if (changeInfo["url"]) {

				if (tabData != null &&
					// only if url is changed
					changeInfo.url != tabData.url) {

					// reset
					shouldReset = true;
				}
			}

			if (shouldReset) {
				// reload the tab data

				if (tabData) {
					tabData.requests.clear();
					if (tabData.failedRequests)
						tabData.failedRequests.clear();
				}
				delete loggedRequests[tabId];
			}
		}

	}

	const webRequestProxyAuthentication = {
		pendingRequests: {},
		startMonitor: function () {
			if (environment.chrome) {
				// chrome supports asyncBlocking
				browser.webRequest.onAuthRequired.addListener(webRequestProxyAuthentication.onAuthRequiredChromeAsync,
					{ urls: ["<all_urls>"] },
					["asyncBlocking"]
				);
			} else {
				browser.webRequest.onAuthRequired.addListener(webRequestProxyAuthentication.onAuthRequired,
					{ urls: ["<all_urls>"] },
					["blocking"]
				);

			}
			browser.webRequest.onCompleted.addListener(
				webRequestProxyAuthentication.onRequestFinished,
				{ urls: ["<all_urls>"] }
			);

			browser.webRequest.onErrorOccurred.addListener(
				webRequestProxyAuthentication.onRequestFinished,
				{ urls: ["<all_urls>"] }
			);
		},
		onAuthRequiredChromeAsync: function (requestDetails, asyncCallback) {
			if (!requestDetails.isProxy) {
				asyncCallback({});
				return {};
			}

			let applyAuthentication = (settings.proxyMode !== proxyModeType.direct) &&
				(settings.proxyMode !== proxyModeType.systemProxy);

			let activeProxy = settings.activeProxyServer;

			if (applyAuthentication &&
				activeProxy &&
				activeProxy.username && activeProxy.password)
				applyAuthentication = true;
			else
				applyAuthentication = false;

			if (asyncCallback) {
				// this is chrome

				// check if authentication is required
				if (!applyAuthentication) {

					asyncCallback({});
					return {};
				}

				// check if authentication is already provided
				if (webRequestProxyAuthentication.pendingRequests[requestDetails.requestId]) {

					asyncCallback({ cancel: true });
					return { cancel: true };
				}

				// add this request to pending list
				webRequestProxyAuthentication.pendingRequests[requestDetails.requestId] = true;

				asyncCallback({
					authCredentials: { username: activeProxy.username, password: activeProxy.password }
				});
			} else {
				// check if authentication is required
				if (!applyAuthentication) {
					return {};
				}

				// check if authentication is already provided
				if (webRequestProxyAuthentication.pendingRequests[requestDetails.requestId]) {
					return { cancel: true };
				}

				// add this request to pending list
				webRequestProxyAuthentication.pendingRequests[requestDetails.requestId] = true;

				return {
					authCredentials: { username: activeProxy.username, password: activeProxy.password }
				};
			}
		},
		onAuthRequired: function (requestDetails) {
			if (!requestDetails.isProxy) {
				return {};
			}

			let applyAuthentication = (settings.proxyMode !== proxyModeType.direct) &&
				(settings.proxyMode !== proxyModeType.systemProxy);

			let activeProxy = settings.activeProxyServer;

			if (applyAuthentication &&
				activeProxy &&
				activeProxy.username && activeProxy.password)
				applyAuthentication = true;
			else
				applyAuthentication = false;

			// check if authentication is required
			if (!applyAuthentication) {
				return {};
			}

			// check if authentication is already provided
			if (webRequestProxyAuthentication.pendingRequests[requestDetails.requestId]) {
				return { cancel: true };
			}

			// add this request to pending list
			webRequestProxyAuthentication.pendingRequests[requestDetails.requestId] = true;

			return {
				authCredentials: { username: activeProxy.username, password: activeProxy.password }
			};
		},
		onRequestFinished: function (requestDetails) {
			delete webRequestProxyAuthentication.pendingRequests[requestDetails.requestId];
		}
	};
	const webRequestMonitor = {
		verbose: false,
		requests: {},
		monitorCallback: null,
		startMonitor: function (callback) {

			if (webRequestMonitor.internal.isMonitoring)
				return;

			browser.webRequest.onBeforeRequest.addListener(webRequestMonitor.events.onBeforeRequest,
				{ urls: ["<all_urls>"] }
			);
			browser.webRequest.onHeadersReceived.addListener(webRequestMonitor.events.onHeadersReceived,
				{ urls: ["<all_urls>"] }
			);
			browser.webRequest.onBeforeRedirect.addListener(webRequestMonitor.events.onBeforeRedirect,
				{ urls: ["<all_urls>"] }
			);
			browser.webRequest.onErrorOccurred.addListener(webRequestMonitor.events.onErrorOccurred,
				{ urls: ["<all_urls>"] }
			);
			browser.webRequest.onCompleted.addListener(webRequestMonitor.events.onCompleted,
				{ urls: ["<all_urls>"] }
			);
			webRequestMonitor.monitorCallback = callback;
		},
		internal: {
			requestTimeoutTime: 5000,
			isMonitoring: false,
			timer: null,
			timerTick: function () {

				let now = Date.now();
				let reqIds = Object.keys(webRequestMonitor.requests);
				let requestTimeoutTime = webRequestMonitor.internal.requestTimeoutTime;

				for (let i = reqIds.length - 1; i >= 0; i--) {
					let reqId = reqIds[i];

					if (reqId === undefined)
						continue;

					// get the request info
					let req = webRequestMonitor.requests[reqId];
					if (!req) continue;

					if (now - req._startTime < requestTimeoutTime) {
						continue;
					} else {
						req._isTimedOut = true;

						// callback request-timeout
						webRequestMonitor.events.raiseCallback(webRequestMonitor.eventTypes.requestTimeout, req);

						if (webRequestMonitor.verbose)
							webRequestMonitor.internal.logMessage(webRequestMonitor.eventTypes.requestTimeout, req);
					}
				}
			},

			logMessage: function (message, requestDetails, additional) {
				debug.log(`${requestDetails.tabId}-${requestDetails.requestId}>`, message, requestDetails.url, additional || "");
			}
		},
		eventTypes: {
			requestStart: "request-start",
			requestTimeout: "request-timeout",
			requestRevertTimeout: "request-revert-timeout",
			requestRedirected: "request-redirected",
			requestComplete: "request-complete",
			requestTimeoutAborted: "request-timeout-aborted",
			requestError: "request-error"
		},
		events: {
			raiseCallback: function () {
				if (webRequestMonitor.monitorCallback)
					webRequestMonitor.monitorCallback.apply(this, arguments);
			},
			onBeforeRequest: function (requestDetails) {
				if (requestDetails.tabId < 0) {
					return;
				}

				let reqInfo = requestDetails;
				reqInfo._startTime = new Date();
				reqInfo._isHealthy = false;

				// add to requests
				webRequestMonitor.requests[requestDetails.requestId] = requestDetails;

				if (!webRequestMonitor.internal.timer) {
					webRequestMonitor.internal.timer = setInterval(webRequestMonitor.internal.timerTick, 1500);
				}

				// callback request-start
				webRequestMonitor.events.raiseCallback(webRequestMonitor.eventTypes.requestStart, requestDetails);

				if (webRequestMonitor.verbose)
					webRequestMonitor.internal.logMessage(webRequestMonitor.eventTypes.requestStart, requestDetails);

			},
			onHeadersReceived: function (requestDetails) {
				let req = webRequestMonitor.requests[requestDetails.requestId];
				if (!req)
					return;

				req._isHealthy = true;

				if (req._isTimedOut) {
					// call the callbacks indicating the request is healthy
					// callback request-revert-from-timeout
					webRequestMonitor.events.raiseCallback(webRequestMonitor.eventTypes.requestRevertTimeout, requestDetails);

					if (webRequestMonitor.verbose)
						webRequestMonitor.internal.logMessage(webRequestMonitor.eventTypes.requestRevertTimeout, requestDetails);
				}


			},
			onBeforeRedirect: function (requestDetails) {
				let url = requestDetails.redirectUrl;
				if (!url)
					return;

				// callback request-revert-from-timeout
				webRequestMonitor.events.raiseCallback(webRequestMonitor.eventTypes.requestRedirected, requestDetails);

				if (webRequestMonitor.verbose)
					webRequestMonitor.internal.logMessage(webRequestMonitor.eventTypes.requestRedirected, requestDetails, "to> " + requestDetails.redirectUrl);

				// because 'requestId' doesn't change for redirects
				// the request is basicly is still the same
				// note that 'request-start' will happen after redirect

				if (url.indexOf("data:") === 0 || url.indexOf("about:") === 0) {

					// request is completed when redirecting to local pages
					webRequestMonitor.events.onCompleted(requestDetails);
				}
			},
			onCompleted: function (requestDetails) {
				if (requestDetails.tabId < 0) {
					return;
				}

				delete webRequestMonitor.requests[requestDetails.requestId];

				// callback request-complete
				webRequestMonitor.events.raiseCallback(webRequestMonitor.eventTypes.requestComplete, requestDetails);

				if (webRequestMonitor.verbose)
					webRequestMonitor.internal.logMessage(webRequestMonitor.eventTypes.requestComplete, requestDetails);
			},
			onErrorOccurred: function (requestDetails) {

				let req = webRequestMonitor.requests[requestDetails.requestId];
				delete webRequestMonitor.requests[requestDetails.requestId];

				if (requestDetails.tabId < 0)
					return;

				if (!req)
					return;

				// details.error
				if (requestDetails.tabId < 0) {
					return;
				}
				if (requestDetails.error === "net::ERR_INCOMPLETE_CHUNKED_ENCODING") {
					return;
				}
				if (requestDetails.error.indexOf("BLOCKED") >= 0) {
					return;
				}
				if (requestDetails.error.indexOf("net::ERR_FILE_") === 0) {
					return;
				}
				if (requestDetails.error.indexOf("NS_ERROR_ABORT") === 0) {
					return;
				}
				if (requestDetails.url.indexOf("file:") === 0) {
					return;
				}
				if (requestDetails.url.indexOf("chrome") === 0) {
					return;
				}
				if (requestDetails.url.indexOf("about:") === 0) {
					return;
				}
				if (requestDetails.url.indexOf("moz-") === 0) {
					return;
				}
				if (requestDetails.url.indexOf("://127.0.0.1") > 0) {
					return;
				}

				if (requestDetails.error === "net::ERR_ABORTED") {
					if (req.timeoutCalled && !req.noTimeout) {

						// callback request-timeout-aborted
						webRequestMonitor.events.raiseCallback(webRequestMonitor.eventTypes.requestTimeoutAborted, requestDetails);

						if (webRequestMonitor.verbose)
							webRequestMonitor.internal.logMessage(webRequestMonitor.eventTypes.requestTimeoutAborted, requestDetails);

					}
					return;
				}

				// callback request-error
				webRequestMonitor.events.raiseCallback(webRequestMonitor.eventTypes.requestError, requestDetails);

				if (webRequestMonitor.verbose)
					webRequestMonitor.internal.logMessage(webRequestMonitor.eventTypes.requestError, requestDetails);

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

	const settingsOperation = {
		setDefaultSettings: function (settingObj) {

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
			if (settingObj["bypass"] == null) {
				settingObj.bypass = {
					enableForAlways: false,
					enableForSystem: false,
					bypassList: ["127.0.0.1", "localhost", "::1"]
				};
			}
			if (settingObj["options"] == null) {
				settingObj.options = {};
			}
			settingObj.product = "SmartProxy";

			polyfill.managementGetSelf(function (info) {
				settingObj.version = info.version;
			});
		},
		readSyncedSettings: function (success) {
			// gettin synced data
			polyfill.storageSyncGet(null,
				onGetSyncData,
				onGetSyncError);

			function onGetSyncData(data) {

				try {
					let syncedSettings = settingsOperation.decodeSyncData(data);

					// only if sync settings is enabled
					if (syncedSettings &&
						syncedSettings.options) {

						if (syncedSettings.options.syncSettings) {

							// use synced settings
							//settings = migrateFromOldVersion(syncedSettings);
							settings = syncedSettings;
							settingsOperation.setDefaultSettings(settings);

						} else {
							// sync is disabled
							syncedSettings.options.syncSettings = false;
						}

						currentOptionsSyncSettings = syncedSettings.options.syncSettings;
					}
				} catch (e) {
					debug.error(`settingsOperation.readSyncedSettings> onGetSyncData error: ${e} \r\n ${data}`);
				}
			}
			function onGetSyncError(error) {
				debug.error(`settingsOperation.readSyncedSettings error: ${error.message}`);
			}
		},
		initialize: function (success) {
			///<summary>The initialization method</summary>
			function onGetLocalData(data) {
				// all the settings
				settings = migrateFromOldVersion(data);
				settingsOperation.setDefaultSettings(settings);

				// read all the synced data along with synced ones
				polyfill.storageSyncGet(null,
					onGetSyncData,
					onGetSyncError);
			}
			function onGetSyncData(data) {

				try {
					let syncedSettings = settingsOperation.decodeSyncData(data);

					// only if sync settings is enabled
					if (syncedSettings &&
						syncedSettings.options) {

						if (syncedSettings.options.syncSettings) {

							// use synced settings
							settings = migrateFromOldVersion(syncedSettings);
							settingsOperation.setDefaultSettings(settings);

						} else {
							// sync is disabled
							syncedSettings.options.syncSettings = false;
						}

						currentOptionsSyncSettings = syncedSettings.options.syncSettings;
					}
				} catch (e) {
					debug.error(`settingsOperation.onGetSyncData error: ${e} \r\n ${data}`);
				}

				if (success) {
					success();
				}
			}
			function onGetLocalError(error) {
				debug.error(`settingsOperation.initialize error: ${error.message}`);
			}
			function onGetSyncError(error) {
				debug.error(`settingsOperation.initialize error: ${error.message}`);

				// local settings should be used
				if (success) {
					success();
				}
			}
			function migrateFromOldVersion(data) {
				///<summary>Temporary migration for old version of this addon in Firefox. This method will be removed in the future</summary>
				if (!data) return data;
				let shouldMigrate = false;

				if (data.proxyRules &&
					data.proxyRules.length > 0) {

					let rule = data.proxyRules[0];

					// the old properties
					if (rule.hasOwnProperty("rule") ||
						!rule.hasOwnProperty("proxy")) {
						shouldMigrate = true;
					}
				}
				if (shouldMigrate) {

					let newProxyRules = [];
					for (let oldRule of data.proxyRules) {
						newProxyRules.push(
							{
								pattern: oldRule.rule || oldRule.pattern,
								source: oldRule.host || oldRule.source,
								enabled: oldRule.enabled,
								proxy: oldRule.proxy
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
			let proxy = settings.proxyServers.find(item => item.name === name);
			if (proxy !== undefined) return proxy;

			for (let subscription of settings.proxyServerSubscriptions) {
				proxy = subscription.proxies.find(item => item.name === name);
				if (proxy !== undefined) return proxy;
			}

			return null;
		},
		encodeSyncData: function (inputObject) {

			let settingStr = JSON.stringify(inputObject);

			// encode string to utf8
			let enc = new TextEncoder("utf-8");
			let settingArray = enc.encode(settingStr);

			// compress
			let compressResultStr = pako.deflateRaw(settingArray, { to: "string" });
			compressResultStr = utils.b64EncodeUnicode(compressResultStr);

			let saveObject = {};

			// some browsers have limitation on data size per item
			// so we have split the data into chunks saved in a object
			splitIntoChunks(compressResultStr, saveObject);

			function splitIntoChunks(str, outputObject) {
				let length = environment.storageQuota.syncQuotaBytesPerItem();
				if (length > 0) {

					let chunks = utils.chunkString(str, length);
					outputObject.chunkLength = chunks.length;

					for (let index = 0; index < chunks.length; index++) {
						outputObject["c" + index] = chunks[index];
					}

				} else {
					outputObject.c0 = str;
					outputObject.chunkLength = 1;
				}
			}

			return saveObject;
		},
		decodeSyncData: function (inputObject) {
			if (!inputObject || !inputObject.chunkLength)
				return null;

			// joining the chunks
			let chunks = [];
			for (let index = 0; index < inputObject.chunkLength; index++) {
				chunks.push(inputObject["c" + index]);
			}
			let compressResultStr = chunks.join("");

			// convert from base64 string
			compressResultStr = utils.b64DecodeUnicode(compressResultStr);

			// decompress
			let settingArray = pako.inflateRaw(compressResultStr);

			// decode array to string
			let dec = new TextDecoder();
			let settingStr = dec.decode(settingArray);

			// parse the JSON
			return JSON.parse(settingStr);
		},
		syncOnChanged: function (changes, area) {
			if (area !== "sync") return;

			debug.log("syncOnChanged ", area, changes);

			// read all the settings
			settingsOperation.readSyncedSettings(function () {
				// on settings read success

				// force to save changes to local
				settingsOperation.saveAllLocal(true);

				proxyRules.notifyProxyRulesChange();
				proxyRules.notifyActiveProxyServerChange();
				proxyRules.notifyProxyModeChange();
				proxyRules.notifyBypassChanged();

				// update proxy rules
				proxyRules.updateChromeProxyConfig();

			});
		},
		saveAllSync: function () {
			if (!settings.options.syncSettings &&
				!currentOptionsSyncSettings) {
				return;
			}

			// before anything save everything in local
			settingsOperation.saveAllLocal(true);

			let saveObject = settingsOperation.encodeSyncData(settings);

			try {
				polyfill.storageSyncSet(saveObject,
					function () {
						currentOptionsSyncSettings = settings.options.syncSettings;
					},
					function (error) {
						debug.error(`settingsOperation.saveAllSync error: ${error.message} ` + saveObject);
					});

			} catch (e) {
				debug.error(`settingsOperation.saveAllSync error: ${e}`);
			}
		},
		saveAllLocal: function (forceSave) {
			if (!forceSave && settings.options.syncSettings)
				// don't save in local when sync enabled
				return;

			polyfill.storageLocalSet(settings,
				null,
				function (error) {
					debug.error(`settingsOperation.saveAllLocal error: ${error.message}`);
				});
		},
		saveOptions: function () {
			if (settings.options.syncSettings)
				// don't save in local when sync enabled
				return;

			polyfill.storageLocalSet({ options: settings.options },
				null,
				function (error) {
					debug.error(`settingsOperation.saveOptions error: ${error.message}`);
				});
		},
		saveRules: function () {
			if (settings.options.syncSettings)
				// don't save in local when sync enabled
				return;

			polyfill.storageLocalSet({ proxyRules: settings.proxyRules },
				null,
				function (error) {
					debug.error(`settingsOperation.saveRules error: ${error.message}`);
				});
		},
		saveProxyServers: function () {
			if (settings.options.syncSettings)
				// don't save in local when sync enabled
				return;

			polyfill.storageLocalSet({ proxyServers: settings.proxyServers },
				null,
				function (error) {
					debug.error(`settingsOperation.saveRules error: ${error.message}`);
				});
		},
		saveProxyServerSubscriptions: function () {
			if (settings.options.syncSettings)
				// don't save in local when sync enabled
				return;

			polyfill.storageLocalSet({ proxyServerSubscriptions: settings.proxyServerSubscriptions },
				null,
				function (error) {
					debug.error(`settingsOperation.proxyServerSubscriptions error: ${error.message}`);
				});
		},
		saveBypass: function () {
			if (settings.options.syncSettings)
				// don't save in local when sync enabled
				return;

			polyfill.storageLocalSet({ bypass: settings.bypass },
				null,
				function (error) {
					debug.error(`settingsOperation.bypass error: ${error.message}`);
				});
		},
		saveActiveProxyServer: function () {
			if (settings.options.syncSettings)
				// don't save in local when sync enabled
				return;

			polyfill.storageLocalSet({ activeProxyServer: settings.activeProxyServer },
				null,
				function (error) {
					debug.error(`settingsOperation.saveRules error: ${error.message}`);
				});
		},
		saveProxyMode: function () {
			internal.setBrowserActionStatus();

			if (settings.options.syncSettings)
				// don't save in local when sync enabled
				return;

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

				//const currentServers = settings.proxyServers;

				//for (let cserver of currentServers) {
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
				let upcomingServers = [];
				for (let server of backupServers) {
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
				let upcomingRules = [];
				for (let rule of backupRules) {
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
			function restoreBypass(backupBypass) {

				if (backupBypass == null ||
					backupBypass.bypassList == null ||
					!Array.isArray(backupBypass.bypassList)) {
					return { success: false, message: browser.i18n.getMessage("settingsBypassInvalid") };
				}
				backupBypass.enableForAlways = backupBypass.enableForAlways || false;
				backupBypass.enableForSystem = backupBypass.enableForSystem || false;

				return { success: true, result: backupBypass };
			}

			try {
				let backupData = JSON.parse(fileData);
				let backupServers;
				let backupRules;
				let backupActiveServer;
				let backupProxyMode;
				let backupBypass;

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
				if (backupData["bypass"] != null &&
					typeof (backupData.bypass) == "object" &&
					Array.isArray(backupData.bypass.bypassList)) {

					let restoreProxyModeResult = restoreBypass(backupData.bypass);

					if (!restoreProxyModeResult.success)
						return restoreProxyModeResult;

					backupBypass = restoreProxyModeResult.result;
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

				if (backupBypass != null) {

					settings.bypass = backupBypass;

					settingsOperation.saveBypass();
					proxyRules.notifyBypassChanged();
				}

				// save synced if needed
				settingsOperation.saveAllSync();

				// update proxy rules
				proxyRules.updateChromeProxyConfig();

				return { success: true, message: browser.i18n.getMessage("settingsRestoreSettingsSuccess") }


			} catch (e) {
				return { success: false, message: browser.i18n.getMessage("settingsRestoreSettingsFailed") };
			}
		}
	}
	const proxyRules = {
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
		notifyBypassChanged: function () {

			// only for Firefox
			if (environment.chrome)
				return;

			if (environment.version < environment.bugFreeVersions.firefoxToProxyScript)
				// in these version this bug requires restart
				restartRequired = changesRerquireRestart;

			polyfill.runtimeSendMessage(
				{
					command: "bypassChanged",
					bypass: settings.bypass
				},
				null,
				function (error) {
					if (!environment.chrome)
						// browser.runtime.sendMessage with toProxyScript fails on Windows
						// https://bugzilla.mozilla.org/show_bug.cgi?id=1389718
						// Error: Could not establish connection. Receiving end does not exist.
						restartRequired = true;

					debug.error("notifyBypassChanged failed with ", error);
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
			let rule = proxyRules.getRuleBySource(domain);

			if (rule != null) {
				// Rule for the domain already exists
				return { success: true, message: browser.i18n.getMessage("settingsEnableByDomainExists"), rule: rule };
			}

			rule = proxyRules.addDomain(domain);

			return { success: true, rule: rule };
		},
		removeBySource: function (source) {

			// get the rule for the source
			let rule = proxyRules.getRuleBySource(source);

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
			let rule = proxyRules.getRuleBySource(domain);

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

			let pattern = utils.hostToMatchPattern(domain);

			let rule = {
				pattern: pattern,
				source: domain,
				enabled: true,
				proxy: null
			};

			// add and save it
			proxyRules.add(rule);

			return rule;
		},
		addDomainList: function (domainList) {
			if (!domainList || !domainList.length)
				return;
			for (let domain of domainList) {

				let rule = proxyRules.getRuleBySource(domain);

				// don't add if it is already there
				if (rule == null)
					proxyRules.addDomain(domain);
			}
		},
		add: function (ruleObject) {
			settings.proxyRules.push(ruleObject);
			settingsOperation.saveRules();
			settingsOperation.saveAllSync();
		},
		remove: function (ruleObject) {

			let itemIndex = settings.proxyRules.indexOf(ruleObject);
			if (itemIndex > -1) {
				settings.proxyRules.splice(itemIndex, 1);
			}
			//settings.proxyRules.delete(ruleObject);

			settingsOperation.saveRules();
			settingsOperation.saveAllSync();
		},
		testSingleRule: function (url) {
			// the url should be complete
			if (url.indexOf(":") == -1)
				url = "http://" + url;

			for (let rule of settings.proxyRules) {
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
			let cachedRegexes = [];
			let result = [];
			for (let uindex = 0; uindex < domainArray.length; uindex++) {
				let domain = domainArray[uindex];
				let url = domain;

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
			let rule = settings.proxyRules.find(rule => rule.source == source);
			return rule;
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
	const timerManagement = {
		serverSubscriptionTimers: [{ id: null, name: null, refreshRate: null }],
		rulesSubscriptionTimers: [{ id: null, name: null, refreshRate: null }],
		updateSubscriptions: function () {

			// -------------------------
			// Proxy Server Subscriptions
			let serverExistingNames = [];
			for (let subscription of settings.proxyServerSubscriptions) {
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
			let remainingTimers = timerManagement.serverSubscriptionTimers.filter(timer => {
				// not used or removed. Just unregister it then remove it
				if (serverExistingNames.indexOf(timer.name) === -1) {
					clearInterval(timer.id);
					return false;
				}

				// it is created or updated, don't remove it
				return true;
			});
			timerManagement.serverSubscriptionTimers = remainingTimers;

			// -------------------------
			// Proxy Rules Subscriptions
			// TODO
		},
		readServerSubscription: function (subscriptionName) {
			debug.log("readServerSubscription", subscriptionName);
			if (!subscriptionName)
				return;


			let subscription = settings.proxyServerSubscriptions.find(item => item.name === name);
			if (!subscription) {
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

						let count = response.result.length;

						subscription.proxies = response.result;
						subscription.totalCount = count;

						settingsOperation.saveProxyServerSubscriptions();
						settingsOperation.saveAllSync();

					} else {
						debug.warn("Failed to read proxy server subscription: " + subscriptionName);
					}
				},
				function (ex) {
					debug.warn("Failed to read proxy server subscription: " + subscriptionName, subscription, ex);
				});
		},
		_getSubscriptionTimer: function (timers, name) {
			let index = timers.findIndex(timer => timer.name === name);
			if (index >= 0) {
				return {
					timer: timers[index],
					index: index
				};
			}
			return null;
		},
		getServerSubscriptionTimer: function (name) {
			return this._getSubscriptionTimer(timerManagement.serverSubscriptionTimers, name);
		},
		getRulesSubscriptionTimersTimer: function (name) { // TODO: Merge to a function
			return this._getSubscriptionTimer(timerManagement.rulesSubscriptionTimers, name);
		},
	};
	const updateManager = {
		updateInfoUrl: "https://raw.githubusercontent.com/salarcode/SmartProxy/master/updateinfo.json",
		unlistedVersionIndicator: "-unlisted",
		updateIsAvailable: false,
		updateInfo: null,
		readUpdateInfo: function () {

			let addonId = browser.runtime.id || "";

			// IMPORTANT NOTE:
			// this code will not run in listed versions (listed in AMO or WebStore)
			if (addonId.indexOf(updateManager.unlistedVersionIndicator) != -1) {

				let xhr = new XMLHttpRequest();
				xhr.open("GET", updateManager.updateInfoUrl);

				xhr.onload = function () {
					if (xhr.status === 200) {
						try {
							let updateInfo = JSON.parse(xhr.responseText);
							updateManager.updateInfo = updateInfo.latestVersion;
							checkForUpdate(updateInfo);
						} catch (e) {
							debug.error("readUpdateInfo>", e);
						}
					}
				};
				xhr.send();
			}

			function checkForUpdate(updateInfo) {

				let manifest = browser.runtime.getManifest();
				let latestVersion = updateInfo.latestVersion;

				if (latestVersion && latestVersion.version > manifest.version) {
					updateManager.updateIsAvailable = true;
				}
			}
		}
	}
	const internal = {
		getDataForProxyScript: function () {

			return {
				proxyRules: settings.proxyRules,
				proxyMode: settings.proxyMode,
				activeProxyServer: settings.activeProxyServer,
				useNewReturnFormat: !environment.chrome && (environment.version >= environment.bugFreeVersions.firefoxNewPacScriptReturnData),
				bypass: settings.bypass
			};
		},
		getDataForSettingsUi: function () {

			let dataForSettingsUi = {
				settings: settings,
				updateAvailableText: null,
				updateInfo: null
			};

			if (updateManager.updateIsAvailable) {
				// generate update text
				dataForSettingsUi.updateAvailableText =
					browser.i18n.getMessage("settingsTabUpdateText").replace("{0}", updateManager.updateInfo.versionName);
				dataForSettingsUi.updateInfo = updateManager.updateInfo;
			}

			return dataForSettingsUi;
		},
		getAllSubscribedProxyServers: function () {

			if (!settings.proxyServerSubscriptions || !settings.proxyServerSubscriptions.length)
				return [];
			let result = [];

			for (let subsription of settings.proxyServerSubscriptions) {
				if (subsription.enabled) {
					result = result.concat(subsription.proxies);
				}
			}
			return result;
		},
		getDataForPopup: function () {
			///<summary>The data that is required for the popup</summary>
			let dataForPopup = {
				proxiableDomains: [],
				proxyMode: settings.proxyMode,
				hasProxyServers: settings.proxyServers.length > 0,
				proxyServers: settings.proxyServers,
				activeProxyServer: settings.activeProxyServer,
				restartRequired: restartRequired,
				currentTabId: null,
				currentTabIndex: null,
				proxyServersSubscribed: internal.getAllSubscribedProxyServers(),
				updateAvailableText: null,
				updateInfo: null,
				failedRequests: null
			};

			if (updateManager.updateIsAvailable) {
				// generate update text
				dataForPopup.updateAvailableText =
					browser.i18n.getMessage("popupUpdateText").replace("{0}", updateManager.updateInfo.versionName);
				dataForPopup.updateInfo = updateManager.updateInfo;
			}

			if (currentTab == null)
				return dataForPopup;

			let tabId = currentTab.id;
			let tabData = loggedRequests[tabId];
			if (tabData == null)
				return dataForPopup;

			// tab info
			dataForPopup.currentTabId = currentTab.id;
			dataForPopup.currentTabIndex = currentTab.index;

			// failed requests
			dataForPopup.failedRequests = convertFailedRequestsToArray(tabData.failedRequests);

			// get the host name from url
			let urlHost = utils.extractHostFromUrl(tabData.url);

			// current url should be valid
			if (!utils.isValidHost(urlHost))
				return dataForPopup;

			// extract list of domain and subdomains
			let proxiableDomainList = utils.extractSubdomainsFromHost(urlHost);

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

				let multiTestResultList = proxyRules.testMultipleRule(proxiableDomainList);

				for (let i = 0; i < multiTestResultList.length; i++) {
					let result = multiTestResultList[i];

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
		setBrowserActionStatus: function (tabData) {
			let extensionName = browser.i18n.getMessage("extensionName");
			let proxyTitle = "";

			switch (settings.proxyMode) {

				case proxyModeType.direct:

					proxyTitle = `${extensionName} : ${browser.i18n.getMessage("popupNoProxy")}`;
					polyfill.browserActionSetIcon({
						path: {
							16: "icons/proxymode-disabled-16.png",
							32: "icons/proxymode-disabled-32.png",
							48: "icons/proxymode-disabled-48.png"
						}
					});
					break;

				case proxyModeType.always:

					proxyTitle = `${extensionName} : ${browser.i18n.getMessage("popupAlwaysEnable")}`;
					polyfill.browserActionSetIcon({
						path: {
							16: "icons/proxymode-always-16.png",
							32: "icons/proxymode-always-32.png",
							48: "icons/proxymode-always-48.png"
						}
					});
					break;

				case proxyModeType.systemProxy:

					proxyTitle = `${extensionName} : ${browser.i18n.getMessage("popupSystemProxy")}`;
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

					proxyTitle = `${extensionName} : ${browser.i18n.getMessage("popupSmartProxy")}`;
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


			if (currentTab != null || tabData != null) {
				let tabId;

				if (tabData) {
					tabId = tabData.tabId;
				}
				else if (currentTab) {
					tabId = currentTab.id;
					tabData = loggedRequests[tabId];
				}

				if (tabData) {
					let failedCount = failedRequestsNotProxifiedCount(tabData.failedRequests);

					if (failedCount > 0) {
						browser.browserAction.setBadgeBackgroundColor({ color: "#f0ad4e" });
						browser.browserAction.setBadgeText({
							text: failedCount.toString(),
							tabId: tabId
						});
					} else {
						browser.browserAction.setBadgeText({
							text: "",
							tabId: tabId
						});
					}

					if (tabData.proxified) {
						proxyTitle += `\r\n${browser.i18n.getMessage("toolbarTooltipEffectiveRule")}  ${tabData.proxySource}`;
					} else {
						proxyTitle += `\r\n${browser.i18n.getMessage("toolbarTooltipEffectiveRuleNone")}`;
					}

				} else {
					browser.browserAction.setBadgeText({
						text: "",
						tabId: tabId
					});
				}
			}

			if (settings.activeProxyServer) {
				proxyTitle += `\r\nProxy server: ${settings.activeProxyServer.host} : ${settings.activeProxyServer.port}`;
			}

			browser.browserAction.setTitle({ title: proxyTitle });
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

		// check for updates, only in unlisted version
		updateManager.readUpdateInfo();

		// handle synced settings changes
		browser.storage.onChanged.addListener(settingsOperation.syncOnChanged);

	});

	// start handling messages
	browser.runtime.onMessage.addListener(handleMessages);

	// register the request logger
	requestLogger.startLogger();

	// always knowing who is active
	trackActiveTab();

	// start the request monitor for failures
	webRequestMonitor.startMonitor(requestMonitorCallback);

	// start proxy authentication request check
	webRequestProxyAuthentication.startMonitor();

})();
