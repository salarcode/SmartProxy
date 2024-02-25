/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2024 Salar Khalilzadeh <salar2k@gmail.com>
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
import { SmartProfileType } from "./definitions";
import { api, environment } from '../lib/environment';
import { TabDataType, TabManager } from "./TabManager";
import { WebFailedRequestMonitor } from "./WebFailedRequestMonitor";

export class Icons {

	public static getBrowserActionTitle(profileType: SmartProfileType) {
		let extensionName = api.i18n.getMessage('extensionName');
		switch (profileType) {
			case SmartProfileType.Direct:
				return `${extensionName} : ${api.i18n.getMessage('popupNoProxy')}`;

			case SmartProfileType.AlwaysEnabledBypassRules:
				return `${extensionName} : ${api.i18n.getMessage('popupAlwaysEnable')}`;

			case SmartProfileType.SystemProxy:
				return `${extensionName} : ${api.i18n.getMessage('popupSystemProxy')}`;

			case SmartProfileType.SmartRules:
			default:
				return `${extensionName} : ${api.i18n.getMessage('popupSmartProxy')}`;
		}
	}

	public static getBrowserActionIcon(profileType: SmartProfileType, tabData?: TabDataType) {
		let iconFile = Icons.getBrowserActionIconKey(profileType, tabData);
		iconFile = `icons/${iconFile}`;

		if (environment.chrome) {
			return {
				path: {
					16: `${iconFile}-16.png`,
					32: `${iconFile}-32.png`,
					48: `${iconFile}-48.png`,
					128: `${iconFile}-128.png`,
				}
			}
		}
		else {
			// Only Firefox supports SVG
			return {
				path: `${iconFile}.svg`
			}
		}
	}

	private static getBrowserActionIconKey(profileType: SmartProfileType, tabData?: TabDataType) {
		switch (profileType) {
			// ---
			case SmartProfileType.Direct:
				return 'profile-disabled';

			// ---
			case SmartProfileType.SystemProxy:
				return 'profile-system';
		}

		if (tabData == null)
			tabData = TabManager.getCurrentTab();

		if (!tabData)
			return 'smartproxy';


		// ---
		if (profileType == SmartProfileType.AlwaysEnabledBypassRules) {

			if (tabData.status.hasAlwaysEnabledByPassed) {
				return 'profile-always-bypassed';
			}

			return 'profile-always';
		}

		// ---
		if (profileType == SmartProfileType.SmartRules) {
			if (tabData.proxified) {

				if (tabData.status.statsHasDirectRequest) {
					return 'profile-smartrules-has-unmatched';
				}
				if (tabData.status.statsHasWhitelistedRules) {
					return 'profile-smartrules-has-bypassed';
				}
				let failedCount = WebFailedRequestMonitor.failedRequestsNotProxifiedCount(tabData.failedRequests);
				if (failedCount > 0) {
					return 'profile-smartrules-has-failed';
				}

				return 'profile-smartrules-greeen';
			}
			else {
				if (tabData.status.statsHasProxifiedRequest)
					return 'profile-smartrules-noproxy-has-matched';

				return 'smartproxy';
				/* For later reference

					if (tabData.status.statsHasProxifiedRequest)
						return 'profile-smartrules-noproxy-warn';
					else
						return 'profile-smartrules-noproxy';
				 */
			}
		}

		// default
		return 'smartproxy';
	}
	/* For later reference
	private static iconDataCache = {};
	private static getBrowserActionIconAsPng(profileType: SmartProfileType, tabData?: TabDataType) {
		let iconFile = `icons/${Icons.getBrowserActionIconKey(profileType, tabData)}.svg`;
		iconFile = PolyFill.extensionGetURL(iconFile);

		// reading from cache
		let iconDataCache = Icons.iconDataCache;
		let iconData = iconDataCache[iconFile];

		if (iconData)
			return iconData;

		(async () => {

			iconData = {};
			iconData[16] = await Icons.convertSvgFileToPng(iconFile, 16, 16);
			iconData[24] = await Icons.convertSvgFileToPng(iconFile, 24, 24);
			iconData[48] = await Icons.convertSvgFileToPng(iconFile, 48, 48);
			iconData[96] = await Icons.convertSvgFileToPng(iconFile, 96, 96);
		})();

		if (!iconData)
			// setting the cache
			Icons.iconDataCache[iconFile] = iconData;

		return iconData;
	}

	private static async convertSvgFileToPng(svgFileUrl: string, width: number, height: number): Promise<ImageData> {

		// Create an SVG image element
		const svgImage = new Image();
		svgImage.src = svgFileUrl;

		// Wait for the SVG image to load
		await new Promise(resolve => {
			svgImage.onload = resolve;
		});

		// Create a canvas element
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');

		// Set canvas dimensions based on the SVG image
		canvas.width = width; // original size svgImage.width;
		canvas.height = height;// original size svgImage.height;

		// Draw the SVG image onto the canvas
		ctx.drawImage(svgImage, 0, 0, width, height);

		// Convert canvas content to PNG image data
		const imageData = ctx.getImageData(0, 0, width, height);

		return imageData;
	}

	private static async convertSvgStringToPng(svgString: string): Promise<ImageData> {

		// Create an SVG image element
		const svgImage = new Image();
		svgImage.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

		// Wait for the SVG image to load
		await new Promise(resolve => {
			svgImage.onload = resolve;
		});

		// Create a canvas element
		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');

		// Set canvas dimensions based on the SVG image
		canvas.width = svgImage.width;
		canvas.height = svgImage.height;

		// Draw the SVG image onto the canvas
		ctx.drawImage(svgImage, 0, 0);

		// Convert canvas content to PNG image data
		const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

		return imageData;
	}*/
}