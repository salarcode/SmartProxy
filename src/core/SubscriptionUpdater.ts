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
import { Debug, DiagDebug } from "../lib/Debug";
import { Settings } from "./Settings";
import { ProxyImporter } from "../lib/ProxyImporter";
import { SettingsOperation } from "./SettingsOperation";
import { RuleImporter } from "../lib/RuleImporter";
import { ProxyEngine } from "./ProxyEngine";
import { ImportedProxyRule, ProxyRulesSubscription, ProxyServer, SubscriptionStats } from "./definitions";

export class SubscriptionUpdater {
	private static serverSubscriptionTimers: SubscriptionTimerType[] = [{ timerId: null, subscriptionId: null, refreshRate: null }];
	private static rulesSubscriptionTimers: SubscriptionTimerType[] = [{ timerId: null, subscriptionId: null, refreshRate: null }];

	public static async reloadEmptyServerSubscriptions() {
		/// Read subscriptions that are enabled but have no proxy
		/// This method is async to prevent unnecessary blocking

		for (let subscription of Settings.current.proxyServerSubscriptions) {
			if (!subscription.enabled)
				continue;

			// ignore if already have proxies
			if (subscription.proxies != null && subscription.proxies.length)
				continue;

			SubscriptionUpdater.readServerSubscription(subscription.name);
		}
	}

	public static setServerSubscriptionsRefreshTimers() {
		// -------------------------
		// Proxy Server Subscriptions
		let serverExistingNames: string[] = [];
		for (let subscription of Settings.current.proxyServerSubscriptions) {
			DiagDebug?.trace("updateServerSubscriptions", `enabled:` + subscription.enabled, 'refreshRate:' + subscription.refreshRate);

			// if disabled or refresh is not requested
			if (!subscription.enabled || !(subscription.refreshRate > 0)) {
				let existingTimerInfo = SubscriptionUpdater.getServerSubscriptionIdTimer(subscription.name);
				if (existingTimerInfo?.timer) {
					clearInterval(existingTimerInfo.timer.timerId);

					// remove from array
					SubscriptionUpdater.serverSubscriptionTimers.splice(existingTimerInfo.index, 1);
				}
				continue;
			}

			// it should be active, don't remove it
			serverExistingNames.push(subscription.name);

			let shouldCreate = false;
			let serverTimerInfo = SubscriptionUpdater.getServerSubscriptionIdTimer(subscription.name);
			if (serverTimerInfo == null) {
				// should be created
				shouldCreate = true;
			} else {

				// should be updated if rates are changed
				if (serverTimerInfo.timer.refreshRate != subscription.refreshRate) {
					shouldCreate = true;
					clearInterval(serverTimerInfo.timer.timerId);

					// remove from array
					SubscriptionUpdater.serverSubscriptionTimers.splice(serverTimerInfo.index, 1);
				}
			}

			if (shouldCreate) {
				let nextFetchInMs: number;
				if (subscription.stats?.lastTryDate) {
					const timeSinceLastTry =
						Date.now() -
						(new Date(subscription.stats.lastTryDate)).getTime();
					nextFetchInMs = Math.max(
						subscription.refreshRate * 60 * 1000 - timeSinceLastTry,
						0
					);
				} else {
					nextFetchInMs = 0;
				}

				// This is like `setInterval`, but with an offset first invocation.
				// Yes, `clearInterval` also works on `setTimeout` IDs.
				const setTimeoutId = setTimeout(() => {
					SubscriptionUpdater.readServerSubscription(subscription.name);

					// Start using `setInterval` from now on.
					const intervalId = setInterval(
						SubscriptionUpdater.readServerSubscription,
						subscription.refreshRate * 60 * 1000,
						subscription.name
					);
					timerObj.timerId = intervalId;
				}, nextFetchInMs);

				const timerObj = {
					timerId: setTimeoutId,
					subscriptionId: subscription.name,
					refreshRate: subscription.refreshRate
				}
				SubscriptionUpdater.serverSubscriptionTimers.push(timerObj);
			}
		}
		// remove the remaining timers
		let remainingTimers = SubscriptionUpdater.serverSubscriptionTimers.filter(timer => {
			// not used or removed. Just unregister it then remove it
			if (serverExistingNames.indexOf(timer.subscriptionId) === -1) {
				clearInterval(timer.timerId);
				return false;
			}

			// it is created or updated, don't remove it
			return true;
		});
		SubscriptionUpdater.serverSubscriptionTimers = remainingTimers;
	}

	private static readServerSubscription(subscriptionName: string) {
		Debug.log("readServerSubscription", subscriptionName);
		if (!subscriptionName)
			return;

		let subscription = Settings.current.proxyServerSubscriptions.find(item => item.name === subscriptionName);
		if (!subscription) {
			// the subscription is removed.
			//remove the timer
			let serverTimerInfo = SubscriptionUpdater.getServerSubscriptionIdTimer(subscriptionName);

			if (!serverTimerInfo)
				return;

			clearInterval(serverTimerInfo.timer.timerId);
			SubscriptionUpdater.serverSubscriptionTimers.splice(serverTimerInfo.index, 1);
			return;
		}
		if (!subscription.stats) {
			subscription.stats = new SubscriptionStats();
		}

		ProxyImporter.readFromServer(subscription,
			function (response: {
				success: boolean,
				message: string,
				result: ProxyServer[]
			}) {
				if (!response) return;

				if (response.success) {
					let count = response.result.length;

					subscription.proxies = response.result;
					subscription.totalCount = count;

					SubscriptionStats.updateStats(subscription.stats, true);

					SettingsOperation.saveProxyServerSubscriptions();
					SettingsOperation.saveAllSync(false);

				} else {
					SubscriptionStats.updateStats(subscription.stats, false);
					Debug.warn("Failed to read proxy server subscription: " + subscriptionName);
				}
			},
			function (error: Error) {
				SubscriptionStats.updateStats(subscription.stats, false, error);
				Debug.warn("Failed to read proxy server subscription: " + subscriptionName, subscription, error);
			});
	}

	public static async reloadEmptyRulesSubscriptions() {
		/// Read subscriptions that are enabled but have no rules defined
		/// This method is async to prevent unnecessary blocking

		for (const profile of Settings.current.proxyProfiles) {
			if (!profile.rulesSubscriptions)
				continue;

			for (const subscription of profile.rulesSubscriptions) {
				if (!subscription.enabled)
					continue;

				// ignore if already have proxies
				if ((subscription.proxyRules != null && subscription.proxyRules.length) ||
					(subscription.whitelistRules != null && subscription.whitelistRules.length))
					continue;

				SubscriptionUpdater.readRulesSubscription(subscription);
			}
		}
	}

	public static setRulesSubscriptionsRefreshTimers() {
		// -------------------------
		// Proxy Rules Subscriptions
		let ruleExistingIds: string[] = [];
		for (const profile of Settings.current.proxyProfiles) {
			if (!profile.rulesSubscriptions)
				continue;

			for (const subscription of profile.rulesSubscriptions) {

				// if disabled or refresh is not requested
				if (!subscription.enabled || !(subscription.refreshRate > 0)) {
					// remove existing timers
					let existingTimerInfo = SubscriptionUpdater.getRulesSubscriptionIdTimer(subscription.id);
					if (existingTimerInfo?.timer) {
						clearInterval(existingTimerInfo.timer.timerId);

						// remove from array
						SubscriptionUpdater.rulesSubscriptionTimers.splice(existingTimerInfo.index, 1);
					}

					continue;
				}

				// it should be active, don't remove it
				ruleExistingIds.push(subscription.id);

				let shouldCreate = false;
				let ruleTimerInfo = SubscriptionUpdater.getRulesSubscriptionIdTimer(subscription.id);
				if (ruleTimerInfo == null) {
					// should be created
					shouldCreate = true;
				} else {

					// should be updated if rates are changed
					if (ruleTimerInfo.timer.refreshRate != subscription.refreshRate) {
						shouldCreate = true;
						clearInterval(ruleTimerInfo.timer.timerId);

						// remove from array
						SubscriptionUpdater.rulesSubscriptionTimers.splice(ruleTimerInfo.index, 1);
					}
				}

				if (shouldCreate) {
					let nextFetchInMs: number;
					if (subscription.stats?.lastTryDate) {
						const timeSinceLastTry =
							Date.now() -
							(new Date(subscription.stats.lastTryDate)).getTime();
						nextFetchInMs = Math.max(
							subscription.refreshRate * 60 * 1000 - timeSinceLastTry,
							0
						);
					} else {
						nextFetchInMs = 0;
					}
	
					// This is like `setInterval`, but with an offset first invocation.
					// Yes, `clearInterval` also works on `setTimeout` IDs.
					const setTimeoutId = setTimeout(() => {
						SubscriptionUpdater.readRulesSubscription(subscription);
	
						// Start using `setInterval` from now on.
						const intervalId = setInterval(
							SubscriptionUpdater.readRulesSubscription,
							subscription.refreshRate * 60 * 1000,
							subscription
						);
						timerObj.timerId = intervalId;
					}, nextFetchInMs);
	
					const timerObj = {
						timerId: setTimeoutId,
						subscriptionId: subscription.id,
						refreshRate: subscription.refreshRate
					}
					SubscriptionUpdater.rulesSubscriptionTimers.push(timerObj);
				}
			}
		}
		// remove the remaining timers
		let remainingTimers = SubscriptionUpdater.rulesSubscriptionTimers.filter(timer => {
			// not used or removed. Just unregister it then remove it
			if (ruleExistingIds.indexOf(timer.subscriptionId) === -1) {
				clearInterval(timer.timerId);
				return false;
			}

			// it is created or updated, don't remove it
			return true;
		});
		SubscriptionUpdater.rulesSubscriptionTimers = remainingTimers;
	}

	private static readRulesSubscription(subscription: ProxyRulesSubscription) {
		Debug.log("readRulesSubscription", subscription.name);
		if (!subscription || !subscription.name)
			return;

		if (!subscription) {
			// the subscription is removed.
			//remove the timer
			let rulesTimerInfo = SubscriptionUpdater.getRulesSubscriptionIdTimer(subscription.id);

			if (!rulesTimerInfo)
				return;

			clearInterval(rulesTimerInfo.timer.timerId);
			SubscriptionUpdater.rulesSubscriptionTimers.splice(rulesTimerInfo.index, 1);
			return;
		}
		if (!subscription.stats) {
			subscription.stats = new SubscriptionStats();
		}

		RuleImporter.readFromServerAndImport(subscription,
			(importResult: {
				success: boolean;
				message: string;
				rules: {
					whiteList: ImportedProxyRule[];
					blackList: ImportedProxyRule[];
				};
			}) => {
				if (!importResult) return;

				if (importResult.success) {

					subscription.proxyRules = importResult.rules.blackList;
					subscription.whitelistRules = importResult.rules.whiteList;
					subscription.totalCount = importResult.rules.blackList.length + importResult.rules.whiteList.length;

					SubscriptionStats.updateStats(subscription.stats, true);

					SettingsOperation.saveProxyServerSubscriptions();
					SettingsOperation.saveAllSync(false);

					ProxyEngine.notifyProxyRulesChanged();

				} else {
					SubscriptionStats.updateStats(subscription.stats, false);
					Debug.warn("Failed to read proxy rules subscription: " + subscription.name);
				}
			},
			function (error: Error) {
				SubscriptionStats.updateStats(subscription.stats, false, error);
				Debug.warn("Failed to read proxy rules subscription: " + subscription.name, subscription, error);
			});
	}

	private static _getSubscriptionIdTimer(timers: SubscriptionTimerType[], id: string)
		: {
			timer: SubscriptionTimerType,
			index: number
		} {
		let index = timers.findIndex(timer => timer.subscriptionId === id);
		if (index >= 0) {
			return {
				timer: timers[index],
				index: index
			};
		}
		return null;
	}

	private static getServerSubscriptionIdTimer(id: string)
		: {
			timer: SubscriptionTimerType,
			index: number
		} {
		return SubscriptionUpdater._getSubscriptionIdTimer(SubscriptionUpdater.serverSubscriptionTimers, id);
	}

	private static getRulesSubscriptionIdTimer(id: string)
		: {
			timer: SubscriptionTimerType,
			index: number
		} {
		return SubscriptionUpdater._getSubscriptionIdTimer(SubscriptionUpdater.rulesSubscriptionTimers, id);
	}
}

type SubscriptionTimerType = { timerId: NodeJS.Timer, subscriptionId: string, refreshRate: number };