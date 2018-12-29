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
import { ProxyModeType, ProxyRuleType } from "./definitions";
import { Debug } from "../lib/Debug";
import { SettingsOperation } from "./SettingsOperation";
import { LiteEvent } from "../lib/LiteEvent";

export class Settings {

	public static current: SettingsConfig;

	/** TODO: specify the type */
	public static currentOptionsSyncSettings: any;

	private static readonly _onInitialized = new LiteEvent<void>();

	// public static get onInitialized() { return this._onInitialized.expose(); }
	public static readonly onInitialized=Settings._onInitialized;

	public static initialize() {
		Settings.current = new SettingsConfig();

		PolyFill.storageLocalGet(null,
			Settings.onInitializeGetLocalData,
			Settings.onInitializeGetLocalError);
	}


	private static onInitializeGetLocalData(data: any) {
		Settings.current = data;
		Settings.setDefaultSettings(Settings.current);

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
			let syncedSettings = SettingsOperation.decodeSyncData(data);

			// only if sync settings is enabled
			if (syncedSettings &&
				syncedSettings.options) {

				if (syncedSettings.options.syncSettings) {

					// use synced settings
					//settings = migrateFromOldVersion(syncedSettings);
					Settings.current = syncedSettings;
					Settings.setDefaultSettings(Settings.current);

				} else {
					// sync is disabled
					syncedSettings.options.syncSettings = false;
				}

				this.currentOptionsSyncSettings = syncedSettings.options.syncSettings;

				this._onInitialized.trigger();
			}
		} catch (e) {
			Debug.error(`settingsOperation.readSyncedSettings> onGetSyncData error: ${e} \r\n ${data}`);
		}
	}

	private static onInitializeGetSyncError(error) {
		Debug.error(`settingsOperation.readSyncedSettings error: ${error.message}`);
	}

	private static setDefaultSettings(config: SettingsConfig) {
		if (config["proxyRules"] == null || !Array.isArray(config.proxyRules)) {
			config.proxyRules = [];
		}
		if (config["proxyMode"] == null) {
			config.proxyMode = 1;
		}
		if (config["proxyServers"] == null || !Array.isArray(config.proxyServers)) {
			config.proxyServers = [];
		}
		if (config["proxyServerSubscriptions"] == null || !Array.isArray(config.proxyServerSubscriptions)) {
			config.proxyServerSubscriptions = [];
		}
		if (config["activeProxyServer"] == null) {
			config.activeProxyServer = null;
		}
		if (config["bypass"] == null) {
			config.bypass = {
				enableForAlways: false,
				enableForSystem: false,
				bypassList: ["127.0.0.1", "localhost", "::1"]
			};
		}
		if (config["options"] == null) {
			config.options = new GeneralOptions();
		}
		if (config["bypass"] == null) {
			config.bypass = new BypassOptions();
		}
		config.product = "SmartProxy";

		PolyFill.managementGetSelf(function (info) {
			config.version = info.version;
		}, null);

	}
}

class SettingsConfig {
	constructor() {
		this.options = new GeneralOptions();
		this.bypass = new BypassOptions();
	}
	public product: string = "SmartProxy";
	public version: string = "";
	public proxyRules: ProxyRule[] = [];
	public proxyServers: ProxyServer[] = [];
	public proxyMode: ProxyModeType = ProxyModeType.Direct;

	// TODO: can this accept null?
	public activeProxyServer: ProxyServer | null;
	public proxyServerSubscriptions: ProxyServerSubscription[] = [];
	public options: GeneralOptions;
	public bypass: BypassOptions;
}
class GeneralOptions {
	public syncSettings: boolean = false;
	public detectRequestFailures: boolean = false;
	public displayFailedOnBadge: boolean = false;
	public displayAppliedProxyOnBadge: boolean = false;
	// TODO: New feature proxyPerOrigin
	public proxyPerOrigin: boolean = true;
}
class BypassOptions {
	public enableForAlways: boolean = false;
	public enableForSystem: boolean = false;
	public bypassList: string[] = ["127.0.0.1", "localhost", "::1"];
}

class ProxyServerConnectDetails {
	public host: string;
	public port: number;
	public protocol: string;
	public username: string;
	public password: string;
	public proxyDNS: boolean;
}

export class ProxyServer implements ProxyServerConnectDetails {
	public host: string;
	public port: number;
	public protocol: string;
	public username: string;
	public password: string;
	public proxyDNS: boolean;
	public name: string;
	public failoverTimeout: number;
	public protocolsServer: ProxyServerConnectDetails[];
}

export class ProxyRule {
	public rulePattern: string;
	public sourceDomain: string;
	public proxy: ProxyServer;
	public enabled: boolean;
	// TODO: New feature ruleType
	public ruleType: ProxyRuleType;
}

class ProxyServerSubscription {
	public name: string;
	public url: string;
	public enabled: boolean = false;

	// same as proxyServerProtocols
	public proxyProtocol: null;

	// in minutes
	public refreshRate: number = 0;

	// types stored in proxyServerSubscriptionObfuscate
	public obfuscation: string;

	// number of proxies in the list
	public totalCount: number = 0;

	public username: string;
	public password: string;
	// the loaded proxies
	public proxies: any[];
}
