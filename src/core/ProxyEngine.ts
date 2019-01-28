import { PacScriptEventDispatcher } from "./EventDispatcher";
import { ProxyRules } from "./ProxyRules";
import { Settings } from "./Settings";
import { ProxyEngineFirefox } from "./ProxyEngineFirefox";
import { environment } from "../lib/environment";

export class ProxyEngine {

    public static registerEngine() {
        if (environment.chrome) {
            throw "Chrome proxy not implemented";
        }
        else {
            ProxyEngineFirefox.register();
        }

        this.notifyCompileRules(false);
    }

    public static notifySettingsOptionsChanged() {

        // update proxy rules
        this.updateChromeProxyConfig();
    }

    public static notifyProxyModeChanged() {
        // send it to the proxy server
        PacScriptEventDispatcher.notifyProxyModeChange();

        // update proxy rules
        this.updateChromeProxyConfig();
    }

    public static notifyActiveProxyServerChanged() {

        // notify
        PacScriptEventDispatcher.notifyActiveProxyServerChange();

        // update proxy rules
        this.updateChromeProxyConfig();
    }

    public static notifyProxyRulesChanged() {

        this.notifyCompileRules();

        // update proxy rules
        this.updateChromeProxyConfig();
    }

    private static notifyCompileRules(sendMessage: boolean = true) {

        if (sendMessage)
            PacScriptEventDispatcher.notifyProxyRulesChange();

        // update proxy rules
        this.updateChromeProxyConfig();

        // TODO: is this only in firefox
        // update proxy rules
        ProxyRules.compileRules(Settings.current.proxyRules);
    }

    public static notifyBypassChanged() {

        PacScriptEventDispatcher.notifyBypassChanged();

        // update proxy rules
        this.updateChromeProxyConfig();
    }


    public static updateChromeProxyConfig() {
        // ProxyRules.updateChromeProxyConfig()
    }


}