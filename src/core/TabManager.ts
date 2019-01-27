import { PolyFill } from "../lib/PolyFill";
import { LiteEvent } from "../lib/LiteEvent";

export class TabManager {

    private static tabs = {};

    private static currentTab: TabDataType;

    private static readonly onTabRemoved = new LiteEvent<TabDataType>();
    private static readonly onTabUpdated = new LiteEvent<TabDataType>();

    public static get TabRemoved() { return this.onTabRemoved.expose(); }
    public static get TabUpdated() { return this.onTabUpdated.expose(); }


    public static initializeTracking() {
        // listen to tab switching
        browser.tabs.onActivated.addListener(TabManager.updateActiveTab);

        // listen to tab URL changes
        browser.tabs.onUpdated.addListener(TabManager.updateActiveTab);
        // update tab status
        browser.tabs.onUpdated.addListener(TabManager.handleTabUpdated);

        browser.tabs.onRemoved.addListener(TabManager.handleTabRemoved);

        // listen for window switching
        browser.windows.onFocusChanged.addListener(TabManager.updateActiveTab);

        // read the active tab
        TabManager.updateActiveTab();
    }

    /** Gets tab or adds it */
    public static getOrSetTab(tabId: number, loadTabData = true): TabDataType {
        let tabData = TabManager.tabs[tabId];

        if (tabData == null) {
            tabData = new TabDataType(tabId);
            TabManager.tabs[tabId] = tabData;

            if (loadTabData)
                TabManager.loadTabData(tabData);
        }
        return tabData;
    }

    public static getCurrentTab(): TabDataType {
        return TabManager.currentTab;
    }

    public static updateTabData(tabData: TabDataType, tabInfo: any): TabDataType {
        if (!tabInfo) return null;

        let tabId = tabInfo.id;
        if (!tabData) {
            tabData = TabManager.getOrSetTab(tabId, false);
        }

        // check proxy rule
        if (tabData.url != tabInfo.url ||
            tabData.proxified == null) {

            tabData.url = tabInfo.url;

            //TODO: updateTabDataProxyInfo(tabData);
            //internal.setBrowserActionStatus(tabData);
        }

        tabData.updated = new Date();
        tabData.incognito = tabInfo.incognito;
        tabData.url = tabInfo.url;
        tabData.index = tabInfo.index;

        // saving the tab in the storage
        TabManager.tabs[tabId] = tabData;

        TabManager.onTabUpdated.trigger(tabData);

        return tabData;
    }

    private static updateActiveTab() {

        // query the active tab in active window
        PolyFill.tabsQuery(
            { active: true, currentWindow: true },
            (tabs: any[]) => {
                if (!tabs || !tabs.length)
                    return;
                let tab = tabs[0];

                // save tab log info
                let tabData = TabManager.updateTabData(null, tab);

                TabManager.currentTab = tabData;
            });
    }

    private static loadTabData(tabData: TabDataType) {

        PolyFill.tabsGet(tabData.tabId,
            function (tabInfo) {

                // save tab log info
                TabManager.updateTabData(tabData, tabInfo);
            });
    }

    static handleTabRemoved(tabId) {
        let tabData = TabManager.tabs[tabId];
        if (tabData == null)
            return;

        delete TabManager.tabs[tabId];

        TabManager.onTabRemoved.trigger(tabData);

        tabData.cleanup();

        //// send notification first
        // TODO: requestLogger.notifyProxyableOriginTabRemoved(tabId);

        // // then remove the tab from the notification list
        // requestLogger.removeFromPorxyableLogIdList(tabId);
    }

    static handleTabUpdated(tabId, changeInfo, tabInfo) {
        // only if url of the page is changed
        // TODO: history changes? # tags?

        let tabData = TabManager.tabs[tabId];
        let shouldReset = false;

        if (changeInfo["status"] === "loading") {
            shouldReset = true;
        }
        else if (changeInfo["url"]) {

            if (tabData != null &&
                // only if url is changed
                changeInfo.url != tabData.url) {

                // reset
                shouldReset = true;
            }
        }

        if (shouldReset) {
            // reload the tab data

            if (tabData) {
                TabManager.onTabUpdated.trigger(tabData);
                tabData.cleanup();
            }
            delete TabManager.tabs[tabId];
        }
    }
}

export class TabDataType {

    constructor(tabId: number) {
        this.tabId = tabId;
        this.created = new Date();
        this.updated = new Date();
        this.requests = new Set();
        this.url = "";
        this.incognito = false;
        this.failedRequests = new Map();
        this.proxified = false;
    }

    public tabId: number;
    public created: Date;
    public updated: Date;
    public requests: Set<string>;
    public url: string;
    public incognito: boolean;
    public failedRequests: Map<object, object>;
    public proxified: boolean | null;
    public index: number;

    public cleanup() {
        if (this.requests)
            this.requests.clear();
        if (this.failedRequests)
            this.failedRequests.clear();
    }
}