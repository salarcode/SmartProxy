/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2026 Salar Khalilzadeh <salar2k@gmail.com>
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
import { api } from "../lib/environment";
import { PolyFill } from "../lib/PolyFill";
import { Debug } from "../lib/Debug";
import { CredentialProvider, CredentialProviderError, CredentialProviderErrorCode, ProviderCredential } from "../lib/CredentialProvider";
import { CommandMessages } from "./definitions";
import { Settings } from "./Settings";
import { SettingsOperation } from "./SettingsOperation";
import { TabDataType, TabManager } from "./TabManager";

interface PendingCredentialRequest {
	tabId: number;
	providerUrl: string;
	/** Unix time in milliseconds */
	startedAt: number;
	/** Saved proxy server that receives the password (refresh from the popup). */
	proxyServerId?: string;
	/** Settings page request that receives the password (the server may not be saved yet). */
	requestId?: string;
}

/**
 * Runs credential provider sign-ins (see lib/CredentialProvider.ts) for the popup and the settings page.
 *
 * It registers no browser listeners of its own: while a sign-in is pending it follows the provider tab
 * through TabManager's tab events, and it unsubscribes as soon as no sign-in is pending.
 *
 * The sign-in can take longer than a Manifest V3 service worker stays alive, so pending requests are
 * kept in `storage.session` (memory where unavailable). When the background starts again it re-checks
 * those tabs directly, so a completion that happened while the worker was asleep is still picked up.
 */
export class CredentialProviderBackground {
	private static readonly storageKey = "credentialProviderPendingRequests";
	private static pending: { [tabId: string]: PendingCredentialRequest } = {};
	private static pendingLoaded = false;
	private static subscribed = false;

	/** Resumes sign-ins that were pending when the background stopped. */
	public static initialize() {
		CredentialProviderBackground.resumePending()
			.catch(error => Debug.warn("CredentialProviderBackground: could not resume pending requests", error));
	}

	/** Refresh started from the popup: the password is saved to the proxy server and a notification is shown. */
	public static requestForServer(proxyServerId: string): Promise<void> {
		const server = CredentialProviderBackground.findOwnProxyServer(proxyServerId);
		if (!server || !server.credentialProviderUrl)
			return Promise.reject(new CredentialProviderError(CredentialProviderErrorCode.InvalidUrl));
		return CredentialProviderBackground.start(server.credentialProviderUrl, { proxyServerId: server.id });
	}

	/** Refresh started from the server dialog: the result is sent back to the settings page. */
	public static requestForSettingsPage(providerUrl: string, requestId: string): Promise<void> {
		return CredentialProviderBackground.start(providerUrl, { requestId });
	}

	/** Reports a request that could not be started to whoever asked for it. */
	public static reportStartFailure(target: { proxyServerId?: string, requestId?: string }, error: any) {
		const code = error instanceof CredentialProviderError ? error.code : CredentialProviderErrorCode.OpenFailed;
		CredentialProviderBackground.reportFailure({ tabId: -1, providerUrl: "", startedAt: 0, ...target }, code);
	}

	/** Exposed for tests. */
	public static onTabUpdated(tabData: TabDataType) {
		const request = CredentialProviderBackground.pending[String(tabData?.tabId)];
		if (!request)
			return;
		CredentialProviderBackground.checkTabUrl(request, tabData.url);
	}

	/** Exposed for tests. */
	public static onTabRemoved(tabData: TabDataType) {
		const request = CredentialProviderBackground.pending[String(tabData?.tabId)];
		if (!request)
			return;
		CredentialProviderBackground.finish(request, null, CredentialProviderErrorCode.TabClosed);
	}

	// ---------------------------------------------------------------- flow

	private static async start(providerUrl: string, target: { proxyServerId?: string, requestId?: string }): Promise<void> {
		const requestUrl = CredentialProvider.buildRequestUrl(providerUrl); // throws on an invalid URL
		await CredentialProviderBackground.loadPending();

		// Open a blank tab first and record it before navigating, so a provider that completes
		// immediately (user already signed in) cannot finish before the request is known.
		const tab = await CredentialProviderBackground.createTab({ url: "about:blank", active: true });
		const request: PendingCredentialRequest = { tabId: tab.id, providerUrl, startedAt: Date.now(), ...target };
		CredentialProviderBackground.pending[String(tab.id)] = request;
		await CredentialProviderBackground.persistPending();
		CredentialProviderBackground.updateSubscription();

		// best effort while the background stays alive; otherwise the next tab event or restart expires it
		setTimeout(() => CredentialProviderBackground.expireIfPending(request), CredentialProvider.defaultTimeoutMs);

		try {
			await CredentialProviderBackground.updateTab(tab.id, { url: requestUrl });
		} catch {
			CredentialProviderBackground.finish(request, null, CredentialProviderErrorCode.OpenFailed);
		}
	}

	private static async resumePending(): Promise<void> {
		await CredentialProviderBackground.loadPending();
		CredentialProviderBackground.updateSubscription();
		for (const request of Object.values(CredentialProviderBackground.pending)) {
			PolyFill.tabsGet(request.tabId,
				(tab: any) => CredentialProviderBackground.checkTabUrl(request, tab?.url),
				() => CredentialProviderBackground.finish(request, null, CredentialProviderErrorCode.TabClosed));
		}
	}

	private static checkTabUrl(request: PendingCredentialRequest, url: string) {
		if (CredentialProviderBackground.expireIfPending(request) || !url)
			return;
		const credential = CredentialProvider.parseCompletionUrl(url, request.providerUrl);
		if (credential !== null)
			CredentialProviderBackground.finish(request, credential, null);
	}

	/** @returns true when the request had timed out */
	private static expireIfPending(request: PendingCredentialRequest): boolean {
		if (Date.now() - request.startedAt < CredentialProvider.defaultTimeoutMs)
			return false;
		if (CredentialProviderBackground.pending[String(request.tabId)] === request)
			CredentialProviderBackground.finish(request, null, CredentialProviderErrorCode.Timeout);
		return true;
	}

	private static finish(request: PendingCredentialRequest, credential: ProviderCredential, errorCode: CredentialProviderErrorCode) {
		const key = String(request.tabId);
		if (CredentialProviderBackground.pending[key] !== request)
			return; // already finished
		delete CredentialProviderBackground.pending[key];
		CredentialProviderBackground.persistPending();
		CredentialProviderBackground.updateSubscription();

		if (!credential) {
			CredentialProviderBackground.reportFailure(request, errorCode);
			return;
		}
		// close the tab so the fragment leaves the address bar; it may already be gone
		PolyFill.tabsRemove(request.tabId, null, () => { });

		if (request.requestId) {
			CredentialProviderBackground.sendToSettingsPage({ requestId: request.requestId, credential });
			return;
		}
		CredentialProviderBackground.whenSettingsReady()
			.then(() => CredentialProviderBackground.applyCredential(request, credential));
	}

	private static reportFailure(request: PendingCredentialRequest, errorCode: CredentialProviderErrorCode) {
		if (request.requestId) {
			CredentialProviderBackground.sendToSettingsPage({ requestId: request.requestId, errorCode });
			return;
		}
		const server = CredentialProviderBackground.findOwnProxyServer(request.proxyServerId);
		CredentialProviderBackground.notify(api.i18n.getMessage("notificationCredentialProviderFailed").replace("{0}", server?.name ?? "")
			+ " " + api.i18n.getMessage(CredentialProviderBackground.errorMessageKey(errorCode)));
	}

	public static errorMessageKey(errorCode: CredentialProviderErrorCode): string {
		switch (errorCode) {
			case CredentialProviderErrorCode.InvalidUrl: return "settingsServerCredentialProviderUrlInvalid";
			case CredentialProviderErrorCode.OpenFailed: return "settingsServersCredentialProviderErrorOpenFailed";
			case CredentialProviderErrorCode.TabClosed: return "settingsServersCredentialProviderErrorTabClosed";
			case CredentialProviderErrorCode.Timeout: return "settingsServersCredentialProviderErrorTimeout";
			default: return "settingsServersCredentialProviderErrorUnknown";
		}
	}

	private static applyCredential(request: PendingCredentialRequest, credential: ProviderCredential) {
		const server = CredentialProviderBackground.findOwnProxyServer(request.proxyServerId);
		if (!server) {
			Debug.warn("CredentialProviderBackground: proxy server no longer exists", request.proxyServerId);
			return;
		}

		server.password = credential.password;
		server.credentialExpiresAt = credential.expiresAt ?? null;
		if (credential.username && !server.username)
			server.username = credential.username;

		SettingsOperation.saveProxyServers();
		SettingsOperation.updateSmartProfilesRulesProxyServer();
		SettingsOperation.saveAllSync();
		Settings.updateActiveSettings();

		let message = api.i18n.getMessage("notificationCredentialProviderSuccess").replace("{0}", server.name);
		if (credential.expiresAt)
			message += " " + api.i18n.getMessage("settingsServersCredentialProviderSuccessExpires")
				.replace("{0}", new Date(credential.expiresAt * 1000).toLocaleString());
		CredentialProviderBackground.notify(message);
	}

	/** Only the user's own servers: subscription servers are replaced on every refresh. */
	private static findOwnProxyServer(proxyServerId: string) {
		return Settings.current?.proxyServers?.find(server => server.id === proxyServerId) ?? null;
	}

	private static sendToSettingsPage(result: { requestId: string, credential?: ProviderCredential, errorCode?: CredentialProviderErrorCode }) {
		// the settings page may have been closed meanwhile: nobody to tell then
		PolyFill.runtimeSendMessage({ command: CommandMessages.SettingsPageProviderCredentialResult, ...result }, null, () => { });
	}

	private static notify(message: string) {
		PolyFill.browserNotificationsCreate("credential-provider", {
			type: "basic",
			iconUrl: PolyFill.extensionGetURL("icons/smartproxy-48.png"),
			title: api.i18n.getMessage("extensionName"),
			message: message,
		}, null, (error: any) => Debug.warn("CredentialProviderBackground: notification failed", error));
	}

	private static whenSettingsReady(): Promise<void> {
		if (Settings.active)
			return Promise.resolve();
		return new Promise<void>(resolve => Settings.addInitializeCompletedEventListener(() => resolve()));
	}

	/** Follows TabManager's tab events only while a sign-in is pending. */
	private static updateSubscription() {
		const needed = Object.keys(CredentialProviderBackground.pending).length > 0;
		if (needed === CredentialProviderBackground.subscribed)
			return;
		CredentialProviderBackground.subscribed = needed;
		if (needed) {
			TabManager.TabUpdated.on(CredentialProviderBackground.onTabUpdated);
			TabManager.TabRemoved.on(CredentialProviderBackground.onTabRemoved);
		} else {
			TabManager.TabUpdated.off(CredentialProviderBackground.onTabUpdated);
			TabManager.TabRemoved.off(CredentialProviderBackground.onTabRemoved);
		}
	}

	// ---------------------------------------------------------------- pending request store

	private static sessionStorage(): any {
		return api.storage?.session ?? null;
	}

	private static async loadPending(): Promise<void> {
		if (CredentialProviderBackground.pendingLoaded)
			return;
		CredentialProviderBackground.pendingLoaded = true;
		const storage = CredentialProviderBackground.sessionStorage();
		if (!storage)
			return;
		try {
			const data = await storage.get(CredentialProviderBackground.storageKey);
			const stored = data?.[CredentialProviderBackground.storageKey] ?? {};
			CredentialProviderBackground.pending = { ...stored, ...CredentialProviderBackground.pending };
		} catch (error) {
			Debug.warn("CredentialProviderBackground: could not read pending requests", error);
		}
	}

	private static async persistPending(): Promise<void> {
		const storage = CredentialProviderBackground.sessionStorage();
		if (!storage)
			return;
		try {
			await storage.set({ [CredentialProviderBackground.storageKey]: CredentialProviderBackground.pending });
		} catch (error) {
			Debug.warn("CredentialProviderBackground: could not save pending requests", error);
		}
	}

	/** Exposed for tests: forget the in-memory state, as a service worker restart would. */
	public static resetForTests() {
		CredentialProviderBackground.pending = {};
		CredentialProviderBackground.pendingLoaded = false;
		CredentialProviderBackground.updateSubscription();
	}

	private static createTab(properties: any): Promise<{ id: number }> {
		return new Promise((resolve, reject) => PolyFill.tabsCreate(properties, resolve,
			(error: any) => reject(new CredentialProviderError(CredentialProviderErrorCode.OpenFailed, error?.message))));
	}

	private static updateTab(tabId: number, properties: any): Promise<void> {
		return new Promise((resolve, reject) => PolyFill.tabsUpdate(tabId, properties, () => resolve(),
			(error: any) => reject(new CredentialProviderError(CredentialProviderErrorCode.OpenFailed, error?.message))));
	}
}
