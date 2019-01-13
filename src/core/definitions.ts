import { ProxyServer, SettingsConfig } from "./Settings";

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
export const proxyServerProtocols = ["HTTP", "HTTPS", "SOCKS4", "SOCKS5"];
export const proxyServerSubscriptionObfuscate = ["None", "Base64"];

export enum ProxyModeType {
	Direct,
	SmartProxy,
	Always,
	SystemProxy
}

export enum ProxyRuleType {
	MatchPattern,
	Regex,
	Exact
}

export enum ProxyServerForProtocol {
	Http,
	SSL,
	FTP,
	SOCKS
}
export class Messages {
	public static PacProxySendRules = "PacSendRules";

	// Popup messages
	public static PopupGetInitialData = "Popup_GetInitialData";
	public static PopupChangeProxyMode = "Popup_ChangeProxyMode";
	public static PopupChangeActiveProxyServer = "Popup_ChangeActiveProxyServer";
	public static PopupToggleProxyForHost = "Popup_ToggleProxyForHost";
	public static PopupAddDomainListToProxyRule = "Popup_AddDomainListToProxyRule";

	// Settings page
	public static SettingsPageGetInitialData = "SettingsPage_GetInitialData";
	public static SettingsPageSaveOptions = "SettingsPage_SaveOptions";
	public static SettingsPageSaveProxyServers = "SettingsPage_SaveProxyServers";

	// Web Failed Request Monitor Activity
	public static WebRequestMonitorFailedActivity = "WebRequestMonitor_FailedActivity";

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

export type PopupInternalDataType = {
	proxyableDomains: any[],
	proxyMode: ProxyModeType,
	hasProxyServers: boolean,
	proxyServers: ProxyServer[],
	activeProxyServer: ProxyServer,
	restartRequired: boolean,
	currentTabId: number,
	currentTabIndex: number,
	proxyServersSubscribed: any[],
	updateAvailableText: string,
	updateInfo: any,
	failedRequests: any
}

export type SettingsPageInternalDataType = {
	settings: SettingsConfig,
	updateAvailableText: string,
	updateInfo: any;
}