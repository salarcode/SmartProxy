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
import { PolyFill } from "../lib/PolyFill";
import { Debug } from "../lib/Debug";
import { Settings } from "./Settings";
import { pako } from "../lib/External";
import { Utils } from "../lib/Utils";
import { GeneralOptions, ProxyServer, ProxyRule, ProxyModeType, BypassOptions } from "./definitions";
import { ProxyEngine } from "./ProxyEngine";
import { ProxyRules } from "./ProxyRules";

export class SettingsOperation {
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
	public static findProxyServerByName(name: string) {
		let proxy = Settings.current.proxyServers.find(item => item.name === name);
		if (proxy !== undefined) return proxy;

		for (let subscription of Settings.current.proxyServerSubscriptions) {
			proxy = subscription.proxies.find(item => item.name === name);
			if (proxy !== undefined) return proxy;
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

			ProxyEngine.notifyProxyRulesChanged();
			ProxyEngine.notifyActiveProxyServerChanged();
			ProxyEngine.notifyProxyModeChanged();
			ProxyEngine.notifyBypassChanged();
		});
	}
	public static saveAllSync() {
		if (!Settings.current.options.syncSettings &&
			!Settings.currentOptionsSyncSettings) {
			return;
		}

		// before anything save everything in local
		SettingsOperation.saveAllLocal(true);

		let saveObject = Utils.encodeSyncData(Settings.current);

		try {
			PolyFill.storageSyncSet(saveObject,
				() => {

					Settings.currentOptionsSyncSettings = Settings.current.options.syncSettings;
				},
				error => {
					Debug.error(`SettingsOperation.saveAllSync error: ${error.message} ` + saveObject);
				});

		} catch (e) {
			Debug.error(`SettingsOperation.saveAllSync error: ${e}`);
		}
	}
	public static saveAllLocal(forceSave: boolean = false) {
		if (!forceSave && Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet(Settings.current,
			null,
			error => {
				Debug.error(`SettingsOperation.saveAllLocal error: ${error.message}`);
			});
	}
	public static saveOptions() {
		if (Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet({ options: Settings.current.options },
			null,
			error => {
				Debug.error(`SettingsOperation.saveOptions error: ${error.message}`);
			});
	}
	public static saveRules() {
		if (Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet({ proxyRules: Settings.current.proxyRules },
			null,
			error => {
				Debug.error(`SettingsOperation.saveRules error: ${error.message}`);
			});
	}
	public static saveProxyServers() {
		if (Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet({ proxyServers: Settings.current.proxyServers },
			null,
			error => {
				Debug.error(`SettingsOperation.saveRules error: ${error.message}`);
			});
	}
	public static saveProxyServerSubscriptions() {
		if (Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet({ proxyServerSubscriptions: Settings.current.proxyServerSubscriptions },
			null,
			error => {
				Debug.error(`SettingsOperation.proxyServerSubscriptions error: ${error.message}`);
			});
	}
	public static saveBypass() {
		if (Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet({ bypass: Settings.current.bypass },
			null,
			error => {
				Debug.error(`SettingsOperation.bypass error: ${error.message}`);
			});
	}
	public static saveActiveProxyServer() {
		if (Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet({ activeProxyServer: Settings.current.activeProxyServer },
			null,
			error => {
				Debug.error(`SettingsOperation.saveRules error: ${error.message}`);
			});
	}
	public static saveProxyMode() {
		if (Settings.current.options.syncSettings)
			// don't save in local when sync enabled
			return;

		PolyFill.storageLocalSet({ proxyMode: Settings.current.proxyMode },
			null,
			error => {
				Debug.error(`SettingsOperation.saveProxyMode error: ${error.message}`);
			});
	}

	public static restoreSettings(fileData: string) {
		if (fileData == null)
			return { success: false, message: "Invalid data" };

		function restoreServers(backupServers: any[]) {
			let upcomingServers: ProxyServer[] = [];
			for (let backServer of backupServers) {

				let newServer = new ProxyServer();
				newServer.CopyFrom(backServer);

				let validateResult = Settings.validateProxyServer(newServer);
				if (!validateResult.success) {
					// if validation failed

					if (validateResult.exist) {
						continue;
					}
					// not exist, then failed
					return validateResult;
				}

				// good
				upcomingServers.push(newServer);
			}

			return { success: true, result: upcomingServers };
		}

		function restoreRules(backupRules: any[]) {
			let upcomingRules: ProxyRule[] = [];
			for (let backRule of backupRules) {

				let newRule = new ProxyRule();
				newRule.CopyFrom(backRule);

				let validateResult = ProxyRules.validateRule(newRule);
				if (!validateResult.success) {
					// if validation failed
					// not exist, then failed
					return validateResult;
				}

				// good
				upcomingRules.push(newRule);
			}

			return { success: true, result: upcomingRules };
		}

		function restoreActiveServer(backupActiveProxyServer: any) {

			let newActiveServer = new ProxyServer();
			newActiveServer.CopyFrom(backupActiveProxyServer);

			let validateResult = Settings.validateProxyServer(newActiveServer);
			if (!validateResult.success &&
				!validateResult.exist) {
				// if validation failed

				// not exist, then failed
				return validateResult;
			}
			return { success: true, result: newActiveServer };
		}

		function restoreProxyMode(backupProxyMode: any) {

			if (backupProxyMode == null ||
				backupProxyMode <= 0) {
				return { success: false, message: browser.i18n.getMessage("settingsProxyModeInvalid") };
			}
			return { success: true, result: backupProxyMode };
		}

		function restoreBypass(backupBypass: any) {

			if (backupBypass == null ||
				(backupBypass.bypassList == null && !Array.isArray(backupBypass.bypassList))) {
				return { success: false, message: browser.i18n.getMessage("settingsBypassInvalid") };
			}

			let newByPass = new BypassOptions();
			newByPass.CopyFrom(backupBypass);

			backupBypass.enableForAlways = backupBypass.enableForAlways || false;
			backupBypass.enableForSystem = backupBypass.enableForSystem || false;

			return { success: true, result: backupBypass };
		}

		function restoreOptions(backupOptions: any) {

			if (backupOptions == null ||
				(backupOptions.ignoreRequestFailuresForDomains && !Array.isArray(backupOptions.ignoreRequestFailuresForDomains))) {
				return { success: false, message: browser.i18n.getMessage("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA") };
			}

			let newOptions = new GeneralOptions();
			newOptions.CopyFrom(backupOptions);

			return { success: true, result: newOptions };
		}

		try {
			let backupData = JSON.parse(fileData);
			let backupOptions: GeneralOptions;
			let backupServers: ProxyServer[];
			let backupRules: ProxyRule[];
			let backupActiveServer: ProxyServer;
			let backupProxyMode: ProxyModeType;
			let backupBypass: BypassOptions;

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
			if (backupData["proxyRules"] != null &&
				Array.isArray(backupData.proxyRules)) {

				let restoreRulesResult = restoreRules(backupData.proxyRules);

				if (!restoreRulesResult.success)
					return restoreRulesResult;

				backupRules = restoreRulesResult.result;
			}

			// -----------------------------------
			if (backupData["activeProxyServer"] != null &&
				typeof (backupData.activeProxyServer) == "object") {

				let restoreActiveServerResult = restoreActiveServer(backupData.activeProxyServer);

				if (!restoreActiveServerResult.success)
					return restoreActiveServerResult;

				backupActiveServer = restoreActiveServerResult.result;
			}

			// -----------------------------------
			if (backupData["proxyMode"] != null &&
				typeof (backupData.proxyMode) == "string") {

				let restoreProxyModeResult = restoreProxyMode(backupData.proxyMode);

				if (!restoreProxyModeResult.success)
					return restoreProxyModeResult;

				backupProxyMode = restoreProxyModeResult.result;
			}

			// -----------------------------------
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
			if (backupOptions != null) {
				Settings.current.options = backupOptions;

				SettingsOperation.saveOptions();
				ProxyEngine.notifySettingsOptionsChanged();
			}

			if (backupServers != null) {
				Settings.current.proxyServers = backupServers;

				SettingsOperation.saveProxyServers();
			}

			if (backupRules != null) {

				Settings.current.proxyRules = backupRules;

				SettingsOperation.saveRules();
				ProxyEngine.notifyProxyRulesChanged();
			}

			if (backupActiveServer != null) {

				Settings.current.activeProxyServer = backupActiveServer;

				SettingsOperation.saveActiveProxyServer();
				ProxyEngine.notifyActiveProxyServerChanged();
			}

			if (backupProxyMode != null) {

				Settings.current.proxyMode = backupProxyMode;

				SettingsOperation.saveProxyMode();
				ProxyEngine.notifyProxyModeChanged();
			}

			if (backupBypass != null) {

				Settings.current.bypass = backupBypass;

				SettingsOperation.saveBypass();
				ProxyEngine.notifyBypassChanged();
			}

			// save synced if needed
			SettingsOperation.saveAllSync();

			// update proxy rules
			ProxyEngine.updateChromeProxyConfig();
			ProxyEngine.updateFirefoxProxyConfig();

			return { success: true, message: browser.i18n.getMessage("settingsRestoreSettingsSuccess") }


		} catch (e) {
			return { success: false, message: browser.i18n.getMessage("settingsRestoreSettingsFailed") };
		}
	}
}
