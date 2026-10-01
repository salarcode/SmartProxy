type Listener = (...args: any[]) => void;

function makeEvent() {
	const listeners = new Set<Listener>();
	return {
		addListener: jest.fn((l: Listener) => listeners.add(l)),
		removeListener: jest.fn((l: Listener) => listeners.delete(l)),
		listenerCount: () => listeners.size,
	};
}

const sessionData: any = {};
const mockApi = {
	runtime: { lastError: null as any, getURL: (p: string) => 'chrome-extension://id/' + p },
	extension: { getURL: (p: string) => 'chrome-extension://id/' + p },
	i18n: { getMessage: (key: string) => key + '{0}' },
	tabs: {
		onUpdated: makeEvent(),
		onRemoved: makeEvent(),
		create: jest.fn(),
		update: jest.fn(),
		remove: jest.fn(),
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

const server = { id: 'srv1', name: 'Office proxy', host: 'proxy.example', port: 443, protocol: 'HTTPS', username: '', password: 'old', credentialProviderUrl: 'https://provider.example/issue' };
const mockSettings = { current: { proxyServers: [server] as any[] }, active: {}, updateActiveSettings: jest.fn(), addInitializeCompletedEventListener: jest.fn() };
const mockOperations = { saveProxyServers: jest.fn(), updateSmartProfilesRulesProxyServer: jest.fn(), saveAllSync: jest.fn() };
jest.mock('../core/Settings', () => ({ Settings: mockSettings }));
jest.mock('../core/SettingsOperation', () => ({ SettingsOperation: mockOperations }));

import { CredentialProviderBackground } from '../core/CredentialProviderBackground';
import { CredentialProvider } from '../lib/CredentialProvider';

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('CredentialProviderBackground', () => {
	beforeEach(() => {
		for (const key of Object.keys(sessionData)) delete sessionData[key];
		CredentialProviderBackground.resetForTests();
		server.password = 'old';
		server.username = '';
		mockSettings.active = {};
		jest.clearAllMocks();
		mockApi.tabs.create.mockImplementation((props: any, cb: Function) => cb({ id: 42, url: props.url }));
		mockApi.tabs.update.mockImplementation((id: number, props: any, cb: Function) => cb({ id, url: props.url }));
		mockApi.tabs.remove.mockImplementation((id: number, cb?: Function) => cb && cb());
		mockApi.notifications.create.mockImplementation((id: string, options: any, cb?: Function) => cb && cb(id));
	});

	it('registers tab listeners when the background starts', () => {
		CredentialProviderBackground.startMonitor();
		expect(mockApi.tabs.onUpdated.addListener).toHaveBeenCalledWith(CredentialProviderBackground.onTabUpdated);
		expect(mockApi.tabs.onRemoved.addListener).toHaveBeenCalledWith(CredentialProviderBackground.onTabRemoved);
	});

	it('opens a blank tab, records the request, then navigates to the provider', async () => {
		await CredentialProviderBackground.requestForServer('srv1');
		expect(mockApi.tabs.create).toHaveBeenCalledWith(expect.objectContaining({ url: 'about:blank', active: true }), expect.any(Function));
		expect(sessionData.credentialProviderPendingRequests['42']).toMatchObject({ tabId: 42, proxyServerId: 'srv1' });
		expect(mockApi.tabs.update).toHaveBeenCalledWith(42, { url: 'https://provider.example/issue?smartproxy=credential' }, expect.any(Function));
		// the request is persisted before navigation starts
		expect(mockApi.storage.session.set.mock.invocationCallOrder[0]).toBeLessThan(mockApi.tabs.update.mock.invocationCallOrder[0]);
	});

	it('saves the issued password, closes the tab and notifies', async () => {
		await CredentialProviderBackground.requestForServer('srv1');
		await CredentialProviderBackground.onTabUpdated(42, { url: 'https://provider.example/issue?smartproxy=credential' });
		expect(server.password).toBe('old');

		await CredentialProviderBackground.onTabUpdated(42, { url: 'https://provider.example/done#username=alice&password=fresh&expires=1789470000' });
		expect(server.password).toBe('fresh');
		expect(server.username).toBe('alice');
		expect((server as any).credentialExpiresAt).toBe(1789470000);
		expect(mockOperations.saveProxyServers).toHaveBeenCalled();
		expect(mockOperations.saveAllSync).toHaveBeenCalled();
		expect(mockSettings.updateActiveSettings).toHaveBeenCalled();
		expect(mockApi.tabs.remove).toHaveBeenCalledWith(42, expect.any(Function));
		expect(mockApi.notifications.create).toHaveBeenCalledWith('credential-provider',
			expect.objectContaining({ message: expect.stringContaining('notificationCredentialProviderSuccess') }), expect.any(Function));
		expect(sessionData.credentialProviderPendingRequests['42']).toBeUndefined();
	});

	it('keeps an existing username', async () => {
		server.username = 'kept';
		await CredentialProviderBackground.requestForServer('srv1');
		await CredentialProviderBackground.onTabUpdated(42, { url: 'https://provider.example/done#username=alice&password=fresh' });
		expect(server.username).toBe('kept');
	});

	it('clears a stale expiry when the provider does not send one', async () => {
		(server as any).credentialExpiresAt = 1;
		await CredentialProviderBackground.requestForServer('srv1');
		await CredentialProviderBackground.onTabUpdated(42, { url: 'https://provider.example/done#password=fresh' });
		expect((server as any).credentialExpiresAt).toBeNull();
	});

	it('completes after a service worker restart, from the persisted request', async () => {
		await CredentialProviderBackground.requestForServer('srv1');
		CredentialProviderBackground.resetForTests(); // the worker was terminated and started again

		await CredentialProviderBackground.onTabUpdated(42, { url: 'https://provider.example/done#password=fresh' });
		expect(server.password).toBe('fresh');
	});

	it('ignores other tabs, other origins and URLs without a credential', async () => {
		await CredentialProviderBackground.requestForServer('srv1');
		await CredentialProviderBackground.onTabUpdated(7, { url: 'https://provider.example/done#password=other-tab' });
		await CredentialProviderBackground.onTabUpdated(42, { url: 'https://evil.example/done#password=stolen' });
		await CredentialProviderBackground.onTabUpdated(42, { url: 'https://provider.example/done' });
		await CredentialProviderBackground.onTabUpdated(42, {});
		expect(server.password).toBe('old');
		expect(mockApi.tabs.remove).not.toHaveBeenCalled();
		expect(sessionData.credentialProviderPendingRequests['42']).toBeDefined();
	});

	it('drops the request and notifies when the user closes the sign-in tab', async () => {
		await CredentialProviderBackground.requestForServer('srv1');
		await CredentialProviderBackground.onTabRemoved(42);
		expect(sessionData.credentialProviderPendingRequests['42']).toBeUndefined();
		expect(mockApi.notifications.create).toHaveBeenCalledWith('credential-provider',
			expect.objectContaining({ message: expect.stringContaining('settingsServersCredentialProviderErrorTabClosed') }), expect.any(Function));
		await CredentialProviderBackground.onTabUpdated(42, { url: 'https://provider.example/done#password=late' });
		expect(server.password).toBe('old');
	});

	it('expires a request that took too long', async () => {
		const now = Date.now();
		const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
		await CredentialProviderBackground.requestForServer('srv1');
		spy.mockReturnValue(now + CredentialProvider.defaultTimeoutMs + 1);
		await CredentialProviderBackground.onTabUpdated(42, { url: 'https://provider.example/done#password=late' });
		spy.mockRestore();
		expect(server.password).toBe('old');
		expect(sessionData.credentialProviderPendingRequests['42']).toBeUndefined();
		expect(mockApi.notifications.create).toHaveBeenCalledWith('credential-provider',
			expect.objectContaining({ message: expect.stringContaining('settingsServersCredentialProviderErrorTimeout') }), expect.any(Function));
	});

	it('waits for settings to load before saving, when the worker just woke up', async () => {
		await CredentialProviderBackground.requestForServer('srv1');
		mockSettings.active = null;
		let ready: Function = () => { };
		mockSettings.addInitializeCompletedEventListener.mockImplementation((listener: Function) => { ready = listener; });

		const done = CredentialProviderBackground.onTabUpdated(42, { url: 'https://provider.example/done#password=fresh' });
		await flush();
		expect(server.password).toBe('old');
		mockSettings.active = {};
		ready();
		await done;
		expect(server.password).toBe('fresh');
	});

	it('rejects servers without a credential provider and unknown servers', async () => {
		await expect(CredentialProviderBackground.requestForServer('nope')).rejects.toMatchObject({ code: 'InvalidUrl' });
		mockSettings.current.proxyServers.push({ id: 'plain', name: 'Plain', credentialProviderUrl: '' });
		await expect(CredentialProviderBackground.requestForServer('plain')).rejects.toMatchObject({ code: 'InvalidUrl' });
		mockSettings.current.proxyServers.pop();
		expect(mockApi.tabs.create).not.toHaveBeenCalled();
	});

	it('works without storage.session by keeping requests in memory', async () => {
		const session = mockApi.storage.session;
		(mockApi.storage as any).session = undefined;
		try {
			await CredentialProviderBackground.requestForServer('srv1');
			await CredentialProviderBackground.onTabUpdated(42, { url: 'https://provider.example/done#password=fresh' });
			expect(server.password).toBe('fresh');
		} finally {
			(mockApi.storage as any).session = session;
		}
	});
});
