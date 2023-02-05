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
import { api, environment } from '../lib/environment';
import { ProxyAuthentication } from './ProxyAuthentication';
import { Debug, DiagDebug } from '../lib/Debug';
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
	SmartProfile,
	PartialThemeDataType,
} from './definitions';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { ProxyEngineSpecialRequests } from './ProxyEngineSpecialRequests';
import { ProfileOperations } from './ProfileOperations';
import { ProfileRules } from './ProfileRules';

const subscriptionUpdaterLib = SubscriptionUpdater;
const proxyEngineLib = ProxyEngine;
const settingsLib = Settings;
const settingsOperationLib = SettingsOperation;

export class Core {
	/** Start the application */
	public static initializeApp() {

		Debug.disable(); // comment this for debugging
		//Debug.enableDiagnostics(true); // uncomment for verbose logs

		proxyEngineLib.configureEnginePrematurely();

		const settingReadComplete = () => {
			DiagDebug?.trace("Core.settingReadComplete start");
			// on settings read success
			// Note: this might run twice, one for local, one for remotely synced data

			// register the proxy when config is ready
			proxyEngineLib.registerEngine();

			// set the title
			Core.setBrowserActionStatus();

			// update the timers
			subscriptionUpdaterLib.updateServerSubscriptions();
			subscriptionUpdaterLib.reloadEmptyServerSubscriptions();

			subscriptionUpdaterLib.updateRulesSubscriptions();
			subscriptionUpdaterLib.reloadEmptyRulesSubscriptions();

			// check for updates, only in unlisted version
			UpdateManager.readUpdateInfo();

			DiagDebug?.trace("Core.settingReadComplete end");

			Core.dumpDiagnosticsInfo();
		};

		settingsLib.onInitializedLocally = settingReadComplete;
		settingsLib.onInitializedRemoteSync = settingReadComplete;
		settingsLib.initialize();

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

	public static initializeFromServiceWorker() {
		// nothing yet!

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

						if (environment.chrome) {
							// BUGFIX: on the first run, `sendResponse` doesn't send data
							PolyFill.runtimeSendMessage(
								{
									command: CommandMessages.SettingsPageGetInitialDataResponse,
									settingsPageInitialData: dataForSettingsUi
								});
						}

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

					if (environment.chrome) {
						// BUGFIX: on the first run, `sendResponse` doesn't send data
						PolyFill.runtimeSendMessage(
							{
								command: CommandMessages.ProxyableGetInitialDataResponse,
								tabId: tabId,
								dataForProxyable: dataForProxyable
							});
					}
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

			case CommandMessages.PopupChangeActiveProxyServer: {
				if (!message.id)
					return;

				let proxyId = message.id;

				let proxy = settingsOperationLib.findProxyServerById(proxyId);
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

				settingsOperationLib.saveSmartProfiles();
				settingsOperationLib.saveAllSync();

				// notify the proxy script
				proxyEngineLib.notifyProxyRulesChanged();

				// update active proxy tab status
				Core.setBrowserActionStatus();

				return;
			}

			case CommandMessages.PopupAddDomainListToProxyRule: {
				if (!message.domainList)
					return;

				let domainList = message.domainList;
				let tabId = message.tabId;

				let result = ProfileRules.enableByHostnameList(domainList);

				let updatedFailedRequests = WebFailedRequestMonitor.removeDomainsFromTabFailedRequests(tabId, domainList);

				// notify the proxy script
				proxyEngineLib.notifyProxyRulesChanged();

				settingsOperationLib.saveSmartProfiles();
				settingsOperationLib.saveAllSync();

				// update active proxy tab status
				Core.setBrowserActionStatus();

				// send the responses
				if (sendResponse) {
					sendResponse({
						result: result,
						failedRequests: updatedFailedRequests,
					});
				}
				return;
			}

			case CommandMessages.PopupAddDomainListToIgnored: {
				if (!message.domainList)
					return;

				let domainList: string[] = message.domainList;
				let tabId = message.tabId;

				let result = ProfileRules.enableByHostnameListIgnoreFailureRules(domainList);

				let updatedFailedRequests = WebFailedRequestMonitor.removeDomainsFromTabFailedRequests(tabId, domainList);

				settingsOperationLib.saveSmartProfiles();
				settingsOperationLib.saveAllSync();

				settingsLib.updateActiveSettings();

				// send the responses
				if (sendResponse) {
					sendResponse({
						result: result,
						failedRequests: updatedFailedRequests,
					});
				}
				return;
			}
			case CommandMessages.SettingsPageSaveOptions: {
				if (!message.options)
					return;
				settingsLib.current.options = message.options;
				settingsOperationLib.saveOptions();
				settingsOperationLib.saveAllSync();

				// update proxy rules
				proxyEngineLib.updateBrowsersProxyConfig();

				if (sendResponse) {
					sendResponse({
						success: true,
						// General options saved successfully.
						message: api.i18n.getMessage('settingsSaveOptionsSuccess'),
					});
				}
				return;
			}

			case CommandMessages.SettingsPageSaveProxyServers: {
				if (!message.saveData)
					return;
				var saveData = message.saveData;

				SettingsOperation.sortProxyServers(saveData.proxyServers);

				settingsLib.current.proxyServers = saveData.proxyServers;
				settingsLib.current.defaultProxyServerId = message.saveData.defaultProxyServerId;
				settingsOperationLib.saveProxyServers();
				settingsOperationLib.updateSmartProfilesRulesProxyServer();
				settingsOperationLib.saveDefaultProxyServer();
				settingsOperationLib.saveAllSync();

				settingsLib.updateActiveSettings();
				// notify
				proxyEngineLib.updateBrowsersProxyConfig();

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

				let smartProfile: SmartProfile = message.smartProfile;
				ProfileOperations.addUpdateProfile(smartProfile);

				settingsOperationLib.saveSmartProfiles();
				settingsOperationLib.saveAllSync();

				settingsLib.updateActiveSettings();
				// notify
				proxyEngineLib.updateBrowsersProxyConfig();

				if (sendResponse) {
					sendResponse({
						success: true,
						// Proxy rules saved successfully.
						message: api.i18n.getMessage('settingsSaveSmartProfileSuccess'),
						smartProfile: smartProfile
					});
				}
				return;
			}
			case CommandMessages.SettingsPageDeleteSmartProfile: {
				if (!message.smartProfileId)
					return;

				let smartProfileId: string = message.smartProfileId;
				let deleteResult = ProfileOperations.deleteProfile(smartProfileId);

				if (deleteResult.success) {
					settingsOperationLib.saveSmartProfiles();
					settingsOperationLib.saveAllSync();

					settingsLib.updateActiveSettings();
					// notify
					proxyEngineLib.updateBrowsersProxyConfig();

					if (sendResponse) {
						sendResponse({
							success: true,
							// The profile is deleted successfully
							message: api.i18n.getMessage('settingsProfilesDeleteDone'),
						});
					}
				}
				else {
					if (sendResponse) {
						sendResponse({
							success: false,
							// Failed to delete the selected profile.
							message: deleteResult.message ||
								api.i18n.getMessage('settingsProfilesDeleteFailed'),
						});
					}
				}
				return;
			}
			case CommandMessages.SettingsPageSaveProxySubscriptions: {
				if (!message.proxyServerSubscriptions)
					return;
				settingsLib.current.proxyServerSubscriptions = message.proxyServerSubscriptions;
				settingsOperationLib.saveProxyServerSubscriptions();
				settingsOperationLib.saveAllSync();

				// update the timers
				subscriptionUpdaterLib.updateServerSubscriptions();

				// it is possible that active proxy is changed
				proxyEngineLib.updateBrowsersProxyConfig();

				if (sendResponse) {
					sendResponse({
						success: true,
						// Proxy server subscriptions saved successfully.
						message: api.i18n.getMessage('settingsSaveProxyServerSubscriptionsSuccess'),
					});
				}
				return;
			}
			case CommandMessages.SettingsPageRestoreSettings: {
				if (!message.fileData) return;
				let fileData = message.fileData;
				let result = settingsOperationLib.restoreBackup(fileData);

				if (sendResponse) {
					sendResponse(result);
				}
				return;
			}
			case CommandMessages.SettingsPageFactoryReset: {
				settingsOperationLib.factoryReset();

				if (sendResponse) {
					sendResponse({
						success: true,
						message: api.i18n.getMessage('settingsFactoryResetSuccess')
					});
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
				settingsLib.current.firstEverInstallNotified = true;
				settingsOperationLib.saveAllSync();

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
					settingsOperationLib.saveSmartProfiles();
					settingsOperationLib.saveAllSync();

					// notify the proxy script
					proxyEngineLib.notifyProxyRulesChanged();
				}

				// send the responses
				if (result && sendResponse) {
					sendResponse(result);
				}

				Core.setBrowserActionStatus();
				return;
			}
			case CommandMessages.DebugEnableDiagnostics: {
				Debug.enableDiagnostics();
				Core.dumpDiagnosticsInfo();
				break;
			}
			case CommandMessages.DebugGetDiagnosticsLogs: {
				let result = DiagDebug?.getDiagLogs();

				// send the responses
				if (result && sendResponse) {
					sendResponse(result);
				}
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

		let profile = ProfileOperations.findSmartProfileById(profileId, settingsLib.current.proxyProfiles);
		if (profile == null) {
			Debug.warn(`Requested profile id '${profileId}' not found, change tor profile failed`);
			return;
		}

		settingsLib.current.activeProfileId = profileId;

		// save the changes
		settingsOperationLib.saveActiveProfile();
		settingsOperationLib.saveAllSync();

		settingsLib.updateActiveSettings();

		// send it to the proxy server
		proxyEngineLib.updateBrowsersProxyConfig();

		// update active proxy tab status
		Core.setBrowserActionStatus();
	}

	public static ChangeActiveProxy(proxy: ProxyServer) {

		let smartProfile = ProfileOperations.getActiveSmartProfile();
		if (smartProfile == null) {
			// should never happen
			updateDefaultProxyServer();
		}
		else if (smartProfile.profileProxyServerId) {
			// profile proxy can be changed from Popup Action only if it is already set to something from settings tab


			smartProfile.profileProxyServerId = proxy.id;

			settingsOperationLib.saveSmartProfiles();
			settingsOperationLib.saveAllSync();
			settingsOperationLib.updateSmartProfilesRulesProxyServer();
		}
		else {
			// profile doesn't have preset value
			// setting the global one
			updateDefaultProxyServer();
		}

		function updateDefaultProxyServer() {
			settingsLib.current.defaultProxyServerId = proxy.id;

			settingsOperationLib.saveDefaultProxyServer();
			settingsOperationLib.saveAllSync();
			settingsOperationLib.updateSmartProfilesRulesProxyServer();
		}

		settingsLib.updateActiveSettings();

		// send it to the proxy server
		proxyEngineLib.updateBrowsersProxyConfig();

		// update active proxy tab status
		Core.setBrowserActionStatus();
	}

	public static CycleToNextProxyServer(): ResultHolderGeneric<ProxyServer> {
		let settingsActive = settingsLib.active;
		let currentServerId =
			settingsActive.activeProfile?.profileProxyServerId ||
			settingsLib.current.defaultProxyServerId;
		let resultProxy: ProxyServer;

		if (!currentServerId) {
			resultProxy = settingsOperationLib.getFirstProxyServer();
		}

		if (!resultProxy && currentServerId)
			resultProxy = settingsOperationLib.findNextProxyServerByCurrentProxyId(currentServerId);

		if (resultProxy) {
			Core.ChangeActiveProxy(resultProxy);

			let result = new ResultHolderGeneric<ProxyServer>();
			result.success = true;
			result.value = resultProxy;
			return result;
		}

		let result = new ResultHolderGeneric<ProxyServer>();
		result.success = false;
		result.message = api.i18n.getMessage('notificationNoNextProxyServer');
		return result;
	}

	public static CycleToPreviousProxyServer(): ResultHolderGeneric<ProxyServer> {
		let settingsActive = settingsLib.active;
		let currentServerId =
			settingsActive.activeProfile?.profileProxyServerId ||
			settingsLib.current.defaultProxyServerId;
		let resultProxy: ProxyServer;

		if (!currentServerId) {
			resultProxy = settingsOperationLib.getFirstProxyServer();
		}

		if (!resultProxy && currentServerId)
			resultProxy = settingsOperationLib.findPreviousProxyServerByCurrentProxyId(currentServerId);

		if (resultProxy) {
			Core.ChangeActiveProxy(resultProxy);

			let result = new ResultHolderGeneric<ProxyServer>();
			result.success = true;
			result.value = resultProxy;
			return result;
		}

		let result = new ResultHolderGeneric<ProxyServer>();
		result.success = false;
		result.message = api.i18n.getMessage('notificationNoPreviousProxyServer');
		return result;
	}

	private static getSettingsPageInitialData(): SettingsPageInternalDataType {
		let dataForSettingsUi: SettingsPageInternalDataType = {
			settings: settingsLib.current,
			updateAvailableText: null,
			updateInfo: null,
		};

		if (UpdateManager.updateIsAvailable) {
			// generate update text
			dataForSettingsUi.updateAvailableText = api.i18n
				.getMessage('settingsTabUpdateText')
				.replace('{0}', UpdateManager.updateInfo.versionName);
			dataForSettingsUi.updateInfo = UpdateManager.updateInfo;
		}

		return dataForSettingsUi;
	}

	private static getPopupInitialData(): PopupInternalDataType {

		let settingsActive = settingsLib.active;
		let settings = settingsLib.current;
		let dataForPopup = new PopupInternalDataType();
		dataForPopup.proxyableDomains = [];
		dataForPopup.proxyProfiles = ProfileOperations.getSmartProfileBaseList(settings.proxyProfiles);
		dataForPopup.activeProfileId = settings.activeProfileId;
		dataForPopup.activeIncognitoProfileId = settings.options.activeIncognitoProfileId;
		dataForPopup.hasProxyServers = settings.proxyServers.length > 0;
		dataForPopup.proxyServers = settings.proxyServers;
		dataForPopup.currentProxyServerId =
			(settingsActive.activeProfile?.profileProxyServerId) ||
			settings.defaultProxyServerId;

		dataForPopup.currentTabId = null;
		dataForPopup.currentTabIndex = null;
		dataForPopup.proxyServersSubscribed = settingsOperationLib.getAllSubscribedProxyServers();
		dataForPopup.updateAvailableText = null;
		dataForPopup.updateInfo = null;
		dataForPopup.failedRequests = null;
		dataForPopup.notSupportedSetProxySettings = environment.notSupported.setProxySettings;
		dataForPopup.notAllowedSetProxySettings = environment.notAllowed.setProxySettings;
		dataForPopup.refreshTabOnConfigChanges = settings.options.refreshTabOnConfigChanges;
		let themeData = new PartialThemeDataType();
		themeData.themeType = settings.options.themeType;
		themeData.themesLight = settings.options.themesLight;
		themeData.themesLightCustomUrl = settings.options.themesLightCustomUrl;
		themeData.themesDark = settings.options.themesDark;
		themeData.themesDarkCustomUrl = settings.options.themesDarkCustomUrl;
		dataForPopup.themeData = themeData;

		if (UpdateManager.updateIsAvailable) {
			// generate update text
			dataForPopup.updateAvailableText = api.i18n
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
		dataForPopup.currentTabIsIncognito = currentTabData.incognito;

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
				let matchedHost = resultRule?.hostName || domain;

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

		let settings = settingsLib.current;

		let result = new ProxyableInternalDataType();
		result.url = tabData.url;

		let themeData = new PartialThemeDataType();
		themeData.themeType = settings.options.themeType;
		themeData.themesLight = settings.options.themesLight;
		themeData.themesLightCustomUrl = settings.options.themesLightCustomUrl;
		themeData.themesDark = settings.options.themesDark;
		themeData.themesDarkCustomUrl = settings.options.themesDarkCustomUrl;
		result.themeData = themeData;

		return result;
	}

	private static getBrowserActionIconAndTitle(profileType: SmartProfileType) {
		let extensionName = api.i18n.getMessage('extensionName');
		switch (profileType) {
			case SmartProfileType.Direct:
				return {
					title: `${extensionName} : ${api.i18n.getMessage('popupNoProxy')}`,
					icons: {
						path: {
							16: 'icons/proxymode-disabled-16.png',
							32: 'icons/proxymode-disabled-32.png',
							48: 'icons/proxymode-disabled-48.png',
						}
					}
				};

			case SmartProfileType.AlwaysEnabledBypassRules:
				return {
					title: `${extensionName} : ${api.i18n.getMessage('popupAlwaysEnable')}`,
					icons: {
						path: {
							16: 'icons/proxymode-always-16.png',
							32: 'icons/proxymode-always-32.png',
							48: 'icons/proxymode-always-48.png',
						}
					}
				};

			case SmartProfileType.SystemProxy:
				return {
					title: `${extensionName} : ${api.i18n.getMessage('popupSystemProxy')}`,
					icons: {
						path: {
							16: 'icons/proxymode-system-16.png',
							32: 'icons/proxymode-system-32.png',
							48: 'icons/proxymode-system-48.png',
						}
					}
				};

			case SmartProfileType.SmartRules:
			default:
				return {
					title: `${extensionName} : ${api.i18n.getMessage('popupSmartProxy')}`,
					icons: {
						path: {
							16: 'icons/smartproxy-16.png',
							24: 'icons/smartproxy-24.png',
							48: 'icons/smartproxy-48.png',
							96: 'icons/smartproxy-96.png',
						}
					}
				};
		}
	}

	public static setBrowserActionStatus(tabData?: TabDataType) {
		if (!settingsLib.active || !settingsLib.active.activeProfile)
			return;
		let info = Core.getBrowserActionIconAndTitle(settingsLib.active.activeProfile.profileType);
		let proxyTitle = info.title;

		PolyFill.browserActionSetIcon(info.icons);

		// TODO: Because of bug #40 do not add additional in overflow menu

		if (tabData == null)
			tabData = TabManager.getCurrentTab();

		if (tabData) {
			let failedCount = 0;

			if (tabData.incognito && settingsLib.active.activeIncognitoProfile) {
				// private browsing mode has special profile, setting icon for that

				info = Core.getBrowserActionIconAndTitle(settingsLib.active.activeIncognitoProfile.profileType);
				proxyTitle = info.title;

				// limiting to this tab only
				info.icons["tabId"] = tabData.tabId;
				PolyFill.browserActionSetIcon(info.icons);
			}

			if (settingsLib.current?.options?.displayFailedOnBadge == true)
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

			if (settingsLib.current.options.displayAppliedProxyOnBadge && !environment.mobile) {
				if (tabData.proxified) {
					proxyTitle += `\r\n${api.i18n.getMessage('toolbarTooltipEffectiveRule')}  ${tabData.proxyRuleHostName}`;
				} else {
					proxyTitle += `\r\n${api.i18n.getMessage('toolbarTooltipEffectiveRuleNone')}`;
				}
			}

			if (settingsLib.current.options.displayMatchedRuleOnBadge && !environment.mobile) {
				if (tabData.proxified && tabData.proxyMatchedRule) {
					proxyTitle += `\r\n${api.i18n.getMessage('toolbarTooltipEffectiveRulePattern')}  ${tabData.proxyMatchedRule.ruleText}`;
				}
			}
		}

		let activeProxyServer = settingsLib.active.activeProfile?.profileProxyServer;
		if (activeProxyServer) {
			proxyTitle += `\r\nProxy server: ${activeProxyServer.host} : ${activeProxyServer.port}`;
		}

		api.browserAction.setTitle({ title: proxyTitle });
	}

	private static onTabUpdatedUpdateActionStatus(tabData: TabDataType) {
		// update active proxy tab status
		Core.setBrowserActionStatus(tabData);
	}

	private static registerMessageReader() {
		// start handling messages
		api.runtime.onMessage.addListener(Core.handleMessages);
	}

	private static dumpDiagnosticsInfo() {
		if (!DiagDebug) return;
		PolyFill.getExtensionVersion((version) => {
			let settings = Settings.current;
			let settingsActive = Settings.active;
			DiagDebug.info("DiagnosticsInfo", {
				smartProxyVersion: version,
				environmentName: environment.name,
				environmentVersion: environment.version,
				buildForBrowser: environment.browserConfig.name,
				activeProfile: settingsActive?.activeProfile.profileName,
				activeProfileRulesCount: settingsActive?.activeProfile.compiledRules?.Rules?.length ?? 0,
				activeProfileWhiteRulesCount: settingsActive?.activeProfile.compiledRules?.WhitelistRules?.length ?? 0,
				currentProxyServer: settingsActive?.currentProxyServer.name,
				syncSettings: settings.options.syncSettings,
				syncActiveProfile: settings.options.syncActiveProfile,
				syncActiveProxy: settings.options.syncActiveProxy,
				hasActiveRuleSubscription: settings?.proxyProfiles?.some(f => f.rulesSubscriptions.some(s => s.enabled)) ?? false,
				hasActiveProxySubscription: settings?.proxyServerSubscriptions?.some(f => f.enabled) ?? false,

			});
		});
	}
}

console.log("Core.ts initializeApp()...");
// start the application
Core.initializeApp();
console.log('Core.ts initializeApp() DONE');
