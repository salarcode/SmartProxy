jest.mock('../lib/environment', () => ({
	environment: {
		chrome: true, name: 'chrome', version: 1, manifestV3: true,
		notSupported: {}, notAllowed: {}, bugFreeVersions: {}, initialConfig: {},
		storageQuota: { syncQuotaBytesPerItem: () => 8000 }, browserConfig: {}
	},
	api: { runtime: { lastError: null }, i18n: { getMessage: (key: string) => key }, tabs: {} }
}));

import { Utils } from '../lib/Utils';

describe('Utils.escapeNonAsciiForScript', () => {
	it('leaves ASCII-only scripts untouched', () => {
		const script = 'function FindProxyForURL(url, host) { return "DIRECT"; }';
		expect(Utils.escapeNonAsciiForScript(script)).toBe(script);
		expect(Utils.escapeNonAsciiForScript('')).toBe('');
	});

	it('escapes non-ASCII characters as \\uXXXX so Chromium accepts the PAC script', () => {
		const escaped = Utils.escapeNonAsciiForScript('// rules \u2192 proxy\nconst host = "m\u00fcnchen.example";');
		expect(escaped).toBe('// rules \\u2192 proxy\nconst host = "m\\u00fcnchen.example";');
		expect(/[^\x00-\x7f]/.test(escaped)).toBe(false);
	});

	it('keeps string literal values intact once the script is evaluated', () => {
		const escaped = Utils.escapeNonAsciiForScript('"m\u00fcnchen.example"');
		expect(eval(escaped)).toBe('m\u00fcnchen.example');
	});
});
