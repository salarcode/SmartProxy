jest.mock('../lib/environment', () => ({
  environment: {
    chrome: true,
    name: 'chrome',
    version: 1,
    manifestV3: false,
    notSupported: {},
    notAllowed: {},
    bugFreeVersions: {},
    initialConfig: {},
    storageQuota: { syncQuotaBytesPerItem: () => 8000 },
    browserConfig: {}
  },
  api: {
    runtime: { lastError: null },
    browserAction: {},
    i18n: { getMessage: (key: string) => key },
    tabs: {}
  }
}));

import { api } from '../lib/environment';
import { TabManager } from '../core/TabManager';

const tabManagerType = TabManager as any;

describe('TabManager webNavigation tracking', () => {
  beforeEach(() => {
    tabManagerType.tabs = {};
    tabManagerType.currentTab = null;
    api.runtime.lastError = null;
    api.tabs.get = jest.fn((tabId: number, callback: Function) => callback({
      id: tabId,
      url: 'https://current.example/',
      incognito: false,
      index: 0
    }));
  });

  it('updates the tab url when main-frame navigation starts', () => {
    let tabData = TabManager.getOrSetTab(1, false, 'https://old.example/');
    let updates = 0;
    const onUpdated = () => updates++;
    TabManager.TabUpdated.on(onUpdated);

    tabManagerType.handleNavigationStarted({
      tabId: 1,
      frameId: 0,
      url: 'https://new.example/path'
    });

    TabManager.TabUpdated.off(onUpdated);
    expect(tabData.url).toBe('https://new.example/path');
    expect(tabData.proxifiedParentDocumentUrl).toBe('https://new.example/path');
    expect(updates).toBe(1);
  });

  it('ignores sub-frame navigation changes', () => {
    let tabData = TabManager.getOrSetTab(1, false, 'https://old.example/');

    tabManagerType.handleNavigationStarted({
      tabId: 1,
      frameId: 1,
      url: 'https://subframe.example/'
    });

    expect(tabData.url).toBe('https://old.example/');
  });

  it('reloads current document url when pending navigation fails', () => {
    let tabData = TabManager.getOrSetTab(1, false, 'https://loading.example/');

    tabManagerType.handleNavigationError({
      tabId: 1,
      frameId: 0,
      url: 'https://loading.example/'
    });

    expect(tabData.url).toBe('https://current.example/');
  });
});
