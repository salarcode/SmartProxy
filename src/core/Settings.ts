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
	ThemeType
} from './definitions';
import { Debug } from '../lib/Debug';
import { SettingsOperation } from './SettingsOperation';
import { api } from '../lib/environment';
import { Utils } from '../lib/Utils';
import { ProfileOperations } from './ProfileOperations';

export class Settings {
	public static current: SettingsConfig;

	public static active: SettingsActive;

	public static currentOptionsSyncSettings: boolean = true;

	public static onInitializedLocally: Function = null;
	public static onInitializedRemoteSync: Function = null;

	private static onInitializedCompleted: EventTarget = new EventTarget();

	public static initialize() {
		me.current = new SettingsConfig();

		PolyFill.storageLocalGet(null, me.onInitializeGetLocalData, me.onInitializeGetLocalError);

		// handle synced settings changes
		api.storage.onChanged.addListener(SettingsOperation.syncOnChanged);
	}

	/** Register for a one time event of when all settings are loaded */
	public static addInitializeCompletedEventListener(listener: EventListenerOrEventListenerObject) {
		me.onInitializedCompleted.addEventListener('onInitializedCompleted', listener,
			{
				passive: true,
				once: true
			});
	}
	public static removeInitializeCompletedEventListener(listener: EventListenerOrEventListenerObject) {
		me.onInitializedCompleted.removeEventListener('onInitializedCompleted', listener);
	}
	private static raiseInitializeCompletedEvent() {
		me.onInitializedCompleted.dispatchEvent(new Event('onInitializedCompleted'));
	}

	private static onInitializeGetLocalData(data: any) {
		Debug.log("onInitializeGetLocalData, local data: ", data);

		data = me.getRestorableSettings(data);

		me.current = data;
		me.updateActiveSettings();

		// read all the synced data along with synced ones
		PolyFill.storageSyncGet(null, me.onInitializeGetSyncData, me.onInitializeGetSyncError);

		if (me.onInitializedLocally)
			me.onInitializedLocally();
	}

	private static onInitializeGetLocalError(error: any) {
		Debug.error(`settingsOperation.initialize error: ${error.message}`);

		if (me.onInitializedLocally)
			me.onInitializedLocally();

		me.raiseInitializeCompletedEvent();
	}

	private static onInitializeGetSyncData(data: any) {
		try {
			let syncedSettings = Utils.decodeSyncData(data);

			Debug.log("onInitializeGetSyncData, sync data: ", data);

			// only if sync settings is enabled
			if (syncedSettings && syncedSettings.options) {
				if (syncedSettings.options.syncSettings) {
					// use synced settings
					syncedSettings = me.getRestorableSettings(syncedSettings);
					me.revertSyncOptions(syncedSettings);

					me.current = syncedSettings;
				} else {
					// sync is disabled
					syncedSettings.options.syncSettings = false;
				}

				me.currentOptionsSyncSettings = syncedSettings.options.syncSettings;
				me.updateActiveSettings();
			}
		} catch (e) {
			Debug.error(`settingsOperation.readSyncedSettings> onGetSyncData error: ${e} \r\n ${data}`);
		}

		if (me.onInitializedRemoteSync)
			me.onInitializedRemoteSync();

		me.raiseInitializeCompletedEvent();
	}

	private static onInitializeGetSyncError(error: Error) {
		Debug.error(`settingsOperation.readSyncedSettings error: ${error.message}`);

		me.raiseInitializeCompletedEvent();
	}

	public static getRestorableSettings(config: any): SettingsConfig {

		me.setDefaultSettings(config);
		me.migrateFromOldVersions(config);
		me.ensureIntegrityOfSettings(config);

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
			config.proxyProfiles = me.setDefaultSettingsSmartProfiles(config.proxyProfiles);

		if (config['proxyServerSubscriptions'] == null || !Array.isArray(config.proxyServerSubscriptions)) {
			config.proxyServerSubscriptions = [];
		}

		PolyFill.getExtensionVersion((version: string) => {
			config.version = version;
		});
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

		if (!config.defaultProxyServerId && config.proxyServers?.length) {
			// reset to the first proxy if it is not found
			config.defaultProxyServerId = config.proxyServers[0].id;
		}
	}

	/** Migrates settings from all old versions */
	public static migrateFromOldVersions(config: any): SettingsConfig {
		// ----------
		// forcing to use new options

		let forceValidation = config.version <= '0.9.9999';
		if (forceValidation) {

			let newOptions = new GeneralOptions();
			if (config.options) {
				newOptions.CopyFrom(config.options);
			}
			config.options = newOptions;

			// proxyServers
			if (config.proxyServers && config.proxyServers.length) {
				let proxyServers = [];

				for (const oldServer of config.proxyServers) {
					let newServer = new ProxyServer();
					newServer.CopyFrom(oldServer);

					if (newServer.isValid())
						proxyServers.push(newServer);
				}
				config.proxyServers = proxyServers;
			}

			// proxyServerSubscriptions
			if (config.proxyServerSubscriptions && config.proxyServerSubscriptions.length) {

				let proxyServerSubscriptions = [];

				for (const oldSub of config.proxyServerSubscriptions) {
					let newSub = new ProxyServerSubscription();
					newSub.CopyFrom(oldSub);

					if (newSub.isValid())
						proxyServerSubscriptions.push(newSub);
				}
				config.proxyServerSubscriptions = proxyServerSubscriptions;
			}
		}

		if (config.proxyProfiles) {
			let profiles = config.proxyProfiles as SmartProfile[];

			for (const smartProfile of profiles) {
				// making sure all profiles have ID
				if (!smartProfile.profileId) {
					Debug.warn("Found and fixed a profile without id> ", smartProfile.profileName);
					ProfileOperations.ensureProfileId(smartProfile);
				}

				// making sure all names are unique
				if (profiles.find(x => x.profileName == smartProfile.profileName &&
					x.profileId != smartProfile.profileId)) {

					Debug.warn("Found and fixed a profile with same name> ", smartProfile.profileName);
					smartProfile.profileName += " - " + smartProfile.profileId;
				}
			}
		}


		// ----------
		// migrating old properties if they exists

		// proxyRules
		if (config.proxyRules && config.proxyRules.length &&
			config.proxyProfiles) {

			let newSmartRules = config.proxyProfiles.find((f: SmartProfile) => f.profileType == SmartProfileType.SmartRules);
			if (newSmartRules) {
				for (const oldRule of config.proxyRules) {
					let newRule = new ProxyRule();
					newRule.CopyFrom(oldRule);

					if (newRule.isValid())
						newSmartRules.proxyRules.push(newRule);
				}
				delete config.proxyRules;

				let oldProxyRulesSubs = config.proxyRulesSubscriptions;
				if (oldProxyRulesSubs && oldProxyRulesSubs.length) {
					newSmartRules.rulesSubscriptions = newSmartRules.rulesSubscriptions || [];

					for (const oldRuleSub of oldProxyRulesSubs) {
						let newRuleSub = new ProxyRulesSubscription();
						newRuleSub.CopyFrom(oldRuleSub);

						if (newRuleSub.isValid())
							newSmartRules.rulesSubscriptions.push(newRuleSub);
					}
				}
				delete config.proxyRulesSubscriptions;
			}
			else {
				Debug.warn(`Migrate has failed for SmartRules because no SmartRules is found in the new configuration`);
			}
		}

		// bypassList
		if (config.bypass && config.bypass.bypassList && config.bypass.bypassList.length &&
			config.proxyProfiles) {

			let newAlwaysEnabledRules = config.proxyProfiles.find((f: SmartProfile) => f.profileType == SmartProfileType.AlwaysEnabledBypassRules);
			if (newAlwaysEnabledRules) {
				let enabledForAlways = config.bypass.enableForAlways != null ? config.bypass.enableForAlways : true;

				for (const bypass of config.bypass.bypassList) {
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
			else {
				Debug.warn(`Migrate has failed for AlwaysEnabledRules because no AlwaysEnabledRules is found in the new configuration`);
			}

			delete config.bypass;
		}

		// proxyMode
		if (config.proxyMode != null && config.proxyProfiles) {
			let activeProfileType: SmartProfileType = -1;

			switch (+config.proxyMode) {
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
				let activeProfile = config.proxyProfiles.find((f: SmartProfile) => f.profileType == activeProfileType);
				if (activeProfile) {
					config.activeProfileId = activeProfile.profileId;
				}
			}

			delete config.proxyMode;
		}

		// activeProxyServer
		if (config.activeProxyServer && config.activeProxyServer.name && config.proxyServers.length &&
			config.proxyServers) {

			let activeProxyServerName = config.activeProxyServer.name;

			let activeProxyServer = config.proxyServers.find(a => a.name == activeProxyServerName);
			if (activeProxyServer) {
				config.defaultProxyServerId = activeProxyServer.id;
			}

			delete config.activeProxyServer;
		}

		return config;
	}

	/** In local options if sync is disabled for these particular options, don't update them from sync server */
	public static revertSyncOptions(syncedConfig: SettingsConfig) {
		let settings = me.current;

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
		} else if (me.current) {
			if (checkExistingName) {
				const currentServers = me.current.proxyServers;

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
		let settings = me.current;
		if (!settings)
			return;

		let active = me.active ?? (me.active = new SettingsActive());

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

let me = Settings;