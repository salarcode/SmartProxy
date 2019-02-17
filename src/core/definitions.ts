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
import { ProxyServer, SettingsConfig } from "./Settings";
export const proxyServerProtocols = ["HTTP", "HTTPS", "SOCKS4", "SOCKS5"];
export const proxyServerSubscriptionObfuscate = ["None", "Base64"];

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
	public static PacScriptGetInitialData = "PacScript_GetInitialData";

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
	public static SettingsPageSaveBypass = "SettingsPage_SaveBypass";
	public static SettingsPageRestoreSettings = "SettingsPage_RestoreSettings";

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
}

export class FailedRequestType {
	hasRule: boolean;
	url: string;
	domain: string;
	hitCount: number;
	ruleIsForThisHost: boolean;
	isRootHost: boolean;
	ignored: boolean;
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

export class ProxyableDataType {
	public url: string;
	public enabled: boolean;
	public sourceDomain: string;
	public rule: string;
}
