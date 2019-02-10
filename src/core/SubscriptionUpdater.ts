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
import { Settings } from "./Settings";
import { ProxyImporter } from "../lib/ProxyImporter";
import { SettingsOperation } from "./SettingsOperation";

export class SubscriptionUpdater {
    private static serverSubscriptionTimers: SubscriptionTimerType[] = [{ id: null, name: null, refreshRate: null }];
    private static rulesSubscriptionTimers: SubscriptionTimerType[] = [{ id: null, name: null, refreshRate: null }];
    public static updateSubscriptions() {

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

        // -------------------------
        // Proxy Rules Subscriptions
        // TODO:
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
            function (response) {
                if (!response) return;

                if (response.success) {
                    let count = response.result.length;

                    subscription.proxies = response.result;
                    subscription.totalCount = count;

                    SettingsOperation.saveProxyServerSubscriptions();
                    SettingsOperation.saveAllSync();

                } else {
                    Debug.warn("Failed to read proxy server subscription: " + subscriptionName);
                }
            },
            function (error) {
                Debug.warn("Failed to read proxy server subscription: " + subscriptionName, subscription, error);
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

    private static getRulesSubscriptionTimersTimer(name: string)
        : {
            timer: SubscriptionTimerType,
            index: number
        } {
        // TODO: Merge to a function
        return SubscriptionUpdater._getSubscriptionTimer(SubscriptionUpdater.rulesSubscriptionTimers, name);
    }
}

type SubscriptionTimerType = { id: number, name: string, refreshRate: number };