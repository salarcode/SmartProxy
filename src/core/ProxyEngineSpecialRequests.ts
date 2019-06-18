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