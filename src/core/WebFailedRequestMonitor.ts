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
import { WebRequestMonitor, RequestMonitorEvent } from "./WebRequestMonitor";
import { Core } from "./Core";
import { PolyFill } from "../lib/PolyFill";
import { ProxyRules } from "./ProxyRules";
import { Utils } from "../lib/Utils";
import { TabManager } from "./TabManager";
import { Messages, FailedRequestType, CompiledProxyRule } from "./definitions";
import { Settings } from "./Settings";
import { Debug } from "../lib/Debug";

export class WebFailedRequestMonitor {

    public static startMonitor() {
        // start the request monitor for failures
        WebRequestMonitor.startMonitor(WebFailedRequestMonitor.requestMonitorCallback);
    }

    private static notifyFailedRequestNotification: boolean = true;

    public static enableFailedRequestNotification() {
        WebFailedRequestMonitor.notifyFailedRequestNotification = true;
        Debug.log("FailedRequestNotification is Enabled");
    }

    public static disableFailedRequestNotification() {
        WebFailedRequestMonitor.notifyFailedRequestNotification = false;
        Debug.log("FailedRequestNotification is Disabled");
    }

    public static removeDomainsFromTabFailedRequests(tabId: number, domainList: string[]) {
        if (!(tabId > -1))
            return null;
        if (!domainList || !domainList.length)
            return null;

        let tabData = TabManager.getTab(tabId);

        if (!tabData)
            return null;

        let failedRequests = tabData.failedRequests;
        if (!failedRequests) return null;

        for (let domain of domainList) {
            WebFailedRequestMonitor.deleteFailedRequests(failedRequests, domain);
        }

        // rechecking the failed requests
        failedRequests.forEach((request, key, map) => {
            let testResult = ProxyRules.testSingleRule(request.domain);

            if (testResult.match) {
                WebFailedRequestMonitor.deleteFailedRequests(failedRequests, request.domain);
            }
        });

        return failedRequests;
    }

    private static requestMonitorCallback(eventType: RequestMonitorEvent, requestDetails: any) {

        if (!Settings.current.options.detectRequestFailures)
            return;

        let tabId = requestDetails.tabId;
        if (tabId < 0)
            return null;

        let tabData = TabManager.getOrSetTab(tabId, false);

        if (!tabData)
            return;

        let requestUrl = requestDetails.url;
        let requestHost = Utils.extractHostFromUrl(requestUrl);

        if (WebFailedRequestMonitor.checkIfDomainIgnored(requestHost)) {
            // no logging or reporting requested to ignore domains
            return;
        }

        let failedRequests = tabData.failedRequests || (tabData.failedRequests = new Map<string, FailedRequestType>());

        switch (eventType) {
            case RequestMonitorEvent.RequestComplete:
            case RequestMonitorEvent.RequestRevertTimeout:
                {
                    // remove the log
                    let removed = WebFailedRequestMonitor.deleteFailedRequests(failedRequests, requestHost);

                    if (removed) {
                        // if there was an entry

                        // send message to the tab
                        WebFailedRequestMonitor.sendWebFailedRequestNotification(
                            tabId,
                            null,
                            failedRequests);

                        Core.setBrowserActionStatus(tabData);
                    }
                    break;
                }

            case RequestMonitorEvent.RequestRedirected:
                {
                    let failedInfo = failedRequests.get(requestHost);
                    if (!failedInfo) {

                        // considering redirect as complete
                        WebFailedRequestMonitor.deleteFailedRequests(failedRequests, requestHost);

                        // send message to the tab
                        WebFailedRequestMonitor.sendWebFailedRequestNotification(
                            tabId,
                            failedInfo,
                            failedRequests);

                        Core.setBrowserActionStatus(tabData);
                    }

                    break;
                }

            case RequestMonitorEvent.RequestTimeoutAborted:
                {
                    // request is either aborted or timeout, doesn't matter
                    // it should not be considered as failed.

                    let failedInfo = failedRequests.get(requestHost);
                    if (!failedInfo) {

                        // send message to the tab
                        WebFailedRequestMonitor.sendWebFailedRequestNotification(
                            tabId,
                            failedInfo,
                            failedRequests);

                        Core.setBrowserActionStatus(tabData);
                    }

                    break;
                }

            case RequestMonitorEvent.RequestTimeout:
            case RequestMonitorEvent.RequestError:
                {
                    let failedInfo = failedRequests.get(requestHost);
                    if (failedInfo) {
                        if (eventType == RequestMonitorEvent.RequestError) {
                            // only on error increase hit count
                            failedInfo.hitCount += 1;
                        }
                    } else {

                        let shouldNotify = false;
                        let requestHostSubDomains = Utils.extractSubdomainListFromHost(requestHost);
                        if (requestHostSubDomains && requestHostSubDomains.length > 1) {

                            let multiTestResultList = ProxyRules.testMultipleRule(requestHostSubDomains);
                            let requestHostRule: CompiledProxyRule = null;

                            // checking if the request itself has rule or not
                            for (let result of multiTestResultList) {
                                if (result.match &&
                                    result.domain == requestHost) {

                                    requestHostRule = result.rule;
                                    break;
                                }
                            }

                            // add only if the request doesn't have rule
                            if (requestHostRule == null) {
                                // adding the sub-domains and top-level domain all together
                                for (let i = 0; i < multiTestResultList.length; i++) {
                                    let resultRule = multiTestResultList[i];

                                    let ruleIsForThisHost = false;
                                    // check to see if the matched rule is for this host or not!
                                    if (resultRule.hostName == requestHostSubDomains[i]) {
                                        ruleIsForThisHost = true;
                                    }

                                    failedInfo = new FailedRequestType();
                                    failedInfo.url = requestDetails.url;
                                    failedInfo.domain = resultRule.domain;
                                    failedInfo.hitCount = 1;
                                    failedInfo.hasRule = resultRule.match;
                                    failedInfo.ruleId = resultRule.rule?.ruleId;
                                    failedInfo.isRuleForThisHost = ruleIsForThisHost;
                                    failedInfo.isRootHost = requestHost == resultRule.domain;

                                    WebFailedRequestMonitor.checkIfFailureIgnored(failedInfo, resultRule.domain);

                                    // add to the list
                                    failedRequests.set(resultRule.domain, failedInfo);
                                    if (!resultRule.match)
                                        shouldNotify = true;
                                }
                            } else {
                                // the root has match, just add it to prevent further checks
                                failedInfo = new FailedRequestType();
                                failedInfo.url = requestDetails.url;
                                failedInfo.domain = requestHost;
                                failedInfo.hitCount = 1;
                                failedInfo.hasRule = true;
                                failedInfo.ruleId = requestHostRule.ruleId;

                                WebFailedRequestMonitor.checkIfFailureIgnored(failedInfo, requestHost);

                                // add to the list
                                failedRequests.set(requestHost, failedInfo);
                            }

                            if (shouldNotify) {
                                // send message to the tab
                                // only on the first hit
                                WebFailedRequestMonitor.sendWebFailedRequestNotification(
                                    tabId,
                                    failedInfo,
                                    failedRequests);

                                Core.setBrowserActionStatus(tabData);
                            }

                        } else {
                            failedInfo = new FailedRequestType();
                            failedInfo.url = requestDetails.url;
                            failedInfo.domain = requestHost;
                            failedInfo.hitCount = 1;
                            failedInfo.hasRule = false;


                            let testResult = ProxyRules.testSingleRule(requestUrl);
                            if (testResult.match) {
                                // there is a rule for this url, so don't bother
                                // we are just adding this to prevent
                                // further call to 'proxyRules.testSingleRule' which is expensive
                                failedInfo.hasRule = true;
                                failedInfo.ruleId = testResult.rule?.ruleId;
                            }

                            WebFailedRequestMonitor.checkIfFailureIgnored(failedInfo, requestHost);

                            // add to the list
                            failedRequests.set(requestHost, failedInfo);

                            // send only if there is no rule
                            if (!failedInfo.hasRule && !failedInfo.ignored) {
                                // send message to the tab
                                // only on the first hit
                                WebFailedRequestMonitor.sendWebFailedRequestNotification(
                                    tabId,
                                    failedInfo,
                                    failedRequests);

                                Core.setBrowserActionStatus(tabData);
                            }
                        }
                    }
                }
        }
    }

    private static checkIfFailureIgnored(failedInfo: FailedRequestType, requestHost: string) {

        let ignoredDomains = Settings.current.options.ignoreRequestFailuresForDomains;
        if (ignoredDomains && ignoredDomains.length) {

            if (ignoredDomains.indexOf(requestHost) !== -1)
                failedInfo.ignored = true;
        }
    }

    private static checkIfDomainIgnored(requestHost: string): boolean {

        let ignoredDomains = Settings.current.options.ignoreRequestFailuresForDomains;
        if (ignoredDomains && ignoredDomains.length) {

            if (ignoredDomains.indexOf(requestHost) !== -1)
                return true;
        }
        return false;
    }

    private static sendWebFailedRequestNotification(tabId: number, failedInfo: FailedRequestType, failedRequests: Map<string, FailedRequestType>) {
        if (!WebFailedRequestMonitor.notifyFailedRequestNotification)
            return;

        PolyFill.runtimeSendMessage(
            {
                command: Messages.WebFailedRequestNotification,
                tabId: tabId,
                failedRequests: WebFailedRequestMonitor.convertFailedRequestsToArray(failedRequests),
                //failedInfo: failedInfo TODO: not used? remove then.
            },
            null,
            error => {
                if (error && error["message"] &&
                    error.message.includes("Could not establish connection")) {
                    WebFailedRequestMonitor.disableFailedRequestNotification();
                }
            });
    }

    /** Converts failed requests to array */
    public static convertFailedRequestsToArray(failedRequests: Map<string, FailedRequestType>): FailedRequestType[] {

        let result: FailedRequestType[] = [];

        failedRequests.forEach((value, key, map) => {
            result.push(value);
        });

        return result;
    }

    /** Number of un-proxified requests */
    public static failedRequestsNotProxifiedCount(failedRequests: Map<string, FailedRequestType>): number {
        let failedCount = 0;

        failedRequests.forEach((request, key, map) => {
            if (request.hasRule || request.ignored)
                return;

            if (request.isRootHost)
                failedCount += request.hitCount;
        });

        return failedCount;
    }

    /** Remove the domain from failed list. Also removed the parent if parent doesn't any other subdomain. */
    private static deleteFailedRequests(failedRequests: Map<string, FailedRequestType>, requestHost: string): boolean {

        if (requestHost == null)
            return false;

        let isRemoved = failedRequests.delete(requestHost);

        let subDomains = Utils.extractSubdomainListFromHost(requestHost);
        if (subDomains && subDomains.length) {
            subDomains.reverse();

            subDomains.forEach((subDomain, index) => {

                let domainHasSubDomain = false;
                failedRequests.forEach((request, requestDomainKey, map) => {
                    if (domainHasSubDomain)
                        return;
                    if (requestDomainKey.endsWith("." + subDomain)) {
                        domainHasSubDomain = true;
                    }
                });

                if (domainHasSubDomain)
                    return;

                let removed = failedRequests.delete(subDomain);
                isRemoved = removed || isRemoved;
            });
        }
        return isRemoved;
    }

}