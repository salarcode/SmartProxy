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
	var selfTabId = null;
	var sourceTabId = null;
	var sourceTab = null;


	function handleMessages(message, sender, sendResponse) {

		if (message["command"] === "notifyProxyableLogRequest" &&
			message["tabId"] != null &&
			message["logInfo"] != null) {

			let tabId = message["tabId"];
			if (tabId != sourceTabId) {
				return;
			}

			// insert to the grid
			proxyableGrid.insertLogRequest(message.logInfo);

			// Chrome requires a response
			if (sendResponse)
				sendResponse(null);

			return;
		}
		if (message["command"] === "notifyProxyableOriginTabRemoved" &&
			message["tabId"] != null) {

			let tabId = message["tabId"];
			if (tabId != sourceTabId) {
				return;
			}

			// Chrome requires a response before current tab gets removed
			if (sendResponse)
				sendResponse(null);

			// Close this tab
			if (selfTabId != null)
				polyfill.tabsRemove(selfTabId);

			return;
		}

		// Chrome requires a response
		if (sendResponse)
			sendResponse(null);
	}
	function initialize() {
		var url = new URL(document.location);
		var idStr = url.searchParams.get("id");
		var id = parseInt(idStr);
		sourceTabId = id;

		// should be greater or euqal to zero
		if (!(id > -1)) {
			window.close();
			return;
		}

		polyfill.tabsGet(sourceTabId,
			function (tabInfo) {
				sourceTab = tabInfo;

				$("#spanPageUrl")
					.show()
					.text(sourceTab.url);
				$("#txtPageUrl")
					.show()
					.val(sourceTab.url);

				// start the logger
				listenToLogger();
			},
			function () {
				if (sourceTab == null) {
					// Source tab not found!
					messageBox.error(browser.i18n.getMessage("proxyableErrNoSourceTab"));
				}
			});
	}

	function listenToLogger() {
		// request log for this page
		polyfill.runtimeSendMessage({
			command: "requestProxyableLog",
			tabId: sourceTabId
		});
	}

	function stopListeningToLogger() {
		// request log for this page
		polyfill.runtimeSendMessage({
			command: "removeProxyableLog",
			tabId: sourceTabId
		});
	}

	function initializeUi() {
		if (!(sourceTabId > -1)) {
			// Source tab not found!
			messageBox.error(browser.i18n.getMessage("proxyableErrNoSourceTab"));
		}

		$("#btnClose").click(function () {
			closeSelf();
		});

		$("#btnReload").click(function () {
			proxyableGrid.clearLogData();
			polyfill.tabsReload(sourceTabId);
		});

		proxyableGrid.initialize();

		// read own tab id
		polyfill.tabsQuery({ active: true, currentWindow: true },
			function (tabs) {
				if (!tabs || !tabs[0])
					return;

				selfTabId = tabs[0].id;
			});
	}
	function closeSelf() {
		polyfill.tabsQuery({ active: true, currentWindow: true },
			function (tabs) {
				if (!tabs || !tabs[0])
					return;

				// signal stopping the looger
				stopListeningToLogger();

				// close this tab
				polyfill.tabsRemove(tabs[0].id);
			});
	}

	var proxyableGrid = {
		initialize: function () {
			proxyableGrid.initializeRequestLogGrid();
		},
		insertLogRequest: function (item) {
			$("#grdProxyable").jsGrid("insertItem", item);
		},
		clearLogData: function () {
			$("#grdProxyable").jsGrid("option", "data", []);
		},
		changeGridDataStatus: function (ruleRegex, source, enabled) {

			var data = $("#grdProxyable").jsGrid("option", "data");

			for (let item of data) {
				if (ruleRegex.test(item.url)) {
					item.enabled = enabled;
					item.source = enabled ? source : "";
				}
			}

			$("#grdProxyable").jsGrid("refresh");
		},
		toggleProxyableRequest: function (enableByDomain, removeBySource, item) {

			polyfill.runtimeSendMessage(
				{
					command: "toggleProxyableRequest+returnRule",
					enableByDomain: enableByDomain,
					removeBySource: removeBySource
				},
				function (response) {

					if (!response)
						return;

					if (response.success) {
						if (response.message) {
							messageBox.success(response.message);
						}
						var enabled = enableByDomain != null;
						var rule = response.rule;

						if (enabled) {
							item.enabled = true;
							if (rule != null) {
								item.source = rule.source;
							}

						} else {
							item.enabled = false;
							item.source = "";
						}

						if (rule != null) {

							let ruleRegex = utils.matchPatternToRegExp(rule.pattern);

							// status
							proxyableGrid.changeGridDataStatus(ruleRegex, rule.source, enabled);
						}

					} else {
						if (response.message) {
							messageBox.error(response.message);
						}
					}

					$("#grdProxyable").jsGrid("refresh");
				});
		},
		enableProxyOnClick: function (domain, item) {
			// Source tab not found!
			messageBox.confirm(`${browser.i18n.getMessage("proxyableCreateRuleConfirm")} <b>'${domain}'</b>?`,
				function () {
					proxyableGrid.toggleProxyableRequest(domain, null, item);
				});
		},
		gridEnableDisableTemplate: function (value, item) {
			if (value) {
				return $(`<button class="btn btn-sm btn-danger"><i class="fa fa-times" aria-hidden="true"></i> ${browser.i18n.getMessage("proxyableDisableButton")}</button>`)
					.click(function () {
						messageBox.confirm(`${browser.i18n.getMessage("proxyableDeleteRuleConfirm")} <b>'${item.source}'</b>?`,
							function () {
								proxyableGrid.toggleProxyableRequest(null, item.source, item);
							});
					});
			} else {
				var template =
					`<div class="btn-group">
						<button type="button" class="btn btn-sm btn-success dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
							<i class="fa fa-plus" aria-hidden="true"></i> ${browser.i18n.getMessage("proxyableEnableButton")} <span class="caret"></span>
						</button><ul class="subdomains-list dropdown-menu dropdown-menu-right"></ul>
					</div>`;
				var url = item.url;
				var subDomains = utils.extractSubdomainsFromUrl(url);
				if (subDomains && subDomains.length) {

					var templateElement = $(template);
					var subdomainContainer = templateElement.find(".subdomains-list");

					for (let domain of subDomains) {
						var domainElement = $(`<li data-domain="${domain}"><a href="#"><small>${browser.i18n.getMessage("proxyableEnableButtonDomain")} <b class='font-url'>${domain}</b></small></a></li>`);

						domainElement.click(function () {
							var domain = $(this).attr("data-domain");
							proxyableGrid.enableProxyOnClick(domain, item);
						});

						subdomainContainer.append(domainElement);
					}

					return templateElement;
				}
			}
		},
		initializeRequestLogGrid: function () {

			$("#grdProxyable").jsGrid({
				width: "100%",
				height: "400px",

				inserting: false,
				editing: false,
				sorting: true,
				paging: false,
				noDataContent: browser.i18n.getMessage("proxyableGridNoDataContent"),
				fields: [
					{
						name: "url", title: browser.i18n.getMessage("proxyableGridColUrl"), css: "jsgrid-cell-one-liner", type: "text", width: "60%",
						itemTemplate: function (value, item) {
							return `<a href="${value}" target='_blank'>${value}</a>`;
						}
					},
					{ name: "enabled", title: browser.i18n.getMessage("proxyableGridColEnabled"), type: "checkbox", width: 50, sorting: true, sorter: "number" },
					{ name: "source", title: browser.i18n.getMessage("proxyableGridColSource"), type: "text" },
					{
						name: "enabled", title: "", type: "text",
						itemTemplate: proxyableGrid.gridEnableDisableTemplate
					}
				]
			});
		}

	};

	initialize();
	$(initializeUi);

	// start handling messages
	browser.runtime.onMessage.addListener(handleMessages);

	// internationalization
	$(localizeHtmlPage);
})();