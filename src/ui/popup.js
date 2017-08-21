(function () {
	var popupData = null;

	function populateDataForPopup(dataForPopup) {

		$("#openSettings").click(function () {

			browser.runtime.openOptionsPage();
			window.close();
		});
		$("#openProxiable").click(function () {
			var sourceTabId = popupData.currentTabId;
			browser.tabs.create(
				{
					active: true,
					//openerTabId: null,
					url: browser.extension.getURL(`ui/proxyable.html?id=${sourceTabId}`)
				}
			);
			window.close();
		});

		if (popupData.restartRequired) {
			$("#divRestartRequired").show();
		}

		populateProxyMode(dataForPopup.proxyMode, dataForPopup);
		populateActiveProxy(dataForPopup);
		populateProxiableDomainList(dataForPopup.proxiableDomains);
	}

	function populateProxyMode(proxyMode, dataForPopup) {

		var divProxyMode = $("#divProxyMode");
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
				var selectedProxyMode = element.attr("data-proxyMode");

				if (!dataForPopup.hasProxyServers) {
					// just open the settings page
					browser.runtime.openOptionsPage();
					window.close();
				} else {
					// change proxy mode
					browser.runtime.sendMessage({
						command: "changeProxyMode",
						proxyMode: selectedProxyMode
					});
					window.close();
				}
			});
	}

	function populateActiveProxy(dataForPopup) {

		var divActiveProxy = $("#divActiveProxy");
		var cmbActiveProxy = divActiveProxy.find("#cmbActiveProxy");

		if (dataForPopup.proxyServers && dataForPopup.proxyServers.length > 1) {

			// remove previous items
			cmbActiveProxy.find('option').remove();

			// display select combo
			divActiveProxy.show();

			var activeProxyName = "";
			if (dataForPopup.activeProxyServer != null) {
				activeProxyName = dataForPopup.activeProxyServer.name;
			}

			// display select options
			$.each(dataForPopup.proxyServers, function (index, proxyServer) {

				// proxyServer
				var $option = $("<option>")
					.attr("value", proxyServer.name)
					.text(proxyServer.name)
					.appendTo(cmbActiveProxy);

				$option.prop("selected", (proxyServer.name === activeProxyName));
			});

			cmbActiveProxy.on('change',
				function () {
					// TODO: on change for active proxy
					var value = cmbActiveProxy.val();
					if (!value) return;

					browser.runtime.sendMessage({
						command: "changeActiveProxyServer",
						name: value
					})
						.then(function (response) {
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

		var divProxiableContainer = $("#divProxiableContainer");
		var divProxiableDomain = divProxiableContainer.find("#divProxiableDomains");
		var divProxiableDomainItem = divProxiableDomain.find("#divProxiableDomainItem");

		// display the list container
		divProxiableContainer.show();

		// this is proxyable
		$("#openProxiable").show();

		for (let i = 0; i < proxiableDomainList.length; i++) {
			let domainResult = proxiableDomainList[i];
			let domain = domainResult.domain;
			let ruleIsForThisHost = domainResult.ruleIsForThisHost;

			let item = divProxiableDomainItem.clone();
			item.show()
				.find("span.proxiable-host-name")
				.text(domain);
			item.appendTo(divProxiableDomain);
			item.data("domainResult", domainResult);
			//item.data("host-name", domain);
			//item.data("ruleIsForThisHost", ruleIsForThisHost);
			//item.data("hasMatchingRule", domainResult.hasMatchingRule);

			var itemIcon = item.find(".proxiable-status-icon");
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
					let host = domainResult.domain;
					let hasMatchingRule = domainResult.hasMatchingRule;
					let ruleIsForThisHost = domainResult.ruleIsForThisHost;


					if (!hasMatchingRule || (hasMatchingRule && ruleIsForThisHost == true)) {

						toggleProxyForHost(host);

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

	function toggleProxyForHost(hostName) {
		// send message to the core
		browser.runtime.sendMessage({
			command: "toggleProxyForHost",
			host: hostName
		});
	}

	function initialize() {
		browser.runtime.sendMessage("getDataForPopup")
			.then(function (dataForPopup) {

				if (dataForPopup != null) {
					popupData = dataForPopup;
					populateDataForPopup(dataForPopup);
				}
			},
			function (error) {
				browser.runtime.sendMessage("getDataForPopup failed! > " + error);
			});
	}


	// ------------------
	// ------------------

	// initialize the popup
	initialize();


})();