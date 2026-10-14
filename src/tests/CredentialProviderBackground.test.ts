const sessionData: any = {};
const mockApi = {
	runtime: { lastError: null as any, getURL: (p: string) => 'chrome-extension://id/' + p, sendMessage: jest.fn() },
	extension: { getURL: (p: string) => 'chrome-extension://id/' + p },
	i18n: { getMessage: (key: string) => key + '{0}' },
	tabs: {
		create: jest.fn(),
		update: jest.fn(),
		remove: jest.fn(),
		get: jest.fn(),
	},
	notifications: { create: jest.fn() },
	storage: {
		session: {
			get: jest.fn(async (key: string) => (key in sessionData ? { [key]: JSON.parse(JSON.stringify(sessionData[key])) } : {})),
			set: jest.fn(async (items: any) => { Object.assign(sessionData, JSON.parse(JSON.stringify(items))); }),
		},
	},
};

jest.mock('../lib/environment', () => ({
	environment: {
		chrome: true, name: 'chrome', version: 1, manifestV3: true,
		notSupported: {}, notAllowed: {}, bugFreeVersions: {}, initialConfig: {},
		storageQuota: { syncQuotaBytesPerItem: () => 8000 }, browserConfig: {}
	},
	api: mockApi,
}));

// TabManager owns the browser's tab listeners; the feature only subscribes to its events.
function makeLiteEvent() {
	const handlers = new Set<Function>();
	return {
		on: jest.fn((h: Function) => handlers.add(h)),
		off: jest.fn((h: Function) => handlers.delete(h)),
		count: () => handlers.size,
		trigger: (data: any) => [...handlers].forEach(h => h(data)),
	};
}
const mockTabUpdated = makeLiteEvent();
const mockTabRemoved = makeLiteEvent();
jest.mock('../core/TabManager', () => ({
	TabManager: { TabUpdated: mockTabUpdated, TabRemoved: mockTabRemoved },
}));

const server = { id: 'srv1', name: 'Office proxy', host: 'proxy.example', port: 443, protocol: 'HTTPS', username: '', password: 'old', credentialProviderUrl: 'https://provider.example/issue' };
const mockSettings = { current: { proxyServers: [server] as any[] }, active: {}, updateActiveSettings: jest.fn(), addInitializeCompletedEventListener: jest.fn() };
const mockOperations = { saveProxyServers: jest.fn(), updateSmartProfilesRulesProxyServer: jest.fn(), saveAllSync: jest.fn() };
jest.mock('../core/Settings', () => ({ Settings: mockSettings }));
jest.mock('../core/SettingsOperation', () => ({ SettingsOperation: mockOperations }));

import { CredentialProviderBackground } from '../core/CredentialProviderBackground';
import { CredentialProvider } from '../lib/CredentialProvider';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
const tabEvent = (tabId: number, url: string) => mockTabUpdated.trigger({ tabId, url });
const notified = (text: string) => expect(mockApi.notifications.create).toHaveBeenCalledWith('credential-provider',
	expect.objectContaining({ message: expect.stringContaining(text) }), expect.any(Function));

describe('CredentialProviderBackground', () => {
	beforeEach(() => {
		for (const key of Object.keys(sessionData)) delete sessionData[key];
		CredentialProviderBackground.resetForTests();
		server.password = 'old';
		server.username = '';
		(server as any).credentialExpiresAt = undefined;
		mockSettings.active = {};
		jest.clearAllMocks();
		mockApi.tabs.create.mockImplementation((props: any, cb: Function) => cb({ id: 42, url: props.url }));
		mockApi.tabs.update.mockImplementation((id: number, props: any, cb: Function) => cb({ id, url: props.url }));
		mockApi.tabs.remove.mockImplementation((id: number, cb?: Function) => cb && cb());
		mockApi.runtime.sendMessage.mockImplementation((extensionId: any, message: any, options: any, cb?: Function) => cb && cb());
		mockApi.notifications.create.mockImplementation((id: string, options: any, cb?: Function) => cb && cb(id));
	});

	it('does not follow any tab activity while no sign-in is pending', async () => {
		CredentialProviderBackground.initialize();
		await flush();
		expect(mockTabUpdated.count()).toBe(0);
		expect(mockTabRemoved.count()).toBe(0);
	});

	it('opens a blank tab, records the request, then navigates to the provider', async () => {
		await CredentialProviderBackground.requestForServer('srv1');
		expect(mockApi.tabs.create).toHaveBeenCalledWith(expect.objectContaining({ url: 'about:blank', active: true }), expect.any(Function));
		expect(sessionData.credentialProviderPendingRequests['42']).toMatchObject({ tabId: 42, proxyServerId: 'srv1' });
		expect(mockApi.tabs.update).toHaveBeenCalledWith(42, { url: 'https://provider.example/issue?smartproxy=credential' }, expect.any(Function));
		// the request is persisted, and followed, before navigation starts
		expect(mockApi.storage.session.set.mock.invocationCallOrder[0]).toBeLessThan(mockApi.tabs.update.mock.invocationCallOrder[0]);
		expect(mockTabUpdated.count()).toBe(1);
		expect(mockTabRemoved.count()).toBe(1);
	});

	it('saves the issued password, closes the tab, notifies and stops following tabs', async () => {
		await CredentialProviderBackground.requestForServer('srv1');
		tabEvent(42, 'https://provider.example/issue?smartproxy=credential');
		expect(server.password).toBe('old');

		tabEvent(42, 'https://provider.example/done#username=alice&password=fresh&expires=1789470000');
		await flush();
		expect(server.password).toBe('fresh');
		expect(server.username).toBe('alice');
		expect((server as any).credentialExpiresAt).toBe(1789470000);
		expect(mockOperations.saveProxyServers).toHaveBeenCalled();
		expect(mockOperations.saveAllSync).toHaveBeenCalled();
		expect(mockSettings.updateActiveSettings).toHaveBeenCalled();
		expect(mockApi.tabs.remove).toHaveBeenCalledWith(42, expect.any(Function));
		notified('notificationCredentialProviderSuccess');
		expect(sessionData.credentialProviderPendingRequests['42']).toBeUndefined();
		expect(mockTabUpdated.count()).toBe(0);
		expect(mockTabRemoved.count()).toBe(0);
	});

	it('keeps an existing username and clears a stale expiry', async () => {
		server.username = 'kept';
		(server as any).credentialExpiresAt = 1;
		await CredentialProviderBackground.requestForServer('srv1');
		tabEvent(42, 'https://provider.example/done#username=alice&password=fresh');
		await flush();
		expect(server.username).toBe('kept');
		expect((server as any).credentialExpiresAt).toBeNull();
	});

	it('ignores other tabs, other origins and URLs without a credential', async () => {
		await CredentialProviderBackground.requestForServer('srv1');
		tabEvent(7, 'https://provider.example/done#password=other-tab');
		tabEvent(42, 'https://evil.example/done#password=stolen');
		tabEvent(42, 'https://provider.example/done');
		tabEvent(42, '');
		await flush();
		expect(server.password).toBe('old');
		expect(mockApi.tabs.remove).not.toHaveBeenCalled();
		expect(sessionData.credentialProviderPendingRequests['42']).toBeDefined();
	});

	it('reports a closed sign-in tab once', async () => {
		await CredentialProviderBackground.requestForServer('srv1');
		mockTabRemoved.trigger({ tabId: 42 });
		expect(sessionData.credentialProviderPendingRequests['42']).toBeUndefined();
		notified('settingsServersCredentialProviderErrorTabClosed');
		tabEvent(42, 'https://provider.example/done#password=late');
		await flush();
		expect(server.password).toBe('old');
		expect(mockApi.notifications.create).toHaveBeenCalledTimes(1);
	});

	it('expires a request that took too long', async () => {
		const now = Date.now();
		const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
		await CredentialProviderBackground.requestForServer('srv1');
		spy.mockReturnValue(now + CredentialProvider.defaultTimeoutMs + 1);
		tabEvent(42, 'https://provider.example/done#password=late');
		spy.mockRestore();
		await flush();
		expect(server.password).toBe('old');
		expect(sessionData.credentialProviderPendingRequests['42']).toBeUndefined();
		notified('settingsServersCredentialProviderErrorTimeout');
	});

	it('after a restart, picks up a sign-in that completed while the worker was asleep', async () => {
		await CredentialProviderBackground.requestForServer('srv1');
		CredentialProviderBackground.resetForTests(); // the worker was terminated and started again
		mockApi.tabs.get.mockImplementation((id: number, cb: Function) => cb({ id, url: 'https://provider.example/done#password=fresh' }));

		CredentialProviderBackground.initialize();
		await flush(); await flush();
		expect(mockApi.tabs.get).toHaveBeenCalledWith(42, expect.any(Function));
		expect(server.password).toBe('fresh');
		expect(mockTabUpdated.count()).toBe(0);
	});

	it('after a restart, keeps following a sign-in that is still in progress', async () => {
		await CredentialProviderBackground.requestForServer('srv1');
		CredentialProviderBackground.resetForTests();
		mockApi.tabs.get.mockImplementation((id: number, cb: Function) => cb({ id, url: 'https://idp.example/signin' }));

		CredentialProviderBackground.initialize();
		await flush(); await flush();
		expect(mockTabUpdated.count()).toBe(1);
		tabEvent(42, 'https://provider.example/done#password=fresh');
		await flush();
		expect(server.password).toBe('fresh');
	});

	it('after a restart, reports a sign-in tab that is gone', async () => {
		await CredentialProviderBackground.requestForServer('srv1');
		CredentialProviderBackground.resetForTests();
		mockApi.tabs.get.mockImplementation((id: number, cb: Function) => { mockApi.runtime.lastError = { message: 'No tab' }; cb(undefined); mockApi.runtime.lastError = null; });

		CredentialProviderBackground.initialize();
		await flush(); await flush();
		notified('settingsServersCredentialProviderErrorTabClosed');
		expect(sessionData.credentialProviderPendingRequests['42']).toBeUndefined();
	});

	it('waits for settings to load before saving, when the worker just woke up', async () => {
		await CredentialProviderBackground.requestForServer('srv1');
		mockSettings.active = null;
		let ready: Function = () => { };
		mockSettings.addInitializeCompletedEventListener.mockImplementation((listener: Function) => { ready = listener; });

		tabEvent(42, 'https://provider.example/done#password=fresh');
		await flush();
		expect(server.password).toBe('old');
		mockSettings.active = {};
		ready();
		await flush();
		expect(server.password).toBe('fresh');
	});

	it('sends the credential back to the settings page instead of saving it', async () => {
		await CredentialProviderBackground.requestForSettingsPage('https://provider.example/issue', 'req1');
		tabEvent(42, 'https://provider.example/done#username=alice&password=fresh&expires=5');
		await flush();
		expect(mockApi.runtime.sendMessage).toHaveBeenCalledWith(undefined,
			{ command: 'SettingsPage_ProviderCredentialResult', requestId: 'req1', credential: { username: 'alice', password: 'fresh', expiresAt: 5 } },
			undefined, expect.any(Function));
		expect(server.password).toBe('old');
		expect(mockApi.notifications.create).not.toHaveBeenCalled();
	});

	it('sends settings page failures back as an error code', async () => {
		await CredentialProviderBackground.requestForSettingsPage('https://provider.example/issue', 'req1');
		mockTabRemoved.trigger({ tabId: 42 });
		expect(mockApi.runtime.sendMessage).toHaveBeenCalledWith(undefined,
			{ command: 'SettingsPage_ProviderCredentialResult', requestId: 'req1', errorCode: 'TabClosed' }, undefined, expect.any(Function));
		expect(mockApi.notifications.create).not.toHaveBeenCalled();
	});

	it('reports a failed navigation once and stops following tabs', async () => {
		mockApi.tabs.update.mockImplementation((id: number, props: any, cb: Function) => { mockApi.runtime.lastError = { message: 'denied' }; cb(undefined); mockApi.runtime.lastError = null; });
		await CredentialProviderBackground.requestForServer('srv1');
		notified('settingsServersCredentialProviderErrorOpenFailed');
		expect(mockApi.notifications.create).toHaveBeenCalledTimes(1);
		expect(mockTabUpdated.count()).toBe(0);
	});

	it('rejects servers without a credential provider and unknown servers', async () => {
		await expect(CredentialProviderBackground.requestForServer('nope')).rejects.toMatchObject({ code: 'InvalidUrl' });
		mockSettings.current.proxyServers.push({ id: 'plain', name: 'Plain', credentialProviderUrl: '' });
		await expect(CredentialProviderBackground.requestForServer('plain')).rejects.toMatchObject({ code: 'InvalidUrl' });
		mockSettings.current.proxyServers.pop();
		await expect(CredentialProviderBackground.requestForSettingsPage('ftp://x', 'req1')).rejects.toMatchObject({ code: 'InvalidUrl' });
		expect(mockApi.tabs.create).not.toHaveBeenCalled();
	});

	it('works without storage.session by keeping requests in memory', async () => {
		const session = mockApi.storage.session;
		(mockApi.storage as any).session = undefined;
		try {
			await CredentialProviderBackground.requestForServer('srv1');
			tabEvent(42, 'https://provider.example/done#password=fresh');
			await flush();
			expect(server.password).toBe('fresh');
		} finally {
			(mockApi.storage as any).session = session;
		}
	});
});
