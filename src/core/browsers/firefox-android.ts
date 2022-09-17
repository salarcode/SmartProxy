import { environment } from "../../lib/environment";

environment.browserConfig = {
    name: "Firefox",
    marketName: "Firefox Add-ons",
    marketUrl: "https://addons.mozilla.org/en-US/firefox/addon/smartproxy/"
};
environment.notSupported.keyboardShortcuts = true;
environment.initialConfig.displayTooltipOnBadge = false;
environment.mobile = true;