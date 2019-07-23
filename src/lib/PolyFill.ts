/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2019 Salar Khalilzadeh <salar2k@gmail.com>
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
	public static tabsGet(tabId: number, success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.tabs.get(tabId,
				(tabInfo: any) => {
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
	public static tabsGetCurrent(success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.tabs.getCurrent(
				(tabInfo: any) => {
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
			browser.tabs.getCurrent()
				.then(success, fail);
		}
	}
	public static tabsRemove(tabIds: number | number[], success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.tabs.remove(tabIds,
				(tabInfo: any) => {
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

	public static tabsReload(tabId: number, success?: Function, fail?: Function, reloadProperties?: any) {
		if (environment.chrome) {
			chrome.tabs.reload(tabId, reloadProperties,
				(tabInfo: any) => {
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
	public static tabsQuery(queryInfo: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.tabs.query(queryInfo,
				(tabs: any) => {
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
	public static tabsCreate(createProperties: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.tabs.create(createProperties,
				(tabInfo: any) => {
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
	public static runtimeSendMessage(message: any, success?: Function, fail?: Function, options?: any, extensionId?: string) {
		if (environment.chrome) {
			if (options != null) {
				// deleting firefox specific property of sending message to PAC
				delete options["toProxyScript"];
			}
			chrome.runtime.sendMessage(extensionId,
				message,
				options,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			let promise = browser.runtime.sendMessage(
				extensionId,
				message,
				options
			)
			if (success || fail)
				promise.then(success, fail);
		}
	}
	public static managementGetSelf(success: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.management.getSelf(
				(response: any) => {
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
	public static storageLocalGet(keys: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.storage.local.get(keys,
				(response: any) => {
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
	public static storageLocalSet(items: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.storage.local.set(items,
				(response: any) => {
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
	public static storageSyncGet(keys: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.storage.sync.get(keys,
				(response: any) => {
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
	public static storageSyncSet(items: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.storage.sync.set(items,
				(response: any) => {
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
	public static runtimeGetBrowserInfo(success: Function, fail?: Function) {
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
	public static runtimeOpenOptionsPage(success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.runtime.openOptionsPage(
				(response: any) => {
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
	public static browserActionSetIcon(details: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.browserAction.setIcon(details,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			if (browser.browserAction["setIcon"])
				browser.browserAction.setIcon(details)
					.then(success, fail);
		}
	}
	public static browserActionSetBadgeText(details: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.browserAction.setBadgeText(details,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			if (browser.browserAction["setBadgeText"])
				browser.browserAction.setBadgeText(details)
					.then(success, fail);
		}
	}
	public static browserActionSetBadgeBackgroundColor(details: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.browserAction.setBadgeBackgroundColor(details,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			if (browser.browserAction["setBadgeBackgroundColor"])
				browser.browserAction.setBadgeBackgroundColor(details)
					.then(success, fail);
		}
	}
	public static browserGetProxySettings(success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.proxy.settings.get(
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			// doc: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/types/BrowserSetting/get
			browser.proxy.settings.get({})
				.then(success, fail);
		}
	}
	public static browserSetProxySettings(details: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.proxy.settings.set(details,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			// doc: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/types/BrowserSetting/set
			browser.proxy.settings.set(details)
				.then(success, fail);
		}
	}
	public static browserCommandsGetAll(success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.commands.getAll(
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			if (browser["commands"])
				browser.commands.getAll()
					.then(success, fail);
		}
	}
	public static browserNotificationsCreate(notificationId: string, options: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			chrome.notifications.create(notificationId, options,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			browser.notifications.create(notificationId, options)
				.then(success, fail);
		}
	}
}

PolyFill.runtimeGetBrowserInfo((response: any) => {
	environment.version = parseInt(response.version) || 1.0;
	environment.name = response.name;
});