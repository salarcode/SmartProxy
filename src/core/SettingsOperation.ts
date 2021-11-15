/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2021 Salar Khalilzadeh <salar2k@gmail.com>
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
import { browser } from "../lib/environment";
import { PolyFill } from "../lib/PolyFill";
import { Debug } from "../lib/Debug";
import { Settings } from "./Settings";
import { Utils } from "../lib/Utils";
import { GeneralOptions, ProxyServer, ProxyServerSubscription, SettingsConfig, SmartProfile } from "./definitions";
import { ProxyEngine } from "./ProxyEngine";
import { ProxyRules } from "./ProxyRules";
import { SubscriptionUpdater } from "./SubscriptionUpdater";
import { ProfileOperations } from "./ProfileOperations";

export class SettingsOperation {

	public static getStrippedSyncableSettings(settings: SettingsConfig): SettingsConfig {
		// deep clone required
		var settingsCopy = JSON.parse(JSON.stringify(settings));

		if (settingsCopy.proxyRulesSubscriptions && settingsCopy.proxyRulesSubscriptions.length)
			for (const subscription of settingsCopy.proxyRulesSubscriptions) {
				subscription.proxyRules = [];
				subscription.whitelistRules = [];
			}
		if (settingsCopy.proxyServerSubscriptions && settingsCopy.proxyServerSubscriptions.length)
			for (const subscription of settingsCopy.proxyServerSubscriptions) {
				subscription.proxies = []
			}

		return settingsCopy;
	}

	public static readSyncedSettings(success: Function) {
		// getting synced data
		PolyFill.storageSyncGet(null,
			onGetSyncData,
			onGetSyncError);

		function onGetSyncData(data: any) {

			try {
				let syncedSettings = Utils.decodeSyncData(data);

				// only if sync settings is enabled
				if (syncedSettings &&
					syncedSettings.options) {

					if (syncedSettings.options.syncSettings) {
						Settings.setDefaultSettings(syncedSettings);
						Settings.migrateFromOldVersion(syncedSettings);
						Settings.revertSyncOptions(syncedSettings);
						// use synced settings
						Settings.current = syncedSettings;

					} else {
						// sync is disabled
						syncedSettings.options.syncSettings = false;
						Settings.setDefaultSettings(syncedSettings);
						Settings.migrateFromOldVersion(syncedSettings);
					}

					Settings.currentOptionsSyncSettings = syncedSettings.options.syncSettings;

					if (success)
						success();
				}
			} catch (e) {
				Debug.error(`SettingsOperation.readSyncedSettings> onGetSyncData error: ${e} \r\n ${data}`);
			}
		}

		function onGetSyncError(error: any) {
			Debug.error(`SettingsOperation.readSyncedSettings error: ${error.message}`);
		}
	}

	public static initialize(success: Function) {
		///<summary>The initialization method</summary>
		function onGetLocalData(data: any) {
			// all the settings
			Settings.setDefaultSettings(data);
			Settings.migrateFromOldVersion(data);
			Settings.current = data;

			// read all the synced data along with synced ones
			PolyFill.storageSyncGet(null,
				onGetSyncData,
				onGetSyncError);
		}

		function onGetSyncData(data: any) {

			try {
				let syncedSettings = Utils.decodeSyncData(data);

				// only if sync settings is enabled
				if (syncedSettings &&
					syncedSettings.options) {

					if (syncedSettings.options.syncSettings) {

						// use synced settings
						Settings.setDefaultSettings(syncedSettings);
						Settings.migrateFromOldVersion(syncedSettings);
						Settings.revertSyncOptions(syncedSettings);
						Settings.current = syncedSettings;

					} else {
						// sync is disabled
						syncedSettings.options.syncSettings = false;
						Settings.setDefaultSettings(syncedSettings);
						Settings.migrateFromOldVersion(syncedSettings);
					}

					Settings.currentOptionsSyncSettings = syncedSettings.options.syncSettings;
				}
			} catch (e) {
				Debug.error(`SettingsOperation.onGetSyncData error: ${e} \r\n ${data}`);
			}

			if (success) {
				success();
			}
		}

		function onGetLocalError(error: any) {
			Debug.error(`SettingsOperation.initialize error: ${error.message}`);
		}

		function onGetSyncError(error: any) {
			Debug.error(`SettingsOperation.initialize error: ${error.message}`);

			// local settings should be used
			if (success) {
				success();
			}
		}
		PolyFill.storageLocalGet(null,
			onGetLocalData,
			onGetLocalError);

	}

	public static findProxyServerByName(name: string): ProxyServer {
		let proxy = Settings.current.proxyServers.find(item => item.name === name);
		if (proxy !== undefined)
			return proxy;

		for (let subscription of Settings.current.proxyServerSubscriptions) {
			proxy = subscription.proxies.find(item => item.name === name);
			if (proxy !== undefined)
				return proxy;
		}

		return null;
	}

	public static findProxyServerById(id: string): ProxyServer {
		let proxy = Settings.current.proxyServers.find(item => item.id === id);
		if (proxy !== undefined)
			return proxy;

		for (let subscription of Settings.current.proxyServerSubscriptions) {
			proxy = subscription.proxies.find(item => item.id === id);
			if (proxy !== undefined)
				return proxy;
		}

		return null;
	}

	public static getAllSubscribedProxyServers(): any[] {

		if (!Settings.current.proxyServerSubscriptions || !Settings.current.proxyServerSubscriptions.length)
			return [];
		let result: any[] = [];

		for (let subscription of Settings.current.proxyServerSubscriptions) {
			if (subscription.enabled) {
				result = result.concat(subscription.proxies);
			}
		}
		return result;
	}

	public static getFirstProxyServer(): ProxyServer {
		let settings = Settings.current;

		if (settings.proxyServers && settings.proxyServers.length) {
			return settings.proxyServers[0];
		}
		if (settings.proxyServerSubscriptions)
			for (const subscription of settings.proxyServerSubscriptions) {
				if (subscription.proxies && subscription.proxies.length) {
					return subscription.proxies[0];
				}
			}
		return null;
	}

	public static findNextProxyServerByCurrentProxyId(currentProxyId: string): ProxyServer {
		let settings = Settings.current;

		let proxyIndex = settings.proxyServers.findIndex(item => item.id === currentProxyId);
		if (proxyIndex > -1 && proxyIndex + 1 < settings.proxyServers.length) {
			return settings.proxyServers[proxyIndex + 1];
		}

		for (let subscription of Settings.current.proxyServerSubscriptions) {
			proxyIndex = subscription.proxies.findIndex(item => item.id === currentProxyId);
			if (proxyIndex > -1 && proxyIndex + 1 < subscription.proxies.length) {
				return subscription.proxies[proxyIndex + 1];
			}
		}
		return null;
	}

	public static findPreviousProxyServerByCurrentProxyId(currentProxyId: string): ProxyServer {
		let settings = Settings.current;

		let proxyIndex = settings.proxyServers.findIndex(item => item.id === currentProxyId);
		if (proxyIndex > 0) {
			return settings.proxyServers[proxyIndex - 1];
		}

		for (let subscription of Settings.current.proxyServerSubscriptions) {
			proxyIndex = subscription.proxies.findIndex(item => item.id === currentProxyId);
			if (proxyIndex > 0) {
				return subscription.proxies[proxyIndex - 1];
			}
		}
		return null;
	}



	public static syncOnChanged(changes: any, area: string) {
		if (area !== "sync") return;

		Debug.log("syncOnChanged ", area, changes);

		// read all the settings
		SettingsOperation.readSyncedSettings(() => {
			// on settings read success

			// force to save changes to local
			SettingsOperation.saveAllLocal(true);

			// Compile rules & Updates Firefox/Chrome proxy configurations
			ProxyEngine.notifyProxyRulesChanged();

			// reload the subscriptions
			SubscriptionUpdater.reloadEmptyServerSubscriptions();
			SubscriptionUpdater.reloadEmptyRulesSubscriptions();
		});
	}
	public static saveAllSync(saveToSyncServer: boolean = true) {
		if (!Settings.current.options.syncSettings &&
			!Settings.currentOptionsSyncSettings) {
			return;
		}

		// before anything save everything in local
		SettingsOperation.saveAllLocal(true);

		if (saveToSyncServer) {
			var strippedSettings = SettingsOperation.getStrippedSyncableSettings(Settings.current);
			let saveObject = Utils.encodeSyncData(strippedSettings);

			try {
				PolyFill.storageSyncSet(saveObject,
					() => {

						Settings.currentOptionsSyncSettings = Settings.current.options.syncSettings;
					},
					(error: Error) => {
						Debug.error(`SettingsOperation.saveAllSync error: ${error.message} ` + saveObject);
					});

			} catch (e) {
				Debug.error(`SettingsOperation.saveAllSync error: ${e}`);
			}
		}
	}
	public static saveAllLocal(forceSave: boolean = false) {
		if (!forceSave && Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet(Settings.current,
			null,
			(error: Error) => {
				Debug.error(`SettingsOperation.saveAllLocal error: ${error.message}`);
			});
	}
	public static saveOptions() {
		if (Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet({ options: Settings.current.options },
			null,
			(error: Error) => {
				Debug.error(`SettingsOperation.saveOptions error: ${error.message}`);
			});
	}
	// public static saveRules() {
	// 	if (Settings.current.options.syncSettings)
	// 		// don't save in local when sync enabled
	// 		return;

	// 	PolyFill.storageLocalSet({ proxyRules: Settings.current.proxyRules },
	// 		null,
	// 		(error: Error) => {
	// 			Debug.error(`SettingsOperation.saveRules error: ${error.message}`);
	// 		});
	// }
	public static saveProxyProfiles() {
		if (Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet({ proxyProfiles: Settings.current.proxyProfiles },
			null,
			(error: Error) => {
				Debug.error(`SettingsOperation.saveProxyProfiles error: ${error.message}`);
			});
	}
	public static saveProxyServers() {
		if (Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet({ proxyServers: Settings.current.proxyServers },
			null,
			(error: Error) => {
				Debug.error(`SettingsOperation.saveRules error: ${error.message}`);
			});
	}
	public static saveProxyServerSubscriptions() {
		if (Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet({ proxyServerSubscriptions: Settings.current.proxyServerSubscriptions },
			null,
			(error: Error) => {
				Debug.error(`SettingsOperation.proxyServerSubscriptions error: ${error.message}`);
			});
	}
	// public static saveProxyRulesSubscriptions() {
	// 	if (Settings.current.options.syncSettings)
	// 		// don't save in local when sync enabled
	// 		return;

	// 	PolyFill.storageLocalSet({ proxyRulesSubscriptions: Settings.current.proxyRulesSubscriptions },
	// 		null,
	// 		(error: Error) => {
	// 			Debug.error(`SettingsOperation.proxyRulesSubscriptions error: ${error.message}`);
	// 		});
	// }

	public static saveDefaultProxyServer() {
		if (Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet({ defaultProxyServerId: Settings.current.defaultProxyServerId },
			null,
			(error: Error) => {
				Debug.error(`SettingsOperation.saveDefaultProxyServer error: ${error.message}`);
			});
	}
	public static saveActiveProfile() {
		if (Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet({ activeProfileId: Settings.current.activeProfileId },
			null,
			(error: Error) => {
				Debug.error(`SettingsOperation.saveActiveProfile error: ${error.message}`);
			});
	}

	/** Updates the `proxy server` used in the proxy rules for all SmartProfiles*/
	public static updateSmartProfilesRulesProxyServer() {
		// let servers = Settings.current.proxyServers;
		// let rules = Settings.current.proxyRules;

		// for (const server of servers) {
		// 	for (const rule of rules) {
		// 		if (!rule.proxy)
		// 			continue;

		// 		if (rule.proxy.name != server.name)
		// 			continue;

		// 		rule.proxy = server;
		// 	}
		// }
	}

	public static restoreBackup(fileData: string) {
		if (fileData == null)
			return { success: false, message: "Invalid data" };

		function restoreServers(backupServers: any[]) {
			let upcomingServers: ProxyServer[] = [];
			for (let backServer of backupServers) {

				let newServer = new ProxyServer();
				newServer.CopyFrom(backServer);

				let validateResult = Settings.validateProxyServer(newServer, false);
				if (!validateResult.success) {
					// if validation failed

					if (validateResult.exist) {
						continue;
					}
					// not exist, then failed
					return validateResult;
				}

				// -----------
				upcomingServers.push(newServer);
			}

			return { success: true, result: upcomingServers };
		}
		function restoreServerSubscriptions(backupServerSubscriptions: any[]) {
			let upcomingSubscriptions: ProxyServerSubscription[] = [];
			for (let subscription of backupServerSubscriptions) {

				let newSubscription = new ProxyServerSubscription();
				newSubscription.CopyFrom(subscription);

				upcomingSubscriptions.push(newSubscription);
			}

			return { success: true, result: upcomingSubscriptions };
		}

		function restoreProxyProfiles(backupProfiles: any[]) {
			let upcomingProxyProfiles: SmartProfile[] = [];
			for (let backProxyProfile of backupProfiles) {

				let newProfile = new SmartProfile();
				ProfileOperations.copySmartProfile(newProfile, backProxyProfile);

				for (const newRule of newProfile.proxyRules) {
					let validateResult = ProxyRules.validateRule(newRule);
					if (!validateResult.success) {
						// if validation failed
						// not exist, then failed
						return validateResult;
					}
				}

				// -----------
				upcomingProxyProfiles.push(newProfile);
			}

			return { success: true, result: upcomingProxyProfiles };
		}

		function restoreDefaultProxyServer(defaultProxyServerId: any) {

			let proxy = SettingsOperation.findProxyServerById(defaultProxyServerId);
			if (proxy == null) {
				return { success: false, result: browser.i18n.getMessage("aaaaaaaaaaaaaaaaaaaaaaaaa") };
			}

			return { success: true, result: defaultProxyServerId };
		}

		function restoreActiveProfileId(backupActiveProfileId: any) {

			if (backupActiveProfileId == null ||
				backupActiveProfileId <= 0) {
				return { success: false, message: browser.i18n.getMessage("aaaaaaaaaaaaaaaaaaaaaaaaa") };
			}
			return { success: true, result: backupActiveProfileId };
		}

		function restoreOptions(backupOptions: any) {

			if (backupOptions == null ||
				(backupOptions.ignoreRequestFailuresForDomains && !Array.isArray(backupOptions.ignoreRequestFailuresForDomains))) {
				return { success: false, message: "Invalid data provided for general options" };
			}

			let newOptions = new GeneralOptions();
			newOptions.CopyFrom(backupOptions);

			return { success: true, result: newOptions };
		}

		try {
			let backupData = JSON.parse(fileData);
			let backupOptions: GeneralOptions;
			let backupServers: ProxyServer[];
			let backupServerSubscriptions: ProxyServerSubscription[];
			let backupProxyProfiles: SmartProfile[];
			let backupDefaultProxyServerId: string;
			let backupActiveProfileId: string;

			// -----------------------------------
			if (backupData["options"] != null &&
				typeof (backupData.options) == "object") {

				let restoreOptionsResult = restoreOptions(backupData.options);

				if (!restoreOptionsResult.success)
					return restoreOptionsResult;

				backupOptions = restoreOptionsResult.result;
			}

			// -----------------------------------
			if (backupData["proxyServers"] != null &&
				Array.isArray(backupData.proxyServers)) {

				let restoreServersResult = restoreServers(backupData.proxyServers);

				if (!restoreServersResult.success)
					return restoreServersResult;

				backupServers = restoreServersResult.result;
			}

			// -----------------------------------
			if (backupData["proxyServerSubscriptions"] != null &&
				Array.isArray(backupData.proxyServerSubscriptions)) {

				let restoreServerSubscriptionsResult = restoreServerSubscriptions(backupData.proxyServerSubscriptions);

				if (!restoreServerSubscriptionsResult.success)
					return restoreServerSubscriptionsResult;

				backupServerSubscriptions = restoreServerSubscriptionsResult.result;
			}

			// -----------------------------------
			if (backupData["proxyProfiles"] != null &&
				Array.isArray(backupData.proxyProfiles)) {

				let restoreRulesResult = restoreProxyProfiles(backupData.proxyRules);

				if (!restoreRulesResult.success)
					return restoreRulesResult;

				backupProxyProfiles = restoreRulesResult.result;
			}

			// -----------------------------------
			if (backupData["defaultProxyServerId"] != null &&
				typeof (backupData.defaultProxyServerId) == "string") {

				let restoreActiveServerResult = restoreDefaultProxyServer(backupData.defaultProxyServerId);

				if (!restoreActiveServerResult.success)
					return restoreActiveServerResult;

				backupDefaultProxyServerId = restoreActiveServerResult.result;
			}

			// -----------------------------------
			if (backupData["activeProfileId"] != null &&
				typeof (backupData.activeProfileId) == "string") {

				let restoreActiveProfileIdResult = restoreActiveProfileId(backupData.activeProfileId);

				if (!restoreActiveProfileIdResult.success)
					return restoreActiveProfileIdResult;

				backupActiveProfileId = restoreActiveProfileIdResult.result;
			}

			// everything is fine so far
			// so start restoring
			if (backupOptions != null) {
				Settings.current.options = backupOptions;

				SettingsOperation.saveOptions();
			}

			if (backupServers != null) {
				Settings.current.proxyServers = backupServers;

				SettingsOperation.saveProxyServers();
			}

			if (backupServerSubscriptions != null) {

				Settings.current.proxyServerSubscriptions = backupServerSubscriptions;

				SettingsOperation.saveProxyServerSubscriptions();
				// update the timers
				SubscriptionUpdater.updateServerSubscriptions();
			}

			if (backupProxyProfiles != null) {

				Settings.current.proxyProfiles = backupProxyProfiles;

				SettingsOperation.saveProxyProfiles();
				ProxyEngine.notifyProxyRulesChanged();
			}

			if (backupDefaultProxyServerId != null) {

				Settings.current.defaultProxyServerId = backupDefaultProxyServerId;

				SettingsOperation.saveDefaultProxyServer();
			}

			if (backupActiveProfileId != null) {

				Settings.current.activeProfileId = backupActiveProfileId;

				SettingsOperation.saveActiveProfile();
			}

			// save synced if needed
			SettingsOperation.saveAllSync();

			// update proxy rules/config
			ProxyEngine.updateBrowsersProxyConfig();

			return { success: true, message: browser.i18n.getMessage("settingsRestoreSettingsSuccess") }


		} catch (e) {
			return { success: false, message: browser.i18n.getMessage("settingsRestoreSettingsFailed") };
		}
	}
}
