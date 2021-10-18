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
import { browser, environment } from '../lib/environment';
import { ProxyAuthentication } from './ProxyAuthentication';
import { Debug } from '../lib/Debug';
import { SettingsOperation } from './SettingsOperation';
import { ProxyEngine } from './ProxyEngine';
import { PolyFill } from '../lib/PolyFill';
import { TabManager, TabDataType } from './TabManager';
import { Utils } from '../lib/Utils';
import { UpdateManager } from './UpdateManager';
import { ProxyRules } from './ProxyRules';
import { TabRequestLogger } from './TabRequestLogger';
import { WebFailedRequestMonitor } from './WebFailedRequestMonitor';
import { SubscriptionUpdater } from './SubscriptionUpdater';
import { Settings } from './Settings';
import {
	CommandMessages,
	SettingsPageInternalDataType,
	PopupInternalDataType,
	ProxyableInternalDataType,
	ProxyServer,
	ResultHolderGeneric,
	SmartProfileType,
	CompiledProxyRulesMatchedSource,
} from './definitions';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { ProxyEngineSpecialRequests } from './ProxyEngineSpecialRequests';
import { ProfileOperations } from './ProfileOperations';
import { ProfileRules } from './ProfileRules';

export class Core {
	/** Start the application */
	public static initializeApp() {
		// comment for debugging
		//Debug.disable();

		Settings.onInitialized = () => {
			// on settings read success

			// register the proxy when config is ready
			ProxyEngine.registerEngine();

			// set the title
			Core.setBrowserActionStatus();

			// update the timers
			SubscriptionUpdater.updateServerSubscriptions();
			SubscriptionUpdater.reloadEmptyServerSubscriptions();

			SubscriptionUpdater.updateRulesSubscriptions();
			SubscriptionUpdater.reloadEmptyRulesSubscriptions();

			// check for updates, only in unlisted version
			UpdateManager.readUpdateInfo();
		};
		Settings.initialize();

		// start handling messages
		Core.registerMessageReader();

		// tracking active tab
		TabManager.initializeTracking();
		TabManager.TabUpdated.on(Core.onTabUpdatedUpdateActionStatus);

		// register the request logger used for Proxyable Resources
		TabRequestLogger.startTracking();

		// Monitoring failed requests
		WebFailedRequestMonitor.startMonitor();

		// start proxy authentication request check
		ProxyAuthentication.startMonitor();

		// listen to shortcut events
		KeyboardShortcuts.startMonitor();
	}

	private static handleMessages(message: any, sender: any, sendResponse: Function) {
		Debug.log('core message> ', message);

		let isCommand = false;
		let command: string;
		if (typeof message == 'string') command = message;
		else {
			command = message['command'];
			isCommand = true;
		}

		if (!isCommand) {
			switch (message) {
				case CommandMessages.PopupGetInitialData:
					{
						if (!sendResponse)
							return;
						let dataForPopup = Core.getPopupInitialData();
						WebFailedRequestMonitor.enableFailedRequestNotification();

						// send the data
						sendResponse(dataForPopup);
						return;
					}
					break;

				case CommandMessages.SettingsPageGetInitialData:
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
			/**  //Uncomment to benchmark the rules
			case "BenchmarkTheRules":
				{
					if (message.urls === null)
						return;
					RulesBenchmark.benchmarkRules(null, message.urls);

					var response = {
						rules: ProxyRules.getCompiledRulesList(),
						whiteListRules: ProxyRules.getCompiledWhitelistRulesList()
					};

					// send the data
					sendResponse(response);
					return;
				}
				break;
			*/

			case CommandMessages.ProxyableGetInitialData:
				{
					if (message.tabId === null)
						return;
					let tabId = message.tabId;

					let dataForProxyable = Core.getProxyableInitialData(tabId);

					if (dataForProxyable) TabRequestLogger.subscribeProxyableLogs(tabId);

					// send the data
					sendResponse(dataForProxyable);
					return;
				}
				break;

			case CommandMessages.ProxyableRemoveProxyableLog:
				{
					if (message.tabId === null)
						return;
					let tabId = message.tabId;

					TabRequestLogger.unsubscribeProxyableLogs(tabId);
				}
				break;

			case CommandMessages.PopupChangeActiveProfile: {
				if (message.profileId === null || message.profileId === undefined)
					return;

				Core.ChangeActiveProfileId(message.profileId);

				return;
			}

			// TODO: REMOVE
			// case CommandMessages.PopupChangeProxyMode: {
			// 	if (message.proxyMode === null || message.proxyMode === undefined) return;

			// 	Core.ChangeActiveProfileId(+message.proxyMode);

			// 	return;
			// }

			case CommandMessages.PopupChangeActiveProxyServer: {
				if (!message.name)
					return;

				let proxyName = message.name;

				let proxy = SettingsOperation.findProxyServerByName(proxyName);
				if (proxy != null) {
					Core.ChangeActiveProxy(proxy);

					if (sendResponse) {
						sendResponse({
							success: true,
						});
					}
				} else {
					if (sendResponse) {
						sendResponse({
							success: false,
						});
					}
				}
				return;
			}

			case CommandMessages.PopupToggleProxyForDomain: {
				if (!message.domain)
					return;

				let domain = message.domain;
				let ruleId = message.ruleId;
				ProfileRules.toggleRule(domain, ruleId);

				SettingsOperation.saveProxyProfiles();
				SettingsOperation.saveAllSync();

				// notify the proxy script
				ProxyEngine.notifyProxyRulesChanged();

				// update active proxy tab status
				Core.setBrowserActionStatus();

				return;
			}

			case CommandMessages.PopupAddDomainListToProxyRule: {
				if (!message.domainList)
					return;

				let domainList = message.domainList;
				let tabId = message.tabId;

				ProfileRules.enableByHostnameList(domainList);

				let updatedFailedRequests = WebFailedRequestMonitor.removeDomainsFromTabFailedRequests(tabId, domainList);

				// notify the proxy script
				ProxyEngine.notifyProxyRulesChanged();

				SettingsOperation.saveProxyProfiles();
				SettingsOperation.saveAllSync();

				// update active proxy tab status
				Core.setBrowserActionStatus();

				// send the responses
				if (updatedFailedRequests != null && sendResponse) {
					sendResponse({
						failedRequests: updatedFailedRequests,
					});
				}
				return;
			}

			case CommandMessages.PopupAddDomainListToIgnored: {
				if (!message.domainList)
					return;

				let domainList = message.domainList;
				let tabId = message.tabId;

				Core.addFailedDomainsToIgnoredList(domainList);

				let updatedFailedRequests = WebFailedRequestMonitor.removeDomainsFromTabFailedRequests(tabId, domainList);

				SettingsOperation.saveOptions();
				SettingsOperation.saveAllSync();

				// send the responses
				if (updatedFailedRequests != null && sendResponse) {
					sendResponse({
						failedRequests: updatedFailedRequests,
					});
				}
				return;
			}
			case CommandMessages.SettingsPageSaveOptions: {
				if (!message.options)
					return;
				Settings.current.options = message.options;
				SettingsOperation.saveOptions();
				SettingsOperation.saveAllSync();

				// update proxy rules
				ProxyEngine.updateBrowsersProxyConfig();

				if (sendResponse) {
					sendResponse({
						success: true,
						// General options saved successfully.
						message: browser.i18n.getMessage('settingsSaveOptionsSuccess'),
					});
				}
				return;
			}

			case CommandMessages.SettingsPageSaveProxyServers: {
				if (!message.saveData)
					return;
				var saveData = message.saveData;

				Settings.current.proxyServers = saveData.proxyServers;
				Settings.current.activeProxyServerId = message.saveData.activeProxyServerId;

				SettingsOperation.saveProxyServers();
				SettingsOperation.updateSmartProfilesRulesProxyServer();
				SettingsOperation.saveActiveProxyServer();
				SettingsOperation.saveAllSync();

				// notify
				ProxyEngine.updateBrowsersProxyConfig();

				if (sendResponse) {
					sendResponse({
						success: true,
						message: 'Proxy servers saved successfully.',
					});
				}
				return;
			}
			case CommandMessages.SettingsPageSaveSmartProfile: {
				if (!message.smartProfile)
					return;

				//let smartProfile: SmartProfile = message.smartProfile;


				// TODO: 
				return;
			}
			// case CommandMessages.SettingsPageSaveProxyRules: {
			// 	if (!message.proxyRules)
			// 		return;

			// 	Settings.current.proxyRules = message.proxyRules;
			// 	SettingsOperation.saveProxyProfiles();
			// 	SettingsOperation.saveAllSync();

			// 	ProxyEngine.notifyProxyRulesChanged();

			// 	// update active proxy tab status
			// 	Core.setBrowserActionStatus();

			// 	if (sendResponse) {
			// 		sendResponse({
			// 			success: true,
			// 			// Proxy rules saved successfully.
			// 			message: browser.i18n.getMessage('settingsSaveProxyRulesSuccess'),
			// 		});
			// 	}

			// 	return;
			// }
			case CommandMessages.SettingsPageSaveProxySubscriptions: {
				if (!message.proxyServerSubscriptions)
					return;
				Settings.current.proxyServerSubscriptions = message.proxyServerSubscriptions;
				SettingsOperation.saveProxyServerSubscriptions();
				SettingsOperation.saveAllSync();

				// update the timers
				SubscriptionUpdater.updateServerSubscriptions();

				// it is possible that active proxy is changed
				ProxyEngine.updateBrowsersProxyConfig();

				if (sendResponse) {
					sendResponse({
						success: true,
						// Proxy server subscriptions saved successfully.
						message: browser.i18n.getMessage('settingsSaveProxyServerSubscriptionsSuccess'),
					});
				}
				return;
			}
			// case CommandMessages.SettingsPageSaveProxyRulesSubscriptions: {
			// 	if (!message.proxyRulesSubscriptions)
			// 		return;
			// 	Settings.current.proxyRulesSubscriptions = message.proxyRulesSubscriptions;
			// 	SettingsOperation.saveProxyRulesSubscriptions();
			// 	SettingsOperation.saveAllSync();

			// 	// update the timers
			// 	SubscriptionUpdater.updateRulesSubscriptions();

			// 	ProxyEngine.notifyProxyRulesChanged();

			// 	// update active proxy tab status
			// 	Core.setBrowserActionStatus();

			// 	if (sendResponse) {
			// 		sendResponse({
			// 			success: true,
			// 			// Proxy rule subscriptions saved successfully.
			// 			message: browser.i18n.getMessage('settingsSaveProxyRulesSubscriptionsSuccess'),
			// 		});
			// 	}
			// 	return;
			// }
			case CommandMessages.SettingsPageRestoreSettings: {
				if (!message.fileData) return;
				let fileData = message.fileData;
				let result = SettingsOperation.restoreBackup(fileData);

				if (sendResponse) {
					sendResponse(result);
				}
				return;
			}
			case CommandMessages.SettingsPageMakeRequestSpecial: {
				if (!message.url)
					return;

				var url = message.url;
				var applyProxy = message.applyProxy;
				var selectedProxy = message.selectedProxy;

				ProxyEngineSpecialRequests.setSpecialUrl(url, applyProxy, selectedProxy);

				if (sendResponse) {
					sendResponse({
						success: true,
					});
				}
				return;
			}
			case CommandMessages.SettingsPageSkipWelcome: {
				Settings.current.firstEverInstallNotified = true;
				SettingsOperation.saveAllSync();

				if (sendResponse) {
					sendResponse({
						success: true,
					});
				}
				return;
			}
			case CommandMessages.ProxyableToggleProxyableDomain: {
				if (!message.enableByDomain && !message.removeBySource)
					return;
				let enableDomain = message.enableByDomain;
				let removeDomain = message.removeBySource;
				let ruleId = message.ruleId;
				let ruleResult;

				if (enableDomain)
					ruleResult = ProfileRules.enableByHostname(enableDomain);
				else
					ruleResult = ProfileRules.removeByHostname(removeDomain, ruleId);

				let result = {
					success: ruleResult.success,
					message: ruleResult.message,
					rule: ruleResult.rule,
					requests: null as any[],
				};

				if (ruleResult.success) {
					SettingsOperation.saveProxyProfiles();
					SettingsOperation.saveAllSync();

					// notify the proxy script
					ProxyEngine.notifyProxyRulesChanged();
				}

				// send the responses
				if (result && sendResponse) {
					sendResponse(result);
				}

				Core.setBrowserActionStatus();
				return;
			}
			default:
				{
				}
				break;
		}

		// Chrome requires a response
		if (sendResponse) sendResponse(null);
	}

	public static ChangeActiveProfileId(profileId: string) {
		// TODO: rename to `ChangeProxyProfile`

		let profile = ProfileOperations.findSmartProfileById(profileId, Settings.current.proxyProfiles);
		if (profile == null) {
			Debug.warn(`Requested profile id '${profileId}' not found, change tor profile failed`);
			return;
		}

		Settings.current.activeProfileId = profileId;

		// save the changes
		SettingsOperation.saveActiveProfile();
		SettingsOperation.saveAllSync();

		// send it to the proxy server
		ProxyEngine.updateBrowsersProxyConfig();

		// update active proxy tab status
		Core.setBrowserActionStatus();
	}

	public static ChangeActiveProxy(proxy: ProxyServer) {

		Settings.current.activeProxyServerId = proxy.id;

		SettingsOperation.saveActiveProxyServer();
		SettingsOperation.saveAllSync();

		// send it to the proxy server
		ProxyEngine.updateBrowsersProxyConfig();

		// update active proxy tab status
		Core.setBrowserActionStatus();
	}

	public static CycleToNextProxyServer(): ResultHolderGeneric<ProxyServer> {
		let settings = Settings.current;
		let activeServerId = settings.activeProxyServerId;
		let resultProxy: ProxyServer;

		if (!activeServerId) {
			resultProxy = SettingsOperation.getFirstProxyServer();
		}

		if (!resultProxy && activeServerId)
			resultProxy = SettingsOperation.findNextProxyServerByCurrentProxyId(activeServerId);

		if (resultProxy) {
			Core.ChangeActiveProxy(resultProxy);

			let result = new ResultHolderGeneric<ProxyServer>();
			result.success = true;
			result.value = resultProxy;
			return result;
		}

		let result = new ResultHolderGeneric<ProxyServer>();
		result.success = false;
		result.message = browser.i18n.getMessage('notificationNoNextProxyServer');
		return result;
	}

	public static CycleToPreviousProxyServer(): ResultHolderGeneric<ProxyServer> {
		let settings = Settings.current;
		let activeServerId = settings.activeProxyServerId;
		let resultProxy: ProxyServer;

		if (!activeServerId) {
			resultProxy = SettingsOperation.getFirstProxyServer();
		}

		if (!resultProxy && activeServerId)
			resultProxy = SettingsOperation.findPreviousProxyServerByCurrentProxyId(activeServerId);

		if (resultProxy) {
			Core.ChangeActiveProxy(resultProxy);

			let result = new ResultHolderGeneric<ProxyServer>();
			result.success = true;
			result.value = resultProxy;
			return result;
		}

		let result = new ResultHolderGeneric<ProxyServer>();
		result.success = false;
		result.message = browser.i18n.getMessage('notificationNoPreviousProxyServer');
		return result;
	}

	private static getSettingsPageInitialData(): SettingsPageInternalDataType {
		let dataForSettingsUi: SettingsPageInternalDataType = {
			settings: Settings.current,
			updateAvailableText: null,
			updateInfo: null,
		};

		if (UpdateManager.updateIsAvailable) {
			// generate update text
			dataForSettingsUi.updateAvailableText = browser.i18n
				.getMessage('settingsTabUpdateText')
				.replace('{0}', UpdateManager.updateInfo.versionName);
			dataForSettingsUi.updateInfo = UpdateManager.updateInfo;
		}

		return dataForSettingsUi;
	}

	private static getPopupInitialData(): PopupInternalDataType {

		let settingsActive = Settings.active;
		let settings = Settings.current;

		let dataForPopup = new PopupInternalDataType();
		dataForPopup.proxyableDomains = [];
		dataForPopup.proxyProfiles = ProfileOperations.getSmartProfileBaseList(settings.proxyProfiles);
		dataForPopup.activeProfileId = settings.activeProfileId;
		dataForPopup.hasProxyServers = settings.proxyServers.length > 0;
		dataForPopup.proxyServers = settings.proxyServers;
		dataForPopup.activeProxyServerId = settings.activeProxyServerId;
		dataForPopup.currentTabId = null;
		dataForPopup.currentTabIndex = null;
		dataForPopup.proxyServersSubscribed = SettingsOperation.getAllSubscribedProxyServers();
		dataForPopup.updateAvailableText = null;
		dataForPopup.updateInfo = null;
		dataForPopup.failedRequests = null;
		dataForPopup.notSupportedSetProxySettings = environment.notSupported.setProxySettings;
		dataForPopup.notAllowedSetProxySettings = environment.notAllowed.setProxySettings;

		if (UpdateManager.updateIsAvailable) {
			// generate update text
			dataForPopup.updateAvailableText = browser.i18n
				.getMessage('popupUpdateText')
				.replace('{0}', UpdateManager.updateInfo.versionName);
			dataForPopup.updateInfo = UpdateManager.updateInfo;
		}

		let currentTabData = TabManager.getCurrentTab();
		if (currentTabData == null)
			return dataForPopup;

		// tab info
		dataForPopup.currentTabId = currentTabData.tabId;
		dataForPopup.currentTabIndex = currentTabData.index;

		// failed requests
		dataForPopup.failedRequests = WebFailedRequestMonitor.convertFailedRequestsToArray(currentTabData.failedRequests);

		// if profile type doesn't support rules, no point in getting domain list
		if (!settingsActive.activeProfile ||
			!ProfileOperations.profileTypeSupportsRules(settingsActive.activeProfile.profileType)) {
			return dataForPopup;
		}

		// get the host name from url
		let urlHost = Utils.extractHostFromUrl(currentTabData.url);

		// current url should be valid
		if (!Utils.isValidHost(urlHost))
			return dataForPopup;

		// extract list of domain and subdomain
		let proxyableDomainList = Utils.extractSubdomainListFromHost(urlHost);

		if (!proxyableDomainList || !proxyableDomainList.length)
			return dataForPopup;

		let activeSmartProfile = settingsActive.activeProfile;

		if (proxyableDomainList.length == 1) {
			let proxyableDomain = proxyableDomainList[0];

			let testResult = ProxyRules.findMatchedDomainInRulesInfo(proxyableDomain, activeSmartProfile.compiledRules);
			if (testResult != null) {
				let matchedRule = testResult.compiledRule;
				let ruleIsWhitelist = testResult.matchedRuleSource == CompiledProxyRulesMatchedSource.WhitelistRules ||
					testResult.matchedRuleSource == CompiledProxyRulesMatchedSource.WhitelistSubscriptionRules;

				// add the domain with matched rule
				dataForPopup.proxyableDomains.push({
					ruleId: matchedRule.ruleId,
					domain: proxyableDomain,
					ruleMatched: true,
					ruleMatchedThisHost: true,
					ruleSource: matchedRule.compiledRuleSource,
					ruleMatchSource: testResult.matchedRuleSource,
					ruleHasWhiteListMatch: ruleIsWhitelist,
				});
			}
			else {
				// add the domain with no matching rule
				dataForPopup.proxyableDomains.push({
					ruleId: null,
					domain: proxyableDomain,
					ruleMatched: false,
					ruleMatchedThisHost: false,
					ruleSource: null,
					ruleMatchSource: null,
					ruleHasWhiteListMatch: false,
				});
			}
		}
		else {
			let multiTestResultList = ProxyRules.findMatchedDomainListInRulesInfo(proxyableDomainList, activeSmartProfile.compiledRules);
			let anyMatchFound = false;

			for (let i = 0; i < multiTestResultList.length; i++) {
				let resultRuleInfo = multiTestResultList[i];
				let resultRule = resultRuleInfo?.compiledRule;
				let domain = proxyableDomainList[i];
				let matchedHost = resultRule?.hostName ?? domain;

				let ruleIsForThisHost = false;
				if (resultRule != null) {
					anyMatchFound = true;

					// check to see if the matched rule is for this host or not!
					if (resultRule.hostName == domain) {
						ruleIsForThisHost = true;
					}
				}

				// ignoring www: do not display www if rule is not for this domain
				if (!ruleIsForThisHost && !anyMatchFound && matchedHost.startsWith('www.')) {
					continue;
				}

				if (resultRuleInfo != null) {
					let ruleIsWhitelist = resultRuleInfo.matchedRuleSource == CompiledProxyRulesMatchedSource.WhitelistRules ||
						resultRuleInfo.matchedRuleSource == CompiledProxyRulesMatchedSource.WhitelistSubscriptionRules;

					// add the domain with matched rule
					dataForPopup.proxyableDomains.push({
						ruleId: resultRule.ruleId,
						domain: domain,
						ruleMatched: true,
						ruleMatchedThisHost: ruleIsForThisHost,
						ruleSource: resultRule.compiledRuleSource,
						ruleMatchSource: resultRuleInfo.matchedRuleSource,
						ruleHasWhiteListMatch: ruleIsWhitelist,
					});
				}
				else {
					// add the domain with no matching rule
					dataForPopup.proxyableDomains.push({
						ruleId: null,
						domain: domain,
						ruleMatched: false,
						ruleMatchedThisHost: false,
						ruleSource: null,
						ruleMatchSource: null,
						ruleHasWhiteListMatch: false,
					});
				}
			}
		}
		return dataForPopup;
	}

	private static getProxyableInitialData(tabId: number): ProxyableInternalDataType {
		let tabData = TabManager.getOrSetTab(tabId, false);
		if (tabData == null)
			return null;

		let result = new ProxyableInternalDataType();

		result.url = tabData.url;
		return result;
	}

	private static addFailedDomainsToIgnoredList(domainList: string[]) {
		let ignoredDomains = Settings.current.options.ignoreRequestFailuresForDomains_REMOVED || [];
		let uniqueMerged = [...new Set([...ignoredDomains, ...domainList])];

		Settings.current.options.ignoreRequestFailuresForDomains_REMOVED = uniqueMerged;
	}

	public static setBrowserActionStatus(tabData?: TabDataType) {
		let extensionName = browser.i18n.getMessage('extensionName');
		let proxyTitle = '';
		switch (Settings.active.activeProfile.profileType) {
			case SmartProfileType.Direct:
				proxyTitle = `${extensionName} : ${browser.i18n.getMessage('popupNoProxy')}`;
				PolyFill.browserActionSetIcon({
					path: {
						16: 'icons/proxymode-disabled-16.png',
						32: 'icons/proxymode-disabled-32.png',
						48: 'icons/proxymode-disabled-48.png',
					},
				});
				break;

			case SmartProfileType.AlwaysEnabledBypassRules:
				proxyTitle = `${extensionName} : ${browser.i18n.getMessage('popupAlwaysEnable')}`;
				PolyFill.browserActionSetIcon({
					path: {
						16: 'icons/proxymode-always-16.png',
						32: 'icons/proxymode-always-32.png',
						48: 'icons/proxymode-always-48.png',
					},
				});
				break;

			case SmartProfileType.SystemProxy:
				proxyTitle = `${extensionName} : ${browser.i18n.getMessage('popupSystemProxy')}`;
				PolyFill.browserActionSetIcon({
					path: {
						16: 'icons/proxymode-system-16.png',
						32: 'icons/proxymode-system-32.png',
						48: 'icons/proxymode-system-48.png',
					},
				});
				break;

			case SmartProfileType.SmartRules:
			default:
				proxyTitle = `${extensionName} : ${browser.i18n.getMessage('popupSmartProxy')}`;
				PolyFill.browserActionSetIcon({
					path: {
						16: 'icons/smartproxy-16.png',
						24: 'icons/smartproxy-24.png',
						48: 'icons/smartproxy-48.png',
						96: 'icons/smartproxy-96.png',
					},
				});
				break;
		}

		// TODO: Because of bug #40 do not add additional in overflow menu

		if (tabData == null) tabData = TabManager.getCurrentTab();

		if (tabData) {
			let failedCount = 0;

			if (Settings.current.options.displayFailedOnBadge)
				failedCount = WebFailedRequestMonitor.failedRequestsNotProxifiedCount(tabData.failedRequests);

			if (failedCount > 0) {
				PolyFill.browserActionSetBadgeBackgroundColor({ color: '#f0ad4e' });
				PolyFill.browserActionSetBadgeText({
					text: failedCount.toString(),
					tabId: tabData.tabId,
				});
			} else {
				PolyFill.browserActionSetBadgeText({
					text: '',
					tabId: tabData.tabId,
				});
			}

			if (Settings.current.options.displayAppliedProxyOnBadge && !environment.mobile) {
				if (tabData.proxified) {
					proxyTitle += `\r\n${browser.i18n.getMessage('toolbarTooltipEffectiveRule')}  ${tabData.proxyRuleHostName}`;
				} else {
					proxyTitle += `\r\n${browser.i18n.getMessage('toolbarTooltipEffectiveRuleNone')}`;
				}
			}

			if (Settings.current.options.displayMatchedRuleOnBadge && !environment.mobile) {
				// TODO: displayMatchedRuleOnBadge
			}
		}

		if (Settings.active.activeProxyServer) {
			proxyTitle += `\r\nProxy server: ${Settings.active.activeProxyServer.host} : ${Settings.active.activeProxyServer.port}`;
		}

		browser.browserAction.setTitle({ title: proxyTitle });
	}

	private static onTabUpdatedUpdateActionStatus(tabData: TabDataType) {
		// update active proxy tab status
		Core.setBrowserActionStatus(tabData);
	}

	private static registerMessageReader() {
		// start handling messages
		browser.runtime.onMessage.addListener(Core.handleMessages);
	}
}
// start the application
Core.initializeApp();
console.log('Core.ts initializeApp() DONE');
