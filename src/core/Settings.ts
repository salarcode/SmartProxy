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
import { ProxyModeType, ProxyRuleType, proxyServerProtocols, ProxyServer, GeneralOptions, BypassOptions, SettingsConfig, ProxyRule } from "./definitions";
import { Debug } from "../lib/Debug";
import { SettingsOperation } from "./SettingsOperation";
import { browser } from "../lib/environment";
import { Utils } from "../lib/Utils";

export class Settings {

	public static current: SettingsConfig;

	public static currentOptionsSyncSettings: boolean = true;

	public static onInitialized: Function = null;

	public static initialize() {
		Settings.current = new SettingsConfig();

		PolyFill.storageLocalGet(null,
			Settings.onInitializeGetLocalData,
			Settings.onInitializeGetLocalError);

		// handle synced settings changes
		browser.storage.onChanged.addListener(SettingsOperation.syncOnChanged);
	}


	private static onInitializeGetLocalData(data: any) {
		Settings.setDefaultSettings(data);
		Settings.migrateFromOldVersion(data);
		Settings.current = data;

		// read all the synced data along with synced ones
		PolyFill.storageSyncGet(null,
			Settings.onInitializeGetSyncData,
			Settings.onInitializeGetSyncError);
	}

	private static onInitializeGetLocalError(error: any) {
		Debug.error(`settingsOperation.initialize error: ${error.message}`);
	}

	private static onInitializeGetSyncData(data: any) {
		try {
			let syncedSettings = Utils.decodeSyncData(data);

			// only if sync settings is enabled
			if (syncedSettings &&
				syncedSettings.options) {

				if (syncedSettings.options.syncSettings) {

					// use synced settings
					Settings.setDefaultSettings(syncedSettings);
					Settings.migrateFromOldVersion(syncedSettings);
					Settings.current = syncedSettings;

				} else {
					// sync is disabled
					syncedSettings.options.syncSettings = false;
				}

				Settings.currentOptionsSyncSettings = syncedSettings.options.syncSettings;
			}
		} catch (e) {
			Debug.error(`settingsOperation.readSyncedSettings> onGetSyncData error: ${e} \r\n ${data}`);
		}

		if (Settings.onInitialized)
			Settings.onInitialized();
	}

	private static onInitializeGetSyncError(error) {
		Debug.error(`settingsOperation.readSyncedSettings error: ${error.message}`);
	}

	public static setDefaultSettings(config: SettingsConfig) {
		if (config["proxyRules"] == null || !Array.isArray(config.proxyRules)) {
			config.proxyRules = [];
		}
		if (config["proxyServers"] == null || !Array.isArray(config.proxyServers)) {
			config.proxyServers = [];
		}
		if (config["proxyMode"] == null) {
			config.proxyMode = ProxyModeType.Direct;
		}
		if (config["activeProxyServer"] == null) {
			config.activeProxyServer = null;
		}
		if (config["proxyServerSubscriptions"] == null || !Array.isArray(config.proxyServerSubscriptions)) {
			config.proxyServerSubscriptions = [];
		}
		if (config["options"] == null) {
			config.options = new GeneralOptions();
		}
		if (config["bypass"] == null) {
			config.bypass = new BypassOptions();
		}
		config.product = "SmartProxy";

		PolyFill.managementGetSelf(info => {
			config.version = info.version;
		}, null);
	}

	public static migrateFromOldVersion(config: SettingsConfig) {
		if (!config)
			return;
		if (config.proxyRules && config.proxyRules.length > 0) {

			// check if pattern property exists
			if (config.proxyRules[0]["pattern"]) {
				let oldRules = config.proxyRules;
				let newRules: ProxyRule[] = [];

				for (const oldRule of oldRules) {
					let newRule = new ProxyRule();
					newRule.rulePattern = oldRule["pattern"];
					newRule.sourceDomain = oldRule["source"];
					newRule.enabled = oldRule.enabled;
					newRule.proxy = oldRule.proxy;
					newRule.ruleType = ProxyRuleType.MatchPatternUrl;

					newRules.push(newRule);
				}

				config.proxyRules = newRules;
			}
		}
	}

	
	public static validateProxyServer(server: ProxyServer): {
		success: boolean, exist?: boolean, message?: string,
		result?: any
	} {
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

			const currentServers = Settings.current.proxyServers;

			for (let srv of currentServers) {
				if (srv.name == server.name) {
					return { success: false, exist: true, message: `Server name ${server.name} already exists` };
				}
			}
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
}

