import { PolyFill } from "../lib/PolyFill";
import { Debug } from "../lib/Debug";
import { Settings, ProxyRule, ProxyServer } from "./Settings";
import { Utils } from "../lib/Utils";
import { environment, browser, chrome } from "../lib/environment";
import { ProxyModeType, ProxyRuleType } from "./definitions";

export class ProxyRules {

	static compiledRulesList: CompiledRule[] = [];

	public static findMatchForUrl(url: string): ProxyRule {
		var host = new URL(url).host;

		try {
			for (let i = 0; i < this.compiledRulesList.length; i++) {
				let rule = this.compiledRulesList[i];

				if (rule.ruleType == ProxyRuleType.MatchPattern) {
					if (rule.regex.test(host))
						return rule.rule;
				}
				else {
					if (rule.regex.test(url))
						return rule.rule;
				}
			}
		} catch (e) {
			Debug.warn(`findMatchForUrl failed for ${url}`,e);
		}
		return null;
	}


}

class CompiledRule {
	ruleType: ProxyRuleType;
	regex: RegExp;
	rule: ProxyRule;
}
