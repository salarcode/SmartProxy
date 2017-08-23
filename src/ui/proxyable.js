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
	//var selfTabId = null;
	var sourceTabId = null;
	var sourceTab = null;


	function handleMessages(message, sender, sendResponse) {

		if (message["command"] === "notifyProxyableLogRequest" &&
			message["tabId"] != null &&
			message["logInfo"] != null) {

			var tabId = message["tabId"];
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
					messageBox.error("Source tab not found!");
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
			messageBox.error("Source tab not found!");
		}

		$("#btnClose").click(function () {
			polyfill.tabsQuery({ active: true, currentWindow: true },
				function (tabs) {
					if (!tabs || !tabs[0])
						return;

					// signal stopping the looger
					stopListeningToLogger();

					// close this tab
					polyfill.tabsRemove(tabs[0].id);
				});
		});

		$("#btnReload").click(function () {
			proxyableGrid.clearLogData();
			polyfill.tabsReload(sourceTabId);
		});

		proxyableGrid.initialize();
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
		changeGridDataStatus: function (ruleRegex, matchHost, enabled) {

			var data = $("#grdProxyable").jsGrid("option", "data");

			for (let i = 0; i < data.length; i++) {

				var item = data[i];
				if (ruleRegex.test(item.url)) {

					item.enabled = enabled;

					if (enabled) {
						item.matchHost = matchHost;
					} else {
						item.matchHost = "";
					}
				}
			}

			$("#grdProxyable").jsGrid("refresh");
		},
		toggleProxyUrl: function (url, item, enabled) {

			polyfill.runtimeSendMessage(
				{
					command: "toggleProxyForUrl+returnRule",
					url: url,
					enabled: enabled
				},
				function (response) {

					if (!response)
						return;

					if (response.success) {
						if (response.message) {
							messageBox.success(response.message);
						}

						var rule = response.rule;
						var ruleMatchPattern = null;

						if (rule != null) {
							ruleMatchPattern = rule.rule;
						}

						if (enabled) {
							item.enabled = true;
							if (rule != null) {
								item.matchHost = rule.host;
							}

						} else {
							item.enabled = false;
							item.matchHost = "";
						}

						if (rule != null && ruleMatchPattern != null) {

							let ruleRegex = utils.matchPatternToRegExp(ruleMatchPattern);

							// status
							proxyableGrid.changeGridDataStatus(ruleRegex, rule.host, enabled);
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
			messageBox.confirm(`Are you sure to create a rule for the selected domain <b>'${domain}'</b>?`,
				function () {
					var url = "http://" + domain;
					proxyableGrid.toggleProxyUrl(url, item, true);
				});
		},
		gridEnableDisableTemplate: function (value, item) {
			if (value) {
				return $(`<button class="btn btn-sm btn-danger"><i class="fa fa-times" aria-hidden="true"></i> Disable</button>`)
					.click(function () {
						messageBox.confirm("Are you sure you want to delete the selected rule for <b>'" + item.matchHost + "'</b>?",
							function () {
								var hostUrl = "http://" + item.matchHost;
								proxyableGrid.toggleProxyUrl(hostUrl, item, false);
							});
					});
			} else {
				var template =
					`<div class="btn-group">
						<button type="button" class="btn btn-sm btn-success dropdown-toggle" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
							<i class="fa fa-plus" aria-hidden="true"></i> Enable <span class="caret"></span>
						</button><ul class="subdomains-list dropdown-menu dropdown-menu-right"></ul>
					</div>`;
				var url = item.url;
				var subDomains = utils.extractSubdomainsFromUrl(url);
				if (subDomains && subDomains.length) {

					var templateElement = $(template);
					var subdomainContainer = templateElement.find(".subdomains-list");

					for (var index = 0; index < subDomains.length; index++) {
						var domain = subDomains[index];
						var domainElement = $(`<li data-domain="${domain}"><a href="#"><small>Enable for: <b class='font-url'>${domain}</b></small></a></li>`);

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
				noDataContent: "No requests",
				fields: [
					{ name: "url", title: "Request Url", css: "jsgrid-cell-one-liner", type: "text", width: "60%" },
					{ name: "enabled", title: "Proxied", type: "checkbox", width: 50, sorting: true, sorter: "number" },
					{ name: "matchHost", title: "In effect rule", type: "text" },
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
})();