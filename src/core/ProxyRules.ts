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
import { Debug } from "../lib/Debug";
import { ProxyRule } from "./Settings";
import { ProxyRuleType } from "./definitions";

export class ProxyRules {

	static compiledRulesList: CompiledRule[] = [];

	public static findMatchForUrl(url: string): ProxyRule | null {
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
			Debug.warn(`findMatchForUrl failed for ${url}`, e);
		}
		return null;
	}


}

class CompiledRule {
	ruleType: ProxyRuleType;
	regex: RegExp;
	rule: ProxyRule;
}
