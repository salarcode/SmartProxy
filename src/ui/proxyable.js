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
			return;
		}
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

		browser.tabs.get(sourceTabId)
			.then(
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
			})
			.catch(function () {
				if (sourceTab == null) {
					messageBox.error("Source tab not found!");
				}
			});
	}

	function listenToLogger() {
		// request log for this page
		browser.runtime.sendMessage({
			command: "requestProxyableLog",
			tabId: sourceTabId
		});
	}

	function stopListeningToLogger() {
		// request log for this page
		browser.runtime.sendMessage({
			command: "removeProxyableLog",
			tabId: sourceTabId
		});
	}

	function initializeUi() {
		if (!(sourceTabId > -1)) {
			messageBox.error("Source tab not found!");
		}

		$("#btnClose").click(function () {
			browser.tabs.query({ active: true, currentWindow: true })
				.then(function (tabs) {
					if (!tabs || !tabs[0])
						return;

					// signal stopping the looger
					stopListeningToLogger();

					// close this tab
					browser.tabs.remove(tabs[0].id);
				});
		});

		$("#btnReload").click(function () {
			proxyableGrid.clearLogData();
			browser.tabs.reload(sourceTabId);
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

			browser.runtime.sendMessage({
				command: "toggleProxyForUrl",
				url: url,
				enabled: enabled
			})
				.then(function (response) {

					if (!response)
						return;

					if (response.success) {
						if (response.message) {
							messageBox.success(response.message);
						}

						var rule = response.rule;
						var ruleRegex = null;

						if (rule != null) {
							ruleRegex = rule.ruleRegex;
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

						if (rule != null && ruleRegex != null)
							// status
							proxyableGrid.changeGridDataStatus(ruleRegex, rule.host, enabled);

					} else {
						if (response.message) {
							messageBox.error(response.message);
						}
					}

					$("#grdProxyable").jsGrid("refresh");
				});
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
				//data: clients,

				fields: [
					{ name: "url", title: "Request Url", css: "jsgrid-cell-one-liner", type: "text", width: "60%" },
					{ name: "enabled", title: "Proxied", type: "checkbox", width: 50, sorting: true, sorter: "number" },
					{ name: "matchHost", title: "In effect rule", type: "text" },
					//{ name: "rule", title: "Rule", type: "text" }
					{
						name: "enabled", title: "", type: "text",
						itemTemplate: function (value, item) {
							if (value) {
								return $(`<button class="btn btn-sm btn-danger"><i class="fa fa-times" aria-hidden="true"></i> Disable</button>`)
									.click(function () {
										var url = item.url;
										messageBox.confirm("Are you sure you want to delete the selected rule?",
											function () {
												proxyableGrid.toggleProxyUrl(url, item, false);
											});
									});
							} else {
								return $(`<button class="btn btn-sm btn-success"><i class="fa fa-plus" aria-hidden="true"></i> Enable</button>`)
									.click(function () {
										var url = item.url;

										messageBox.confirm("Are you sure to create a rule for the selected url?",
											function () {

												proxyableGrid.toggleProxyUrl(url, item, true);
											});

									});
							}
						}
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