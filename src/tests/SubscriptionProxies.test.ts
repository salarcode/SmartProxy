import { PolyFill } from '../lib/PolyFill';
import { ProxyImporter } from '../lib/ProxyImporter';
import { Settings } from '../core/Settings';
import { SettingsOperation } from '../core/SettingsOperation';
import { SubscriptionUpdater } from '../core/SubscriptionUpdater';
import { ProxyEngine } from '../core/ProxyEngine';
import {
  ProxyServer,
  ProxyServerSubscription,
  SettingsConfig,
  SmartProfileType,
  getBuiltinSmartProfiles
} from '../core/definitions';

const SUBSCRIPTION_NAME = 'sub-1';
const SUBSCRIPTION_URL = 'https://example.com/proxies.txt';
const SELECTED_PROXY_ID = 'sub-proxy-2';

function createProxy(id: string): ProxyServer {
  const proxy = new ProxyServer();
  proxy.id = id;
  proxy.name = id;
  proxy.host = `${id}.example.com`;
  proxy.port = 1080;
  proxy.protocol = 'SOCKS5';
  return proxy;
}

function createSubscription(proxies: any): ProxyServerSubscription {
  const subscription = new ProxyServerSubscription();
  subscription.name = SUBSCRIPTION_NAME;
  subscription.url = SUBSCRIPTION_URL;
  subscription.enabled = true;
  subscription.proxies = proxies;
  return subscription;
}

function createSettings(subscriptionProxies: any): SettingsConfig {
  const settings = new SettingsConfig();
  settings.proxyProfiles = getBuiltinSmartProfiles();
  settings.proxyServerSubscriptions = [createSubscription(subscriptionProxies)];
  return settings;
}

/** A plain object like the one read from the storage, with a profile that uses a subscription proxy */
function createStoredLocalData(subscriptionProxies: any): any {
  const profiles = getBuiltinSmartProfiles();
  const smartProfile = profiles.find(p => p.profileType == SmartProfileType.SmartRules);
  smartProfile.profileProxyServerId = SELECTED_PROXY_ID;

  return JSON.parse(JSON.stringify({
    activeProfileId: smartProfile.profileId,
    proxyProfiles: profiles,
    proxyServers: [],
    proxyServerSubscriptions: [createSubscription(subscriptionProxies)]
  }));
}

describe('SettingsOperation.copyNonSyncableSettings, proxy server subscriptions', () => {
  it('clears the proxies of a subscription which is missing in the source by default', () => {
    const dest = createSettings([createProxy('a')]);
    const source = new SettingsConfig();
    source.proxyServerSubscriptions = [];

    SettingsOperation.copyNonSyncableSettings(dest, source);

    expect(dest.proxyServerSubscriptions[0].proxies).toEqual([]);
  });

  it('keeps the proxies of a subscription which is missing in the source when asked', () => {
    const dest = createSettings([createProxy('a'), createProxy('b')]);
    const source = new SettingsConfig();
    source.proxyServerSubscriptions = [];

    SettingsOperation.copyNonSyncableSettings(dest, source, true);

    expect(dest.proxyServerSubscriptions[0].proxies.map(p => p.id)).toEqual(['a', 'b']);
  });

  it('drops malformed proxy items when keeping the proxies', () => {
    const dest = createSettings([createProxy('a'), null, 'broken', undefined, 5]);
    const source = new SettingsConfig();
    source.proxyServerSubscriptions = [];

    SettingsOperation.copyNonSyncableSettings(dest, source, true);

    expect(dest.proxyServerSubscriptions[0].proxies.map(p => p.id)).toEqual(['a']);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a string', 'broken'],
    ['an object', { id: 'a' }]
  ])('resets the proxies to an empty list when they are %s', (_label, malformed) => {
    const dest = createSettings(malformed);
    const source = new SettingsConfig();
    source.proxyServerSubscriptions = [];

    SettingsOperation.copyNonSyncableSettings(dest, source, true);

    expect(dest.proxyServerSubscriptions[0].proxies).toEqual([]);
  });

  it('does not throw when the source has no subscriptions list', () => {
    const dest = createSettings([createProxy('a')]);
    const source = new SettingsConfig();
    source.proxyServerSubscriptions = undefined;

    expect(() => SettingsOperation.copyNonSyncableSettings(dest, source)).not.toThrow();
    expect(dest.proxyServerSubscriptions[0].proxies).toEqual([]);
  });

  it('still copies the proxies from a matching source subscription', () => {
    const dest = createSettings([]);
    const source = createSettings([createProxy('a'), createProxy('b')]);

    SettingsOperation.copyNonSyncableSettings(dest, source);

    expect(dest.proxyServerSubscriptions[0].proxies.map(p => p.id)).toEqual(['a', 'b']);
  });
});

describe('Settings local initialization with subscription proxies', () => {
  beforeEach(() => {
    jest.spyOn(PolyFill, 'getExtensionVersion').mockImplementation((success: Function) => success('2.4.3'));
    jest.spyOn(PolyFill, 'storageLocalSet').mockImplementation(() => { });
    jest.spyOn(PolyFill, 'storageLocalRemove').mockImplementation(() => { });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Settings.onInitializedLocally = null;
    Settings.onInitializedRemoteSync = null;
  });

  function initializeWithLocalData(localData: any) {
    // the first read is the settings, the later ones are the residue cleanup
    let isFirstRead = true;
    jest.spyOn(PolyFill, 'storageLocalGet').mockImplementation((_keys: any, success: Function) => {
      if (isFirstRead) {
        isFirstRead = false;
        success(localData);
      }
    });
    Settings.initialize();
  }

  it('keeps the stored subscription proxies and resolves the selected proxy', () => {
    initializeWithLocalData(createStoredLocalData([createProxy('sub-proxy-1'), createProxy(SELECTED_PROXY_ID)]));

    const proxies = Settings.current.proxyServerSubscriptions[0].proxies;
    expect(proxies.map(p => p.id)).toEqual(['sub-proxy-1', SELECTED_PROXY_ID]);
    expect(Settings.active.currentProxyServer?.id).toBe(SELECTED_PROXY_ID);
  });

  it('does not persist emptied subscription proxies', () => {
    initializeWithLocalData(createStoredLocalData([createProxy(SELECTED_PROXY_ID)]));

    const saved = (PolyFill.storageLocalSet as jest.Mock).mock.calls
      .map(call => call[0])
      .find(data => data?.proxyServerSubscriptions);

    expect(saved.proxyServerSubscriptions[0].proxies.map((p: ProxyServer) => p.id)).toEqual([SELECTED_PROXY_ID]);
  });

  it('recovers from malformed stored proxies with an empty list', () => {
    initializeWithLocalData(createStoredLocalData('broken'));

    expect(Settings.current.proxyServerSubscriptions[0].proxies).toEqual([]);
    expect(Settings.active.currentProxyServer).toBeNull();
  });
});

describe('SubscriptionUpdater server subscription refresh', () => {
  let notifySpy: jest.SpyInstance;

  beforeEach(() => {
    jest.spyOn(PolyFill, 'getExtensionVersion').mockImplementation((success: Function) => success('2.4.3'));
    jest.spyOn(SettingsOperation, 'saveProxyServerSubscriptions').mockImplementation(() => { });
    jest.spyOn(SettingsOperation, 'saveAllSync').mockImplementation(() => { });
    jest.spyOn(SubscriptionUpdater as any, 'updateProxyServersCountryCode').mockImplementation(() => { });
    jest.spyOn(ProxyEngine, 'updateBrowsersProxyConfig').mockImplementation(() => { });
    notifySpy = jest.spyOn(ProxyEngine, 'notifyProxyRulesChanged');
  });

  afterEach(() => jest.restoreAllMocks());

  function mockServerResponse(proxies: ProxyServer[]) {
    jest.spyOn(ProxyImporter, 'readFromServer').mockImplementation((_subscription: any, success: Function) => {
      success({ success: true, message: '', result: proxies });
    });
  }

  function loadSettingsWithEmptySubscription() {
    const data = createStoredLocalData([]);
    jest.spyOn(PolyFill, 'storageLocalGet').mockImplementation(() => { });
    Settings.current = Settings.getRestorableSettings(data);
    Settings.active = undefined;
    Settings.updateActiveSettings();
  }

  it('resolves the selected proxy again once the subscription proxies arrive', () => {
    loadSettingsWithEmptySubscription();
    // the proxies are not known yet, so nothing is resolved
    expect(Settings.active.currentProxyServer).toBeNull();

    mockServerResponse([createProxy('sub-proxy-1'), createProxy(SELECTED_PROXY_ID)]);
    (SubscriptionUpdater as any).readServerSubscription(SUBSCRIPTION_NAME);

    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(Settings.active.currentProxyServer?.id).toBe(SELECTED_PROXY_ID);
  });

  it('does not re-apply the settings when the refresh fails', () => {
    loadSettingsWithEmptySubscription();
    jest.spyOn(ProxyImporter, 'readFromServer').mockImplementation((_subscription: any, success: Function) => {
      success({ success: false, message: 'failed', result: null });
    });

    (SubscriptionUpdater as any).readServerSubscription(SUBSCRIPTION_NAME);

    expect(notifySpy).not.toHaveBeenCalled();
  });
});
