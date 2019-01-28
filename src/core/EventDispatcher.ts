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