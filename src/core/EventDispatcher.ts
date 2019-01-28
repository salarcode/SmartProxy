import { environment } from "../lib/environment";
import { PolyFill } from "../lib/PolyFill";
import { Settings } from "./Settings";
import { Debug } from "../lib/Debug";

export class PacScriptEventDispatcher {

    public static notifyProxyModeChange() {
        // only for Firefox
        if (environment.chrome)
            return;

        PolyFill.runtimeSendMessage(
            {
                // TODO: command string
                command: "proxyModeChanged",
                proxyMode: Settings.current.proxyMode
            },
            null,
            error => {
                Debug.error("notifyProxyModeChange failed with ", error);
            },
            {
                toProxyScript: true
            });
    }
    public static notifyProxyRulesChange() {

        // only for Firefox
        if (environment.chrome)
            return;

        PolyFill.runtimeSendMessage(
            {
                // TODO: command string
                command: "proxyRulesChanged",
                proxyRules: Settings.current.proxyRules
            },
            null,
            error => {
                Debug.error("notifyProxyRulesChange failed with ", error);
            },
            {
                toProxyScript: true
            });
    }
    public static notifyBypassChanged() {

        // only for Firefox
        if (environment.chrome)
            return;

        PolyFill.runtimeSendMessage(
            {
                // TODO: command string
                command: "bypassChanged",
                bypass: Settings.current.bypass
            },
            null,
            error => {
                Debug.error("notifyBypassChanged failed with ", error);
            },
            {
                toProxyScript: true
            });
    }
    public static notifyActiveProxyServerChange() {

        // only for Firefox
        if (environment.chrome)
            return;

        PolyFill.runtimeSendMessage(
            {
                // TODO: command string
                command: "activeProxyServerChanged",
                activeProxyServer: Settings.current.activeProxyServer
            },
            null,
            error => {
                Debug.error("notifyActiveProxyServerChange failed with ", error);
            },
            {
                toProxyScript: true
            });
    }
}