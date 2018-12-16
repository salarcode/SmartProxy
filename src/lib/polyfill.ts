import { environment, chrome, browser } from "./environment";

export class PolyFill {
	public static lastError() {
		if (environment.chrome) {
			// chrome.extension.lastError Deprecated since Chrome 58
			return chrome.runtime.lastError;
		} else {
			return browser.runtime.lastError;
		}
	}
	public static onProxyError() {
		if (environment.chrome) {
			return chrome.proxy.onProxyError;
		} else {
			if (browser.proxy.onError)
				// this is under consideration for future version of Firefox #1388619
				return browser.proxy.onError;
			else
				return browser.proxy.onProxyError;
		}
	}
	public static tabsGet(tabId, success, fail) {
		if (environment.chrome) {
			chrome.tabs.get(tabId,
				tabInfo => {
					const error = PolyFill.lastError();
					if (error) {
						if (fail)
							fail(error);
					} else {
						if (success)
							success(tabInfo);
					}
				});
		} else {
			browser.tabs.get(tabId)
				.then(success, fail);
		}
	}
	public static tabsRemove(tabIds, success, fail) {
		if (environment.chrome) {
			chrome.tabs.remove(tabIds,
				tabInfo => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail)
							fail(error);
					} else {
						if (success)
							success(tabInfo);
					}
				});
		} else {
			browser.tabs.remove(tabIds)
				.then(success, fail);
		}
	}

	public static tabsReload(tabId, success, fail, reloadProperties) {
		if (environment.chrome) {
			chrome.tabs.reload(tabId, reloadProperties,
				tabInfo => {
					let error = PolyFill.lastError();
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
	}
	public static tabsQuery(queryInfo, success, fail) {
		if (environment.chrome) {
			chrome.tabs.query(queryInfo,
				tabs => {
					let error = PolyFill.lastError();
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
	}
	public static tabsCreate(createProperties, success, fail) {
		if (environment.chrome) {
			chrome.tabs.create(createProperties,
				tabInfo => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(tabInfo);
					}
				});
		} else {
			browser.tabs.create(createProperties)
				.then(success, fail);
		}
	}
	public static runtimeSendMessage(message, success, fail, options, extensionId) {
		if (environment.chrome) {
			if (options != null) {
				// deleting firefox specific property of sending message to PAC
				delete options["toProxyScript"];
			}
			chrome.runtime.sendMessage(extensionId,
				message,
				options,
				response => {
					let error = PolyFill.lastError();
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
	}
	public static managementGetSelf(success, fail) {
		if (environment.chrome) {
			chrome.management.getSelf(
				response => {
					let error = PolyFill.lastError();
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
	}
	public static storageLocalGet(keys, success, fail) {
		if (environment.chrome) {
			chrome.storage.local.get(keys,
				response => {
					let error = PolyFill.lastError();
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
	}
	public static storageLocalSet(items, success, fail) {
		if (environment.chrome) {
			chrome.storage.local.set(items,
				response => {
					let error = PolyFill.lastError();
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
	}
	public static storageSyncGet(keys, success, fail) {
		if (environment.chrome) {
			chrome.storage.sync.get(keys,
				response => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			browser.storage.sync.get(keys)
				.then(success, fail);
		}
	}
	public static storageSyncSet(items, success, fail) {
		if (environment.chrome) {
			chrome.storage.sync.set(items,
				response => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			browser.storage.sync.set(items)
				.then(success, fail);
		}
	}
	public static runtimeGetBrowserInfo(success, fail) {
		if (environment.chrome) {
			// No implemented in chrome yet!
			if (fail) fail({ message: "getBrowserInfo is not implemented" });

			//chrome.runtime.getBrowserInfo(
			//	function (response) {
			//		const error = polyfill.lastError();
			//		if (error) {
			//			if (fail) fail(error);
			//		} else {
			//			if (success) success(response);
			//		}
			//	});
		} else {
			browser.runtime.getBrowserInfo()
				.then(success, fail);
		}
	}
	public static runtimeOpenOptionsPage(success, fail) {
		if (environment.chrome) {
			chrome.runtime.openOptionsPage(
				response => {
					let error = PolyFill.lastError();
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
	public static browserActionSetIcon(details, success, fail) {
		if (environment.chrome) {
			chrome.browserAction.setIcon(details,
				response => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			browser.browserAction.setIcon(details)
				.then(success, fail);
		}
	}
}