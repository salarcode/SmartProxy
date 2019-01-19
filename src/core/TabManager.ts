import { PolyFill } from "../lib/PolyFill";

export class TabManager {

    private static tabs = {};

    private static currentTab: TabDataType;

    public static onTabRemoved: Function;

    public static onTabUpdated: Function;

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

    public static getTab(tabId: number): TabDataType {
        return TabManager.tabs[tabId];
    }

    public static getCurrentTab(): TabDataType {
        return TabManager.currentTab;
    }

    public static updateTabData(tabData: TabDataType, tabInfo: any): TabDataType {
        if (!tabInfo) return null;

        let tabId = tabInfo.id;
        if (!tabData)
            tabData = TabManager.tabs[tabId];

        if (!tabData)
            tabData = Object.assign(new TabDataType(), {
                tabId: tabId,
                created: new Date(),
                updated: new Date(),
                requests: new Set(),
                url: "",
                incognito: false,
                failedRequests: new Map(),
                proxified: false
            });

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

        if (TabManager.onTabUpdated)
            TabManager.onTabUpdated(tabData);

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

    static handleTabRemoved(tabId) {
        let tabData = TabManager.tabs[tabId];
        if (tabData == null)
            return;

        delete TabManager.tabs[tabId];

        if (TabManager.onTabUpdated)
            TabManager.onTabRemoved(tabData);

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

            if (tabData)
                tabData.cleanup();
            delete TabManager.tabs[tabId];
        }
    }
}

export class TabDataType {
    public tabId: number;
    public created: Date;
    public updated: Date;
    public requests: Set<object>;
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

class RequestTracker {

    public static startTracking() {
        browser.webRequest.onBeforeRequest.addListener(
            RequestTracker.logRequest,
            { urls: ["<all_urls>"] }
        );
        // browser.tabs.onRemoved.addListener(RequestTracker.handleTabRemoved);
        // browser.tabs.onUpdated.addListener(RequestTracker.handleTabUpdated);
    }

    static logRequest(requestDetails) {
        let tabId = requestDetails.tabId;
        if (!(tabId > -1))
            // only requests from tabs are logged
            return;


    }

    static handleTabRemoved(tabId) {

    }

    static handleTabUpdated(tabId, changeInfo, tabInfo) {

    }

}

