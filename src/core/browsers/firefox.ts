import { environment } from "../../lib/environment";

environment.browserConfig = {
    name: "Firefox",
    marketName: "Firefox Add-ons",
    marketUrl: "https://addons.mozilla.org/en-US/firefox/addon/smartproxy/"
};

if (typeof (navigator) != 'undefined' && navigator?.userAgent?.toLowerCase().includes("mobile")) {
    environment.notSupported.keyboardShortcuts = true;
    environment.initialConfig.displayTooltipOnBadge = false;
    environment.mobile = true;
}