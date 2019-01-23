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
import { ProxyModeType, ProxyRuleType, ProxyServerForProtocol } from "./definitions";
import { Debug } from "../lib/Debug";
import { SettingsOperation } from "./SettingsOperation";
import { LiteEvent } from "../lib/LiteEvent";

export class Settings {

	public static current: SettingsConfig;

	/** TODO: specify the type */
	public static currentOptionsSyncSettings: any;

	public static onInitialized: Function = null;

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

export class SettingsConfig {
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
export class GeneralOptions {
	public syncSettings: boolean = false;
	public syncProxyMode: boolean = true;
	public syncActiveProxy: boolean = true;
	public detectRequestFailures: boolean = true;
	public ignoreRequestFailuresForDomains: string[];
	public displayFailedOnBadge: boolean = false;
	public displayAppliedProxyOnBadge_Doubt: boolean = false;
	// TODO: New feature proxyPerOrigin
	public proxyPerOrigin: boolean = true;
	public enableShortcuts: boolean = true;
	public shortcutNotification: boolean = true;
}
export class BypassOptions {
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

export class ProxyServer extends ProxyServerConnectDetails {
	public name: string;
	public failoverTimeout: number;
	public protocolsServer: ProxyServerConnectDetails[];
}

export class ProxyRule {
	public ruleType: ProxyRuleType;
	public sourceDomain: string;
	public autoGeneratePattern: boolean;
	public rulePattern: string;
	public ruleRegex: string;
	public ruleExact: string;
	public proxy: ProxyServer;
	public enabled: boolean;

	get ruleTypeName(): string {
		return ProxyRuleType[this.ruleType];
	}

	get rule(): string {
		// why ruleType is string? converting to int
		switch (+this.ruleType) {
			case ProxyRuleType.MatchPatternHost:
			case ProxyRuleType.MatchPatternUrl:
				return this.rulePattern;

			case ProxyRuleType.RegexHost:
			case ProxyRuleType.RegexUrl:
				return this.ruleRegex;

			case ProxyRuleType.Exact:
				return this.ruleExact;
		}
		return "";
	}
	public static assignArray(rules: any[]): ProxyRule[] {
		if (!rules || !rules.length)
			return [];
		let result: ProxyRule[] = [];

		for (let index = 0; index < rules.length; index++) {
			const r = rules[index];
			let rule = new ProxyRule();

			Object.assign(rule, r);
			result.push(rule);
		}

		return result;
	}
}

export class ProxyServerSubscription {
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
