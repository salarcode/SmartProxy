/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2022 Salar Khalilzadeh <salar2k@gmail.com>
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
import { CommandMessages, FailedRequestType, CompiledProxyRule } from "./definitions";
import { Settings } from "./Settings";
import { Debug, DiagDebug } from "../lib/Debug";

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

	/** Domain is being added to the rules list, so removing it from failed requests list */
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

		let settingsActive = Settings.active;
		let activeSmartProfile = settingsActive.activeProfile;

		// rechecking the failed requests
		failedRequests.forEach((request, key, map) => {
			let testResult = ProxyRules.findMatchedDomainInRulesInfo(request.domain, activeSmartProfile.compiledRules);

			if (testResult != null) {
				WebFailedRequestMonitor.deleteFailedRequests(failedRequests, request.domain);
			}
		});

		return failedRequests;
	}

	/** Monitor entry point */
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
		if (WebFailedRequestMonitor.checkIfUrlIgnored(requestUrl)) {
			// no logging or reporting requested to ignore domains
			return;
		}

		let requestHost = Utils.extractHostFromUrl(requestUrl);
		let failedRequests = tabData.failedRequests || (tabData.failedRequests = new Map<string, FailedRequestType>());

		DiagDebug?.trace("WebFailedRequestMonitorCall", tabId, RequestMonitorEvent[eventType], requestHost);

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

						let settingsActive = Settings.active;
						let activeSmartProfile = settingsActive.activeProfile;

						let shouldNotifyFailures = false;
						let proxyableDomainList = Utils.extractSubdomainListFromHost(requestHost);
						if (proxyableDomainList && proxyableDomainList.length > 1) {

							let multiTestResultList = ProxyRules.findMatchedDomainListInRulesInfo(proxyableDomainList, activeSmartProfile.compiledRules);
							let requestHostRule: CompiledProxyRule = null;

							// checking if the request itself has rule or not
							for (let result of multiTestResultList) {
								if (result &&
									result.compiledRule.hostName == requestHost) {

									requestHostRule = result.compiledRule;
									break;
								}
							}

							// add only if the request doesn't have rule
							if (requestHostRule == null) {

								// adding the sub-domains and top-level domain all together
								for (let i = 0; i < multiTestResultList.length; i++) {
									let resultRuleInfo = multiTestResultList[i];
									let resultRule = resultRuleInfo?.compiledRule;
									let domain = proxyableDomainList[i];
									let matchedHost = resultRule?.hostName || domain;

									failedInfo = new FailedRequestType();
									failedInfo.url = requestDetails.url;
									failedInfo.domain = domain;
									failedInfo.hitCount = 1;

									let ruleIsForThisHost = false;
									if (resultRule != null) {
										// check to see if the matched rule is for this host or not!
										if (resultRule.hostName == domain) {
											ruleIsForThisHost = true;
										}

										failedInfo.hasRule = true;
										failedInfo.ruleId = resultRule.ruleId;
										failedInfo.isRuleForThisHost = ruleIsForThisHost;
									}
									else {
										failedInfo.hasRule = false;
										failedInfo.ruleId = null;
										failedInfo.isRuleForThisHost = false;

										shouldNotifyFailures = true;
									}
									failedInfo.isRootHost = requestHost == matchedHost;

									WebFailedRequestMonitor.markIgnoreDomain(failedInfo, domain);
									// add to the list
									failedRequests.set(domain, failedInfo);
								}
							} else {
								// the root has match, just add it to prevent further checks
								failedInfo = new FailedRequestType();
								failedInfo.url = requestDetails.url;
								failedInfo.domain = requestHost;
								failedInfo.hitCount = 1;
								failedInfo.hasRule = true;
								failedInfo.ruleId = requestHostRule.ruleId;

								WebFailedRequestMonitor.markIgnoreDomain(failedInfo, requestHost);

								// add to the list
								failedRequests.set(requestHost, failedInfo);
							}

							if (shouldNotifyFailures) {
								// send message to the tab
								// only on the first hit
								WebFailedRequestMonitor.sendWebFailedRequestNotification(
									tabId,
									failedInfo,
									failedRequests);

								Core.setBrowserActionStatus(tabData);
							}

						} else if (proxyableDomainList && proxyableDomainList.length == 1) {
							failedInfo = new FailedRequestType();
							failedInfo.url = requestDetails.url;
							failedInfo.domain = requestHost;
							failedInfo.hitCount = 1;
							failedInfo.hasRule = false;

							let testResult = ProxyRules.findMatchedUrlInRulesInfo(requestUrl, activeSmartProfile.compiledRules);

							if (testResult != null) {
								// there is a rule for this url, so don't bother
								// we are just adding this to prevent
								// further call to 'proxyRules.testSingleRule' which is expensive
								failedInfo.hasRule = true;
								failedInfo.ruleId = testResult.compiledRule.ruleId;
							}

							WebFailedRequestMonitor.markIgnoreDomain(failedInfo, requestHost);

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

	/** Marks the a failed request to be ignored if it is requested by user using the ignore rules. */
	private static markIgnoreDomain(failedInfo: FailedRequestType, requestHost: string) {

		if (WebFailedRequestMonitor.checkIfDomainIgnored(requestHost)) {
			Debug.info("markIgnoreDomain=true", requestHost, failedInfo);
			failedInfo.ignored = true;
		}
	}

	private static checkIfUrlIgnored(requestUrl: string): boolean {

		let ignoreFailureProfile = Settings.active.currentIgnoreFailureProfile;
		if (!ignoreFailureProfile)
			return false;

		let matchedRule = ProxyRules.findMatchedUrlInRules(requestUrl, ignoreFailureProfile.compiledRules.Rules);
		if (matchedRule) {
			return true;
		}

		return false;
	}

	/** Checks if a domain is in ignore rules list */
	private static checkIfDomainIgnored(requestHost: string): boolean {

		let ignoreFailureProfile = Settings.active.currentIgnoreFailureProfile;
		if (!ignoreFailureProfile)
			return false;

		let matchedRule = ProxyRules.findMatchedDomainRule(requestHost, ignoreFailureProfile.compiledRules.Rules);
		if (matchedRule) {
			return true;
		}

		return false;
	}

	private static sendWebFailedRequestNotification(tabId: number, failedInfo: FailedRequestType, failedRequests: Map<string, FailedRequestType>) {
		if (!WebFailedRequestMonitor.notifyFailedRequestNotification)
			return;

		PolyFill.runtimeSendMessage(
			{
				command: CommandMessages.WebFailedRequestNotification,
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