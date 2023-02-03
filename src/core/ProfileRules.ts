import { api } from "../lib/environment";
import { Utils } from "../lib/Utils";
import { ProxyRule, ProxyRuleType, RuleId, SmartProfile } from "./definitions";
import { ProfileOperations } from "./ProfileOperations";

export class ProfileRules {


	public static toggleRule(hostName: string, ruleId?: RuleId) {

		let smartProfile = ProfileOperations.getActiveSmartProfile();
		if (smartProfile == null)
			return;

		if (!ProfileOperations.profileTypeSupportsRules(smartProfile.profileType))
			return;

		if (ruleId > 0) {
			let rule = ProfileRules.getRuleById(smartProfile, ruleId);

			if (rule != null) {
				ProfileRules.removeRule(smartProfile, rule);
				return;
			}
		}

		if (!Utils.isValidHost(hostName))
			// this is an extra check!
			return;

		ProfileRules.toggleRuleByHostname(smartProfile, hostName);
	}

	public static removeByHostname(hostName: string, ruleId?: number): {
		success: boolean,
		message: string,
		rule: ProxyRule
	} {
		let smartProfile = ProfileOperations.getActiveSmartProfile();
		if (smartProfile == null)
			return;

		if (!smartProfile.profileTypeConfig.editable) {
			return {
				success: false,
				message: api.i18n.getMessage("settingsEnableByDomainSmartProfileNonEditable").replace("{0}", smartProfile.profileName),
				rule: null
			};
		}

		// get the rule for the source
		let rule: ProxyRule;

		if (ruleId > 0)
			rule = ProfileRules.getRuleById(smartProfile, ruleId);
		else
			rule = ProfileRules.getRuleByHostname(smartProfile, hostName);

		if (rule != null) {
			ProfileRules.removeRule(smartProfile, rule);

			return {
				success: true,
				message: null,
				rule: rule
			};
		}
		return {
			success: false,
			message: api.i18n.getMessage("settingsNoRuleFoundForDomain").replace("{0}", hostName),
			rule: null
		};
	}

	public static enableByHostnameListIgnoreFailureRules(hostnameList: string[]) {
		if (!hostnameList || !hostnameList.length)
			return {
				success: false,
				message: api.i18n.getMessage("settingsEnableByDomainInvalid")
			};

		let ignoreRulesProfile = ProfileOperations.getIgnoreFailureRulesProfile();
		if (ignoreRulesProfile == null)
			// TODO: this message is a temporary workaround, an UI is needed for popup in Add to Ignore List
			return {
				success: false,
				message: 'Ignore rules profile not found'
			};

		for (let hostName of hostnameList) {
			let enableResult = ProfileRules.enableByHostnameInternal(ignoreRulesProfile, hostName);
			if (enableResult && !enableResult.success) {
				return {
					success: false,
					message: enableResult.message || `Failed to add host '${hostName}' to ignore rules`
				};
			}
		}
		return {
			success: true,
			message: null
		};
	}

	public static enableByHostnameList(hostnameList: string[]): {
		success: boolean,
		message: string
	} {
		if (!hostnameList || !hostnameList.length)
			return {
				success: false,
				message: api.i18n.getMessage("settingsEnableByDomainInvalid")
			};

		let smartProfile = ProfileOperations.getActiveSmartProfile();
		if (smartProfile == null)
			// TODO: this message is a temporary workaround, an UI is needed for popup in Add to Ignore List
			return {
				success: false,
				message: 'Please select a profile first.'
			};

		if (!smartProfile.profileTypeConfig.editable ||
			!ProfileOperations.profileTypeSupportsRules(smartProfile.profileType)) {
			return {
				success: false,
				message: api.i18n.getMessage("settingsEnableByDomainSmartProfileNonEditable").replace("{0}", smartProfile.profileName),
			};
		}

		for (let hostName of hostnameList) {
			let enableResult = ProfileRules.enableByHostnameInternal(smartProfile, hostName);
			if (enableResult && !enableResult.success) {
				return {
					success: false,
					message: enableResult.message || `Failed to add host '${hostName}' to rules`
				};
			}
		}
		return {
			success: true,
			message: null
		};
	}

	public static enableByHostname(hostname: string): {
		success: boolean,
		message: string,
		rule: ProxyRule
	} {
		let smartProfile = ProfileOperations.getActiveSmartProfile();
		if (smartProfile == null)
			return;

		if (!smartProfile.profileTypeConfig.editable ||
			!ProfileOperations.profileTypeSupportsRules(smartProfile.profileType)) {
			return {
				success: false,
				message: api.i18n.getMessage("settingsEnableByDomainSmartProfileNonEditable").replace("{0}", smartProfile.profileName),
				rule: null
			};
		}

		return ProfileRules.enableByHostnameInternal(smartProfile, hostname);
	}

	private static enableByHostnameInternal(smartProfile: SmartProfile, hostname: string): {
		success: boolean,
		message: string,
		rule: ProxyRule
	} {
		// current url should be valid
		if (!Utils.isValidHost(hostname))
			// The selected domain is not valid
			return {
				success: false,
				message: api.i18n.getMessage("settingsEnableByDomainInvalid"),
				rule: null
			};

		// the domain should be the source
		let rule = ProfileRules.getRuleByHostname(smartProfile, hostname);

		if (rule != null) {
			// Rule for the domain already exists
			return {
				success: true,
				message: api.i18n.getMessage("settingsEnableByDomainExists"),
				rule: rule
			};
		}

		rule = ProfileRules.addRuleByHostname(smartProfile, hostname);

		return {
			success: true,
			message: null,
			rule: rule
		};
	}

	private static getRuleById(smartProfile: SmartProfile, ruleId: number) {
		return smartProfile.proxyRules.find(rule => rule.ruleId == ruleId);
	}

	private static getRuleByHostname(smartProfile: SmartProfile, hostName: string) {
		return smartProfile.proxyRules.find(rule => rule.hostName == hostName);
	}

	private static toggleRuleByHostname(smartProfile: SmartProfile, hostName: string) {

		// the domain should be the source
		let rule = ProfileRules.getRuleByHostname(smartProfile, hostName);

		if (rule == null) {
			if (!Utils.isValidHost(hostName))
				// this is an extra check!
				return;

			ProfileRules.addRuleByHostname(smartProfile, hostName);
		} else {
			ProfileRules.removeRule(smartProfile, rule);
		}
	}

	private static addRuleByHostname(smartProfile: SmartProfile, hostname: string): ProxyRule {

		let rule = new ProxyRule();
		rule.ruleType = ProxyRuleType.DomainSubdomain;
		rule.ruleSearch = hostname;
		rule.autoGeneratePattern = true;
		rule.hostName = hostname;
		rule.enabled = true;
		rule.proxy = null;

		if (smartProfile.profileTypeConfig.defaultRuleActionIsWhitelist == true)
			// NOTE: in AlwaysEnabled mode the default rule type is Whitelist
			rule.whiteList = true;

		// add and save it
		ProfileRules.addRule(smartProfile, rule);

		return rule;
	}

	private static addRule(smartProfile: SmartProfile, rule: ProxyRule) {

		do {
			// making sure the ruleId is unique
			var isDuplicateRuleId = smartProfile.proxyRules.some(r => r.ruleId == rule.ruleId);

			if (isDuplicateRuleId)
				rule.ruleId = Utils.getNewUniqueIdNumber();
		} while (isDuplicateRuleId);

		smartProfile.proxyRules.push(rule);
	}

	private static removeRule(smartProfile: SmartProfile, rule: ProxyRule) {
		let itemIndex = smartProfile.proxyRules.indexOf(rule);
		if (itemIndex > -1) {
			smartProfile.proxyRules.splice(itemIndex, 1);
		}
	}
}