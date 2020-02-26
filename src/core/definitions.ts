import { Settings } from "./Settings";
import { browser } from "../lib/environment";

/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2020 Salar Khalilzadeh <salar2k@gmail.com>
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
export const proxyServerProtocols = ["HTTP", "HTTPS", "SOCKS4", "SOCKS5"];
export const proxyServerSubscriptionObfuscate = ["None", "Base64"];
export const proxyServerSubscriptionFormat = ["PlainText", "JSON"];
export const specialRequestApplyProxyModeKeys = ["NoProxy", "CurrentProxy"/* , "SelectedProxy" */];
export const proxyRulesSubscriptionFormat = ["AutoProxy/GFWList"];
export const proxyRulesActionTypes = [browser.i18n.getMessage("settingsRuleActionApplyProxy"), browser.i18n.getMessage("settingsRuleActionWhitelist")];

export enum ProxyModeType {
	Direct,
	SmartProxy,
	Always,
	SystemProxy
}

export class BrowserProxySettingsType {
	public static none = "none";
	public static autoDetect = "autoDetect";
	public static system = "system";
	public static manual = "manual";
	public static autoConfig = "autoConfig";
};

export enum ProxyRuleType {
	MatchPatternHost,
	MatchPatternUrl,
	RegexHost,
	RegexUrl,
	Exact
}

export enum ProxyServerForProtocol {
	Http,
	SSL,
	FTP,
	SOCKS
}
export class Messages {

	// Popup messages
	public static PopupGetInitialData = "Popup_GetInitialData";
	public static PopupChangeProxyMode = "Popup_ChangeProxyMode";
	public static PopupChangeActiveProxyServer = "Popup_ChangeActiveProxyServer";
	public static PopupToggleProxyForDomain = "Popup_ToggleProxyForDomain";
	public static PopupAddDomainListToProxyRule = "Popup_AddDomainListToProxyRule";

	// Settings page
	public static SettingsPageGetInitialData = "SettingsPage_GetInitialData";
	public static SettingsPageSaveOptions = "SettingsPage_SaveOptions";
	public static SettingsPageSaveProxyServers = "SettingsPage_SaveProxyServers";
	public static SettingsPageSaveProxyRules = "SettingsPage_SaveProxyRules";
	public static SettingsPageSaveProxySubscriptions = "SettingsPage_SaveProxySubscriptions";
	public static SettingsPageSaveProxyRulesSubscriptions = "SettingsPage_SaveProxyRulesSubscriptions";
	public static SettingsPageSaveBypass = "SettingsPage_SaveBypass";
	public static SettingsPageRestoreSettings = "SettingsPage_RestoreSettings";
	public static SettingsPageMakeRequestSpecial = "SettingsPage_MakeRequestSpecial";
	public static SettingsPageSkipWelcome = "SettingsPage_SkipWelcome";

	// Request Logger
	public static ProxyableRequestLog = "Proxyable_RequestLog";
	public static ProxyableOriginTabRemoved = "Proxyable_OriginTabRemoved";

	// Proxyable Resources
	public static ProxyableGetInitialData = "Proxyable_GetInitialData";
	public static ProxyableRemoveProxyableLog = "Proxyable_RemoveProxyableLog";
	public static ProxyableToggleProxyableDomain = "Proxyable_ToggleProxyableDomain";

	// WebFailedRequest
	public static WebFailedRequestNotification = "WebFailedRequest_Notification";
}

export class ShortcutCommands {
	public static NextProxyServer = "next-proxy-server";
	public static PreviousProxyServer = "previous-proxy-server";
	public static ProxyModeNone = "proxy-mode-none";
	public static ProxyModeSmart = "proxy-mode-smart";
	public static ProxyModeAlways = "proxy-mode-always";
	public static ProxyModeSystem = "proxy-mode-system";
}

export class ResultHolder {
	public success: boolean;
	public message: string;
}

export class ResultHolderGeneric<T> implements ResultHolder {
	public success: boolean;
	public message: string;
	public value: T;
}

export class PopupInternalDataType {
	public proxyableDomains: ProxyableDomainType[];
	public proxyMode: ProxyModeType;
	public hasProxyServers: boolean;
	public proxyServers: ProxyServer[];
	public activeProxyServer: ProxyServer;
	public currentTabId: number;
	public currentTabIndex: number;
	public proxyServersSubscribed: any[];
	public updateAvailableText: string;
	public updateInfo: any;
	public failedRequests: FailedRequestType[];
	public notSupportedSetProxySettings: boolean;
	public notAllowedSetProxySettings: boolean;
}

export class FailedRequestType {
	hasRule: boolean;
	url: string;
	domain: string;
	hitCount: number;
	ruleIsForThisHost: boolean;
	isRootHost: boolean;
	ignored: boolean;
	_domainSortable: string;
}

export type ProxyableDomainType = {
	domain: string,
	hasMatchingRule: boolean,
	ruleIsForThisHost: boolean
}

export type SettingsPageInternalDataType = {
	settings: SettingsConfig,
	updateAvailableText: string,
	updateInfo: any;
}

export class ProxyableInternalDataType {
	url: string;
	requests: ProxyableDataType[];
}

export enum ProxyableLogType {
	NoneMatched,
	MatchedRule,
	Special,
	Whitelisted,
	ByPassed,
	SystemProxyApplied,
	AlwaysEnabled,
	ProxyPerOrigin
}

export class ProxyableDataType {
	public tabId: number;
	public logType: ProxyableLogType;
	public url: string;
	public enabled?: boolean;
	public sourceDomain: string;
	public rule: string;

	get logTypeName(): string {
		return ProxyableLogType[this.logType];
	}
	get proxied(): boolean {
		if (this.logType == ProxyableLogType.AlwaysEnabled ||
			this.logType == ProxyableLogType.MatchedRule ||
			this.logType == ProxyableLogType.ProxyPerOrigin)
			return true;
		return false;
	}
	get statusCanBeDetermined(): boolean {
		if (this.logType == ProxyableLogType.AlwaysEnabled ||
			this.logType == ProxyableLogType.Special ||
			this.logType == ProxyableLogType.SystemProxyApplied ||
			this.logType == ProxyableLogType.ByPassed)
			return false;
		return true;
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

	public activeProxyServer: ProxyServer | null;
	public proxyServerSubscriptions: ProxyServerSubscription[] = [];
	public proxyRulesSubscriptions: ProxyRulesSubscription[] = [];
	public options: GeneralOptions;
	public bypass: BypassOptions;
	public firstEverInstallNotified: boolean = false;
}
export class GeneralOptions implements Cloneable {
	public syncSettings: boolean = false;
	public syncProxyMode: boolean = true;
	public syncActiveProxy: boolean = true;
	public detectRequestFailures: boolean = true;
	public ignoreRequestFailuresForDomains: string[];
	public displayFailedOnBadge: boolean = true;
	public displayAppliedProxyOnBadge: boolean = true;
	public proxyPerOrigin: boolean = true;
	public enableShortcuts: boolean = true;
	public shortcutNotification: boolean = true;

	CopyFrom(source: any) {
		if (source["syncSettings"] != null)
			this.syncSettings = source["syncSettings"] == true ? true : false;
		if (source["syncProxyMode"] != null)
			this.syncProxyMode = source["syncProxyMode"] == true ? true : false;
		if (source["syncActiveProxy"] != null)
			this.syncActiveProxy = source["syncActiveProxy"] == true ? true : false;
		if (source["detectRequestFailures"] != null)
			this.detectRequestFailures = source["detectRequestFailures"] == true ? true : false;
		if (source["ignoreRequestFailuresForDomains"] != null)
			this.ignoreRequestFailuresForDomains = source["ignoreRequestFailuresForDomains"] || [];
		if (source["displayFailedOnBadge"] != null)
			this.displayFailedOnBadge = source["displayFailedOnBadge"] == true ? true : false;
		if (source["displayAppliedProxyOnBadge"] != null)
			this.displayAppliedProxyOnBadge = source["displayAppliedProxyOnBadge"] == true ? true : false;
		if (source["proxyPerOrigin"] != null)
			this.proxyPerOrigin = source["proxyPerOrigin"] == true ? true : false;
		if (source["enableShortcuts"] != null)
			this.enableShortcuts = source["enableShortcuts"] == true ? true : false;
		if (source["shortcutNotification"] != null)
			this.shortcutNotification = source["shortcutNotification"] == true ? true : false;
	}
}
export class BypassOptions implements Cloneable {
	public enableForAlways: boolean = false;
	public bypassList: string[] = ["127.0.0.1", "localhost", "::1"];

	CopyFrom(source: any) {
		if (source["enableForAlways"] != null)
			this.enableForAlways = source["enableForAlways"] == true ? true : false;
		if (source["bypassList"] != null)
			this.bypassList = source["bypassList"] || [];
	}
}

interface Cloneable {
	CopyFrom(source: any): void;
}

class ProxyServerConnectDetails {
	public host: string;
	public port: number;
	public protocol: string;
	public username: string;
	public password: string;
	public proxyDNS: boolean;
}

export class ProxyServer extends ProxyServerConnectDetails implements Cloneable {
	public name: string;
	public failoverTimeout: number;

	CopyFrom(source: any) {
		this.name = source["name"];
		this.host = source["host"];
		this.port = (+source["port"]);
		this.protocol = source["protocol"];
		this.username = source["username"];
		this.password = source["password"];
		if (source["proxyDNS"] != null)
			this.proxyDNS = source["proxyDNS"] == true ? true : false;
		this.failoverTimeout = source["failoverTimeout"] > 0 ? source["failoverTimeout"] : null;

		if (!this.protocol) {
			this.protocol = "HTTP";
		}
	}
}

export class ProxyRule implements Cloneable {
	public ruleType: ProxyRuleType;
	public sourceDomain: string;
	public autoGeneratePattern: boolean;
	public rulePattern: string;
	public ruleRegex: string;
	public ruleExact: string;
	public proxy: ProxyServer;
	public enabled: boolean = true;
	public whiteList: boolean = false;

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
	get proxyName(): string {
		if (!this.proxy)
			return null;

		return this.proxy.name;
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

	CopyFrom(source: any) {
		this.ruleType = source["ruleType"] || ProxyRuleType.MatchPatternHost;
		this.sourceDomain = source["sourceDomain"];
		this.autoGeneratePattern = source["autoGeneratePattern"] == true ? true : false;
		this.rulePattern = source["rulePattern"];
		this.ruleRegex = source["ruleRegex"];
		this.ruleExact = source["ruleExact"];
		this.proxy = source["proxy"];
		if (source["enabled"] != null)
			this.enabled = source["enabled"] == true ? true : false;

		if (source["whiteList"] != null)
			this.whiteList = source["whiteList"] == true ? true : false;

		if (this.proxy) {
			if (!Settings.validateProxyServer(this.proxy).success) {
				this.proxy = null;
			}
		}

		// supporting old version
		if (source["pattern"]) {
			this.rulePattern = source["pattern"];
			this.ruleType = ProxyRuleType.MatchPatternUrl;
			this.sourceDomain = source["source"];
			this.autoGeneratePattern = false;
		}
	}
}

export class CompiledRule extends ProxyRule {
	regex: RegExp;
}

export enum SpecialRequestApplyProxyMode {
	NoProxy,
	CurrentProxy,
	SelectedProxy
}
export enum ProxyServerSubscriptionFormat {
	PlainText,
	Json
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

	public format: ProxyServerSubscriptionFormat;

	// number of proxies in the list
	public totalCount: number = 0;

	public username: string;
	public password: string;
	// the loaded proxies
	public proxies: ProxyServer[];

	public applyProxy: SpecialRequestApplyProxyMode;
}

export enum ProxyRulesSubscriptionFormat {
	AutoProxy
}

export class ProxyRulesSubscription {
	public name: string;
	public url: string;
	public enabled: boolean = false;

	// in minutes
	public refreshRate: number = 0;

	// types stored in proxyServerSubscriptionObfuscate
	public obfuscation: string;

	public format: ProxyRulesSubscriptionFormat;

	// number of rules in the list
	public totalCount: number = 0;

	public username: string;
	public password: string;

	// the loaded rules
	public proxyRules: string[]; // Regex string
	public whitelistRules: string[]; // Regex string

	public applyProxy: SpecialRequestApplyProxyMode;
}
