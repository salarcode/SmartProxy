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
import { Debug } from '../lib/Debug';
import { Utils } from '../lib/Utils';
import { browser } from '../lib/environment';
import { monitorUrlsSchemaFilter } from './definitions';
import { TabDataType, TabManager } from './TabManager';

export class WebRequestMonitor {
	private static isMonitoring = false;
	private static monitorCallback: Function = null;
	private static requestTimeoutTime: 5000;
	private static timer: any = null;
	private static requests: { [index: string]: any } = {};
	private static debugInfo = false;

	public static startMonitor(callback: Function) {
		if (WebRequestMonitor.isMonitoring) return;

		browser.webRequest.onBeforeRequest.addListener(WebRequestMonitor.events.onBeforeRequest, {
			urls: monitorUrlsSchemaFilter,
		});
		browser.webRequest.onHeadersReceived.addListener(WebRequestMonitor.events.onHeadersReceived, {
			urls: monitorUrlsSchemaFilter,
		});
		browser.webRequest.onBeforeRedirect.addListener(WebRequestMonitor.events.onBeforeRedirect, {
			urls: monitorUrlsSchemaFilter,
		});
		browser.webRequest.onErrorOccurred.addListener(WebRequestMonitor.events.onErrorOccurred, {
			urls: monitorUrlsSchemaFilter,
		});
		browser.webRequest.onCompleted.addListener(WebRequestMonitor.events.onCompleted, {
			urls: monitorUrlsSchemaFilter,
		});
		// unsubscribing when tab got removed
		TabManager.TabRemoved.on(WebRequestMonitor.events.onTabRemovedInternal);

		WebRequestMonitor.monitorCallback = callback;
		WebRequestMonitor.isMonitoring = true;
	}

	private static timerTick() {
		let now = Date.now();
		let reqIds = Object.keys(WebRequestMonitor.requests);
		let requestTimeoutTime = WebRequestMonitor.requestTimeoutTime;

		for (let i = reqIds.length - 1; i >= 0; i--) {
			let reqId = reqIds[i];

			if (reqId === undefined) continue;

			// get the request info
			let req = WebRequestMonitor.requests[reqId];
			if (!req)
				continue;

			if (now - req._startTime < requestTimeoutTime) {
				continue;
			}

			// NOTE: here the time constantly send timeout notifications to the callback
			// we need this because the 'host' that has error can lost the error mark if another successful request from the same 'host' happens

			req._isTimedOut = true;

			// callback request-timeout
			WebRequestMonitor.raiseCallback(RequestMonitorEvent.RequestTimeout, req);

			if (WebRequestMonitor.debugInfo)
				WebRequestMonitor.logMessage(RequestMonitorEvent[RequestMonitorEvent.RequestTimeout], req);
		}
	}

	private static raiseCallback(...args: any) {
		if (WebRequestMonitor.monitorCallback)
			WebRequestMonitor.monitorCallback.apply(this, arguments);
	}

	private static logMessage(message: any, requestDetails: any, additional?: any) {
		Debug.log(`${requestDetails.tabId}-${requestDetails.requestId}>`, message, requestDetails.url, additional || '');
	}

	private static findRequestByUrl(url) {
		let requests = WebRequestMonitor.requests;
		let matched = [];
		for (const key in requests) {
			let req = requests[key];

			if (!req)
				continue;

			if (req["url"] === url)
				matched.push(req);
		}
		return matched;
	}

	private static popArrayAndCallback(array: any[], callback: Function) {
		while (array.length) {
			// remove and return item
			const item = array.shift();
			try {
				callback(item);
			} catch (error) {
				console.error('popArrayAndCallback failed for', item, error);
			}
		}
	}

	private static events = {
		onBeforeRequest(requestDetails: any) {
			let reqInfo = requestDetails;

			if (requestDetails.tabId < 0) {
				let sameUrlRequests = WebRequestMonitor.findRequestByUrl(requestDetails.url);
				if (!sameUrlRequests.length) {
					// no related request in tabs, don't monitor
					return;
				}
				reqInfo._relatedRequests = sameUrlRequests;

				// referencing self to others
				for (const req of sameUrlRequests) {
					if (!req._relatedRequests)
						req._relatedRequests = [reqInfo];
					else
						req._relatedRequests.push(reqInfo);
				}
			}

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
		onHeadersReceived(requestDetails: any) {
			let req = WebRequestMonitor.requests[requestDetails.requestId];
			if (!req) return;

			req._isHealthy = true;

			if (req._isTimedOut) {
				req._isTimedOut = false;

				// call the callbacks indicating the request is healthy
				// callback request-revert-from-timeout
				WebRequestMonitor.raiseCallback(RequestMonitorEvent.RequestRevertTimeout, requestDetails);

				if (WebRequestMonitor.debugInfo)
					WebRequestMonitor.logMessage(RequestMonitorEvent[RequestMonitorEvent.RequestRevertTimeout], requestDetails);
			}
		},
		onBeforeRedirect(requestDetails: any) {

			let url = requestDetails.redirectUrl;
			if (!url) return;

			// callback request-revert-from-timeout
			WebRequestMonitor.raiseCallback(RequestMonitorEvent.RequestRedirected, requestDetails);

			if (WebRequestMonitor.debugInfo)
				WebRequestMonitor.logMessage(
					RequestMonitorEvent[RequestMonitorEvent.RequestRedirected],
					requestDetails,
					'to> ' + requestDetails.redirectUrl,
				);

			// because 'requestId' doesn't change for redirects
			// the request is basically is still the same
			// note that 'request-start' will happen after redirect

			if (Utils.isUrlLocal(url)) {
				// request is completed when redirecting to local pages
				WebRequestMonitor.events.onCompleted(requestDetails);
				return;
			}

			let req = WebRequestMonitor.requests[requestDetails.requestId];
			if (req && req.url === url) {
				// if redirect url is same as the url itself, mark completed
				WebRequestMonitor.events.onCompleted(requestDetails);
			}
		},
		onCompleted(requestDetails: any) {
			let req = WebRequestMonitor.requests[requestDetails.requestId];
			if (!req) {
				// not monitored request
				return;
			}

			if (req._relatedRequests && req._relatedRequests.length) {
				// calling related on complete events
				WebRequestMonitor.popArrayAndCallback(req._relatedRequests, WebRequestMonitor.events.onCompleted);

				// needs double check this request again
				req = WebRequestMonitor.requests[requestDetails.requestId];
				if (!req) {
					// already removed from monitor
					return;
				}
			}

			// making sure there is no property, even no null one
			delete WebRequestMonitor.requests[requestDetails.requestId];

			// callback request-complete
			WebRequestMonitor.raiseCallback(RequestMonitorEvent.RequestComplete, requestDetails);

			if (WebRequestMonitor.debugInfo)
				WebRequestMonitor.logMessage(RequestMonitorEvent[RequestMonitorEvent.RequestComplete], requestDetails);
		},
		onErrorOccurred(requestDetails: any) {
			let req = WebRequestMonitor.requests[requestDetails.requestId];
			delete WebRequestMonitor.requests[requestDetails.requestId];

			if (!req) return;

			if (req._relatedRequests && req._relatedRequests.length) {
				// calling related on complete events
				WebRequestMonitor.popArrayAndCallback(req._relatedRequests, WebRequestMonitor.events.onErrorOccurred);

				// needs double check this request again
				req = WebRequestMonitor.requests[requestDetails.requestId];
				if (!req) {
					// already removed from monitor
					return;
				}
			}

			if (requestDetails.tabId < 0) {
				return;
			}
			if (requestDetails.error === 'net::ERR_INCOMPLETE_CHUNKED_ENCODING') {
				return;
			}
			if (requestDetails.error.indexOf('BLOCKED') >= 0) {
				return;
			}
			if (requestDetails.error.indexOf('net::ERR_FILE_') === 0) {
				return;
			}
			if (requestDetails.error.indexOf('NS_ERROR_ABORT') === 0) {
				return;
			}
			let checkUrl: string = requestDetails.url.toLowerCase();
			if (
				checkUrl.startsWith('file:') ||
				checkUrl.startsWith('chrome:') ||
				checkUrl.startsWith('edge:') ||
				checkUrl.startsWith('about:') ||
				checkUrl.startsWith('data:') ||
				checkUrl.startsWith('moz-')
			) {
				return;
			}
			if (checkUrl.includes('://127.0.0.1')) {
				return;
			}

			if (requestDetails.error === 'net::ERR_ABORTED') {
				if (req.timeoutCalled && !req.noTimeout) {
					// callback request-timeout-aborted
					WebRequestMonitor.raiseCallback(RequestMonitorEvent.RequestTimeoutAborted, requestDetails);

					if (WebRequestMonitor.debugInfo)
						WebRequestMonitor.logMessage(
							RequestMonitorEvent[RequestMonitorEvent.RequestTimeoutAborted],
							requestDetails,
						);
				}
				return;
			}

			// callback request-error
			WebRequestMonitor.raiseCallback(RequestMonitorEvent.RequestError, requestDetails);

			if (WebRequestMonitor.debugInfo)
				WebRequestMonitor.logMessage(RequestMonitorEvent[RequestMonitorEvent.RequestError], requestDetails);
		},
		onTabRemovedInternal(tabData: TabDataType) {
			let tabId = tabData?.tabId;
			if (!tabId)
				return;

			for (const requestId in WebRequestMonitor.requests) {
				const req = WebRequestMonitor.requests[requestId];
			
				if (req && req.tabId == tabId) {
					delete WebRequestMonitor.requests[requestId];
				}
			}
		}
	};
}

export enum RequestMonitorEvent {
	RequestStart,
	RequestTimeout,
	/** When was timed-out but eventually headers are received  */
	RequestRevertTimeout,
	RequestRedirected,
	RequestComplete,
	RequestTimeoutAborted,
	RequestError,
}
