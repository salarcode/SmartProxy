// Keep browser startup side effects out of these message/storage integration tests.
jest.mock('../core/KeyboardShortcuts', () => ({ KeyboardShortcuts: { startMonitor: jest.fn() } }));
jest.mock('../core/WebFailedRequestMonitor', () => ({
  WebFailedRequestMonitor: {
    startMonitor: jest.fn(),
    enableFailedRequestNotification: jest.fn()
  }
}));

import { api, environment } from '../lib/environment';
import { PolyFill } from '../lib/PolyFill';
import { Debug } from '../lib/Debug';
import { Settings } from '../core/Settings';
import { ProxyEngine } from '../core/ProxyEngine';
import { SubscriptionUpdater } from '../core/SubscriptionUpdater';
import { UpdateManager } from '../core/UpdateManager';
import { TabManager } from '../core/TabManager';
import { TabRequestLogger } from '../core/TabRequestLogger';
import { ProxyAuthentication } from '../core/ProxyAuthentication';
import { CommandMessages } from '../core/definitions';

describe('Core initial data during background startup', () => {
  let core: typeof import('../core/Core').Core;
  let readLocal: Function;
  let listener: (message: any, sender: any, sendResponse: Function) => any;

  beforeAll(() => {
    // Core initializes on import; hold the actual local-storage callback until the test releases it.
    jest.spyOn(PolyFill, 'storageLocalGet').mockImplementation((_keys, success) => { readLocal = success; });
    jest.spyOn(PolyFill, 'getExtensionVersion').mockImplementation((success) => success('2.4.3'));
    jest.spyOn(PolyFill, 'runtimeSendMessage').mockImplementation(() => {});
    jest.spyOn(ProxyEngine, 'configureEnginePrematurely').mockImplementation(() => {});
    jest.spyOn(ProxyEngine, 'registerEngine').mockImplementation(() => {});
    jest.spyOn(TabManager, 'initializeTracking').mockImplementation(() => {});
    jest.spyOn(TabManager, 'getCurrentTab').mockReturnValue(null);
    jest.spyOn(TabRequestLogger, 'startTracking').mockImplementation(() => {});
    jest.spyOn(ProxyAuthentication, 'startMonitor').mockImplementation(() => {});
    jest.spyOn(SubscriptionUpdater, 'setServerSubscriptionsRefreshTimers').mockImplementation(() => {});
    jest.spyOn(SubscriptionUpdater, 'reloadEmptyServerSubscriptions').mockResolvedValue(undefined);
    jest.spyOn(SubscriptionUpdater, 'setRulesSubscriptionsRefreshTimers').mockImplementation(() => {});
    jest.spyOn(SubscriptionUpdater, 'reloadEmptyRulesSubscriptions').mockResolvedValue(undefined);
    jest.spyOn(SubscriptionUpdater, 'updateProxyServerSubscriptionsCountryCode').mockResolvedValue(undefined);
    jest.spyOn(UpdateManager, 'readUpdateInfo').mockImplementation(() => {});
    jest.spyOn(api.runtime.onMessage, 'addListener').mockImplementation((handler) => {
      listener = handler as typeof listener;
    });
    core = require('../core/Core').Core;
    jest.spyOn(core, 'setBrowserActionStatus').mockImplementation(() => {});
  });

  beforeEach(() => {
    jest.useFakeTimers();
    environment.chrome = true;
    core.initializeApp();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  afterAll(() => jest.restoreAllMocks());

  it('registers the listener synchronously and holds a cold popup request until local settings load', async () => {
    expect(listener).toEqual(expect.any(Function));
    expect(Settings.current.options).toBeUndefined();
    const respond = jest.fn();

    expect(listener(CommandMessages.PopupGetInitialData, {}, respond)).toBe(true);
    expect(respond).not.toHaveBeenCalled();

    readLocal({ options: { activeIncognitoProfileId: 'test-incognito' } });
    await Promise.resolve();

    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith(expect.objectContaining({ activeIncognitoProfileId: 'test-incognito' }));
    expect(jest.getTimerCount()).toBe(0);
  });

  it('releases concurrent popup, settings and proxyable requests using the loaded settings', async () => {
    const popupResponse = jest.fn();
    const settingsResponse = jest.fn();
    const proxyableResponse = jest.fn();
    const getTab = jest.spyOn(TabManager, 'getOrSetTab').mockReturnValue({ url: 'about:blank' } as any);

    expect(listener(CommandMessages.PopupGetInitialData, {}, popupResponse)).toBe(true);
    expect(listener(CommandMessages.SettingsPageGetInitialData, {}, settingsResponse)).toBe(true);
    expect(listener({ command: CommandMessages.ProxyableGetInitialData, tabId: 7 }, {}, proxyableResponse)).toBe(true);
    expect(popupResponse).not.toHaveBeenCalled();
    expect(settingsResponse).not.toHaveBeenCalled();
    expect(proxyableResponse).not.toHaveBeenCalled();

    readLocal({});
    await Promise.resolve();

    expect(popupResponse).toHaveBeenCalledTimes(1);
    expect(settingsResponse).toHaveBeenCalledWith({ settings: Settings.current });
    expect(proxyableResponse).toHaveBeenCalledWith(expect.objectContaining({ url: 'about:blank', themeData: expect.any(Object) }));
    expect(jest.getTimerCount()).toBe(0);
    getTab.mockRestore();
  });

  it('does not wait for remote sync after local settings become usable', async () => {
    const readSync = jest.spyOn(PolyFill, 'storageSyncGet').mockImplementation(() => {});
    const respond = jest.fn();
    listener(CommandMessages.PopupGetInitialData, {}, respond);

    readLocal({ options: { syncSettings: true } });
    await Promise.resolve();

    expect(readSync).toHaveBeenCalled();
    expect(respond).toHaveBeenCalledTimes(1);
    Settings.onInitializedRemoteSync();
    await Promise.resolve();
    expect(respond).toHaveBeenCalledTimes(1);
    readSync.mockRestore();
  });

  it('responds synchronously to a warm popup request', async () => {
    readLocal({});
    await Promise.resolve();
    const respond = jest.fn();

    expect(listener(CommandMessages.PopupGetInitialData, {}, respond)).toBeUndefined();
    expect(respond).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not hold unrelated messages during startup', () => {
    const respond = jest.fn();
    expect(listener({ command: 'UnknownCommand' }, {}, respond)).toBeUndefined();
    expect(respond).toHaveBeenCalledWith(null);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('expires an unanswered startup request and does not respond twice if storage completes later', async () => {
    const respond = jest.fn();
    expect(listener(CommandMessages.PopupGetInitialData, {}, respond)).toBe(true);
    jest.advanceTimersByTime(10000);
    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith(null);

    readLocal({});
    await Promise.resolve();
    expect(respond).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);

    const nextResponse = jest.fn();
    listener(CommandMessages.PopupGetInitialData, {}, nextResponse);
    expect(nextResponse).toHaveBeenCalledWith(expect.objectContaining({ proxyProfiles: expect.any(Array) }));
  });

  it('closes the deferred channel if building the response throws', async () => {
    const respond = jest.fn();
    listener(CommandMessages.PopupGetInitialData, {}, respond);
    const logError = jest.spyOn(Debug, 'error').mockImplementation(() => {});
    const getTab = jest.spyOn(TabManager, 'getCurrentTab').mockImplementationOnce(() => { throw new Error('test failure'); });

    readLocal({});
    await Promise.resolve();

    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond).toHaveBeenCalledWith(null);
    expect(logError).toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    getTab.mockReturnValue(null);
    logError.mockRestore();
  });
});
