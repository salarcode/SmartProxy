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
import { SpecialRequestApplyProxyMode, ProxyServer } from "./definitions";

export class ProxyEngineSpecialRequests {

	private static SpecialUrls: {} = {};

	/** Marks this url as a one-off special url, with special proxy settings.
	 * The character casing of the Url is not important, since the requested URL and received request should have same casing  */
	public static setSpecialUrl(url: string, applyProxy: SpecialRequestApplyProxyMode, selectedProxy?: ProxyServer) {
		ProxyEngineSpecialRequests.SpecialUrls[url] = {
			applyMode: applyProxy,
			selectedProxy: selectedProxy
		};
	}

	public static getProxyMode(url: string, removeSpecial: boolean = true): {
		applyMode: SpecialRequestApplyProxyMode,
		selectedProxy: ProxyServer
	} | null {

		var specialUrl = ProxyEngineSpecialRequests.SpecialUrls[url];
		if (specialUrl) {
			if (removeSpecial)
				delete ProxyEngineSpecialRequests.SpecialUrls[url];
			return specialUrl;
		}
		return null;
	}
}