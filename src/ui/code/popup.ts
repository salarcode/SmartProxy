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
import { browser, environment } from "../../lib/environment";
import { jQuery, messageBox } from "../../lib/External";
import { Messages, PopupInternalDataType, ProxyModeType, ProxyableDomainType, FailedRequestType } from "../../core/definitions";
import { PolyFill } from "../../lib/PolyFill";
import { CommonUi } from "./CommonUi";

export class popup {
    private static popupData: PopupInternalDataType = null;

    public static initialize() {

        popup.onDocumentReady(popup.bindEvents);

        PolyFill.runtimeSendMessage(Messages.PopupGetInitialData,
            (dataForPopup: PopupInternalDataType) => {

                if (dataForPopup != null) {
                    popup.popupData = dataForPopup;
                    popup.populateDataForPopup(dataForPopup);
                }
            },
            error => {
                PolyFill.runtimeSendMessage("PopupGetInitialData failed! > " + error);
            });

        // start handling messages
        browser.runtime.onMessage.addListener(popup.handleMessages);

        popup.onDocumentReady(CommonUi.localizeHtmlPage);
    }

    private static handleMessages(message: string, sender: any, sendResponse: Function) {

        if (typeof (message) == "object") {

            if (message["command"] === Messages.WebFailedRequestNotification) {
                if (message["tabId"] == null)
                    return;

                let sourceTabId = popup.popupData.currentTabId;

                let tabId = message["tabId"];
                if (tabId != sourceTabId) {
                    return;
                }

                let failedRequests: FailedRequestType[] = message["failedRequests"];

                // display the failed requests
                popup.populateFailedRequests(failedRequests);

                // Chrome requires a response
                if (sendResponse)
                    sendResponse(null);

                return;
            }
        }
        // Chrome requires a response
        if (sendResponse)
            sendResponse(null);
    }

    private static onDocumentReady(callback: Function) {
        jQuery(document).ready(callback);
    }

    private static bindEvents() {
        jQuery("#openSettings").click(() => {
            PolyFill.runtimeOpenOptionsPage();
            window.close();
        });
        jQuery("#openProxyable").click(() => {
            if (!popup.popupData)
                return;

            var sourceTabId = popup.popupData.currentTabId;
            browser.tabs.create(
                {
                    active: true,
                    //openerTabId: null,
                    url: browser.extension.getURL(`ui/proxyable.html?id=${sourceTabId}`)
                }
            );
            window.close();
        });

        jQuery("#divFailedRequests a").click(() => {
            jQuery(".popup-menu-failed").toggle();
        });

        jQuery("#btnAddFailedRequests").click(popup.onAddFailedRequestsClick);
    }

    private static populateDataForPopup(dataForPopup: PopupInternalDataType) {

        popup.populateUpdateAvailable(dataForPopup);
        popup.populateProxyMode(dataForPopup.proxyMode);
        popup.populateActiveProxy(dataForPopup);
        popup.populateProxyableDomainList(dataForPopup.proxyableDomains);
        popup.populateFailedRequests(dataForPopup.failedRequests);
    }

    private static populateUpdateAvailable(dataForPopup: PopupInternalDataType) {
        if (dataForPopup.updateAvailableText && dataForPopup.updateInfo) {
            jQuery("#divUpdateIsAvailable").show()
                .find("a")
                .text(dataForPopup.updateAvailableText)
                .attr("href", dataForPopup.updateInfo.downloadPage);
        }
    }

    private static populateProxyMode(proxyMode: ProxyModeType) {
        let divProxyMode = jQuery("#divProxyMode");
        divProxyMode.find("li.disabled a").css("cursor", "default");

        divProxyMode.find(".nav-link").removeClass("active");
        //divProxyMode.find("li").removeClass("active");

        divProxyMode.find(`.nav-link[data-proxyMode=${proxyMode}]`)
            .addClass("active")
            .parent("li")
        //.addClass("active");

        divProxyMode.find(".nav-link:not(.disabled)")
            .on("click", popup.onProxyModeClick);
    }

    private static populateActiveProxy(dataForPopup: PopupInternalDataType) {
        let divActiveProxy = jQuery("#divActiveProxy");
        let cmbActiveProxy = divActiveProxy.find("#cmbActiveProxy");

        if (!dataForPopup.proxyServers)
            dataForPopup.proxyServers = [];
        if (!dataForPopup.proxyServersSubscribed)
            dataForPopup.proxyServersSubscribed = [];

        // remove previous items
        cmbActiveProxy.find("option").remove();

        if (dataForPopup.proxyServers.length > 1 ||
            dataForPopup.proxyServersSubscribed.length) {

            // display select combo
            divActiveProxy.show();

            let activeProxyName = "";
            if (dataForPopup.activeProxyServer != null) {
                activeProxyName = dataForPopup.activeProxyServer.name;
            }

            // display select options
            jQuery.each(dataForPopup.proxyServers, (index, proxyServer) => {

                // proxyServer
                let $option = jQuery("<option>")
                    .attr("value", proxyServer.name)
                    .text(proxyServer.name)
                    .appendTo(cmbActiveProxy);

                $option.prop("selected", (proxyServer.name === activeProxyName));
            });

            if (dataForPopup.proxyServersSubscribed.length > 0) {
                let subscriptionGroup = jQuery("<optgroup>")
                    // -Subscriptions-
                    .attr("label", browser.i18n.getMessage("popupSubscriptions"))
                    .appendTo(cmbActiveProxy);

                dataForPopup.proxyServersSubscribed.forEach(proxyServer => {
                    // proxyServer
                    let $option = jQuery("<option>")
                        .attr("value", proxyServer.name)
                        .text(proxyServer.name)
                        .appendTo(subscriptionGroup);

                    $option.prop("selected", (proxyServer.name === activeProxyName));
                });
            }

            cmbActiveProxy.on("change", popup.onActiveProxyChange);

        } else {
            // for one or less we dont show the select proxy
            divActiveProxy.hide();
        }
    }

    private static populateProxyableDomainList(proxyableDomainList: ProxyableDomainType[]) {
        if (!proxyableDomainList || !proxyableDomainList.length) return;

        var divProxyableContainer = jQuery("#divProxyableContainer");
        var divProxyableDomain = divProxyableContainer.find("#divProxyableDomains");
        var divProxyableDomainItem = divProxyableDomain.find("#divProxyableDomainItem");

        // display the list container
        divProxyableContainer.show();

        // this is proxyable
        jQuery("#openProxyable").show();

        for (let i = 0; i < proxyableDomainList.length; i++) {
            let domainResult = proxyableDomainList[i];
            let domain = domainResult.domain;

            let item = divProxyableDomainItem.clone();
            item.show()
                .find("span.proxyable-host-name")
                .text(domain);
            item.appendTo(divProxyableDomain);
            item.data("domainResult", domainResult);
            //item.data("host-name", domain);
            //item.data("ruleIsForThisHost", ruleIsForThisHost);
            //item.data("hasMatchingRule", domainResult.hasMatchingRule);

            var itemIcon = item.find(".proxyable-status-icon");
            if (domainResult.hasMatchingRule) {
                itemIcon.removeClass("fa-square")
                    .addClass("fa-check-square");

                // if the matching rule is not for this host
                if (!domainResult.ruleIsForThisHost) {
                    item.find(".nav-link").addClass("disabled")
                        .attr("title", `Enabled by other domains`);
                }
            } else {
                itemIcon.removeClass("fa-check-square")
                    .addClass("fa-square");
            }

            item.on("click", popup.onProxyableDomainClick);

            divProxyableDomainItem.hide();
        }
    }

    private static populateFailedRequests(failedRequests: FailedRequestType[]) {

        var divFailedRequests = jQuery("#divFailedRequests");

        if (failedRequests && failedRequests.length) {

            let failedRequestCount = 0;
            let failedRequestsItemsContainer = jQuery(".popup-menu-failed .failed-request-container");

            // the item template
            let failedRequestsItemTemplate = failedRequestsItemsContainer.find(".failed-request-template");
            failedRequestsItemTemplate.hide();

            // save checked domains, preventing check change on refresh
            let domainsStatus = {};
            failedRequestsItemsContainer.find(".request-box input:checkbox").each((index, e) => {
                var element = jQuery(e);
                domainsStatus[element.attr("data-domain")] = element.prop("checked");
            });

            // remove previous items
            failedRequestsItemsContainer.find(".request-box:not(.failed-request-template)").remove();

            // Order by parent domain
            failedRequests = failedRequests.sort((a, b) => {
                if ("." + a.domain.includes(b.domain))
                    return -1;
                if ("." + b.domain.includes(a.domain))
                    return 1;
                return 0;
            });

            for (let i = 0; i < failedRequests.length; i++) {
                let request = failedRequests[i];

                if (request.hasRule || request.ignored)
                    // don't add if the request has rule
                    continue;

                let newItem = failedRequestsItemTemplate.clone();
                newItem.find(".request-name a").attr("href", request.url);
                newItem.find(".request-name label>span").text(request.domain);

                let newItemCheckbox = newItem.find("input");
                newItemCheckbox.attr("data-domain", request.domain);

                if (request.isRootHost) {
                    failedRequestCount += request.hitCount;

                    newItemCheckbox.prop("checked", false);
                } else {
                    newItem.find(".failed-request-root").show();
                    newItemCheckbox.prop("checked", true);
                    newItem.addClass("request-box-dependant");
                }
                newItem.find(".failed-request-count").text(request.hitCount).show();

                // set previous status, preventing check change on refresh
                let previousStatus = domainsStatus[request.domain];
                if (previousStatus != null) {
                    newItemCheckbox.prop("checked", previousStatus);
                }

                newItem.removeClass("failed-request-template");
                newItem.show();

                failedRequestsItemsContainer.append(newItem);
            }

            // updating the failed request count
            divFailedRequests.find("#lblFailedRequestCount").text(failedRequestCount);

            if (failedRequestCount) {
                // display the failed requests block
                divFailedRequests.show();
            } else {
                divFailedRequests.hide();
            }
        } else {
            divFailedRequests.hide();
        }
    }

    //#region Events

    private static onProxyModeClick() {
        let element = jQuery(this);
        let selectedProxyMode = element.attr("data-proxyMode");

        // change proxy mode
        PolyFill.runtimeSendMessage({
            command: Messages.PopupChangeProxyMode,
            proxyMode: selectedProxyMode
        });

        if (!popup.popupData.hasProxyServers) {
            // open the settings page
            PolyFill.runtimeOpenOptionsPage();
        }
        window.close();
    }

    private static onActiveProxyChange() {
        let cmbActiveProxy = jQuery("#divActiveProxy #cmbActiveProxy");

        let value = cmbActiveProxy.val();
        if (!value) return;

        PolyFill.runtimeSendMessage(
            {
                command: Messages.PopupChangeActiveProxyServer,
                name: value
            });
    }

    private static onProxyableDomainClick() {
        let domainResult: ProxyableDomainType = jQuery(this).data("domainResult");
        let domain = domainResult.domain;
        let hasMatchingRule = domainResult.hasMatchingRule;
        let ruleIsForThisHost = domainResult.ruleIsForThisHost;


        if (!hasMatchingRule || (hasMatchingRule && ruleIsForThisHost == true)) {
            PolyFill.runtimeSendMessage(`proxyable-host-name: ${domain}`);

            PolyFill.runtimeSendMessage({
                command: Messages.PopupToggleProxyForDomain,
                domain: domain
            });

            window.close();
        } else {
            PolyFill.runtimeSendMessage(`rule is not for this domain: ${domain}`);
        }
    }

    private static onAddFailedRequestsClick() {
        let domainList: string[] = [];

        jQuery(".failed-request-container .request-box input:checked").each((index, e) => {
            let element = jQuery(e);
            let domain = element.attr("data-domain");
            if (domain)
                domainList.push(domain);
        });

        if (domainList.length)
            // Add the selected domains to rule list?
            if ((!environment.chrome && environment.version < environment.bugFreeVersions.firefoxConfirmInPopupWorks) ||
                confirm(browser.i18n.getMessage("popupAddFailedRequestsConfirm"))) {

                // send message to the core
                PolyFill.runtimeSendMessage(
                    {
                        command: Messages.PopupAddDomainListToProxyRule,
                        domainList: domainList,
                        tabId: popup.popupData.currentTabId
                    },
                    response => {
                        if (!response) return;
                        if (response.failedRequests) {

                            // display the failed requests
                            popup.populateFailedRequests(response.failedRequests);
                        }
                    });

                window.close();
            }
    }
    //#endregion
}

popup.initialize();