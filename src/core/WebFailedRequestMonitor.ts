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
import { Messages, FailedRequestType } from "./definitions";

export class WebFailedRequestMonitor {

    public static startMonitor() {
        // start the request monitor for failures
        WebRequestMonitor.startMonitor(WebFailedRequestMonitor.requestMonitorCallback);
    }

    public static removeDomainsFromTabFailedRequests(tabId: number, domainList: string[]) {
        if (!(tabId > -1))
            return null;
        if (!domainList || !domainList.length)
            return null;

        let tabData = TabManager.getOrSetTab(tabId, false);

        if (!tabData)
            return null;

        let failedRequests = tabData.failedRequests;
        if (!failedRequests) return null;

        for (let domain of domainList) {
            failedRequests.delete(domain);
        }

        // rechecking the failed requests
        failedRequests.forEach((request, key, map) => {
	        let testResult = ProxyRules.testSingleRule(request.domain);

	        if (testResult.match) {
		        failedRequests.delete(request.domain);
	        }
        });

        return failedRequests;
    }

    private static requestMonitorCallback(eventType: RequestMonitorEvent, requestDetails: any) {
        let tabId = requestDetails.tabId;
        let tabData = TabManager.getOrSetTab(tabId, false);

        if (!tabData)
            return;

        let requestId = requestDetails.requestId;
        let requestUrl = requestDetails.url;
        let requestHost = Utils.extractHostFromUrl(requestUrl);

        let failedRequests = tabData.failedRequests || (tabData.failedRequests = new Map<string, FailedRequestType>());

        switch (eventType) {
            case RequestMonitorEvent.RequestComplete:
            case RequestMonitorEvent.RequestRevertTimeout:
                {
                    // remove the log
                    var removed = failedRequests.delete(requestHost);

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
                    // here we check that the redirected location is in black-listed urls or not
                    // if it is black-listed then it should be considered to be added to filter suggestions
                    // BUG No #37: https://github.com/salarcode/SmartProxy/issues/37

                    // TODO: Implement in vFuture BUG #37
                    let redirectUrl = requestDetails.redirectUrl;

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

            case RequestMonitorEvent.RequestTimeoutAborted:
                {
                    // request is either aborted or timeout, doesn't matter
                    // it should not be considered as failed.

                    let failedInfo = failedRequests.get(requestHost);
                    if (!failedInfo) {

                        // remove the log
                        //TODO: failedRequests.delete(requestHost);

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
                        // only on error increase hit count
                        failedInfo.hitCount += 1;
                    } else {

                        let shouldNotify = false;
                        let requestHostSubDomains = Utils.extractSubdomainListFromHost(requestHost);
                        if (requestHostSubDomains && requestHostSubDomains.length > 1) {

                            let multiTestResultList = ProxyRules.testMultipleRule(requestHostSubDomains);
                            let requestHostHasRule = false;

                            // checking if the request itself has rule or not
                            for (let result of multiTestResultList) {
                                if (result.match &&
                                    result.domain == requestHost) {

                                    requestHostHasRule = true;
                                    break;
                                }
                            }

                            // add only if the request doesn't have rule
                            if (!requestHostHasRule) {
                                // adding the sub-domains and top-level domain all together
                                for (let i = 0; i < multiTestResultList.length; i++) {
                                    let result = multiTestResultList[i];

                                    let ruleIsForThisHost = false;
                                    // check to see if the matched rule is for this host or not!
                                    if (result.sourceDomain == requestHostSubDomains[i]) {
                                        ruleIsForThisHost = true;
                                    }

                                    failedInfo = new FailedRequestType();
                                    failedInfo.url = requestDetails.url;
                                    failedInfo.domain = result.domain;
                                    failedInfo.hitCount = 1;
                                    failedInfo.hasRule = result.match;
                                    failedInfo.ruleIsForThisHost = ruleIsForThisHost;
                                    failedInfo.isRootHost = requestHost == result.domain;

                                    // add to the list
                                    failedRequests.set(result.domain, failedInfo);
                                    if (!result.match)
                                        shouldNotify = true;
                                }
                            } else {
                                // the root has match, just add it to prevent further checks
                                failedInfo = new FailedRequestType();
                                failedInfo.url = requestDetails.url;
                                failedInfo.domain = requestHost;
                                failedInfo.hitCount = 1;
                                failedInfo.hasRule = true;

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
                            }

                            // add to the list
                            failedRequests.set(requestHost, failedInfo);

                            // send only if there is no rule
                            if (!failedInfo.hasRule) {
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

    private static sendWebFailedRequestNotification(tabId: string, failedInfo: FailedRequestType, failedRequests: Map<string, FailedRequestType>) {
        PolyFill.runtimeSendMessage(
            {
                command: Messages.WebFailedRequestNotification,
                tabId: tabId,
                failedRequests: WebFailedRequestMonitor.convertFailedRequestsToArray(failedRequests),
                failedInfo: failedInfo
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
	        if (request.hasRule)
		        return;

	        if (request.isRootHost)
		        failedCount += request.hitCount;
        });

        return failedCount;
    }

}