import { browser, environment } from "../../lib/environment";
import { jQuery } from "../../lib/External";
import { Messages, PopupInternalDataType, ProxyModeType } from "../../core/definitions";
import { PolyFill } from "../../lib/PolyFill";
import { CommonUi } from "./CommonUi";

export class popup {
    private static popupData: PopupInternalDataType = null;

    public static initialize() {

        this.onDocumentReady(this.bindEvents);

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
        browser.runtime.onMessage.addListener(this.handleMessages);

        this.onDocumentReady(CommonUi.localizeHtmlPage);
    }

    private static handleMessages(message: string, sender: any, sendResponse: Function) {

        let sourceTabId = this.popupData.currentTabId;

        if (typeof (message) == "object") {

            if (message["command"] === Messages.WebRequestMonitorFailedActivity &&
                message["tabId"] != null) {

                let tabId = message["tabId"];
                if (tabId != sourceTabId) {
                    return;
                }

                let failedRequests: any[] = message["failedRequests"];

                // display the failed requests
                this.populateFailedRequests(failedRequests);

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

        this.populateRestartRequired(dataForPopup);
        this.populateUpdateAvailable(dataForPopup);
        this.populateProxyMode(dataForPopup.proxyMode);
        this.populateActiveProxy(dataForPopup);
        this.populateProxyableDomainList(dataForPopup.proxyableDomains);
        this.populateFailedRequests(dataForPopup.failedRequests);
    }

    private static populateRestartRequired(dataForPopup: PopupInternalDataType) {
        if (dataForPopup.restartRequired) {
            jQuery("#divRestartRequired").show();
        }
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
        debugger;
        let divProxyMode = jQuery("#divProxyMode");
        divProxyMode.find("li.disabled a").css("cursor", "default");

        divProxyMode.find(".nav-link").removeClass("active");
        divProxyMode.find("li").removeClass("active");

        divProxyMode.find(`.nav-link[data-proxyMode=${proxyMode}]`)
            .addClass("active")
            .parent("li")
            .addClass("active");

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

    private static populateProxyableDomainList(proxyableDomainList: any[]) {
        if (!proxyableDomainList || !proxyableDomainList.length) return;

        var divProxyableContainer = jQuery("#divProxyableContainer");
        var divProxyableDomain = divProxyableContainer.find("#divProxyableDomains");
        var divProxyableDomainItem = divProxyableDomain.find("#divProxyableDomainItem");

        // display the list container
        divProxyableContainer.show();

        // this is proxyable
        jQuery("#openProxyable").show();

        for (let i = 0; i < proxyableDomainList.length; i++) {
            let domainResult: any = proxyableDomainList[i];
            let domain = domainResult.domain;
            let ruleIsForThisHost = domainResult.ruleIsForThisHost;

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
                itemIcon.removeClass("fa-square-o")
                    .addClass("fa-check-square-o");

                // if the matching rule is not for this host
                if (!ruleIsForThisHost) {
                    item.addClass("disabled");
                }
            } else {
                itemIcon.removeClass("fa-check-square-o")
                    .addClass("fa-square-o");
            }

            item.on("click", popup.onProxyableDomainClick);

            divProxyableDomainItem.hide();
        }
    }

    private static populateFailedRequests(failedRequests: any[]) {

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

            for (let i = 0; i < failedRequests.length; i++) {
                let request = failedRequests[i];

                if (request.hasRule)
                    // don't add if the request has rule
                    continue;


                let newItem = failedRequestsItemTemplate.clone();
                let newItemLink = newItem.find(".request-name a");
                newItemLink.attr("href", request.url);
                newItemLink.text(request.domain);

                let newItemCheckbox = newItem.find("input");
                newItemCheckbox.attr("data-domain", request.domain);

                if (request.isMain) {
                    failedRequestCount += request.hitCount;

                    newItem.find(".failed-request-count").text(request.hitCount).show();
                    newItemCheckbox.prop("checked", false);
                } else {
                    newItem.find(".failed-request-root").show();
                    newItemCheckbox.prop("checked", true);
                    newItem.addClass("request-box-dependant");
                }

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
            },
            response => {
	            if (!response) return;
	            popup.popupData.restartRequired = response.restartRequired;
	            popup.populateRestartRequired(popup.popupData);
            });
    }

    private static onProxyableDomainClick() {
        let domainResult: any = jQuery(this).data("domainResult");
        let host = domainResult.domain;
        let hasMatchingRule = domainResult.hasMatchingRule;
        let ruleIsForThisHost = domainResult.ruleIsForThisHost;


        if (!hasMatchingRule || (hasMatchingRule && ruleIsForThisHost == true)) {
            PolyFill.runtimeSendMessage(`proxyable-host-name: ${host}`);

            PolyFill.runtimeSendMessage({
                command: Messages.PopupToggleProxyForHost,
                host: host
            });

            window.close();
        } else {
            PolyFill.runtimeSendMessage(`rule is not for this host: ${host}`);
        }

        //jQuery(this).find(".proxyable-status-icon")
        //	.removeClass("fa-square-o")
        //	.removeClass("fa-check-square-o")
        //	.addClass("fa-check-square-o");
    }

    private static onAddFailedRequestsClick() {
        let domainList: any[] = [];

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

                // close the menu
                jQuery(".popup-menu-failed").hide();
            }
    }
    //#endregion
}

popup.initialize();