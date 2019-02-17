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
import { PacScriptEventDispatcher } from "./PacScriptEventDispatcher";
import { ProxyRules } from "./ProxyRules";
import { Settings } from "./Settings";
import { ProxyEngineFirefox } from "./ProxyEngineFirefox";
import { environment, browser } from "../lib/environment";
import { ProxyEngineChrome } from "./ProxyEngineChrome";

export class ProxyEngine {

    public static registerEngine() {
        if (environment.chrome) {
            this.updateChromeProxyConfig();
        }
        else {
            ProxyEngineFirefox.register();
            this.updateFirefoxProxyConfig();
        }

        this.notifyCompileRules(false);
    }

    public static notifySettingsOptionsChanged() {

        // update proxy rules
        this.updateFirefoxProxyConfig();
        this.updateChromeProxyConfig();
    }

    public static notifyProxyModeChanged() {
        // send it to the proxy server
        PacScriptEventDispatcher.notifyProxyModeChange();

        // update proxy rules
        this.updateFirefoxProxyConfig();
        this.updateChromeProxyConfig();
    }

    public static notifyActiveProxyServerChanged() {

        // notify
        PacScriptEventDispatcher.notifyActiveProxyServerChange();

        // update proxy rules
        this.updateFirefoxProxyConfig();
        this.updateChromeProxyConfig();
    }

    public static notifyProxyRulesChanged() {

        this.notifyCompileRules();

        // update proxy rules
        this.updateChromeProxyConfig();
        this.updateFirefoxProxyConfig();
    }

    private static notifyCompileRules(sendMessage: boolean = true) {

        if (sendMessage)
            PacScriptEventDispatcher.notifyProxyRulesChange();

        // update proxy rules
        this.updateChromeProxyConfig();
        this.updateFirefoxProxyConfig();

        // TODO: is this only in firefox
        // update proxy rules
        ProxyRules.compileRules(Settings.current.proxyRules);
    }

    public static notifyBypassChanged() {

        PacScriptEventDispatcher.notifyBypassChanged();

        // update proxy rules
        this.updateChromeProxyConfig();
        this.updateFirefoxProxyConfig();
    }


    public static updateChromeProxyConfig() {
        if (!environment.chrome)
            return;

        ProxyEngineChrome.updateChromeProxyConfig();
    }

    public static updateFirefoxProxyConfig() {
        if (environment.chrome)
            return;

        ProxyEngineFirefox.updateFirefoxProxyConfig();
    }
}