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
import { Settings } from "./Settings";
import { SettingsOperation } from "./SettingsOperation";

interface PendingCredentialRequest {
	tabId: number;
	proxyServerId: string;
	providerUrl: string;
	/** Unix time in milliseconds */
	startedAt: number;
}

/**
 * Runs the credential provider sign-in from the background, for requests started outside the
 * settings page (the toolbar popup closes as soon as the sign-in tab takes focus).
 *
 * The sign-in can take longer than a Manifest V3 service worker stays alive, so the pending request
 * is kept in `storage.session` (memory where unavailable) and the tab listeners are registered when
 * the background starts. A completion that arrives after the worker was restarted is still handled.
 * The issued password is saved to the proxy server and the user is told with a notification.
 */
export class CredentialProviderBackground {
	private static readonly storageKey = "credentialProviderPendingRequests";
	private static pending: { [tabId: string]: PendingCredentialRequest } = {};
	private static pendingLoaded = false;

	/** Must run synchronously when the background starts, so events wake the worker after a restart. */
	public static startMonitor() {
		api.tabs.onUpdated.addListener(CredentialProviderBackground.onTabUpdated);
		api.tabs.onRemoved.addListener(CredentialProviderBackground.onTabRemoved);
	}

	/**
	 * Opens the provider of a saved proxy server in a new tab. Resolves once the tab is open; the
	 * outcome is reported with a notification.
	 */
	public static async requestForServer(proxyServerId: string): Promise<void> {
		const server = CredentialProviderBackground.findOwnProxyServer(proxyServerId);
		if (!server || !server.credentialProviderUrl)
			throw new CredentialProviderError(CredentialProviderErrorCode.InvalidUrl);

		const requestUrl = CredentialProvider.buildRequestUrl(server.credentialProviderUrl);

		// Open a blank tab first and record it before navigating, so a provider that completes
		// immediately (user already signed in) cannot finish before the request is known.
		const tab = await CredentialProviderBackground.createTab({ url: "about:blank", active: true });
		await CredentialProviderBackground.savePending({
			tabId: tab.id,
			proxyServerId: server.id,
			providerUrl: server.credentialProviderUrl,
			startedAt: Date.now(),
		});
		await CredentialProviderBackground.updateTab(tab.id, { url: requestUrl });
	}

	/** Exposed for tests. */
	public static async onTabUpdated(tabId: number, changeInfo: { url?: string }): Promise<void> {
		if (!changeInfo || !changeInfo.url)
			return;
		const request = await CredentialProviderBackground.getPending(tabId);
		if (!request)
			return;

		if (Date.now() - request.startedAt > CredentialProvider.defaultTimeoutMs) {
			await CredentialProviderBackground.removePending(tabId);
			CredentialProviderBackground.notifyFailure(request, CredentialProviderErrorCode.Timeout);
			return;
		}

		const credential = CredentialProvider.parseCompletionUrl(changeInfo.url, request.providerUrl);
		if (credential === null)
			return;

		await CredentialProviderBackground.removePending(tabId);
		PolyFill.tabsRemove(tabId, null, () => { });

		await CredentialProviderBackground.whenSettingsReady();
		CredentialProviderBackground.applyCredential(request, credential);
	}

	/** Exposed for tests. */
	public static async onTabRemoved(tabId: number): Promise<void> {
		const request = await CredentialProviderBackground.getPending(tabId);
		if (!request)
			return;
		await CredentialProviderBackground.removePending(tabId);
		CredentialProviderBackground.notifyFailure(request, CredentialProviderErrorCode.TabClosed);
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

	private static notifyFailure(request: PendingCredentialRequest, code: CredentialProviderErrorCode) {
		const server = CredentialProviderBackground.findOwnProxyServer(request.proxyServerId);
		const reasonKey = code === CredentialProviderErrorCode.TabClosed
			? "settingsServersCredentialProviderErrorTabClosed"
			: "settingsServersCredentialProviderErrorTimeout";
		CredentialProviderBackground.notifyError(server?.name ?? "", api.i18n.getMessage(reasonKey));
	}

	public static notifyError(serverName: string, reason: string) {
		CredentialProviderBackground.notify(api.i18n.getMessage("notificationCredentialProviderFailed")
			.replace("{0}", serverName) + " " + reason);
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

	private static async getPending(tabId: number): Promise<PendingCredentialRequest | null> {
		await CredentialProviderBackground.loadPending();
		return CredentialProviderBackground.pending[String(tabId)] ?? null;
	}

	private static async savePending(request: PendingCredentialRequest): Promise<void> {
		await CredentialProviderBackground.loadPending();
		CredentialProviderBackground.pending[String(request.tabId)] = request;
		await CredentialProviderBackground.persistPending();
	}

	private static async removePending(tabId: number): Promise<void> {
		await CredentialProviderBackground.loadPending();
		delete CredentialProviderBackground.pending[String(tabId)];
		await CredentialProviderBackground.persistPending();
	}

	/** Exposed for tests: forget the in-memory state, as a service worker restart would. */
	public static resetForTests() {
		CredentialProviderBackground.pending = {};
		CredentialProviderBackground.pendingLoaded = false;
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
