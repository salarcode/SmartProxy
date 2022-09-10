import { environment } from "../../lib/environment";

environment.browserConfig = {
    name: "Thunderbird",
    marketName: "Thunderbird Add-ons",
    marketUrl: "https://addons.thunderbird.net/en-US/thunderbird/addon/smartproxy/"
};
environment.notSupported.setProxySettings = true;
environment.initialConfig.displayTooltipOnBadge = false;