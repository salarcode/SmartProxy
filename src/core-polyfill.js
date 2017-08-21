var environment = {
	chrome: false
};

// Google Chrome polyfill
if (typeof browser === "undefined") {
	browser = chrome;
	environment.chrome = true;
}

// the api used in this extension, polyfiled to use Promises if possible
var polyfill = {
	lastError: function () {
		if (environment.chrome) {
			// chrome.extension.lastError Deprecated since Chrome 58
			return chrome.runtime.lastError;
		} else {
			return browser.runtime.lastError;
		}
	},
	onProxyError: function () {
		if (environment.chrome) {
			return chrome.proxy.onProxyError;
		} else {
			if (browser.proxy.onError)
				// this is under consideration
				return browser.onError;
			else
				return browser.proxy.onProxyError;
		}
	},
	tabsGet: function (tabId, success, fail) {
		if (environment.chrome) {
			chrome.tabs.get(tabId,
				function (tabInfo) {
					var error = polyfill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(tabInfo);
					}
				});
		} else {
			browser.tabs.get(tabId)
				.then(success, fail);
		}
	},
	tabsRemove: function (tabIds, success, fail) {
		if (environment.chrome) {
			chrome.tabs.remove(tabIds,
				function (tabInfo) {
					var error = polyfill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(tabInfo);
					}
				});
		} else {
			browser.tabs.remove(tabIds)
				.then(success, fail);
		}
	},
	tabsReload: function (tabId, success, fail, reloadProperties) {
		if (environment.chrome) {
			chrome.tabs.reload(tabId, reloadProperties,
				function (tabInfo) {
					var error = polyfill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(tabInfo);
					}
				});
		} else {
			browser.tabs.reload(tabId, reloadProperties)
				.then(success, fail);
		}
	},
	tabsQuery: function (queryInfo, success, fail) {
		if (environment.chrome) {
			chrome.tabs.query(queryInfo,
				function (tabs) {
					var error = polyfill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(tabs);
					}
				});
		} else {
			browser.tabs.query(queryInfo)
				.then(success, fail);
		}
	},
	runtimeSendMessage: function (message, success, fail, options, extensionId) {
		if (environment.chrome) {
			chrome.runtime.sendMessage(extensionId,
				message,
				options,
				function (response) {
					var error = polyfill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			browser.runtime.sendMessage(
				extensionId,
				message,
				options
			).then(success, fail);
		}
	},
	managementGetSelf: function (success, fail) {
		if (environment.chrome) {
			chrome.management.getSelf(
				function (response) {
					var error = polyfill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			browser.management.getSelf()
				.then(success, fail);
		}
	},
	storageLocalGet: function (keys, success, fail) {
		if (environment.chrome) {
			chrome.storage.local.get(keys,
				function (response) {
					var error = polyfill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			browser.storage.local.get(keys)
				.then(success, fail);
		}
	},
	storageLocalSet: function (items, success, fail) {
		if (environment.chrome) {
			chrome.storage.local.set(items,
				function (response) {
					var error = polyfill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			browser.storage.local.set(items)
				.then(success, fail);
		}
	},
	runtimeOpenOptionsPage: function () {
		if (environment.chrome) {
			chrome.runtime.openOptionsPage(
				function (response) {
					var error = polyfill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			browser.runtime.openOptionsPage()
				.then(success, fail);
		}
	}
};