import { Settings } from './Settings';
import { api, environment } from '../lib/environment';
import { Utils } from '../lib/Utils';
import { ProfileOperations } from './ProfileOperations';

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
export const proxyServerProtocols = ['HTTP', 'HTTPS', 'SOCKS4', 'SOCKS5'];
export const proxyServerSubscriptionObfuscate = ['None', 'Base64'];
export const proxyServerSubscriptionFormat = ['PlainText', 'JSON'];
export const specialRequestApplyProxyModeKeys = ['NoProxy', 'CurrentProxy' /* , "SelectedProxy" */];
export const proxyRulesActionTypes = [
	api.i18n.getMessage('settingsRuleActionApplyProxy'),
	api.i18n.getMessage('settingsRuleActionWhitelist'),
];
export const monitorUrlsSchemaFilter = ['*://*/*', 'ws://*/*', 'wss://*/*', 'ftp://*/*'];
export const themesCustomType = "0";
export const themesDarkFix = "themes-darkfix.css";
export const themesDataTablesDarkFix = "themes-datatables-darkfix.css";

export enum SmartProfileType {
	Direct,
	SystemProxy,
	SmartRules,
	AlwaysEnabledBypassRules,
	IgnoreFailureRules,
}
export function getSmartProfileTypeIcon(profileType: SmartProfileType) {
	switch (profileType) {
		case SmartProfileType.Direct:
			return 'fas fa-ban text-danger';

		case SmartProfileType.SystemProxy:
			return 'fab fa-windows text-primary';

		case SmartProfileType.SmartRules:
			return 'fas fa-magic text-primary';

		case SmartProfileType.AlwaysEnabledBypassRules:
			return 'fas fa-globe-americas text-success';

		case SmartProfileType.IgnoreFailureRules:
			return 'fas fa-scroll';

		default:
			return '';
	}
}
export enum SmartProfileTypeBuiltinIds {
	Direct = 'InternalProfile_Direct',
	SmartRules = 'InternalProfile_SmartRules',
	AlwaysEnabled = 'InternalProfile_AlwaysEnabled',
	SystemProxy = 'InternalProfile_SystemProxy',
	IgnoreRequestFailures = 'InternalProfile_IgnoreRequestFailures',
}
export enum ProxyRuleType {
	MatchPatternHost,
	MatchPatternUrl,
	RegexHost,
	RegexUrl,
	Exact,
	DomainSubdomain,
}
export enum CompiledProxyRuleType {
	RegexHost,
	RegexUrl,
	Exact,
	/** Url should be included from the start */
	SearchUrl,
	/** Domain should be a exact match */
	SearchDomain,
	/** Matches domain and its subdomains */
	SearchDomainSubdomain,
	/** Matches domain and path */
	SearchDomainAndPath,
	/** Matches domain and its subdomains including path in the end of each */
	SearchDomainSubdomainAndPath,
}
export enum CompiledProxyRuleSource {
	Rules,
	Subscriptions,
}
export enum ProxyServerForProtocol {
	Http,
	SSL,
	FTP,
	SOCKS,
}
export class CommandMessages {
	// Popup messages
	public static PopupGetInitialData = 'Popup_GetInitialData';
	//public static PopupChangeProxyMode = 'Popup_ChangeProxyMode';
	public static PopupChangeActiveProfile = 'Popup_ChangeActiveProfile';
	public static PopupChangeActiveProxyServer = 'Popup_ChangeActiveProxyServer';
	public static PopupToggleProxyForDomain = 'Popup_ToggleProxyForDomain';
	public static PopupAddDomainListToProxyRule = 'Popup_AddDomainListToProxyRule';
	public static PopupAddDomainListToIgnored = 'Popup_AddDomainListToIgnored';

	// Settings page
	public static SettingsPageGetInitialData = 'SettingsPage_GetInitialData';
	public static SettingsPageGetInitialDataResponse = 'SettingsPage_GetInitialData_Response';
	public static SettingsPageSaveOptions = 'SettingsPage_SaveOptions';
	public static SettingsPageSaveProxyServers = 'SettingsPage_SaveProxyServers';
	public static SettingsPageSaveProxySubscriptions = 'SettingsPage_SaveProxySubscriptions';
	public static SettingsPageSaveSmartProfile = 'SettingsPage_SaveSmartProfile';
	public static SettingsPageDeleteSmartProfile = 'SettingsPage_DeleteSmartProfile';
	public static SettingsPageRestoreSettings = 'SettingsPage_RestoreSettings';
	public static SettingsPageMakeRequestSpecial = 'SettingsPage_MakeRequestSpecial';
	public static SettingsPageSkipWelcome = 'SettingsPage_SkipWelcome';
	public static SettingsPageFactoryReset = 'SettingsPage_FactoryReset';

	// Request Logger
	public static ProxyableRequestLog = 'Proxyable_RequestLog';
	public static ProxyableOriginTabRemoved = 'Proxyable_OriginTabRemoved';

	// Proxyable Resources
	public static ProxyableGetInitialData = 'Proxyable_GetInitialData';
	public static ProxyableGetInitialDataResponse = 'Proxyable_GetInitialData_Response';
	public static ProxyableRemoveProxyableLog = 'Proxyable_RemoveProxyableLog';
	public static ProxyableToggleProxyableDomain = 'Proxyable_ToggleProxyableDomain';

	// WebFailedRequest
	public static WebFailedRequestNotification = 'WebFailedRequest_Notification';

	// Debug
	public static DebugEnableDiagnostics = 'Debug_EnableDiagnostics';
	public static DebugGetDiagnosticsLogs = 'Debug_GetDiagnosticsLogs';

}
export enum BrowserProxySettingsType {
	none = 'none',
	autoDetect = 'autoDetect',
	system = 'system',
	manual = 'manual',
	autoConfig = 'autoConfig',
}
export class ShortcutCommands {
	public static NextProxyServer = 'next-proxy-server';
	public static PreviousProxyServer = 'previous-proxy-server';
	public static BuiltinProfileNone = 'proxy-mode-none';
	public static BuiltinProfileSmart = 'proxy-mode-smart';
	public static BuiltinProfileAlways = 'proxy-mode-always';
	public static BuiltinProfileSystem = 'proxy-mode-system';
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
	public proxyProfiles: SmartProfileBase[];
	public activeProfileId: string;
	public activeIncognitoProfileId: string;
	public hasProxyServers: boolean;
	public proxyServers: ProxyServer[];
	public currentProxyServerId: string;
	public currentTabId: number;
	public currentTabIndex: number;
	public currentTabIsIncognito: boolean;
	public proxyServersSubscribed: ProxyServer[];
	public updateAvailableText: string;
	public updateInfo: any;
	public failedRequests: FailedRequestType[];
	public notSupportedSetProxySettings: boolean;
	public notAllowedSetProxySettings: boolean;
	public themeData: PartialThemeDataType;
	public refreshTabOnConfigChanges: boolean;
}
export class PartialThemeDataType {
	public themeType: ThemeType = ThemeType.Auto;
	public themesLight: string;
	public themesLightCustomUrl: string;
	public themesDark: string;
	public themesDarkCustomUrl: string;
}
export class FailedRequestType {
	hasRule: boolean;
	ruleId?: RuleId;
	url: string;
	domain: string;
	hitCount: number;
	isRuleForThisHost: boolean;
	isRootHost: boolean;
	ignored: boolean;
	_domainSortable: string;
}

export type ProxyableDomainType = {
	/**Most of the times no rule is defined */
	ruleId?: RuleId;
	domain: string;
	ruleMatched: boolean;
	ruleMatchedThisHost: boolean;
	ruleSource: CompiledProxyRuleSource;
	ruleMatchSource: CompiledProxyRulesMatchedSource;
	ruleHasWhiteListMatch?: boolean;
};

export type SettingsPageInternalDataType = {
	settings: SettingsConfig;
	updateAvailableText: string;
	updateInfo: any;
};
export class SettingsPageSmartProfile {
	smartProfile: SmartProfile;
	htmlProfileMenu: any;
	htmlProfileTab: any;
	grdRules: any;
	grdRulesSubscriptions: any;
	modalModifyRule: any;
	modalAddMultipleRules: any;
	modalRulesSubscription: any;
	modalImportRules: any;
};

export class ProxyableInternalDataType {
	url: string;
	themeData: PartialThemeDataType;
}

export enum ProxyableMatchedRuleStatus {
	NoneMatched,
	Special,
	ProxyPerOrigin,
	// SmartRules profile
	MatchedRule,
	Whitelisted,

	// AlwaysEnabled profile
	AlwaysEnabledByPassed/* whitelisted, rule matched */,
	AlwaysEnabledForcedByRules /* proxied, rule matched */

}
export enum ProxyableProxifiedStatus {
	NoProxy,
	Special,
	ProxyPerOrigin,
	MatchedRule,
	AlwaysEnabled /* proxied, no rule matched */,
	SystemProxyApplied /* unknown, system proxy will apply */
}

export class ProxyableLogDataType {
	public tabId: number;
	public url: string;
	public ruleId?: number;
	public ruleHostName: string;
	public rulePatternText: string;
	public ruleSource?: CompiledProxyRuleSource;
	public matchedRuleStatus: ProxyableMatchedRuleStatus;
	public proxifiedStatus: ProxyableProxifiedStatus;

	get matchedRuleStatusName(): string {
		return ProxyableMatchedRuleStatus[this.matchedRuleStatus];
	}

	get proxifiedStatusName(): string {
		return ProxyableProxifiedStatus[this.proxifiedStatus];
	}

	get proxified(): boolean {
		return this.proxifiedStatus != ProxyableProxifiedStatus.NoProxy;
	}

	applyFromRule(rule: CompiledProxyRule) {
		if (!rule)
			return;

		this.rulePatternText = rule.ruleText;
		this.ruleId = rule.ruleId;
		this.ruleSource = rule.compiledRuleSource;
		if (!this.ruleHostName)
			this.ruleHostName = rule.hostName;
	}
	removeRuleInfo() {
		this.rulePatternText = '';
		this.ruleId = null;
		this.ruleSource = null;
		this.ruleHostName = '';
	}
}

export class SettingsConfig implements Cloneable {
	constructor() { }
	public product: string = 'SmartProxy';
	public version: string = '';
	public proxyProfiles: SmartProfile[] = getBuiltinSmartProfiles();
	public activeProfileId: string = SmartProfileTypeBuiltinIds.Direct;
	public defaultProxyServerId: string;

	public proxyServers: ProxyServer[] = [];
	public proxyServerSubscriptions: ProxyServerSubscription[] = [];
	public options: GeneralOptions;
	public firstEverInstallNotified: boolean = false;

	CopyFrom(source: SettingsConfig): void {
		this.options = new GeneralOptions();
		this.options.CopyFrom(source.options);

		let copyProxyProfiles: SmartProfile[] = [];
		for (const sourceProfile of source.proxyProfiles) {
			let copyProfile = new SmartProfile();
			ProfileOperations.copySmartProfile(sourceProfile, copyProfile);

			copyProxyProfiles.push(copyProfile);
		}
		this.proxyProfiles = copyProxyProfiles;
		this.activeProfileId = source.activeProfileId;

		let copyProxyServers: ProxyServer[] = [];
		for (const sourceProxy of source.proxyProfiles) {
			let copyProxy = new ProxyServer();
			copyProxy.CopyFrom(sourceProxy);

			if (copyProxy.isValid())
				copyProxyServers.push(copyProxy);
		}
		this.proxyServers = copyProxyServers;
		this.defaultProxyServerId = source.defaultProxyServerId;

		let copyProxySubs: ProxyServerSubscription[] = [];
		for (const srcProxySub of source.proxyServerSubscriptions) {
			let copyProxySub = new ProxyServerSubscription();
			copyProxySub.CopyFrom(srcProxySub);

			if (copyProxySub.isValid())
				copyProxySubs.push(copyProxySub);
		}
		this.proxyServerSubscriptions = copyProxySubs;

		this.firstEverInstallNotified = source.firstEverInstallNotified;
		this.version = source.version;
	}
}

export class SettingsActive {
	public activeProfile: SmartProfileCompiled;
	public activeIncognitoProfile: SmartProfileCompiled;

	/** Current proxy server is derived from 
	 * Active Profile if it is set otherwise it is derived from Default Proxy Server */
	public currentProxyServer: ProxyServer;
	public currentIgnoreFailureProfile: SmartProfileCompiled;
}

export class SmartProfileTypeConfig {
	public editable: boolean;
	public selectable: boolean;
	public builtin: boolean;
	public supportsSubscriptions: boolean;
	/** Can have customer proxy on Profile */
	public supportsProfileProxy: boolean;
	/** Can have custom proxy for each rule */
	public customProxyPerRule: boolean;
	/**  Enabled/Disabled */
	public canBeDisabled: boolean;
	/** Rule action can be Apply Whitelist/Apply Proxy */
	public supportsRuleActionWhitelist: boolean;
	/** If rule action is supported what is the default action? Is it whitelist */
	public defaultRuleActionIsWhitelist?: boolean;
}

export class SmartProfileBase {
	public profileType: SmartProfileType;
	public profileTypeConfig: SmartProfileTypeConfig;
	public profileId: string;
	public profileName: string;
	public enabled: boolean = true;
	public profileProxyServerId: string;
}

export class SmartProfile extends SmartProfileBase {
	public proxyRules: ProxyRule[] = [];
	public rulesSubscriptions: ProxyRulesSubscription[] = [];
}

export class SmartProfileCompiled extends SmartProfileBase {
	public compiledRules: CompiledProxyRulesInfo;
	public profileProxyServer: ProxyServer;
}
export function getUserSmartProfileTypeConfig(profileType: SmartProfileType): SmartProfileTypeConfig {
	let config = getSmartProfileTypeConfig(profileType);
	config.builtin = false;
	return config;
}
export function getSmartProfileTypeConfig(profileType: SmartProfileType): SmartProfileTypeConfig {
	switch (profileType) {
		case SmartProfileType.Direct:
			return {
				builtin: true,
				editable: false,
				selectable: true,
				supportsSubscriptions: false,
				supportsProfileProxy: false,
				customProxyPerRule: false,
				canBeDisabled: false,
				supportsRuleActionWhitelist: false,
				defaultRuleActionIsWhitelist: null,
			}
		case SmartProfileType.SmartRules:
			return {
				builtin: true,
				editable: true,
				selectable: true,
				supportsSubscriptions: true,
				supportsProfileProxy: true,
				customProxyPerRule: true,
				canBeDisabled: true,
				supportsRuleActionWhitelist: true,
				defaultRuleActionIsWhitelist: false,
			}
		case SmartProfileType.AlwaysEnabledBypassRules:
			return {
				builtin: true,
				editable: true,
				selectable: true,
				supportsSubscriptions: false,
				supportsProfileProxy: true,
				customProxyPerRule: true,
				canBeDisabled: true,
				supportsRuleActionWhitelist: true,
				defaultRuleActionIsWhitelist: true,
			}
		case SmartProfileType.SystemProxy:
			return {
				builtin: true,
				editable: false,
				selectable: true,
				supportsSubscriptions: false,
				supportsProfileProxy: false,
				customProxyPerRule: false,
				canBeDisabled: false,
				supportsRuleActionWhitelist: false,
				defaultRuleActionIsWhitelist: null,
			}
		case SmartProfileType.IgnoreFailureRules:
			return {
				builtin: true,
				editable: false,
				selectable: false,
				supportsSubscriptions: false,
				supportsProfileProxy: false,
				customProxyPerRule: false,
				canBeDisabled: false,
				supportsRuleActionWhitelist: false,
				defaultRuleActionIsWhitelist: null,
			}
		default:
			return null;
	}
}
export function getSmartProfileTypeName(profileType: SmartProfileType) {
	return api.i18n.getMessage(`settings_SmartProfileType_${SmartProfileType[profileType]}`);
}
export function getBuiltinSmartProfiles(): SmartProfile[] {
	return [
		{
			profileId: SmartProfileTypeBuiltinIds.Direct,
			profileType: SmartProfileType.Direct,
			profileTypeConfig: getSmartProfileTypeConfig(SmartProfileType.Direct),
			profileName: api.i18n.getMessage('popupNoProxy'),
			proxyRules: [],
			enabled: true,
			rulesSubscriptions: [],
			profileProxyServerId: null
		},
		{
			profileId: SmartProfileTypeBuiltinIds.SmartRules,
			profileType: SmartProfileType.SmartRules,
			profileTypeConfig: getSmartProfileTypeConfig(SmartProfileType.SmartRules),
			profileName: api.i18n.getMessage('popupSmartProxy'),
			proxyRules: [],
			enabled: true,
			rulesSubscriptions: [],
			profileProxyServerId: null
		},
		{
			profileId: SmartProfileTypeBuiltinIds.AlwaysEnabled,
			profileType: SmartProfileType.AlwaysEnabledBypassRules,
			profileTypeConfig: getSmartProfileTypeConfig(SmartProfileType.AlwaysEnabledBypassRules),
			profileName: api.i18n.getMessage('popupAlwaysEnable'),
			proxyRules: [],
			enabled: true,
			rulesSubscriptions: [],
			profileProxyServerId: null
		},
		{
			profileId: SmartProfileTypeBuiltinIds.SystemProxy,
			profileType: SmartProfileType.SystemProxy,
			profileTypeConfig: getSmartProfileTypeConfig(SmartProfileType.SystemProxy),
			profileName: api.i18n.getMessage('popupSystemProxy'),
			proxyRules: [],
			enabled: true,
			rulesSubscriptions: [],
			profileProxyServerId: null
		},
	];
}

export function getSmartProfileTypeDefaultId(profileType: SmartProfileType) {
	switch (profileType) {
		case SmartProfileType.Direct:
			return SmartProfileTypeBuiltinIds.Direct;

		case SmartProfileType.SystemProxy:
			return SmartProfileTypeBuiltinIds.SystemProxy;

		case SmartProfileType.SmartRules:
			return SmartProfileTypeBuiltinIds.SmartRules;

		case SmartProfileType.AlwaysEnabledBypassRules:
			return SmartProfileTypeBuiltinIds.AlwaysEnabled;

		case SmartProfileType.IgnoreFailureRules:
			return SmartProfileTypeBuiltinIds.IgnoreRequestFailures;

		default:
			return '';
	}
}

export enum ThemeType {
	Auto,
	Light,
	Dark
}

export class GeneralOptions implements Cloneable {
	public static defaultDarkThemeName: string = "themes-cosmo-dark";

	public syncSettings: boolean = false;
	public syncActiveProfile: boolean = true;
	public syncActiveProxy: boolean = true;
	public detectRequestFailures: boolean = true;
	public displayFailedOnBadge: boolean = true;
	public displayAppliedProxyOnBadge: boolean = environment.initialConfig.displayTooltipOnBadge;
	public displayMatchedRuleOnBadge: boolean = environment.initialConfig.displayTooltipOnBadge;
	public refreshTabOnConfigChanges: boolean = false;
	public proxyPerOrigin: boolean = true;
	public activeIncognitoProfileId: string;
	public enableShortcuts: boolean = true;
	public shortcutNotification: boolean = true;
	public themeType: ThemeType = ThemeType.Auto;
	public themesLight: string;
	public themesLightCustomUrl: string;
	public themesDark: string = GeneralOptions.defaultDarkThemeName;
	public themesDarkCustomUrl: string;

	CopyFrom(source: any) {
		if (source['syncSettings'] != null) this.syncSettings = source['syncSettings'] == true ? true : false;
		if (source['syncProxyMode'] != null) this.syncActiveProfile = source['syncProxyMode'] == true ? true : false;
		if (source['syncActiveProfile'] != null) this.syncActiveProfile = source['syncActiveProfile'] == true ? true : false;
		if (source['syncActiveProxy'] != null) this.syncActiveProxy = source['syncActiveProxy'] == true ? true : false;
		if (source['detectRequestFailures'] != null)
			this.detectRequestFailures = source['detectRequestFailures'] == true ? true : false;
		if (source['displayFailedOnBadge'] != null)
			this.displayFailedOnBadge = source['displayFailedOnBadge'] == true ? true : false;
		if (source['displayAppliedProxyOnBadge'] != null)
			this.displayAppliedProxyOnBadge = source['displayAppliedProxyOnBadge'] == true ? true : false;
		if (source['displayMatchedRuleOnBadge'] != null)
			this.displayMatchedRuleOnBadge = source['displayMatchedRuleOnBadge'] == true ? true : false;
		if (source['refreshTabOnConfigChanges'] != null)
			this.refreshTabOnConfigChanges = source['refreshTabOnConfigChanges'] == true ? true : false;
		if (source['proxyPerOrigin'] != null) this.proxyPerOrigin = source['proxyPerOrigin'] == true ? true : false;
		if (source['enableShortcuts'] != null) this.enableShortcuts = source['enableShortcuts'] == true ? true : false;
		if (source['shortcutNotification'] != null)
			this.shortcutNotification = source['shortcutNotification'] == true ? true : false;
		this.themeType = source['themeType'] || ThemeType.Auto;
		this.themesLight = source['themesLight'];
		this.themesLightCustomUrl = source['themesLightCustomUrl'];
		this.themesDark = source['themesDark'];
		this.themesDarkCustomUrl = source['themesDarkCustomUrl'];
	}
}

interface Cloneable {
	CopyFrom(source: any): void;
}

class ProxyServerConnectDetails {
	public order: number;
	public host: string;
	public port: number;
	public protocol: string;
	public username: string;
	public password: string;
	public proxyDNS: boolean;
}

export class ProxyServer extends ProxyServerConnectDetails implements Cloneable {
	public id: string;
	public name: string = '';
	public failoverTimeout: number;

	constructor() {
		super();
		this.id = Utils.getNewUniqueIdString();
		this.order = 0;
	}

	CopyFrom(source: any) {
		this.id = source['id'] || Utils.getNewUniqueIdString();
		this.order = source['order'] ?? 0;
		this.name = source['name'];
		this.host = source['host'];
		this.port = +source['port'];
		this.protocol = source['protocol'];
		this.username = source['username'];
		this.password = source['password'];
		if (source['proxyDNS'] != null) this.proxyDNS = source['proxyDNS'] == true ? true : false;
		this.failoverTimeout = source['failoverTimeout'] > 0 ? source['failoverTimeout'] : null;

		if (!this.protocol) {
			this.protocol = 'HTTP';
		}
	}

	public isValid(): boolean {

		if (!this.name || !this.protocol)
			return false;
		if (!this.port || this.port <= 0 || this.port >= 65535)
			return false;
		if (!this.host || !Utils.isValidHost(this.host))
			return false;

		return true;
	}
}

export type RuleId = number;

export enum ProxyRuleSpecialProxyServer {
	DefaultGeneral = "-1",
	ProfileProxy = "-2"
}

export class ProxyRule implements Cloneable {

	constructor() {
		this.ruleId = Utils.getNewUniqueIdNumber();
	}

	public ruleId: RuleId;
	public ruleType: ProxyRuleType;
	public hostName: string;
	public autoGeneratePattern: boolean;
	public rulePattern: string;
	public ruleRegex: string;
	public ruleExact: string;
	/** Used with DomainSubdomain */
	public ruleSearch: string;
	public proxy: ProxyServer;
	public proxyServerId: string;
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

			case ProxyRuleType.DomainSubdomain:
				return this.ruleSearch;

			case ProxyRuleType.Exact:
				return this.ruleExact;
		}
		return '';
	}
	get proxyName(): string {
		if (!this.proxy) return null;

		return this.proxy.name;
	}
	public static assignArray(rules: any[]): ProxyRule[] {
		if (!rules || !rules.length) return [];
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
		this.ruleType = source['ruleType'];
		if (source['ruleType'] == null)
			this.ruleType = ProxyRuleType.DomainSubdomain;
		this.hostName = source['hostName'] || source['sourceDomain'];
		this.autoGeneratePattern = source['autoGeneratePattern'] == true ? true : false;
		this.rulePattern = source['rulePattern'];
		this.ruleRegex = source['ruleRegex'];
		this.ruleExact = source['ruleExact'];
		this.ruleSearch = source['ruleSearch'];
		this.proxy = source['proxy'];
		if (source['enabled'] != null)
			this.enabled = source['enabled'] == true ? true : false;

		if (source['whiteList'] != null)
			this.whiteList = source['whiteList'] == true ? true : false;

		if (this.proxy) {
			if (!Settings.validateProxyServer(this.proxy).success) {
				this.proxy = null;
			}
		}

		// supporting old version
		if (source['pattern']) {
			this.rulePattern = source['rulePattern'] || source['pattern'];
			this.hostName = source['hostName'] || source['source'] || source['sourceDomain'];
			if (this.ruleType == null)
				this.ruleType = ProxyRuleType.MatchPatternUrl;
			if (this.autoGeneratePattern == null)
				this.autoGeneratePattern = false;
		}
	}

	public isValid(): boolean {
		if (!this.rule || !this.hostName || this.ruleType == null)
			return false;
		return true;
	}
}

export class CompiledProxyRule {
	public ruleId: RuleId;
	public compiledRuleType: CompiledProxyRuleType;
	public compiledRuleSource: CompiledProxyRuleSource;
	public regex?: RegExp;
	public search?: string;

	public hostName: string;

	public proxy: ProxyServer;
	public whiteList: boolean = false;

	/**getting rule text */
	get ruleText(): string {
		// why ruleType is string? converting to int
		switch (+this.compiledRuleType) {
			case CompiledProxyRuleType.RegexHost:
			case CompiledProxyRuleType.RegexUrl:
				return this.regex.toString();

			case CompiledProxyRuleType.Exact:
			case CompiledProxyRuleType.SearchUrl:
			case CompiledProxyRuleType.SearchDomain:
			case CompiledProxyRuleType.SearchDomainAndPath:
			case CompiledProxyRuleType.SearchDomainSubdomain:
			case CompiledProxyRuleType.SearchDomainSubdomainAndPath:
				return this.search;
		}
		return '';
	}
}

/** Compiled rules, separated by type and Priority */
export class CompiledProxyRulesInfo {
	/** User defined whitelist rules. P2 */
	public WhitelistRules: CompiledProxyRule[] = [];
	/** User defined rules. P1 */
	public Rules: CompiledProxyRule[] = [];
	/** Subscription whitelist rules. P3  */
	public WhitelistSubscriptionRules: CompiledProxyRule[] = [];
	/** Subscription rules. P4 */
	public SubscriptionRules: CompiledProxyRule[] = [];
}
export enum CompiledProxyRulesMatchedSource {
	WhitelistRules,
	Rules,
	WhitelistSubscriptionRules,
	SubscriptionRules
}

export enum SpecialRequestApplyProxyMode {
	NoProxy,
	CurrentProxy,
	SelectedProxy,
}
export enum ProxyServerSubscriptionFormat {
	PlainText,
	Json,
}

export class SubscriptionStats {
	lastSuccessDate: string;
	lastTryDate: string;
	lastStatus: boolean;
	lastStatusMessage: string;
	lastStatusProxyServerName: string;

	public static updateStats(stats: SubscriptionStats, success: boolean, errorResult?: any) {
		let now = new Date();
		if (success) {
			stats.lastStatus = true;
			stats.lastStatusMessage = null;
			stats.lastTryDate =
				stats.lastSuccessDate = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
		}
		else {
			stats.lastStatus = false;
			stats.lastStatusMessage = errorResult?.message ?? errorResult?.toString();
			stats.lastTryDate = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
		}
		stats.lastStatusProxyServerName = Settings.active?.currentProxyServer?.name;
	}
	public static ToString(stats: SubscriptionStats): string {
		let status = `Status: ${stats.lastStatus ? 'Success' : 'Fail'}`;
		if (stats.lastStatus) {
			status = api.i18n.getMessage("settingsSubscriptionStatsStatusSuccess");
		}
		else {
			status = api.i18n.getMessage("settingsSubscriptionStatsStatusFail");
		}

		if (!stats.lastStatus) {
			if (stats.lastTryDate) {
				status += `\r\n${api.i18n.getMessage("settingsSubscriptionStatsLastTry")} ${stats.lastTryDate}`
			}
			else {
				status += `\r\n${api.i18n.getMessage("settingsSubscriptionStatsLastTry")} -`
			}
			if (stats.lastStatusMessage) {
				status += `\r\n${api.i18n.getMessage("settingsSubscriptionStatsMessage")} ${stats.lastStatusMessage}`
			}
		}
		if (stats.lastStatusProxyServerName) {
			status += `\r\n${api.i18n.getMessage("settingsRulesGridColProxy")}: ${stats.lastStatusProxyServerName}`
		}
		if (stats.lastSuccessDate) {
			status += `\r\n${api.i18n.getMessage("settingsSubscriptionStatsLastSuccess")} ${stats.lastSuccessDate}`
		}
		return status;
	}
}

export class ProxyServerSubscription implements Cloneable {
	public name: string;
	public url: string;
	public enabled: boolean = false;

	// same as proxyServerProtocols
	public proxyProtocol: string = null;

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

	public stats: SubscriptionStats;

	CopyFrom(source: any) {
		if (source['name'] != null) this.name = source['name'] || '';
		if (source['url'] != null) this.url = source['url'] || '';
		if (source['enabled'] != null) this.enabled = source['enabled'] == true ? true : false;
		if (source['proxyProtocol'] != null) this.proxyProtocol = source['proxyProtocol'] || null;
		this.refreshRate = +source['failoverTimeout'] > 0 ? +source['failoverTimeout'] : 0;
		if (source['obfuscation'] != null) this.obfuscation = source['obfuscation'] || null;
		this.format = ProxyServerSubscriptionFormat.PlainText;
		if (source['format'] != null)
			if (+source['format'] in ProxyServerSubscriptionFormat) {
				this.format = +source['format'];
			}
		this.totalCount = +source['totalCount'];
		if (source['username'] != null) this.username = source['username'] || '';
		if (source['password'] != null) this.password = source['password'] || '';

		this.applyProxy = SpecialRequestApplyProxyMode.CurrentProxy;
		if (source['applyProxy'] != null)
			if (+source['applyProxy'] in SpecialRequestApplyProxyMode) {
				this.applyProxy = +source['applyProxy'];
			}
		this.proxies = [];
		if (source['proxies'] != null && Array.isArray(source['proxies']))
			for (const sourceServer of source['proxies']) {
				var server = new ProxyServer();
				server.CopyFrom(sourceServer);

				if (server.isValid())
					this.proxies.push(server);
			}
		this.stats = new SubscriptionStats();
		if (source.stats) {
			Object.assign(this.stats, source.stats);
		}
	}

	public isValid(): boolean {

		if (!this.name || !this.url || !this.proxyProtocol || !this.format)
			return false;
		return true;
	}
}

export enum ProxyRulesSubscriptionFormat {
	AutoProxy,
	SwitchyOmega,
}

export enum ProxyRulesSubscriptionRuleType {
	RegexHost,
	RegexUrl,
	/** Url should be included from the start */
	SearchUrl,
	/** Domain should be a exact match */
	SearchDomain,
	/** Matches domain and path */
	SearchDomainAndPath,
	/** Matches domain and its subdomains */
	SearchDomainSubdomain,
	/** Matches domain and its subdomains including path in the end of each */
	SearchDomainSubdomainAndPath,
}

export class SubscriptionProxyRule {
	public name: string;
	public regex?: string;
	public search?: string;
	public importedRuleType?: ProxyRulesSubscriptionRuleType;
}

export class ProxyRulesSubscription {
	constructor() {
		this.id = Utils.getNewUniqueIdString();
	}
	public id: string;
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
	public proxyRules: SubscriptionProxyRule[];
	public whitelistRules: SubscriptionProxyRule[];

	public applyProxy: SpecialRequestApplyProxyMode;

	public stats: SubscriptionStats;

	CopyFrom(source: any) {
		if (source['name'] != null) this.name = source['name'] || '';
		if (source['url'] != null) this.url = source['url'] || '';
		if (source['enabled'] != null) this.enabled = source['enabled'] == true ? true : false;

		this.refreshRate = +source['failoverTimeout'] > 0 ? +source['failoverTimeout'] : 0;
		if (source['obfuscation'] != null) this.obfuscation = source['obfuscation'] || null;
		this.format = ProxyRulesSubscriptionFormat.AutoProxy;
		if (source['format'] != null)
			if (+source['format'] in ProxyServerSubscriptionFormat) {
				this.format = +source['format'];
			}
		this.totalCount = +source['totalCount'];
		if (source['username'] != null) this.username = source['username'] || '';
		if (source['password'] != null) this.password = source['password'] || '';

		this.applyProxy = SpecialRequestApplyProxyMode.CurrentProxy;
		if (source['applyProxy'] != null)
			if (+source['applyProxy'] in SpecialRequestApplyProxyMode) {
				this.applyProxy = +source['applyProxy'];
			}
		this.proxyRules = [];
		this.whitelistRules = [];
		if (source['proxyRules'] != null && Array.isArray(source['proxyRules'])) this.proxyRules = source['proxyRules'];
		if (source['whitelistRules'] != null && Array.isArray(source['whitelistRules']))
			this.whitelistRules = source['whitelistRules'];
		this.stats = new SubscriptionStats();
		if (source.stats) {
			Object.assign(this.stats, source.stats);
		}
	}

	public isValid(): boolean {
		if (!this.name || !this.url)
			return false;

		return true;
	}
}
