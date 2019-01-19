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
import { browser, environment } from "../lib/environment";
import { Settings } from "./Settings";
import { ProxyModeType } from "./definitions";

export class ProxyAuthentication {
    static pendingRequests = {};

    public static startMonitor() {
        if (environment.chrome) {
            // chrome supports asyncBlocking
            browser.webRequest.onAuthRequired.addListener(this.onAuthRequiredChromeAsync,
                { urls: ["<all_urls>"] },
                ["asyncBlocking"]
            );
        } else {
            browser.webRequest.onAuthRequired.addListener(this.onAuthRequired,
                { urls: ["<all_urls>"] },
                ["blocking"]
            );

        }
        browser.webRequest.onCompleted.addListener(
            this.onRequestFinished,
            { urls: ["<all_urls>"] }
        );

        browser.webRequest.onErrorOccurred.addListener(
            this.onRequestFinished,
            { urls: ["<all_urls>"] }
        );
    }

    private static onAuthRequiredChromeAsync(requestDetails, asyncCallback): any {
        if (!requestDetails.isProxy) {
            asyncCallback({});
            return {};
        }
        let settings = Settings.current;

        let applyAuthentication = (settings.proxyMode !== ProxyModeType.Direct) &&
            (settings.proxyMode !== ProxyModeType.SystemProxy);

        let activeProxy = settings.activeProxyServer;

        if (!activeProxy) {
            if (asyncCallback)
                asyncCallback({});
            return {};
        }

        if (applyAuthentication &&
            activeProxy.username)
            applyAuthentication = true;
        else
            applyAuthentication = false;

        // TODO:
        // TODO: find a way to proxy authentication for proxy selected in the rule
        // TODO:

        if (asyncCallback) {
            // this is chrome

            // check if authentication is required
            if (!applyAuthentication) {

                asyncCallback({});
                return {};
            }

            // check if authentication is already provided
            if (this.pendingRequests[requestDetails.requestId]) {

                asyncCallback({ cancel: true });
                return { cancel: true };
            }

            // add this request to pending list
            this.pendingRequests[requestDetails.requestId] = true;

            asyncCallback({
                authCredentials: { username: activeProxy.username, password: activeProxy.password }
            });
        } else {
            // check if authentication is required
            if (!applyAuthentication) {
                return {};
            }

            // check if authentication is already provided
            if (this.pendingRequests[requestDetails.requestId]) {
                return { cancel: true };
            }

            // add this request to pending list
            this.pendingRequests[requestDetails.requestId] = true;

            return {
                authCredentials: { username: activeProxy.username, password: activeProxy.password }
            };
        }
    }

    private static onAuthRequired(requestDetails): any {
        if (!requestDetails.isProxy) {
            return {};
        }
        let settings = Settings.current;

        let applyAuthentication = (settings.proxyMode !== ProxyModeType.Direct) &&
            (settings.proxyMode !== ProxyModeType.SystemProxy);

        let activeProxy = settings.activeProxyServer;

        if (!activeProxy) {
            return {};
        }
        
        if (applyAuthentication &&
            activeProxy &&
            activeProxy.username)
            applyAuthentication = true;
        else
            applyAuthentication = false;

        // check if authentication is required
        if (!applyAuthentication) {
            return {};
        }

        // check if authentication is already provided
        if (this.pendingRequests[requestDetails.requestId]) {
            return { cancel: true };
        }

        // add this request to pending list
        this.pendingRequests[requestDetails.requestId] = true;

        return {
            authCredentials: { username: activeProxy.username, password: activeProxy.password }
        };
    }
    private static onRequestFinished(requestDetails) {
        delete this.pendingRequests[requestDetails.requestId];
    }
}