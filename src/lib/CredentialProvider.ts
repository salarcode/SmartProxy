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
/**
 * Obtains a proxy password from a "credential provider": a web page, chosen by the user,
 * that authenticates them (typically through the organisation's single sign-on) and hands
 * back a short-lived proxy password.
 *
 * Protocol
 * --------
 * 1. The extension opens a foreground tab at the provider URL with the query parameter
 *    `smartproxy=credential` appended.
 * 2. The provider authenticates the user however it likes (redirects to an identity
 *    provider are fine, the tab is followed across navigations).
 * 3. When done, the provider navigates the tab to any URL on its *own origin* whose
 *    fragment carries the credential, encoded as query parameters:
 *
 *        https://provider.example/anything#username=alice&password=s3cret&expires=1789470000
 *
 *    `password` is required; `username` and `expires` (Unix seconds) are optional.
 * 4. The extension reads the credential from the tab's navigation, closes the tab and
 *    saves it to the proxy server (core/CredentialProviderBackground.ts runs the flow). The fragment is never sent over the network, and the
 *    extension never requests the provider with cookies or credentials itself.
 *
 * Providers should strip the fragment with `history.replaceState` once their page loads,
 * so the password does not linger in the browser history.
 */
export class CredentialProvider {
	/** Query parameter appended to the provider URL to signal a credential request. */
	public static readonly requestParameterName = "smartproxy";
	public static readonly requestParameterValue = "credential";

	/** Fragment parameter names the provider uses to return the credential. */
	public static readonly passwordParameterName = "password";
	public static readonly usernameParameterName = "username";
	public static readonly expiresParameterName = "expires";

	/** How long to wait for the user to complete the sign-in before giving up. */
	public static readonly defaultTimeoutMs = 5 * 60 * 1000;

	/**
	 * Validates and normalizes a provider URL. Only absolute http(s) URLs are accepted;
	 * any fragment is dropped because the fragment is reserved for the response.
	 * @throws CredentialProviderError with code `InvalidUrl`
	 */
	public static normalizeUrl(providerUrl: string): string {
		const trimmed = (providerUrl ?? "").trim();
		let url: URL;
		try {
			url = new URL(trimmed);
		} catch {
			throw new CredentialProviderError(CredentialProviderErrorCode.InvalidUrl);
		}
		if (url.protocol !== "https:" && url.protocol !== "http:")
			throw new CredentialProviderError(CredentialProviderErrorCode.InvalidUrl);
		url.hash = "";
		return url.toString();
	}

	public static isValidUrl(providerUrl: string): boolean {
		try {
			CredentialProvider.normalizeUrl(providerUrl);
			return true;
		} catch {
			return false;
		}
	}

	/** The URL opened in the tab: the provider URL plus the request marker. */
	public static buildRequestUrl(providerUrl: string): string {
		const url = new URL(CredentialProvider.normalizeUrl(providerUrl));
		url.searchParams.set(CredentialProvider.requestParameterName, CredentialProvider.requestParameterValue);
		return url.toString();
	}

	/**
	 * Extracts a credential from a URL the provider tab navigated to.
	 * Returns null when the URL is not a completion (wrong origin, no fragment, no password).
	 */
	public static parseCompletionUrl(candidateUrl: string, providerUrl: string): ProviderCredential | null {
		let candidate: URL;
		let provider: URL;
		try {
			candidate = new URL(candidateUrl);
			provider = new URL(CredentialProvider.normalizeUrl(providerUrl));
		} catch {
			return null;
		}
		if (candidate.origin !== provider.origin)
			return null;

		const fragment = candidate.hash.startsWith("#") ? candidate.hash.substring(1) : candidate.hash;
		if (!fragment)
			return null;

		const params = new URLSearchParams(fragment);
		const password = params.get(CredentialProvider.passwordParameterName);
		if (!password)
			return null;

		const credential: ProviderCredential = { password };

		const username = params.get(CredentialProvider.usernameParameterName);
		if (username)
			credential.username = username;

		const expires = params.get(CredentialProvider.expiresParameterName);
		if (expires && /^\d+$/.test(expires))
			credential.expiresAt = Number(expires);

		return credential;
	}
}

export interface CredentialValidity {
	expired: boolean;
	/** Short duration such as "2d 3h", "7h 12m" or "5m"; "<1m" in the last minute. Empty once expired. */
	remaining: string;
}

/**
 * Describes how long a provider-issued password remains valid.
 * @param expiresAt Unix time in seconds, as returned by the provider
 * @param nowMs current time in milliseconds (injectable for tests)
 * @returns null when the expiry is unknown
 */
export function describeCredentialValidity(expiresAt: number | null | undefined, nowMs: number = Date.now()): CredentialValidity | null {
	if (!expiresAt || !(expiresAt > 0))
		return null;
	const secondsLeft = Math.floor(expiresAt - nowMs / 1000);
	if (secondsLeft <= 0)
		return { expired: true, remaining: "" };

	const minutes = Math.floor(secondsLeft / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	let remaining: string;
	if (days > 0)
		remaining = hours % 24 ? `${days}d ${hours % 24}h` : `${days}d`;
	else if (hours > 0)
		remaining = minutes % 60 ? `${hours}h ${minutes % 60}m` : `${hours}h`;
	else if (minutes > 0)
		remaining = `${minutes}m`;
	else
		remaining = "<1m";
	return { expired: false, remaining };
}

export interface ProviderCredential {
	username?: string;
	password: string;
	/** Unix time (seconds) after which the provider considers the password expired. */
	expiresAt?: number;
}

export enum CredentialProviderErrorCode {
	InvalidUrl = "InvalidUrl",
	OpenFailed = "OpenFailed",
	TabClosed = "TabClosed",
	Timeout = "Timeout",
}

export class CredentialProviderError extends Error {
	public readonly code: CredentialProviderErrorCode;

	constructor(code: CredentialProviderErrorCode, message?: string) {
		super(message ?? code);
		this.name = "CredentialProviderError";
		this.code = code;
	}
}
