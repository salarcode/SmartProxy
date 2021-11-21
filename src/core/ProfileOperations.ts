import { Debug } from "../lib/Debug";
import { Utils } from "../lib/Utils";
import { CompiledProxyRulesInfo, SmartProfile, SmartProfileBase, SmartProfileCompiled, SmartProfileType } from "./definitions";
import { ProxyRules } from "./ProxyRules";
import { Settings } from "./Settings";
import { SettingsOperation } from "./SettingsOperation";

export class ProfileOperations {


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
			return;
		}
		return smartProfile;
	}

	public static findSmartProfileById(id: string, profiles: SmartProfile[]): SmartProfile | null {
		return profiles.find((a) => a.profileId === id);
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

			for (const subscription of profile.rulesSubscriptions) {
				if (!subscription.enabled)
					continue;

				if (subscription.proxyRules &&
					subscription.proxyRules.length > 0) {

					let subRules = ProxyRules.compileRulesSubscription(subscription.proxyRules);

					compiledProfile.compiledRules.SubscriptionRules = subRules ?? [];
				}

				if (subscription.whitelistRules &&
					subscription.whitelistRules.length > 0) {

					let subWhitelistRules = ProxyRules.compileRulesSubscription(subscription.whitelistRules, true);
					compiledProfile.compiledRules.WhitelistSubscriptionRules = subWhitelistRules ?? [];
				}
			}
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

	public static copySmartProfileBase(fromProfile: SmartProfileBase, toProfile: SmartProfileBase) {
		toProfile.profileType = fromProfile.profileType;
		toProfile.profileId = fromProfile.profileId;
		toProfile.profileName = fromProfile.profileName;
		toProfile.enabled = fromProfile.enabled;
		toProfile.profileProxyServerId = fromProfile.profileProxyServerId;
		toProfile.profileTypeConfig = {
			builtin: fromProfile.profileTypeConfig.builtin,
			editable: fromProfile.profileTypeConfig.editable,
			supportsSubscriptions: fromProfile.profileTypeConfig.supportsSubscriptions,
			supportsProfileProxy: fromProfile.profileTypeConfig.supportsProfileProxy,
			customProxyPerRule: fromProfile.profileTypeConfig.customProxyPerRule,
			canBeDisabled: fromProfile.profileTypeConfig.canBeDisabled,
			supportsRuleActionWhitelist: fromProfile.profileTypeConfig.supportsRuleActionWhitelist,
			defaultRuleActionIsWhitelist: fromProfile.profileTypeConfig.defaultRuleActionIsWhitelist,
		};
	}

	public static copySmartProfile(fromProfile: SmartProfile, toProfile: SmartProfile) {

		ProfileOperations.copySmartProfileBase(fromProfile, toProfile);

		toProfile.proxyRules = Utils.deepClone(fromProfile.proxyRules);
		toProfile.rulesSubscriptions = Utils.deepClone(fromProfile.rulesSubscriptions);
	}
}