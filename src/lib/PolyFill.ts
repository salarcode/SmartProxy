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
import { environment, api } from "./environment";

export class PolyFill {
	public static lastError() {
		if (environment.chrome) {
			// api.extension.lastError Deprecated since Chrome 58
			return api.runtime.lastError;
		} else {
			return api.runtime.lastError;
		}
	}
	public static onProxyError() {
		if (environment.chrome) {
			return api.proxy.onProxyError;
		} else {
			if (api.proxy.onError)
				// this is under consideration for future version of Firefox #1388619
				return api.proxy.onError;
			else
				return api.proxy.onProxyError;
		}
	}
	public static tabsGet(tabId: number, success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.tabs.get(tabId,
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
			api.tabs.get(tabId)
				.then(success, fail);
		}
	}
	public static tabsGetCurrent(success?: Function, fail?: Function) {
		if (environment.chrome) {
			// Gets the tab that this script call is being made from.
			// May be undefined if called from a non-tab context (for example, a background page or popup view).
			api.tabs.getCurrent(
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
			api.tabs.getCurrent()
				.then(success, fail);
		}
	}
	public static tabsRemove(tabIds: number | number[], success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.tabs.remove(tabIds,
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
			api.tabs.remove(tabIds)
				.then(success, fail);
		}
	}
	public static tabsReload(tabId: number, success?: Function, fail?: Function, reloadProperties?: any) {
		if (environment.chrome) {
			api.tabs.reload(tabId, reloadProperties,
				(tabInfo: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(tabInfo);
					}
				});
		} else {
			api.tabs.reload(tabId, reloadProperties)
				.then(success, fail);
		}
	}
	public static tabsQuery(queryInfo: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.tabs.query(queryInfo,
				(tabs: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(tabs);
					}
				});
		} else {
			api.tabs.query(queryInfo)
				.then(success, fail);
		}
	}
	public static tabsCreate(createProperties: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.tabs.create(createProperties,
				(tabInfo: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(tabInfo);
					}
				});
		} else {
			api.tabs.create(createProperties)
				.then(success, fail);
		}
	}
	public static runtimeSendMessage(message: any, success?: Function, fail?: Function, options?: any, extensionId?: string) {
		if (environment.chrome) {
			if (options != null) {
				// deleting firefox specific property of sending message to PAC
				delete options["toProxyScript"];
			}
			api.runtime.sendMessage(extensionId,
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
			let promise = api.runtime.sendMessage(
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
			api.management.getSelf(
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			api.management.getSelf()
				.then(success, fail);
		}
	}
	public static storageLocalGet(keys: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.storage.local.get(keys,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			api.storage.local.get(keys)
				.then(success, fail);
		}
	}
	public static storageLocalSet(items: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.storage.local.set(items,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			api.storage.local.set(items)
				.then(success, fail);
		}
	}
	public static storageLocalRemove(items: string | string[], success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.storage.local.remove(items,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			api.storage.local.remove(items)
				.then(success, fail);
		}
	}
	public static storageSyncGet(keys: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.storage.sync.get(keys,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			api.storage.sync.get(keys)
				.then(success, fail);
		}
	}
	public static storageSyncSet(items: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.storage.sync.set(items,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			api.storage.sync.set(items)
				.then(success, fail);
		}
	}
	public static runtimeGetBrowserInfo(success: Function, fail?: Function) {
		if (environment.chrome) {
			// No implemented in chrome yet!
			if (fail) fail({ message: "getBrowserInfo is not implemented" });

			//api.runtime.getBrowserInfo(
			//	function (response) {
			//		const error = polyfill.lastError();
			//		if (error) {
			//			if (fail) fail(error);
			//		} else {
			//			if (success) success(response);
			//		}
			//	});
		} else {
			api.runtime.getBrowserInfo()
				.then(success, fail);
		}
	}
	public static runtimeOpenOptionsPage(success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.runtime.openOptionsPage(
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			api.runtime.openOptionsPage()
				.then(success, fail);
		}
	}
	public static browserActionSetIcon(details: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.browserAction.setIcon(details,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			if (api.browserAction["setIcon"])
				api.browserAction.setIcon(details)
					.then(success, fail);
		}
	}
	public static browserActionSetBadgeText(details: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.browserAction.setBadgeText(details,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			if (api.browserAction["setBadgeText"])
				api.browserAction.setBadgeText(details)
					.then(success, fail);
		}
	}
	public static browserActionSetBadgeBackgroundColor(details: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.browserAction.setBadgeBackgroundColor(details,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			if (api.browserAction["setBadgeBackgroundColor"])
				api.browserAction.setBadgeBackgroundColor(details)
					.then(success, fail);
		}
	}
	public static browserGetProxySettings(success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.proxy.settings.get(
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
			api.proxy.settings.get({})
				.then(success, fail);
		}
	}
	public static browserSetProxySettings(details: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.proxy.settings.set(details,
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
			api.proxy.settings.set(details)
				.then(success, fail);
		}
	}
	public static browserCommandsGetAll(success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.commands.getAll(
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			if (api["commands"])
				api.commands.getAll()
					.then(success, fail);
		}
	}
	public static browserNotificationsCreate(notificationId: string, options: any, success?: Function, fail?: Function) {
		if (environment.chrome) {
			api.notifications.create(notificationId, options,
				(response: any) => {
					let error = PolyFill.lastError();
					if (error) {
						if (fail) fail(error);
					} else {
						if (success) success(response);
					}
				});
		} else {
			api.notifications.create(notificationId, options)
				.then(success, fail);
		}
	}

	public static extensionGetURL(path: string) {
		if (environment.chrome) {

			if (api.extension["getURL"])
				return api.extension.getURL(path);

			return api.runtime.getURL(path);
		} else {
			return api.extension.getURL(path);
		}
	}
	public static getExtensionVersion(success?: Function) {
		if (environment.extensionVersion)
			success?.(environment.extensionVersion);
		else {
			PolyFill.managementGetSelf((info: any) => {
				environment.extensionVersion = info.version;
				success?.(environment.extensionVersion);
			}, null);
		}
	}
}
PolyFill.runtimeGetBrowserInfo((response: any) => {
	environment.version = parseInt(response.version) || 1.0;
	environment.name = response.name;
});
