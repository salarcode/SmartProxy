import { ProxyServer } from '../core/definitions';

describe('ProxyServer credential expiry', () => {
	const base = { id: 'a', name: 'A', host: 'proxy.example', port: 443, protocol: 'HTTPS' };

	it('keeps a valid expiry and the provider URL through CopyFrom (backup, restore, sync)', () => {
		const server = new ProxyServer();
		server.CopyFrom({ ...base, credentialProviderUrl: 'https://provider.example/', credentialExpiresAt: 1789470000 });
		expect(server.credentialProviderUrl).toBe('https://provider.example/');
		expect(server.credentialExpiresAt).toBe(1789470000);
	});

	it('normalises missing or invalid expiries to null', () => {
		for (const value of [undefined, null, 0, -5, 'soon']) {
			const server = new ProxyServer();
			server.CopyFrom({ ...base, credentialExpiresAt: value });
			expect(server.credentialExpiresAt).toBeNull();
		}
	});
});
