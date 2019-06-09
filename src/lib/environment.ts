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
	mobile: false,
	notSupported: {
		setProxySettings: false
	},
	notAllowed: {
		setProxySettings: false
	},
	bugFreeVersions: {
		firefoxToProxyScript: 56,
		firefoxConfirmInPopupWorks: 57,
		firefoxNewPacScriptReturnData: 57
	},
	storageQuota: {
		syncQuotaBytesPerItem() {
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


export var chrome: any = window["chrome"];
export var browser: any = window["browser"];

// Google Chrome polyfill
if (typeof browser === "undefined" || browser == null) {
	browser = chrome;
	environment.chrome = true;
}
if (!browser["windows"]) {
	environment.mobile = true;
}
else {
	if (browser.runtime["getBrowserInfo"])
		browser.runtime.getBrowserInfo().then(details => {
			if (details.name == "Fennec")
				environment.mobile = true;
		});
}