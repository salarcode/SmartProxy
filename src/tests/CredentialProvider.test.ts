type Listener = (...args: any[]) => void;

function makeEvent() {
	const listeners = new Set<Listener>();
	return {
		addListener: jest.fn((l: Listener) => listeners.add(l)),
		removeListener: jest.fn((l: Listener) => listeners.delete(l)),
		hasListeners: () => listeners.size > 0,
		emit: (...args: any[]) => listeners.forEach(l => l(...args)),
	};
}

const tabs = {
	onUpdated: makeEvent(),
	onRemoved: makeEvent(),
	create: jest.fn(),
	remove: jest.fn(),
};

jest.mock('../lib/environment', () => ({
	environment: {
		chrome: true,
		name: 'chrome',
		version: 1,
		manifestV3: true,
		notSupported: {},
		notAllowed: {},
		bugFreeVersions: {},
		initialConfig: {},
		storageQuota: { syncQuotaBytesPerItem: () => 8000 },
		browserConfig: {}
	},
	api: {
		runtime: { lastError: null },
		i18n: { getMessage: (key: string) => key },
		tabs: tabs
	}
}));

import { CredentialProvider, CredentialProviderError, CredentialProviderErrorCode, describeCredentialValidity } from '../lib/CredentialProvider';

const provider = 'https://provider.example/proxy-access';

describe('CredentialProvider URL handling', () => {
	it('normalizes valid http(s) URLs and drops any fragment', () => {
		expect(CredentialProvider.normalizeUrl('  https://provider.example/issue#x ')).toBe('https://provider.example/issue');
		expect(CredentialProvider.normalizeUrl('http://localhost:4180')).toBe('http://localhost:4180/');
	});

	it('rejects relative, empty and non-http URLs', () => {
		for (const bad of ['', '   ', 'provider.example', 'ftp://provider.example', 'javascript:alert(1)', 'file:///etc/passwd']) {
			expect(CredentialProvider.isValidUrl(bad)).toBe(false);
			expect(() => CredentialProvider.normalizeUrl(bad)).toThrow(CredentialProviderError);
			try { CredentialProvider.normalizeUrl(bad); } catch (e: any) { expect(e.code).toBe(CredentialProviderErrorCode.InvalidUrl); }
		}
	});

	it('appends the request marker, keeping existing query parameters', () => {
		expect(CredentialProvider.buildRequestUrl(provider)).toBe('https://provider.example/proxy-access?smartproxy=credential');
		expect(CredentialProvider.buildRequestUrl('https://provider.example/issue?tenant=a')).toBe('https://provider.example/issue?tenant=a&smartproxy=credential');
	});
});

describe('CredentialProvider completion parsing', () => {
	it('reads username, password and expiry from the fragment', () => {
		const credential = CredentialProvider.parseCompletionUrl(
			'https://provider.example/done#username=alice&password=s3cr%26t&expires=1789470000', provider);
		expect(credential).toEqual({ username: 'alice', password: 's3cr&t', expiresAt: 1789470000 });
	});

	it('accepts a password alone and ignores a malformed expiry', () => {
		expect(CredentialProvider.parseCompletionUrl('https://provider.example/#password=pw&expires=soon', provider))
			.toEqual({ password: 'pw' });
	});

	it('ignores URLs from another origin, without a fragment, or without a password', () => {
		expect(CredentialProvider.parseCompletionUrl('https://evil.example/done#password=pw', provider)).toBeNull();
		expect(CredentialProvider.parseCompletionUrl('http://provider.example/done#password=pw', provider)).toBeNull();
		expect(CredentialProvider.parseCompletionUrl('https://provider.example/done?password=pw', provider)).toBeNull();
		expect(CredentialProvider.parseCompletionUrl('https://provider.example/done#username=alice', provider)).toBeNull();
		expect(CredentialProvider.parseCompletionUrl('not a url', provider)).toBeNull();
	});
});

describe('CredentialProvider.requestCredential', () => {
	beforeEach(() => {
		jest.useFakeTimers();
		tabs.create.mockReset();
		tabs.remove.mockReset();
		tabs.create.mockImplementation((props: any, callback: Function) => callback({ id: 42, url: props.url }));
		tabs.remove.mockImplementation((tabId: number, callback?: Function) => callback && callback());
	});
	afterEach(() => {
		jest.useRealTimers();
		expect(tabs.onUpdated.hasListeners()).toBe(false);
		expect(tabs.onRemoved.hasListeners()).toBe(false);
	});

	it('opens the provider in a foreground tab and resolves once it navigates to a completion URL', async () => {
		const pending = CredentialProvider.requestCredential(provider);
		expect(tabs.create).toHaveBeenCalledWith(
			expect.objectContaining({ url: 'https://provider.example/proxy-access?smartproxy=credential', active: true }),
			expect.any(Function));

		tabs.onUpdated.emit(42, { url: 'https://provider.example/proxy-access?smartproxy=credential' });   // provider page
		tabs.onUpdated.emit(42, { url: 'https://accounts.idp.example/signin' });                            // redirect to IdP
		tabs.onUpdated.emit(7, { url: 'https://provider.example/done#password=other-tab' });                // another tab
		tabs.onUpdated.emit(42, { status: 'loading' });                                                     // no url change
		tabs.onUpdated.emit(42, { url: 'https://provider.example/done#username=alice&password=pw&expires=1' });

		await expect(pending).resolves.toEqual({ username: 'alice', password: 'pw', expiresAt: 1 });
		expect(tabs.remove).toHaveBeenCalledWith(42, expect.any(Function));
	});

	it('rejects when the user closes the sign-in tab', async () => {
		const pending = CredentialProvider.requestCredential(provider);
		tabs.onRemoved.emit(42);
		await expect(pending).rejects.toMatchObject({ code: CredentialProviderErrorCode.TabClosed });
		expect(tabs.remove).not.toHaveBeenCalled();
	});

	it('rejects and closes the tab when the sign-in does not complete in time', async () => {
		const pending = CredentialProvider.requestCredential(provider, 1000);
		jest.advanceTimersByTime(1000);
		await expect(pending).rejects.toMatchObject({ code: CredentialProviderErrorCode.Timeout });
		expect(tabs.remove).toHaveBeenCalledWith(42, expect.any(Function));
	});

	it('rejects when the tab cannot be opened', async () => {
		const runtime = require('../lib/environment').api.runtime;
		tabs.create.mockImplementation((props: any, callback: Function) => { runtime.lastError = { message: 'no windows' }; callback(undefined); runtime.lastError = null; });
		await expect(CredentialProvider.requestCredential(provider)).rejects.toMatchObject({ code: CredentialProviderErrorCode.OpenFailed });
	});

	it('rejects synchronously-invalid URLs without opening a tab', async () => {
		expect(() => CredentialProvider.requestCredential('ftp://x')).toThrow(CredentialProviderError);
		expect(tabs.create).not.toHaveBeenCalled();
	});
});


describe('describeCredentialValidity', () => {
	const now = 1_800_000_000_000; // ms
	const at = (seconds: number) => now / 1000 + seconds;

	it('returns null when the expiry is unknown', () => {
		expect(describeCredentialValidity(null, now)).toBeNull();
		expect(describeCredentialValidity(undefined, now)).toBeNull();
		expect(describeCredentialValidity(0, now)).toBeNull();
	});

	it('reports expired passwords', () => {
		expect(describeCredentialValidity(at(0), now)).toEqual({ expired: true, remaining: '' });
		expect(describeCredentialValidity(at(-3600), now)).toEqual({ expired: true, remaining: '' });
	});

	it('formats the remaining time compactly', () => {
		expect(describeCredentialValidity(at(30), now)).toEqual({ expired: false, remaining: '<1m' });
		expect(describeCredentialValidity(at(5 * 60 + 59), now)!.remaining).toBe('5m');
		expect(describeCredentialValidity(at(3600), now)!.remaining).toBe('1h');
		expect(describeCredentialValidity(at(7 * 3600 + 12 * 60), now)!.remaining).toBe('7h 12m');
		expect(describeCredentialValidity(at(2 * 86400), now)!.remaining).toBe('2d');
		expect(describeCredentialValidity(at(2 * 86400 + 3 * 3600 + 59 * 60), now)!.remaining).toBe('2d 3h');
	});
});
