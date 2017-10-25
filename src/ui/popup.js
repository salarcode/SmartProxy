/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2017 Salar Khalilzadeh <salar2k@gmail.com>
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
(function () {
	let popupData = null;

	function handleMessages(message, sender, sendResponse) {

		let sourceTabId = popupData.currentTabId;

		if (message["command"] === "webRequestMonitor" &&
			message["tabId"] != null) {

			let tabId = message["tabId"];
			if (tabId != sourceTabId) {
				return;
			}
			//let failedInfo = message["failedInfo"];
			let failedRequests = message["failedRequests"];

			// display the failed requests
			populateFailedRequests(failedRequests, null);

			// Chrome requires a response
			if (sendResponse)
				sendResponse(null);

			return;
		}

		// Chrome requires a response
		if (sendResponse)
			sendResponse(null);
	}

	function populateDataForPopup(dataForPopup) {

		$("#openSettings").click(function () {

			polyfill.runtimeOpenOptionsPage();
			window.close();
		});
		$("#openProxiable").click(function () {
			let sourceTabId = popupData.currentTabId;
			polyfill.tabsCreate(
				{
					active: true,
					//openerTabId: null,
					url: browser.runtime.getURL(`ui/proxyable.html?id=${sourceTabId}`),
					index: popupData.currentTabIndex + 1
				}
			);
			window.close();
		});

		if (popupData.restartRequired) {
			$("#divRestartRequired").show();
		}

		if (popupData.updateAvailableText && dataForPopup.updateInfo) {
			$("#divUpdateIsAvailable").show()
				.find("a")
				.text(popupData.updateAvailableText)
				.attr("href", dataForPopup.updateInfo.downloadPage);
		}

		if (environment.chrome) {
			// Chrome supports "SYSTEM" proxy mode
			// FIREFOX: This code should be removed when firefox supports this
			$("#divProxyModeSystem").removeClass("disabled")
				.find("a.nav-link").removeClass("disabled");
		}

		$("#divFailedRequests a").click(function () {
			$(".popup-menu-failed").toggle();
		});

		$("#btnAddFailedRequests").click(function () {

			let domainList = [];
			$(".failed-request-container .request-box input:checked").each(function (index, e) {
				let element = $(e);
				let domain = element.attr("data-domain");
				if (domain)
					domainList.push(domain);
			});

			if (domainList.length)
				// Add the selected domains to rule list?
				if (confirm(browser.i18n.getMessage("popupAddFailedRequestsConfirm"))) {
					// send message to the core
					polyfill.runtimeSendMessage(
						{
							command: "addDomainListToProxyRuleFromTab",
							domainList: domainList,
							tabId: popupData.currentTabId
						},
						function (response) {
							if (!response) return;
							if (response.failedRequests) {

								// display the failed requests
								populateFailedRequests(response.failedRequests, null);
							}
						});

					// close the menu
					$(".popup-menu-failed").hide();
				}
		});


		populateProxyMode(dataForPopup.proxyMode, dataForPopup);
		populateActiveProxy(dataForPopup);
		populateProxiableDomainList(dataForPopup.proxiableDomains);
		populateFailedRequests(dataForPopup.failedRequests, null);
	}

	function populateProxyMode(proxyMode, dataForPopup) {

		let divProxyMode = $("#divProxyMode");
		divProxyMode.find("li.disabled a").css("cursor", "default");

		divProxyMode.find(".nav-link").removeClass("active");
		divProxyMode.find("li").removeClass("active");

		divProxyMode.find(`.nav-link[data-proxyMode=${proxyMode}]`)
			.addClass("active")
			.parent("li")
			.addClass("active");

		divProxyMode.find(".nav-link:not(.disabled)")
			.on("click",
			function () {
				let element = $(this);
				let selectedProxyMode = element.attr("data-proxyMode");

				// change proxy mode
				polyfill.runtimeSendMessage({
					command: "changeProxyMode",
					proxyMode: selectedProxyMode
				});

				if (!dataForPopup.hasProxyServers) {
					// open the settings page
					polyfill.runtimeOpenOptionsPage();
				}
				window.close();
			});
	}

	function populateActiveProxy(dataForPopup) {

		let divActiveProxy = $("#divActiveProxy");
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
			$.each(dataForPopup.proxyServers, function (index, proxyServer) {

				// proxyServer
				let $option = $("<option>")
					.attr("value", proxyServer.name)
					.text(proxyServer.name)
					.appendTo(cmbActiveProxy);

				$option.prop("selected", (proxyServer.name === activeProxyName));
			});

			if (dataForPopup.proxyServersSubscribed.length > 0) {
				let subscriptionGroup = $("<optgroup>")
					// -Subscriptions-
					.attr("label", browser.i18n.getMessage("popupSubscriptions"))
					.appendTo(cmbActiveProxy);

				dataForPopup.proxyServersSubscribed.forEach(function (proxyServer) {
					// proxyServer
					let $option = $("<option>")
						.attr("value", proxyServer.name)
						.text(proxyServer.name)
						.appendTo(subscriptionGroup);

					$option.prop("selected", (proxyServer.name === activeProxyName));
				});
			}

			cmbActiveProxy.on("change",
				function () {
					let value = cmbActiveProxy.val();
					if (!value) return;

					polyfill.runtimeSendMessage(
						{
							command: "changeActiveProxyServer",
							name: value
						},
						function (response) {
							if (!response) return;
							if (response.restartRequired) {
								// restart required
								$("#divRestartRequired").show();
							}
						});
				});

		} else {
			// for one or less we dont show the select proxy
			divActiveProxy.hide();
		}

	}

	function populateProxiableDomainList(proxiableDomainList) {
		if (!proxiableDomainList || !proxiableDomainList.length) return;

		let divProxiableContainer = $("#divProxiableContainer");
		let divProxiableDomain = divProxiableContainer.find("#divProxiableDomains");
		let divProxiableDomainItem = divProxiableDomain.find("#divProxiableDomainItem");

		// display the list container
		divProxiableContainer.show();

		// this is proxyable
		$("#openProxiable").show();

		for (let domainResult of proxiableDomainList) {
			let domain = domainResult.domain;
			let ruleIsForThisHost = domainResult.ruleIsForThisHost;

			let item = divProxiableDomainItem.clone();
			item.show()
				.find("span.proxiable-host-name")
				.text(domain);
			item.appendTo(divProxiableDomain);
			item.data("domainResult", domainResult);

			let itemIcon = item.find(".proxiable-status-icon");
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

			item.on("click",
				function () {
					let domainResult = $(this).data("domainResult");
					let domain = domainResult.domain;
					let hasMatchingRule = domainResult.hasMatchingRule;
					let ruleIsForThisHost = domainResult.ruleIsForThisHost;


					if (!hasMatchingRule || (hasMatchingRule && ruleIsForThisHost == true)) {

						toggleProxyForDomain(domain);

						window.close();
					} else {
						// rule is not for this host
					}

					//$(this).find(".proxiable-status-icon")
					//	.removeClass("fa-square-o")
					//	.removeClass("fa-check-square-o")
					//	.addClass("fa-check-square-o");
				});

			divProxiableDomainItem.hide();
		}
	}

	function populateFailedRequests(failedRequests, currentFailedInfo) {

		var divFailedRequests = $("#divFailedRequests");

		if (failedRequests && failedRequests.length) {

			let failedRequestCount = 0;
			let failedRequestsItemsContainer = $(".popup-menu-failed .failed-request-container");

			// the item template
			let failedRequestsItemTemplate = failedRequestsItemsContainer.find(".failed-request-template");
			failedRequestsItemTemplate.hide();

			// save checked domains, preventing check change on referesh
			let domainsStatus = {};
			failedRequestsItemsContainer.find(".request-box input:checkbox").each(function (index, e) {
				var element = $(e);
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

				// set previous status, preventing check change on referesh
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

	function toggleProxyForDomain(domain) {
		// send message to the core
		polyfill.runtimeSendMessage({
			command: "toggleProxyForDomain",
			domain: domain
		});
	}

	function initialize() {
		polyfill.runtimeSendMessage("getDataForPopup",
			function (dataForPopup) {

				if (dataForPopup != null) {
					popupData = dataForPopup;
					populateDataForPopup(dataForPopup);
				}
			},
			function (error) {
				polyfill.runtimeSendMessage("getDataForPopup failed! > " + error);
			});
	}


	// ------------------
	// ------------------

	// initialize the popup
	initialize();

	// start handling messages
	browser.runtime.onMessage.addListener(handleMessages);

	// internationalization
	$(localizeHtmlPage);

})();