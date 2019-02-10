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
import { environment, browser } from "../lib/environment";
import { proxyServerProtocols } from "./definitions";

export class SettingsOperation {
	public static setDefaultSettings(settingObj) {

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

		PolyFill.managementGetSelf(info => {
			settingObj.version = info.version;
		});
	}

	public static readSyncedSettings(success) {
		// gettin synced data
		PolyFill.storageSyncGet(null,
			onGetSyncData,
			onGetSyncError);

		function onGetSyncData(data: any);
		function onGetSyncData(data) {

			try {
				let syncedSettings = SettingsOperation.decodeSyncData(data);

				// only if sync settings is enabled
				if (syncedSettings &&
					syncedSettings.current.options) {

					if (syncedSettings.current.options.syncSettings) {

						// use synced settings
						//settings = migrateFromOldVersion(syncedSettings);

						// TODO: don't replace current settings directly
						Settings.current = syncedSettings;
						SettingsOperation.setDefaultSettings(Settings.current);

					} else {
						// sync is disabled
						syncedSettings.current.options.syncSettings = false;
					}

					// TODO: don't replace current settings directly
					Settings.currentOptionsSyncSettings = syncedSettings.current.options.syncSettings;
				}
			} catch (e) {
				Debug.error(`SettingsOperation.readSyncedSettings> onGetSyncData error: ${e} \r\n ${data}`);
			}
		}

		function onGetSyncError(error: any);
		function onGetSyncError(error) {
			Debug.error(`SettingsOperation.readSyncedSettings error: ${error.message}`);
		}
	}

	public static initialize(success) {
		///<summary>The initialization method</summary>
		function onGetLocalData(data: any);
		function onGetLocalData(data) {
			// all the settings
			// TODO: don't replace current settings directly
			Settings.current = migrateFromOldVersion(data);

			SettingsOperation.setDefaultSettings(Settings.current);

			// read all the synced data along with synced ones
			PolyFill.storageSyncGet(null,
				onGetSyncData,
				onGetSyncError);
		}

		function onGetSyncData(data: any);
		function onGetSyncData(data) {

			try {
				let syncedSettings = SettingsOperation.decodeSyncData(data);

				// only if sync settings is enabled
				if (syncedSettings &&
					syncedSettings.current.options) {

					if (syncedSettings.current.options.syncSettings) {

						// use synced settings
						// TODO: don't replace current settings directly
						Settings.current = migrateFromOldVersion(syncedSettings);
						SettingsOperation.setDefaultSettings(Settings.current);

					} else {
						// sync is disabled
						syncedSettings.current.options.syncSettings = false;
					}

					// TODO: don't replace current settings directly
					Settings.currentOptionsSyncSettings = syncedSettings.current.options.syncSettings;
				}
			} catch (e) {
				Debug.error(`SettingsOperation.onGetSyncData error: ${e} \r\n ${data}`);
			}

			if (success) {
				success();
			}
		}

		function onGetLocalError(error: any);
		function onGetLocalError(error) {
			Debug.error(`SettingsOperation.initialize error: ${error.message}`);
		}

		function onGetSyncError(error: any);
		function onGetSyncError(error) {
			Debug.error(`SettingsOperation.initialize error: ${error.message}`);

			// local settings should be used
			if (success) {
				success();
			}
		}

		function migrateFromOldVersion(data: any);
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
				// for (let oldRule of data.proxyRules) {
				// 	// newProxyRules.push(
				// 	// 	new  {
				// 	// 		pattern: oldRule.rule || oldRule.pattern,
				// 	// 		source: oldRule.host || oldRule.source,
				// 	// 		enabled: oldRule.enabled,
				// 	// 		proxy: oldRule.proxy
				// 	// 	});
				// }
				data.proxyRules = newProxyRules;
			}
			return data;
		}

		PolyFill.storageLocalGet(null,
			onGetLocalData,
			onGetLocalError);

	}
	public static findProxyServerByName(name) {
		let proxy = Settings.current.proxyServers.find(item => item.name === name);
		if (proxy !== undefined) return proxy;

		for (let subscription of Settings.current.proxyServerSubscriptions) {
			proxy = subscription.proxies.find(item => item.name === name);
			if (proxy !== undefined) return proxy;
		}

		return null;
	}

	public static encodeSyncData(inputObject) {

		let settingStr = JSON.stringify(inputObject);

		// encode string to utf8
		let enc = new TextEncoder();
		let settingArray = enc.encode(settingStr);

		// compress
		let compressResultStr = pako.deflateRaw(settingArray, { to: "string" });
		compressResultStr = Utils.b64EncodeUnicode(compressResultStr);

		let saveObject = {};

		// some browsers have limitation on data size per item
		// so we have split the data into chunks saved in a object
		splitIntoChunks(compressResultStr, saveObject);

		function splitIntoChunks(str: any, outputObject: any);
		function splitIntoChunks(str: any, outputObject: any) {
			let length = environment.storageQuota.syncQuotaBytesPerItem();
			if (length > 0) {

				let chunks = Utils.chunkString(str, length);
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
	}

	public static decodeSyncData(inputObject) {
		if (!inputObject || !inputObject.chunkLength)
			return null;

		// joining the chunks
		let chunks = [];
		for (let index = 0; index < inputObject.chunkLength; index++) {
			chunks.push(inputObject["c" + index]);
		}
		let compressResultStr = chunks.join("");

		// convert from base64 string
		compressResultStr = Utils.b64DecodeUnicode(compressResultStr);

		// decompress
		let settingArray = pako.inflateRaw(compressResultStr);

		// decode array to string
		let dec = new TextDecoder();
		let settingStr = dec.decode(settingArray);

		// parse the JSON
		return JSON.parse(settingStr);
	}
	public static syncOnChanged(changes, area) {
		if (area !== "sync") return;

		Debug.log("syncOnChanged ", area, changes);

		// read all the settings
		SettingsOperation.readSyncedSettings(() => {
			// on settings read success

			// force to save changes to local
			SettingsOperation.saveAllLocal(true);

			// ProxyRules.notifyProxyRulesChange();
			// ProxyRules.notifyActiveProxyServerChange();
			// ProxyRules.notifyProxyModeChange();
			// ProxyRules.notifyBypassChanged();

			// // update proxy rules
			// ProxyRules.updateChromeProxyConfig();

		});
	}
	public static saveAllSync() {
		if (!Settings.current.options.syncSettings &&
			!Settings.currentOptionsSyncSettings) {
			return;
		}

		// before anything save everything in local
		SettingsOperation.saveAllLocal(true);

		let saveObject = SettingsOperation.encodeSyncData(Settings.current);

		try {
			PolyFill.storageSyncSet(saveObject,
				() => {
					// TODO: don't replace current settings directly
					Settings.currentOptionsSyncSettings = Settings.current.options.syncSettings;
				},
				error => {
					Debug.error(`SettingsOperation.saveAllSync error: ${error.message} ` + saveObject);
				});

		} catch (e) {
			Debug.error(`SettingsOperation.saveAllSync error: ${e}`);
		}
	}
	public static saveAllLocal(forceSave) {
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
	public static validateProxyServer(server) {
		if (server.port <= 0 || server.port >= 65535) {
			return {
				success: false,
				message: browser.i18n.getMessage("settingsServerPortInvalid").replace("{0}", `${server.host}:${server.port}`)
			};
		}

		if (!server.host || !Utils.isValidHost(server.host)) {
			return {
				success: false,
				message: browser.i18n.getMessage("settingsServerHostInvalid").replace("{0}", `${server.host}:${server.port}`)
			};
		}

		if (!server.name) {
			return { success: false, message: browser.i18n.getMessage("settingsServerNameRequired") };
		} else {

			//const currentServers = Settings.current.proxyServers;

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
	}
	public static restoreSettings(fileData) {
		// if (fileData == null)
		// 	return { success: false, message: "Invalid data" };

		// function restoreServers(backupServers: any);
		// function restoreServers(backupServers) {
		// 	let upcomingServers = [];
		// 	for (let server of backupServers) {
		// 		let validateResult = SettingsOperation.validateProxyServer(server);
		// 		if (!validateResult.success) {
		// 			// if validation failed

		// 			//if (validateResult.exist) {
		// 			//	continue;
		// 			//}
		// 			// not exist, then failed
		// 			return validateResult;
		// 		}

		// 		// good
		// 		upcomingServers.push(server);
		// 	}

		// 	return { success: true, result: upcomingServers };
		// }

		// function restoreRules(backupRules: any);
		// function restoreRules(backupRules) {
		// 	// let upcomingRules = [];
		// 	// for (let rule of backupRules) {
		// 	// 	let validateResult = ProxyRules.validateRule(rule);
		// 	// 	if (!validateResult.success) {
		// 	// 		// if validation failed

		// 	// 		//if (validateResult.exist) {
		// 	// 		//	continue;
		// 	// 		//}
		// 	// 		// not exist, then failed
		// 	// 		return validateResult;
		// 	// 	}

		// 	// 	// good
		// 	// 	upcomingRules.push(rule);
		// 	// }

		// 	// return { success: true, result: upcomingRules };
		// }

		// function restoreActiveServer(backupActiveProxyServer: any);
		// function restoreActiveServer(backupActiveProxyServer) {

		// 	let validateResult = SettingsOperation.validateProxyServer(backupActiveProxyServer);
		// 	if (!validateResult.success) {
		// 		// if validation failed

		// 		//if (validateResult.exist) {
		// 		//	continue;
		// 		//}
		// 		// not exist, then failed
		// 		return validateResult;
		// 	}
		// 	return { success: true, result: backupActiveProxyServer };
		// }

		// function restoreProxyMode(backupProxyMode: any);
		// function restoreProxyMode(backupProxyMode) {

		// 	if (backupProxyMode == null ||
		// 		backupProxyMode <= 0) {
		// 		return { success: false, message: browser.i18n.getMessage("settingsProxyModeInvalid") };
		// 	}
		// 	return { success: true, result: backupProxyMode };
		// }

		// function restoreBypass(backupBypass: any);
		// function restoreBypass(backupBypass) {

		// 	if (backupBypass == null ||
		// 		backupBypass.bypassList == null ||
		// 		!Array.isArray(backupBypass.bypassList)) {
		// 		return { success: false, message: browser.i18n.getMessage("settingsBypassInvalid") };
		// 	}
		// 	backupBypass.enableForAlways = backupBypass.enableForAlways || false;
		// 	backupBypass.enableForSystem = backupBypass.enableForSystem || false;

		// 	return { success: true, result: backupBypass };
		// }

		// try {
		// 	let backupData = JSON.parse(fileData);
		// 	let backupServers;
		// 	let backupRules;
		// 	let backupActiveServer;
		// 	let backupProxyMode;
		// 	let backupBypass;

		// 	if (backupData["proxyServers"] != null &&
		// 		Array.isArray(backupData.proxyServers)) {

		// 		let restoreServersResult = restoreServers(backupData.proxyServers);

		// 		if (!restoreServersResult.success)
		// 			return restoreServersResult;

		// 		backupServers = restoreServersResult.result;
		// 	}

		// 	if (backupData["proxyRules"] != null &&
		// 		Array.isArray(backupData.proxyRules)) {

		// 		let restoreRulesResult = restoreRules(backupData.proxyRules);

		// 		if (!restoreRulesResult.success)
		// 			return restoreRulesResult;

		// 		backupRules = restoreRulesResult.result;
		// 	}

		// 	if (backupData["activeProxyServer"] != null &&
		// 		typeof (backupData.activeProxyServer) == "object") {

		// 		let restoreActiveServerResult = restoreActiveServer(backupData.activeProxyServer);

		// 		if (!restoreActiveServerResult.success)
		// 			return restoreActiveServerResult;

		// 		backupActiveServer = restoreActiveServerResult.result;
		// 	}

		// 	if (backupData["proxyMode"] != null &&
		// 		typeof (backupData.proxyMode) == "string") {

		// 		let restoreProxyModeResult = restoreProxyMode(backupData.proxyMode);

		// 		if (!restoreProxyModeResult.success)
		// 			return restoreProxyModeResult;

		// 		backupProxyMode = restoreProxyModeResult.result;
		// 	}
		// 	if (backupData["bypass"] != null &&
		// 		typeof (backupData.bypass) == "object" &&
		// 		Array.isArray(backupData.bypass.bypassList)) {

		// 		let restoreProxyModeResult = restoreBypass(backupData.bypass);

		// 		if (!restoreProxyModeResult.success)
		// 			return restoreProxyModeResult;

		// 		backupBypass = restoreProxyModeResult.result;
		// 	}

		// 	// everything is fine so far
		// 	// so start restoring
		// 	if (backupServers != null) {
		// 		Settings.current.proxyServers = backupServers;

		// 		SettingsOperation.saveProxyServers();

		// 	}

		// 	if (backupRules != null) {

		// 		Settings.current.proxyRules = backupRules;

		// 		SettingsOperation.saveRules();
		// 		ProxyRules.notifyProxyRulesChange();
		// 	}

		// 	if (backupActiveServer != null) {

		// 		Settings.current.activeProxyServer = backupActiveServer;

		// 		SettingsOperation.saveActiveProxyServer();
		// 		ProxyRules.notifyActiveProxyServerChange();
		// 	}

		// 	if (backupProxyMode != null) {

		// 		Settings.current.proxyMode = backupProxyMode;

		// 		SettingsOperation.saveProxyMode();
		// 		ProxyRules.notifyProxyModeChange();
		// 	}

		// 	if (backupBypass != null) {

		// 		Settings.current.bypass = backupBypass;

		// 		SettingsOperation.saveBypass();
		// 		ProxyRules.notifyBypassChanged();
		// 	}

		// 	// save synced if needed
		// 	SettingsOperation.saveAllSync();

		// 	// update proxy rules
		// 	ProxyRules.updateChromeProxyConfig();

		// 	return { success: true, message: browser.i18n.getMessage("settingsRestoreSettingsSuccess") }


		// } catch (e) {
		// 	return { success: false, message: browser.i18n.getMessage("settingsRestoreSettingsFailed") };
		// }
	}
}
