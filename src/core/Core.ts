import { Settings } from "./Settings";
import { browser } from "../lib/environment";
import { PolyFill } from "../lib/Polyfill";
import { ProxyEngineFirefox } from "./ProxyEngineFirefox";
import { ProxyAuthentication } from "./ProxyAuthentication";

export class Core {


	/** Start the application */
	public static initializeApp() {

		Settings.onInitialized.on(() => {
			// on settings read success

			// register the proxy when config is ready
			this.registerProxy();

			//// set the title
			//internal.setBrowserActionStatus();

			//// update the timers
			//timerManagement.updateSubscriptions();

			//// check for updates, only in unlisted version
			//updateManager.readUpdateInfo();

			//// handle synced settings changes
			//browser.storage.onChanged.addListener(settingsOperation.syncOnChanged);
		});
		Settings.initialize();

		// start proxy authentication request check
		ProxyAuthentication.startMonitor();
	}

	/** Registring the PAC proxy script */
	static registerProxy() {

		if (environment.chrome) {

		}
		else {
			ProxyEngineFirefox.register();
		}
	}
}

// start the application
Core.initializeApp();
