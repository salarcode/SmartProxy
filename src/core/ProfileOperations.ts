import { Debug } from "../lib/Debug";
import { api } from "../lib/environment";
import { Utils } from "../lib/Utils";
import { CompiledProxyRule, CompiledProxyRulesInfo, getSmartProfileTypeConfig, ProxyRule, ProxyRulesSubscription, ResultHolder, SmartProfile, SmartProfileBase, SmartProfileCompiled, SmartProfileType } from "./definitions";
import { ProxyRules } from "./ProxyRules";
import { Settings } from "./Settings";
import { SettingsOperation } from "./SettingsOperation";

export class ProfileOperations {

	public static addUpdateProfile(smartProfile: SmartProfile) {
		let settings = Settings.current;

		if (smartProfile.profileId) {
			let existingProfile = ProfileOperations.findSmartProfileById(smartProfile.profileId, settings.proxyProfiles);

			if (existingProfile) {
				Object.assign(existingProfile, smartProfile);
				return;
			}
		}
		smartProfile.profileId = 'profile-' + Utils.getNewUniqueIdString();
		settings.proxyProfiles.push(smartProfile);
	}

	public static deleteProfile(smartProfileId: string): ResultHolder {
		let result = new ResultHolder();
		let settings = Settings.current;

		let existingProfileIndex = ProfileOperations.findSmartProfileIndexById(smartProfileId, settings.proxyProfiles);
		if (existingProfileIndex == -1) {
			Debug.warn(`deleteProfile failed for profile id = ${smartProfileId}`);
			result.success = false;

			// Failed to delete the selected profile.
			result.message = api.i18n.getMessage('settingsProfilesDeleteFailed');
			return result;
		}
		let existingProfile = settings.proxyProfiles[existingProfileIndex];
		if (existingProfile.profileTypeConfig.builtin) {
			result.success = false;

			// Cannot delete built-in profiles
			result.message = api.i18n.getMessage('settingsProfilesDeleteBuiltinFail');
			return result;
		}
		settings.proxyProfiles.splice(existingProfileIndex, 1);

		result.success = true;
		return result;
	}

	public static profileTypeSupportsRules(profileType: SmartProfileType): boolean {
		switch (profileType) {
			case SmartProfileType.SmartRules:
			case SmartProfileType.AlwaysEnabledBypassRules:
			case SmartProfileType.IgnoreFailureRules:
				return true;

			case SmartProfileType.Direct:
			case SmartProfileType.SystemProxy:
			default:
				return false;
		}
	}
	public static profileTypeSupportsSubscriptions(profileType: SmartProfileType): boolean {
		switch (profileType) {
			case SmartProfileType.SmartRules:
			case SmartProfileType.AlwaysEnabledBypassRules:
				return true;

			case SmartProfileType.IgnoreFailureRules:
			case SmartProfileType.Direct:
			case SmartProfileType.SystemProxy:
			default:
				return false;
		}
	}

	public static getActiveSmartProfile(): SmartProfile {
		let settings = Settings.current;

		let smartProfile = ProfileOperations.findSmartProfileById(settings.activeProfileId, settings.proxyProfiles);
		if (smartProfile == null) {
			Debug.warn(`No active profile found`);
			return null;
		}
		return smartProfile;
	}

	public static getIgnoreFailureRulesProfile(): SmartProfile {
		let settings = Settings.current;

		let smartProfile = ProfileOperations.findFirstSmartProfileType(SmartProfileType.IgnoreFailureRules, settings.proxyProfiles);
		if (smartProfile == null) {
			smartProfile = new SmartProfile();
			smartProfile.profileType = SmartProfileType.IgnoreFailureRules;
			smartProfile.profileTypeConfig = getSmartProfileTypeConfig(SmartProfileType.IgnoreFailureRules);
			smartProfile.profileName = 'Ignore Failure Rules';
			settings.proxyProfiles.push(smartProfile);
		}
		return smartProfile;
	}

	static findFirstSmartProfileType(profileType: SmartProfileType, profiles: SmartProfile[]): SmartProfile | null {
		return profiles.find((a) => a.profileType === profileType);
	}

	public static findSmartProfileById(id: string, profiles: SmartProfile[]): SmartProfile | null {
		return profiles.find((a) => a.profileId === id);
	}
	static findSmartProfileIndexById(id: string, profiles: SmartProfile[]): number {
		return profiles.findIndex((a) => a.profileId === id);
	}

	public static compileSmartProfile(profile: SmartProfile): SmartProfileCompiled {
		let compiledProfile = new SmartProfileCompiled();

		ProfileOperations.copySmartProfileBase(profile, compiledProfile);

		ProfileOperations.compileSmartProfileRuleInternal(profile, compiledProfile);

		if (compiledProfile.profileProxyServerId) {
			// the proxy server is derived from what is available
			compiledProfile.profileProxyServer = SettingsOperation.findProxyServerById(compiledProfile.profileProxyServerId);
		}

		return compiledProfile;
	}

	//** Compiles the rules and assigns to the `SmartProfileCompiled` */
	private static compileSmartProfileRuleInternal(profile: SmartProfile, compiledProfile: SmartProfileCompiled) {

		compiledProfile.compiledRules = new CompiledProxyRulesInfo();

		if (profile.proxyRules && profile.proxyRules.length) {

			let compiledInfo = ProxyRules.compileRules(profile, profile.proxyRules);

			compiledProfile.compiledRules.Rules = compiledInfo?.compiledList ?? [];
			compiledProfile.compiledRules.WhitelistRules = compiledInfo?.compiledWhiteList ?? [];
		}
		else {
			compiledProfile.compiledRules.Rules = [];
			compiledProfile.compiledRules.WhitelistRules = [];
		}

		// the subscription rules
		if (profile.rulesSubscriptions && profile.rulesSubscriptions.length > 0) {

			let subscriptionRules: CompiledProxyRule[] = [];
			let whitelistSubscriptionRules: CompiledProxyRule[] = [];

			for (const subscription of profile.rulesSubscriptions) {
				if (!subscription.enabled)
					continue;

				if (subscription.proxyRules &&
					subscription.proxyRules.length > 0) {

					let subRules = ProxyRules.compileRulesSubscription(subscription.proxyRules);
					if (subRules)
						subscriptionRules = subscriptionRules.concat(subRules);
				}

				if (subscription.whitelistRules &&
					subscription.whitelistRules.length > 0) {

					let subWhitelistRules = ProxyRules.compileRulesSubscription(subscription.whitelistRules, true);
					if (subWhitelistRules)
						whitelistSubscriptionRules = whitelistSubscriptionRules.concat(subWhitelistRules);
				}
			}

			compiledProfile.compiledRules.SubscriptionRules = subscriptionRules;
			compiledProfile.compiledRules.WhitelistSubscriptionRules = whitelistSubscriptionRules;
		}
	}

	public static getSmartProfileBaseList(profiles: SmartProfile[]): SmartProfileBase[] {
		let result: SmartProfileBase[] = [];

		for (const profile of profiles) {
			let baseProfile = new SmartProfileBase();

			ProfileOperations.copySmartProfileBase(profile, baseProfile);
			result.push(baseProfile);
		}

		return result;
	}

	public static getSmartProfileBase(profile: SmartProfile): SmartProfileBase {
		let baseProfile = new SmartProfileBase();

		ProfileOperations.copySmartProfileBase(profile, baseProfile);
		return baseProfile;
	}

	public static copySmartProfileBase(fromProfile: SmartProfileBase, toProfile: SmartProfileBase, copyConfig: boolean = true) {
		toProfile.profileType = fromProfile.profileType;
		toProfile.profileId = fromProfile.profileId;
		toProfile.profileName = fromProfile.profileName;
		toProfile.enabled = fromProfile.enabled;
		toProfile.profileProxyServerId = fromProfile.profileProxyServerId;
		if (copyConfig) {
			toProfile.profileTypeConfig = {
				builtin: fromProfile.profileTypeConfig.builtin,
				editable: fromProfile.profileTypeConfig.editable,
				selectable: fromProfile.profileTypeConfig.selectable,
				supportsSubscriptions: fromProfile.profileTypeConfig.supportsSubscriptions,
				supportsProfileProxy: fromProfile.profileTypeConfig.supportsProfileProxy,
				customProxyPerRule: fromProfile.profileTypeConfig.customProxyPerRule,
				canBeDisabled: fromProfile.profileTypeConfig.canBeDisabled,
				supportsRuleActionWhitelist: fromProfile.profileTypeConfig.supportsRuleActionWhitelist,
				defaultRuleActionIsWhitelist: fromProfile.profileTypeConfig.defaultRuleActionIsWhitelist,
			};
		}
	}

	public static copySmartProfile(fromProfile: SmartProfile, toProfile: SmartProfile, copyConfig: boolean = true) {
		ProfileOperations.copySmartProfileBase(fromProfile, toProfile, copyConfig);

		let proxyRules: ProxyRule[] = [];
		if (fromProfile.proxyRules) {
			for (const srcRule of fromProfile.proxyRules) {
				let copyRule = new ProxyRule();
				copyRule.CopyFrom(srcRule);

				if (copyRule.isValid())
					proxyRules.push(copyRule);
			}
		}
		toProfile.proxyRules = proxyRules;

		let ruleSubs: ProxyRulesSubscription[] = [];
		if (fromProfile.rulesSubscriptions) {
			for (const ruleSub of fromProfile.rulesSubscriptions) {
				let copyRuleSub = new ProxyRulesSubscription();
				copyRuleSub.CopyFrom(ruleSub);

				if (copyRuleSub.isValid())
					ruleSubs.push(copyRuleSub);
			}
		}
		toProfile.rulesSubscriptions = ruleSubs;
	}

	public static resetProfileTypeConfig(profile: SmartProfile) {
		let profileTypeConfig = getSmartProfileTypeConfig(profile.profileType);
		if (profileTypeConfig) {
			profile.profileTypeConfig = profileTypeConfig;
		}
	}
}
