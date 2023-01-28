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
import { PolyFill } from '../lib/PolyFill';
import {
	ProxyRuleType,
	proxyServerProtocols,
	ProxyServer,
	GeneralOptions,
	SettingsConfig,
	SmartProfileTypeBuiltinIds,
	getBuiltinSmartProfiles,
	SettingsActive,
	SmartProfileCompiled,
	SmartProfile,
	SmartProfileType,
	getSmartProfileTypeConfig,
	ProxyServerSubscription,
	ProxyRule,
	ProxyRulesSubscription,
	ThemeType,
} from './definitions';
import { Debug } from '../lib/Debug';
import { SettingsOperation } from './SettingsOperation';
import { api, environment } from '../lib/environment';
import { Utils } from '../lib/Utils';
import { ProfileOperations } from './ProfileOperations';

export class Settings {
	public static current: SettingsConfig;

	public static active: SettingsActive;

	public static currentOptionsSyncSettings: boolean = true;

	public static onInitializedLocally: Function = null;
	public static onInitializedRemoteSync: Function = null;

	public static initialize() {
		Settings.current = new SettingsConfig();

		PolyFill.storageLocalGet(null, Settings.onInitializeGetLocalData, Settings.onInitializeGetLocalError);

		// handle synced settings changes
		api.storage.onChanged.addListener(SettingsOperation.syncOnChanged);
	}

	private static onInitializeGetLocalData(data: any) {
		data = Settings.getRestorableSettings(data);

		Settings.current = data;
		Settings.updateActiveSettings();

		// read all the synced data along with synced ones
		PolyFill.storageSyncGet(null, Settings.onInitializeGetSyncData, Settings.onInitializeGetSyncError);

		if (Settings.onInitializedLocally)
			Settings.onInitializedLocally();
	}

	private static onInitializeGetLocalError(error: any) {
		Debug.error(`settingsOperation.initialize error: ${error.message}`);

		if (Settings.onInitializedLocally)
			Settings.onInitializedLocally();
	}

	private static onInitializeGetSyncData(data: any) {
		try {
			let syncedSettings = Utils.decodeSyncData(data);

			// only if sync settings is enabled
			if (syncedSettings && syncedSettings.options) {
				if (syncedSettings.options.syncSettings) {
					// use synced settings
					syncedSettings = Settings.getRestorableSettings(syncedSettings);
					Settings.revertSyncOptions(syncedSettings);

					Settings.current = syncedSettings;
				} else {
					// sync is disabled
					syncedSettings.options.syncSettings = false;
				}

				Settings.currentOptionsSyncSettings = syncedSettings.options.syncSettings;
				Settings.updateActiveSettings();
			}
		} catch (e) {
			Debug.error(`settingsOperation.readSyncedSettings> onGetSyncData error: ${e} \r\n ${data}`);
		}

		if (Settings.onInitializedRemoteSync)
			Settings.onInitializedRemoteSync();
	}

	private static onInitializeGetSyncError(error: Error) {
		Debug.error(`settingsOperation.readSyncedSettings error: ${error.message}`);
	}

	public static getRestorableSettings(config: any): SettingsConfig {
		if (config.version < '0.9.999') {
			let newConfig = Settings.migrateFromVersion09x(config);
			return newConfig;
		}

		this.setDefaultSettings(config);
		this.ensureIntegrityOfSettings(config);
		return config;
	}

	public static setDefaultSettings(config: SettingsConfig) {
		config.product = 'SmartProxy';
		config.version = null;
		if (config['activeProfileId'] == null) {
			config.activeProfileId = SmartProfileTypeBuiltinIds.Direct;
		}
		if (config['defaultProxyServerId'] == null) {
			config.defaultProxyServerId = null;
		}
		if (config['options'] == null) {
			config.options = new GeneralOptions();
		}
		if (config.options.themeType == null) {
			config.options.themeType = ThemeType.Auto;
		}
		if (!config.options.themesDark) {
			config.options.themesDark = GeneralOptions.defaultDarkThemeName;
		}
		if (config['firstEverInstallNotified'] == null) {
			config.firstEverInstallNotified = false;
		}
		if (config['proxyServers'] == null || !Array.isArray(config.proxyServers)) {
			config.proxyServers = [];
		}
		if (config['proxyProfiles'] == null || !Array.isArray(config.proxyProfiles)) {
			config.proxyProfiles = getBuiltinSmartProfiles();
		}
		else
			config.proxyProfiles = Settings.setDefaultSettingsSmartProfiles(config.proxyProfiles);

		if (config['proxyServerSubscriptions'] == null || !Array.isArray(config.proxyServerSubscriptions)) {
			config.proxyServerSubscriptions = [];
		}
		config.version = environment.extensionVersion;
	}

	public static ensureIntegrityOfSettings(config: SettingsConfig) {
		// proxyServers
		if (config.proxyServers && config.proxyServers.length) {
			let proxyServers: ProxyServer[] = [];

			SettingsOperation.sortProxyServers(config.proxyServers);

			let order = 0;
			for (const oldServer of config.proxyServers) {
				let newServer = new ProxyServer();
				newServer.CopyFrom(oldServer);

				if (newServer.isValid()) {
					newServer.order = order;
					proxyServers.push(newServer);

					order++;
				}
			}
			config.proxyServers = proxyServers;
		}
	}

	public static migrateFromVersion09x(oldConfig: any): SettingsConfig {
		/** Migrating from old version 0.9.x to v1.0  */

		let newConfig = new SettingsConfig();
		Settings.setDefaultSettings(newConfig);

		if (oldConfig.options) {
			newConfig.options.CopyFrom(oldConfig.options);
		}

		// proxyServers
		if (oldConfig.proxyServers && oldConfig.proxyServers.length) {
			for (const oldServer of oldConfig.proxyServers) {
				let newServer = new ProxyServer();
				newServer.CopyFrom(oldServer);

				if (newServer.isValid())
					newConfig.proxyServers.push(newServer);
			}
		}

		// proxyServerSubscriptions
		if (oldConfig.proxyServerSubscriptions && oldConfig.proxyServerSubscriptions.length) {
			for (const oldSub of oldConfig.proxyServerSubscriptions) {
				let newSub = new ProxyServerSubscription();
				newSub.CopyFrom(oldSub);

				if (newSub.isValid())
					newConfig.proxyServerSubscriptions.push(newSub);
			}
		}

		// proxyRules
		if (oldConfig.proxyRules && oldConfig.proxyRules.length) {
			let newSmartRules = newConfig.proxyProfiles.find(f => f.profileType == SmartProfileType.SmartRules);
			if (newSmartRules) {
				for (const oldRule of oldConfig.proxyRules) {
					let newRule = new ProxyRule();
					newRule.CopyFrom(oldRule);

					if (newRule.isValid())
						newSmartRules.proxyRules.push(newRule);
				}

				let oldProxyRulesSubs = oldConfig.proxyRulesSubscriptions;
				if (oldProxyRulesSubs && oldProxyRulesSubs.length) {
					newSmartRules.rulesSubscriptions = newSmartRules.rulesSubscriptions || [];

					for (const oldRuleSub of oldProxyRulesSubs) {
						let newRuleSub = new ProxyRulesSubscription();
						newRuleSub.CopyFrom(oldRuleSub);

						if (newRuleSub.isValid())
							newSmartRules.rulesSubscriptions.push(newRuleSub);
					}
				}
				delete oldConfig.proxyRulesSubscriptions;
			}
		}
		// bypassList
		if (oldConfig.bypass && oldConfig.bypass.bypassList && oldConfig.bypass.bypassList.length) {
			let newAlwaysEnabledRules = newConfig.proxyProfiles.find(f => f.profileType == SmartProfileType.AlwaysEnabledBypassRules);

			let enabledForAlways = oldConfig.bypass.enableForAlways != null ? oldConfig.bypass.enableForAlways : true;

			for (const bypass of oldConfig.bypass.bypassList) {
				if (!bypass)
					continue;

				let newRule = new ProxyRule();
				newRule.ruleType = ProxyRuleType.DomainSubdomain;
				newRule.ruleSearch = bypass;
				newRule.hostName = bypass;
				newRule.enabled = enabledForAlways;
				newRule.whiteList = true;

				newAlwaysEnabledRules.proxyRules.push(newRule);
			}
		}

		// proxyMode
		if (oldConfig.proxyMode != null) {
			let activeProfileType: SmartProfileType = -1;

			switch (+oldConfig.proxyMode) {
				case 0 /** Direct */:
					activeProfileType = SmartProfileType.Direct;
					break;

				case 1 /** SmartProxy */:
					activeProfileType = SmartProfileType.SmartRules;
					break;

				case 2 /** Always */:
					activeProfileType = SmartProfileType.AlwaysEnabledBypassRules;
					break;

				case 3 /** SystemProxy */:
					activeProfileType = SmartProfileType.SystemProxy;
					break;
			}
			if (activeProfileType >= 0) {
				let activeProfile = newConfig.proxyProfiles.find(v => v.profileType == activeProfileType);
				if (activeProfile) {
					newConfig.activeProfileId = activeProfile.profileId;
				}
			}
		}

		// activeProxyServer
		if (oldConfig.activeProxyServer && oldConfig.activeProxyServer.name &&
			newConfig.proxyServers.length) {
			let activeProxyServerName = oldConfig.activeProxyServer.name;

			let activeProxyServer = newConfig.proxyServers.find(a => a.name == activeProxyServerName);
			if (activeProxyServer) {
				newConfig.defaultProxyServerId = activeProxyServer.id;
			}
		}

		Settings.ensureIntegrityOfSettings(newConfig);
		return newConfig;
	}

	/** In local options if sync is disabled for these particular options, don't update them from sync server */
	public static revertSyncOptions(syncedConfig: SettingsConfig) {
		let settings = Settings.current;

		syncedConfig.options.syncActiveProxy = settings.options.syncActiveProxy;
		syncedConfig.options.syncActiveProfile = settings.options.syncActiveProfile;

		if (!settings.options.syncActiveProxy) {
			syncedConfig.defaultProxyServerId = settings.defaultProxyServerId;
		}
		if (!settings.options.syncActiveProfile) {
			syncedConfig.activeProfileId = settings.activeProfileId;
		}
	}

	/** Validates SmartProfiles and adds missing profile and properties */
	static setDefaultSettingsSmartProfiles(proxyProfiles: SmartProfile[]): SmartProfile[] {

		let hasDirect = false;
		let hasSmartRule = false;
		let hasSmartAlwaysEnabled = false;
		let hasSystem = false;

		let result: SmartProfile[] = [];

		for (const profile of proxyProfiles) {
			if (profile.profileType == null)
				continue;

			let profileTypeConfig = getSmartProfileTypeConfig(profile.profileType)
			if (profileTypeConfig == null)
				continue;

			// checking for important profiles
			if (profile.profileType == SmartProfileType.Direct)
				hasDirect = true;
			else if (profile.profileType == SmartProfileType.SmartRules)
				hasSmartRule = true;
			else if (profile.profileType == SmartProfileType.AlwaysEnabledBypassRules)
				hasSmartAlwaysEnabled = true;
			else if (profile.profileType == SmartProfileType.SystemProxy)
				hasSystem = true;

			let isBuiltin = profile.profileTypeConfig?.builtin || false;
			let newProfile = new SmartProfile();
			Object.assign(newProfile, profile);
			newProfile.profileTypeConfig = profileTypeConfig;

			if (!isBuiltin && profileTypeConfig.builtin) {
				// trying to detect builtin vs user profiles
				let existingTypeProfile = proxyProfiles.find(x => x.profileType == profile.profileType && x.profileId != profile.profileId);
				if (!existingTypeProfile ||
					!existingTypeProfile.profileTypeConfig?.builtin) {
					// there is no existing one so this one needs to be marked builtin
					// or the other is not built in, so this needs to be built in
					newProfile.profileTypeConfig.builtin = true;
					profile.profileTypeConfig.builtin = true;
				}
				else {
					// unmark as builtin
					newProfile.profileTypeConfig.builtin = false;
					profile.profileTypeConfig.builtin = false;
				}
			}

			if (!newProfile.profileName) {
				// set name if missing
				newProfile.profileName = `${SmartProfileType[newProfile.profileType]} - ${Utils.getNewUniqueIdNumber()}`;
			}

			result.push(newProfile);
		}
		let missingBuiltin = !hasDirect || !hasSmartRule || !hasSmartAlwaysEnabled || !hasSystem;

		let builtinProfile: SmartProfile[];
		if (missingBuiltin) {
			builtinProfile = getBuiltinSmartProfiles();

			if (!hasDirect)
				result.push(builtinProfile.find(a => a.profileType == SmartProfileType.Direct));

			if (!hasSmartRule)
				result.push(builtinProfile.find(a => a.profileType == SmartProfileType.SmartRules));

			if (!hasSmartAlwaysEnabled)
				result.push(builtinProfile.find(a => a.profileType == SmartProfileType.AlwaysEnabledBypassRules));

			if (!hasSystem)
				result.push(builtinProfile.find(a => a.profileType == SmartProfileType.SystemProxy));

			result.sort((a, b) => {
				if (a.profileType < b.profileType)
					return -1;
				if (a.profileType > b.profileType)
					return 1;
				return 0;
			})
		}

		return result;
	}

	public static validateProxyServer(
		server: ProxyServer,
		checkExistingName: boolean = true,
	): {
		success: boolean;
		exist?: boolean;
		message?: string;
		result?: any;
	} {
		if (server.port <= 0 || server.port >= 65535) {
			return {
				success: false,
				message: api.i18n.getMessage('settingsServerPortInvalid').replace('{0}', `${server.host}:${server.port}`),
			};
		}

		if (!server.host || !Utils.isValidHost(server.host)) {
			return {
				success: false,
				message: api.i18n.getMessage('settingsServerHostInvalid').replace('{0}', `${server.host}:${server.port}`),
			};
		}

		if (!server.name) {
			return { success: false, message: api.i18n.getMessage('settingsServerNameRequired') };
		} else if (Settings.current) {
			if (checkExistingName) {
				const currentServers = Settings.current.proxyServers;

				for (let srv of currentServers) {
					if (srv.name == server.name) {
						return { success: false, exist: true, message: `Server name ${server.name} already exists` };
					}
				}
			}
		}

		if (!server.protocol) {
			server.protocol = 'HTTP';
		} else {
			server.protocol = server.protocol.toUpperCase();
			if (proxyServerProtocols.indexOf(server.protocol) == -1) {
				// not valid protocol, resetting
				server.protocol = 'HTTP';
			}
		}

		return { success: true };
	}

	public static updateActiveSettings(fallback: boolean = true) {
		/** Updating `Settings.active` */

		let settings = Settings.current;
		if (!settings)
			return;

		let active = Settings.active ?? (Settings.active = new SettingsActive());

		let foundActiveProfile = ProfileOperations.findSmartProfileById(settings.activeProfileId, settings.proxyProfiles);
		if (!foundActiveProfile && fallback) {
			foundActiveProfile = ProfileOperations.findSmartProfileById(SmartProfileTypeBuiltinIds.Direct, settings.proxyProfiles);
		}

		let activeProfile: SmartProfileCompiled = null;
		if (foundActiveProfile) {
			active.activeProfile = ProfileOperations.compileSmartProfile(foundActiveProfile);
			activeProfile = active.activeProfile;
		}

		active.currentProxyServer = null;
		if (activeProfile?.profileProxyServer) {
			active.currentProxyServer = active.activeProfile.profileProxyServer;
		}

		if (!active.currentProxyServer) {
			let foundProxy = SettingsOperation.findProxyServerById(settings.defaultProxyServerId);
			if (foundProxy) {
				active.currentProxyServer = foundProxy;
			}
		}

		let activeIncognitoProfile: SmartProfileCompiled = null;
		if (settings.options.activeIncognitoProfileId) {
			if (foundActiveProfile.profileId == settings.options.activeIncognitoProfileId) {
				activeIncognitoProfile = activeProfile;
			}
			else {
				const incognitoProfile = ProfileOperations.findSmartProfileById(settings.options.activeIncognitoProfileId, settings.proxyProfiles);
				if (incognitoProfile) {
					activeIncognitoProfile = ProfileOperations.compileSmartProfile(incognitoProfile);
				}
			}
		}
		active.activeIncognitoProfile = activeIncognitoProfile;

		let profileIgnoreFailureRules = ProfileOperations.getIgnoreFailureRulesProfile();
		if (profileIgnoreFailureRules)
			active.currentIgnoreFailureProfile = ProfileOperations.compileSmartProfile(profileIgnoreFailureRules);
	}
}
