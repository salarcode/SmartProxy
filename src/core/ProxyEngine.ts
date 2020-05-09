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
import { ProxyRules } from "./ProxyRules";
import { ProxyEngineFirefox } from "./ProxyEngineFirefox";
import { environment } from "../lib/environment";
import { ProxyEngineChrome } from "./ProxyEngineChrome";

export class ProxyEngine {

    public static registerEngine() {
        if (!environment.chrome) {
            ProxyEngineFirefox.register();
        }
        else {
            // chrome engine is registered below after rule compiles
        }

        // update proxy rules
        ProxyRules.compileRules();

        // Updates Firefox & Chrome proxy configurations also registers Chrome Engine
        this.updateBrowsersProxyConfig();
    }

    /** Updates Firefox & Chrome proxy configurations  */
    public static updateBrowsersProxyConfig() {

        // update proxy config
        this.updateFirefoxProxyConfig();

        // also registers Chrome engine
        this.updateChromeProxyConfig();
    }

    public static notifyProxyRulesChanged() {

        // update proxy rules
        ProxyRules.compileRules();

        // update proxy rules
        this.updateBrowsersProxyConfig();
    }

    /** Registers Chrome engine & updates the configurations for Chrome  */
    private static updateChromeProxyConfig() {
        if (!environment.chrome)
            return;

        ProxyEngineChrome.updateChromeProxyConfig();
    }

    /** Updates the configurations for Firefox  */
    private static updateFirefoxProxyConfig() {
        if (environment.chrome)
            return;

        ProxyEngineFirefox.updateFirefoxProxyConfig();
    }
}