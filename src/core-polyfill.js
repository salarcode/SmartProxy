/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2017 Salar Khalilzadeh <salar2k@gmail.com>
 *
 * SmartProxy is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * SmartProxy is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with SmartProxy.  If not, see <http://www.gnu.org/licenses/>.
 */
let environment = {
	chrome: false,
	name: "general",
	version: 1.0,
	bugFreeVersions: {
		firefoxToProxyScript: 56,
		firefoxConfirmInPopupWorks: 57,
		firefoxNewPacScriptReturnData: 57
	},
	storageQuota: {
		syncQuotaBytesPerItem: function () {
			if (environment.chrome) {
				// https://developer.chrome.com/apps/storage#property-sync
				// QUOTA_BYTES_PER_ITEM = 8,192
				return 8000;
			} else {
				// no limit
				return -1;
			}
		}
	}
};

// Google Chrome polyfill
if (typeof browser === "undefined") {
	browser = chrome;
	environment.chrome = true;
}

// Only polyfill the API that is used in extension
const polyfill = {
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
				// this is under consideration for future version of Firefox #1388619
				return browser.proxy.onError;
			else
				return browser.proxy.onProxyError;
		}
	},
	tabsGet: function (tabId, success, fail) {
		if (environment.chrome) {
			chrome.tabs.get(tabId,
				function (tabInfo) {
					let error = polyfill.lastError();
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
					let error = polyfill.lastError();
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
					let error = polyfill.lastError();
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
					let error = polyfill.lastError();
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
	tabsCreate: function (createProperties, success, fail) {
		if (environment.chrome) {
			chrome.tabs.create(createProperties,
				function (tabInfo) {
					let error = polyfill.lastError();
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
	},
	runtimeSendMessage: function (message, success, fail, options, extensionId) {
		if (environment.chrome) {
			if (options != null) {
				// deleting firefox specific property of sending message to PAC
				delete options["toProxyScript"];
			}
			chrome.runtime.sendMessage(extensionId,
				message,
				options,
				function (response) {
					let error = polyfill.lastError();
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
					let error = polyfill.lastError();
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
					let error = polyfill.lastError();
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
					let error = polyfill.lastError();
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
	storageSyncGet: function (keys, success, fail) {
		if (environment.chrome) {
			chrome.storage.sync.get(keys,
				function (response) {
					let error = polyfill.lastError();
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
	},
	storageSyncSet: function (items, success, fail) {
		if (environment.chrome) {
			chrome.storage.sync.set(items,
				function (response) {
					let error = polyfill.lastError();
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
	},
	runtimeGetBrowserInfo: function (success, fail) {
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
	},
	runtimeOpenOptionsPage: function (success, fail) {
		if (environment.chrome) {
			chrome.runtime.openOptionsPage(
				function (response) {
					let error = polyfill.lastError();
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
	},
	browserActionSetIcon: function (details, success, fail) {
		if (environment.chrome) {
			chrome.browserAction.setIcon(details,
				function (response) {
					let error = polyfill.lastError();
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
};

polyfill.runtimeGetBrowserInfo(function (response) {
	// browser version
	environment.version = parseInt(response.version) || 1.0;
	environment.name = response.name;
});