/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2020 Salar Khalilzadeh <salar2k@gmail.com>
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
import { Settings } from "./Settings";
import { ProxyImporter } from "../lib/ProxyImporter";
import { SettingsOperation } from "./SettingsOperation";
import { RuleImporter } from "../lib/RuleImporter";
import { ProxyEngine } from "./ProxyEngine";
import { ProxyServer, SubscriptionProxyRule } from "./definitions";

export class SubscriptionUpdater {
    private static serverSubscriptionTimers: SubscriptionTimerType[] = [{ id: null, name: null, refreshRate: null }];
    private static rulesSubscriptionTimers: SubscriptionTimerType[] = [{ id: null, name: null, refreshRate: null }];

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

    public static updateServerSubscriptions() {

        // -------------------------
        // Proxy Server Subscriptions
        let serverExistingNames: string[] = [];
        for (let subscription of Settings.current.proxyServerSubscriptions) {
            if (!subscription.enabled)
                continue;

            // refresh is not requested
            if (!(subscription.refreshRate > 0))
                continue;

            // it should be active, don't remove it
            serverExistingNames.push(subscription.name);

            let shouldCreate = false;
            let serverTimerInfo = SubscriptionUpdater.getServerSubscriptionTimer(subscription.name);
            if (serverTimerInfo == null) {
                // should be created
                shouldCreate = true;
            } else {

                // should be updated if rates are changed
                if (serverTimerInfo.timer.refreshRate != subscription.refreshRate) {
                    shouldCreate = true;
                    clearInterval(serverTimerInfo.timer.id);

                    // remove from array
                    SubscriptionUpdater.serverSubscriptionTimers.splice(serverTimerInfo.index, 1);
                }
            }

            if (shouldCreate) {
                let internal = subscription.refreshRate * 60 * 1000;
                //internal = 1000;

                let id = setInterval(
                    SubscriptionUpdater.readServerSubscription,
                    internal,
                    subscription.name);

                SubscriptionUpdater.serverSubscriptionTimers.push({
                    id: id,
                    name: subscription.name,
                    refreshRate: subscription.refreshRate
                });
            }
        }
        // remove the remaining timers
        let remainingTimers = SubscriptionUpdater.serverSubscriptionTimers.filter(timer => {
            // not used or removed. Just unregister it then remove it
            if (serverExistingNames.indexOf(timer.name) === -1) {
                clearInterval(timer.id);
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
            let serverTimerInfo = SubscriptionUpdater.getServerSubscriptionTimer(subscriptionName);

            if (!serverTimerInfo)
                return;

            clearInterval(serverTimerInfo.timer.id);
            SubscriptionUpdater.serverSubscriptionTimers.splice(serverTimerInfo.index, 1);
            return;
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

                    SettingsOperation.saveProxyServerSubscriptions();
                    SettingsOperation.saveAllSync(false);

                } else {
                    Debug.warn("Failed to read proxy server subscription: " + subscriptionName);
                }
            },
            function (error: Error) {
                Debug.warn("Failed to read proxy server subscription: " + subscriptionName, subscription, error);
            });
    }

    public static async reloadEmptyRulesSubscriptions() {
        /// Read subscriptions that are enabled but have no rules defined
        /// This method is async to prevent unnecessary blocking

        for (let subscription of Settings.current.proxyRulesSubscriptions) {
            if (!subscription.enabled)
                continue;

            // ignore if already have proxies
            if ((subscription.proxyRules != null && subscription.proxyRules.length) ||
                (subscription.whitelistRules != null && subscription.whitelistRules.length))
                continue;

            SubscriptionUpdater.readRulesSubscription(subscription.name);
        }
    }

    public static updateRulesSubscriptions() {

        // -------------------------
        // Proxy Rules Subscriptions
        let ruleExistingNames: string[] = [];
        for (let subscription of Settings.current.proxyRulesSubscriptions) {
            if (!subscription.enabled)
                continue;

            // refresh is not requested
            if (!(subscription.refreshRate > 0))
                continue;

            // it should be active, don't remove it
            ruleExistingNames.push(subscription.name);

            let shouldCreate = false;
            let ruleTimerInfo = SubscriptionUpdater.getRulesSubscriptionTimer(subscription.name);
            if (ruleTimerInfo == null) {
                // should be created
                shouldCreate = true;
            } else {

                // should be updated if rates are changed
                if (ruleTimerInfo.timer.refreshRate != subscription.refreshRate) {
                    shouldCreate = true;
                    clearInterval(ruleTimerInfo.timer.id);

                    // remove from array
                    SubscriptionUpdater.rulesSubscriptionTimers.splice(ruleTimerInfo.index, 1);
                }
            }

            if (shouldCreate) {
                let internal = subscription.refreshRate * 60 * 1000;
                //internal = 1000;

                let id = setInterval(
                    SubscriptionUpdater.readRulesSubscription,
                    internal,
                    subscription.name);

                SubscriptionUpdater.rulesSubscriptionTimers.push({
                    id: id,
                    name: subscription.name,
                    refreshRate: subscription.refreshRate
                });
            }
        }
        // remove the remaining timers
        let remainingTimers = SubscriptionUpdater.rulesSubscriptionTimers.filter(timer => {
            // not used or removed. Just unregister it then remove it
            if (ruleExistingNames.indexOf(timer.name) === -1) {
                clearInterval(timer.id);
                return false;
            }

            // it is created or updated, don't remove it
            return true;
        });
        SubscriptionUpdater.rulesSubscriptionTimers = remainingTimers;

    }

    private static readRulesSubscription(subscriptionName: string) {
        Debug.log("readRulesSubscription", subscriptionName);
        if (!subscriptionName)
            return;

        let subscription = Settings.current.proxyRulesSubscriptions.find(item => item.name === subscriptionName);
        if (!subscription) {
            // the subscription is removed.
            //remove the timer
            let rulesTimerInfo = SubscriptionUpdater.getRulesSubscriptionTimer(subscriptionName);

            if (!rulesTimerInfo)
                return;

            clearInterval(rulesTimerInfo.timer.id);
            SubscriptionUpdater.rulesSubscriptionTimers.splice(rulesTimerInfo.index, 1);
            return;
        }

        RuleImporter.readFromServer(subscription,
            function (response: {
                success: boolean,
                message: string,
                result: {
                    whiteList: SubscriptionProxyRule[],
                    blackList: SubscriptionProxyRule[]
                }
            }) {
                if (!response) return;

                if (response.success) {

                    subscription.proxyRules = response.result.blackList;
                    subscription.whitelistRules = response.result.whiteList;
                    subscription.totalCount = response.result.blackList.length + response.result.whiteList.length;

                    SettingsOperation.saveProxyServerSubscriptions();
                    SettingsOperation.saveAllSync(false);

                    ProxyEngine.notifyProxyRulesChanged();

                } else {
                    Debug.warn("Failed to read proxy rules subscription: " + subscriptionName);
                }
            },
            function (error: Error) {
                Debug.warn("Failed to read proxy rules subscription: " + subscriptionName, subscription, error);
            });
    }

    private static _getSubscriptionTimer(timers: SubscriptionTimerType[], name: string)
        : {
            timer: SubscriptionTimerType,
            index: number
        } {
        let index = timers.findIndex(timer => timer.name === name);
        if (index >= 0) {
            return {
                timer: timers[index],
                index: index
            };
        }
        return null;
    }

    private static getServerSubscriptionTimer(name: string)
        : {
            timer: SubscriptionTimerType,
            index: number
        } {
        return SubscriptionUpdater._getSubscriptionTimer(SubscriptionUpdater.serverSubscriptionTimers, name);
    }

    private static getRulesSubscriptionTimer(name: string)
        : {
            timer: SubscriptionTimerType,
            index: number
        } {
        return SubscriptionUpdater._getSubscriptionTimer(SubscriptionUpdater.rulesSubscriptionTimers, name);
    }
}

type SubscriptionTimerType = { id: number, name: string, refreshRate: number };