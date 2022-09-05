/** Currently this is only for Google Chrome */

import { Debug } from "../../lib/Debug";
import { Core } from "../Core";

self.addEventListener("activate", (event) => {
	Debug.log('CoreServiceWorker.activate DONE');
});

self.addEventListener("install", (event) => {
	Debug.log('CoreServiceWorker.install...', event);
	Core.initializeFromServiceWorker();
	Debug.log('CoreServiceWorker.install DONE');
});
