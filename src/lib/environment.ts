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
export let environment = {
	chrome: false,
	name: "general",
	version: 1.0,
	/** do not use directly, call PolyFill.getExtensionVersion */
	extensionVersion: '',
	mobile: false,
	manifestV3: false,
	notSupported: {
		setProxySettings: false,
		keyboardShortcuts: false
	},
	notAllowed: {
		setProxySettings: false
	},
	bugFreeVersions: {
		firefoxToProxyScript: 56,
		firefoxConfirmInPopupWorks: 57,
		firefoxNewPacScriptReturnData: 57
	},
	initialConfig: {
		// special/different config for the environment
		displayTooltipOnBadge: true
	},
	storageQuota: {
		syncQuotaBytesPerItem() {
			if (environment.chrome) {
				// https://developer.chrome.com/apps/storage#property-sync
				// QUOTA_BYTES_PER_ITEM = 8,192
				return 8000;
			} else {
				// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/sync
				// Maximum item size = 8192
				return 8000;
			}
		}
	},
	browserConfig: {
		name: "Default",
		marketName: "Extensions",
		marketUrl: ""
	}
};

export var api: any = {};
declare var chrome: any;

if (typeof (browser) != 'undefined') {
	api = browser;
}
else if (typeof (chrome) != 'undefined') {
	api = chrome;
	environment.chrome = true;
}

// browserAction refill
if (api["browserAction"])
	api.action = api["browserAction"];
else if (api["action"])
	api.browserAction = api["action"];

if (!api["windows"]) {
	environment.mobile = true;
}
else {
	if (api.runtime["getBrowserInfo"])
		// getBrowserInfo is Firefox only API 
		api.runtime.getBrowserInfo().then(details => {
			if (details.name == "Fennec")
				environment.mobile = true;
		});
}
