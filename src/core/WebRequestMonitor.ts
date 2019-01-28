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
import { Debug } from "../lib/Debug";
import { Utils } from "../lib/Utils";

export class WebRequestMonitor {
    static isMonitoring = false;
    static monitorCallback: Function = null;
    static requestTimeoutTime: 5000;
    static timer = null;
    static requests = {};
    static debugInfo = false;

    public static startMonitor(callback: Function) {

        if (WebRequestMonitor.isMonitoring)
            return;

        browser.webRequest.onBeforeRequest.addListener(WebRequestMonitor.events.onBeforeRequest,
            { urls: ["<all_urls>"] }
        );
        browser.webRequest.onHeadersReceived.addListener(WebRequestMonitor.events.onHeadersReceived,
            { urls: ["<all_urls>"] }
        );
        browser.webRequest.onBeforeRedirect.addListener(WebRequestMonitor.events.onBeforeRedirect,
            { urls: ["<all_urls>"] }
        );
        browser.webRequest.onErrorOccurred.addListener(WebRequestMonitor.events.onErrorOccurred,
            { urls: ["<all_urls>"] }
        );
        browser.webRequest.onCompleted.addListener(WebRequestMonitor.events.onCompleted,
            { urls: ["<all_urls>"] }
        );
        WebRequestMonitor.monitorCallback = callback;
        WebRequestMonitor.isMonitoring = true;
    }

    static timerTick() {

        let now = Date.now();
        let reqIds = Object.keys(WebRequestMonitor.requests);
        let requestTimeoutTime = WebRequestMonitor.requestTimeoutTime;

        for (let i = reqIds.length - 1; i >= 0; i--) {
            let reqId = reqIds[i];

            if (reqId === undefined)
                continue;

            // get the request info
            let req = WebRequestMonitor.requests[reqId];
            if (!req) continue;

            if (now - req._startTime < requestTimeoutTime) {
                continue;
            } else {
                req._isTimedOut = true;

                // callback request-timeout
                WebRequestMonitor.raiseCallback(RequestMonitorEvent.RequestTimeout, req);

                if (WebRequestMonitor.debugInfo)
                    WebRequestMonitor.logMessage(RequestMonitorEvent[RequestMonitorEvent.RequestTimeout], req);
            }
        }
    }

    static raiseCallback(...args) {
        if (WebRequestMonitor.monitorCallback)
            WebRequestMonitor.monitorCallback.apply(this, arguments);
    }

    static logMessage(message, requestDetails, additional?) {
        Debug.log(`${requestDetails.tabId}-${requestDetails.requestId}>`, message, requestDetails.url, additional || "");
    }

    static events = {
        onBeforeRequest: function (requestDetails) {
            if (requestDetails.tabId < 0) {
                return;
            }

            let reqInfo = requestDetails;
            reqInfo._startTime = new Date();
            reqInfo._isHealthy = false;

            // add to requests
            WebRequestMonitor.requests[requestDetails.requestId] = requestDetails;

            if (!WebRequestMonitor.timer) {
                WebRequestMonitor.timer = setInterval(WebRequestMonitor.timerTick, 1500);
            }

            // callback request-start
            WebRequestMonitor.raiseCallback(RequestMonitorEvent.RequestStart, requestDetails);

            if (WebRequestMonitor.debugInfo)
                WebRequestMonitor.logMessage(RequestMonitorEvent[RequestMonitorEvent.RequestStart], requestDetails);

        },
        onHeadersReceived: function (requestDetails) {
            let req = WebRequestMonitor.requests[requestDetails.requestId];
            if (!req)
                return;

            req._isHealthy = true;

            if (req._isTimedOut) {
                // call the callbacks indicating the request is healthy
                // callback request-revert-from-timeout
                WebRequestMonitor.raiseCallback(RequestMonitorEvent.RequestRevertTimeout, requestDetails);

                if (WebRequestMonitor.debugInfo)
                    WebRequestMonitor.logMessage(RequestMonitorEvent[RequestMonitorEvent.RequestRevertTimeout], requestDetails);
            }
        },
        onBeforeRedirect: function (requestDetails) {
            let url = requestDetails.redirectUrl;
            if (!url)
                return;

            // callback request-revert-from-timeout
            WebRequestMonitor.raiseCallback(RequestMonitorEvent.RequestRedirected, requestDetails);

            if (WebRequestMonitor.debugInfo)
                WebRequestMonitor.logMessage(RequestMonitorEvent[RequestMonitorEvent.RequestRedirected], requestDetails, "to> " + requestDetails.redirectUrl);

            // because 'requestId' doesn't change for redirects
            // the request is basically is still the same
            // note that 'request-start' will happen after redirect

            if (Utils.isUrlLocal(url)) {
                // request is completed when redirecting to local pages
                WebRequestMonitor.events.onCompleted(requestDetails);
            }
        },
        onCompleted: function (requestDetails) {
            if (requestDetails.tabId < 0) {
                return;
            }

            delete WebRequestMonitor.requests[requestDetails.requestId];

            // callback request-complete
            WebRequestMonitor.raiseCallback(RequestMonitorEvent.RequestComplete, requestDetails);

            if (WebRequestMonitor.debugInfo)
                WebRequestMonitor.logMessage(RequestMonitorEvent[RequestMonitorEvent.RequestComplete], requestDetails);
        },
        onErrorOccurred: function (requestDetails) {

            let req = WebRequestMonitor.requests[requestDetails.requestId];
            delete WebRequestMonitor.requests[requestDetails.requestId];

            if (!req)
                return;

            if (requestDetails.tabId < 0) {
                return;
            }
            if (requestDetails.error === "net::ERR_INCOMPLETE_CHUNKED_ENCODING") {
                return;
            }
            if (requestDetails.error.indexOf("BLOCKED") >= 0) {
                return;
            }
            if (requestDetails.error.indexOf("net::ERR_FILE_") === 0) {
                return;
            }
            if (requestDetails.error.indexOf("NS_ERROR_ABORT") === 0) {
                return;
            }
            let checkUrl: string = requestDetails.url.toLowerCase();
            if (checkUrl.startsWith("file:") ||
                checkUrl.startsWith("chrome:") ||
                checkUrl.startsWith("about:") ||
                checkUrl.startsWith("data:") ||
                checkUrl.startsWith("moz-")) {
                return;
            }
            if (checkUrl.includes("://127.0.0.1")) {
                return;
            }

            if (requestDetails.error === "net::ERR_ABORTED") {
                if (req.timeoutCalled && !req.noTimeout) {

                    // callback request-timeout-aborted
                    WebRequestMonitor.raiseCallback(RequestMonitorEvent.RequestTimeoutAborted, requestDetails);

                    if (WebRequestMonitor.debugInfo)
                        WebRequestMonitor.logMessage(RequestMonitorEvent[RequestMonitorEvent.RequestTimeoutAborted], requestDetails);

                }
                return;
            }

            // callback request-error
            WebRequestMonitor.raiseCallback(RequestMonitorEvent.RequestError, requestDetails);

            if (WebRequestMonitor.debugInfo)
                WebRequestMonitor.logMessage(RequestMonitorEvent[RequestMonitorEvent.RequestError], requestDetails);
        }
    }
}

export enum RequestMonitorEvent {
    RequestStart,
    RequestTimeout,
    RequestRevertTimeout,
    RequestRedirected,
    RequestComplete,
    RequestTimeoutAborted,
    RequestError,
}