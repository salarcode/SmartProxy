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
	let settingsUiData = null;
	let originalSettingsData = {
		proxyServers: null,
		proxyRules: null,
		activeProxyServer: null,
		proxyServerSubscriptions: null
	};
	let changeTracking = {
		rules: false,
		servers: false,
		activeProxy: false,
		serverSubscriptions: false
	};

	function populateSettingsUiData(dataForSettingsUi) {
		let settingsUiData = dataForSettingsUi.settings;

		let divNoServersWarning = $("#divNoServersWarning");
		if (settingsUiData.proxyServers.length > 0 ||
			(settingsUiData.proxyServerSubscriptions && settingsUiData.proxyServerSubscriptions.length > 0)) {

			divNoServersWarning.hide();
		} else {
			divNoServersWarning.show();
		}

		$("#spanVersion").text("Version: " + settingsUiData.version);

		if (dataForSettingsUi.updateAvailableText && dataForSettingsUi.updateInfo) {
			$("#divUpdateIsAvailable").show()
				.find("a")
				.attr("href", dataForSettingsUi.updateInfo.downloadPage)
				.find("span")
				.text(dataForSettingsUi.updateAvailableText);
		}
	}

	function downloadData(data, fileName) {

		let downloadUrl = "data:application/json;charset=utf-8," + encodeURIComponent(data);
		let a = $("<a/>")
			.attr("download", fileName || "")
			.attr("href", downloadUrl);
		a[0].dispatchEvent(new MouseEvent("click"));
	}

	function initializeUi() {

		if (environment.chrome) {
			$("#divAlertChrome").show();

			// not supported by Chrome
			$("#chkEnableBypassForSystemProxy").attr("disabled", "disabled");
		} else {
			$("#divAlertFirefox").show();
		}


		function checkRestartRequired(required) {
			if (!required) return;

			$("#divRestartRequired").show();

			// confirm is more anoying?
			//messageBox.confirm('Due a Firefox bug, any SmartProxy changes require restart. ' +
			//	'Do you want to restart the add-on now?<br/>' +
			//	'Sorry for inconvenience.',
			//	function() {
			//		browser.runtime.reload();
			//	});
		}

		let cmbActiveProxyServer = $("#cmbActiveProxyServer");
		cmbActiveProxyServer.on("change",
			function () {

				let proxyName = cmbActiveProxyServer.val();

				let server = settingsGrid.findProxyServerByName(proxyName);

				// this can be null
				settingsUiData.activeProxyServer = server;
			});

		$("#btnSaveProxyServers").click(function () {

			// update the active proxy server data
			cmbActiveProxyServer.trigger("change");

			let saveData = {
				proxyServers: settingsGrid.getServers(),
				activeProxyServer: settingsUiData.activeProxyServer
			};

			polyfill.runtimeSendMessage(
				{
					command: "settingsSaveProxyServers",
					saveData: saveData
				},
				function (response) {
					if (!response) return;
					if (response.success) {
						if (response.message)
							messageBox.success(response.message);

						checkRestartRequired(response.restartRequired);

						// current server should become equal to saved servers
						settingsUiData.proxyServers = saveData.proxyServers;
						settingsUiData.activeProxyServer = saveData.activeProxyServer;

					} else {
						if (response.message)
							messageBox.error(response.message);
					}
				},
				function (error) {
					messageBox.error(browser.i18n.getMessage("settingsErrorFailedToSaveServers") + " " + error.message);
				});

			changeTracking.servers = false;
			changeTracking.activeProxy = false;

		});
		$("#btnRejectProxyServers").click(function () {
			// reset the data
			settingsUiData.proxyServers = originalSettingsData.proxyServers.slice();
			settingsGrid.loadServers(settingsUiData.proxyServers);
			settingsGrid.reloadActiveProxyServer();
			$("#grdServers").jsGrid("refresh");

			changeTracking.servers = false;

			// Changes reverted successfully
			messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
		});

		$("#btnClearProxyServers").click(function () {

			// Are you sure to remove all the servers?
			messageBox.confirm(browser.i18n.getMessage("settingsRemoveAllProxyServers"),
				function () {
					settingsGrid.loadServers([]);

					changeTracking.servers = true;

					// All the proxy servers are removed.<br/>You have to save to apply the changes.
					messageBox.info(browser.i18n.getMessage("settingsRemoveAllProxyServersSuccess"));
				});
		});

		$("#btnSaveProxyRules").click(function () {

			let rules = settingsGrid.getRules();

			polyfill.runtimeSendMessage(
				{
					command: "settingsSaveProxyRules",
					proxyRules: rules
				},
				function (response) {
					if (!response) return;
					if (response.success) {
						if (response.message)
							messageBox.success(response.message);

						checkRestartRequired(response.restartRequired);

						// current rules should become equal to saved rules
						settingsUiData.proxyRules = rules;

					} else {
						if (response.message)
							messageBox.error(response.message);
					}
				},
				function (error) {
					messageBox.error(browser.i18n.getMessage("settingsErrorFailedToSaveRules") + " " + error.message);
				});

			changeTracking.rules = false;

		});
		$("#btnRejectProxyRules").click(function () {
			// reset the data
			settingsUiData.proxyRules = originalSettingsData.proxyRules.slice();
			settingsGrid.loadRules(settingsUiData.proxyRules);
			$("#grdRules").jsGrid("refresh");

			changeTracking.rules = false;

			// Changes reverted successfully
			messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
		});

		$("#btnClearProxyRules").click(function () {

			// Are you sure to remove all the rules?
			messageBox.confirm(browser.i18n.getMessage("settingsRemoveAllRules"),
				function () {
					settingsGrid.loadRules([]);

					changeTracking.rules = true;

					// All rules are removed.<br/>You have to save to apply the changes.
					messageBox.info(browser.i18n.getMessage("settingsRemoveAllRulesSuccess"));
				});
		});

		$("#btnSaveBypassChanges").click(function () {
			let bypassList = settingsGrid.getBypassList();
			settingsUiData.bypass.bypassList = bypassList;
			settingsUiData.bypass.enableForAlways = $("#chkEnableBypassForAlwaysEnable").prop("checked");
			settingsUiData.bypass.enableForSystem = $("#chkEnableBypassForSystemProxy").prop("checked");

			polyfill.runtimeSendMessage(
				{
					command: "settingsSaveBypass",
					bypass: settingsUiData.bypass
				},
				function (response) {
					if (!response) return;
					if (response.success) {
						if (response.message)
							messageBox.success(response.message);

						checkRestartRequired(response.restartRequired);

					} else {
						if (response.message)
							messageBox.error(response.message);
					}
				},
				function (error) {
					messageBox.error(browser.i18n.getMessage("settingsErrorFailedToSaveBypass") + " " + error.message);
				});

			changeTracking.rules = false;
		});
		$("#btnRejectBypass").click(function () {
			// reset the data
			settingsUiData.bypass = jQuery.extend({}, originalSettingsData.bypass);
			settingsGrid.loadBypass(settingsUiData.bypass);

			changeTracking.bypass = false;

			// Changes reverted successfully
			messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
		});

		$("#btnBackupComplete").on("click",
			function () {

				let data = JSON.stringify(settingsUiData);
				downloadData(data, "SmartProxy-FullBackup.json");
			});

		$("#btnBackupRules").click(function () {
			let data = JSON.stringify(
				{
					proxyRules: settingsUiData.proxyRules
				}
			);
			downloadData(data, "SmartProxy-RulesBackup.json");
		});
		$("#btnRestoreBackup").click(function () {

			function callRestoreSettings(fileData) {

				polyfill.runtimeSendMessage(
					{
						command: "restoreSettings",
						fileData: fileData
					},
					function (response) {

						if (response.success) {
							if (response.message) {
								messageBox.success(response.message,
									false,
									function () {
										// reload the current settings page
										document.location.reload();
									});
							} else {
								// reload the current settings page
								document.location.reload();
							}
						} else {
							if (response.message) {
								messageBox.error(response.message);
							}
						}
					},
					function (error) {
						// There was an error in restoring the backup
						messageBox.error(browser.i18n.getMessage("settingsRestoreBackupFailed"));
						polyfill.runtimeSendMessage("restoreSettings failed with> " + error.message);
					});
			}

			selectFileOnTheFly($("#frmRestoreBackup")[0],
				"retore-file",
				function (inputElement, files) {
					let file = files[0];

					let reader = new FileReader();
					reader.onerror = function (event) {
						// Failed to read the selected file
						messageBox.error(browser.i18n.getMessage("settingsRestoreBackupFileError"));
					};
					reader.onload = function (event) {
						let textFile = event.target;
						let fileText = textFile.result;

						callRestoreSettings(fileText);
					};
					reader.readAsText(file);
				},
				"application/json");


		});

		$("#btnAddServerSubscription").click(function () {
			settingsGrid.serverSubscriptionsAdd();
		});
		$("#btnSaveServerSubscription").click(function () {
			settingsGrid.serverSubscriptionsSave();
		});
		$("#btnTestServerSubscription").click(function () {
			settingsGrid.serverSubscriptionsTest(true);
		});
		$("#btnClearServerSubscriptions").click(function () {

			// Are you sure to remove all the proxy server subscriptions?
			messageBox.confirm(browser.i18n.getMessage("settingsRemoveAllProxyServerSubscriptions"),
				function () {
					settingsGrid.loadServerSubscriptions([]);
					settingsGrid.reloadActiveProxyServer();

					changeTracking.serverSubscriptions = true;

					// All the proxy server subscriptions are removed.<br/>You have to save to apply the changes.
					messageBox.info(browser.i18n.getMessage("settingsRemoveAllProxyServerSubscriptionsSuccess"));
				});
		});

		(function () {
			// the default values
			let cmbServerSubscriptionProtocol = $("#cmbServerSubscriptionProtocol");

			// the default values
			let cmbServerSubscriptionObfuscation = $("#cmbServerSubscriptionObfuscation");

			$("<option>").attr("value", "")
				// (Auto detect with HTTP fallback)
				.text(browser.i18n.getMessage("settingsServerSubscriptionProtocolDefault"))
				.appendTo(cmbServerSubscriptionProtocol);
			proxyServerProtocols.forEach(function (item) {
				$("<option>").attr("value", item)
					.text(item)
					.appendTo(cmbServerSubscriptionProtocol);
			});

			proxyServerSubscriptionObfuscate.forEach(function (item) {
				$("<option>").attr("value", item)
					.text(item)
					.appendTo(cmbServerSubscriptionObfuscation);
			});
		})();
		$("#btnSaveServerSubscriptionsChanges").click(function () {
			let proxyServerSubscriptions = settingsGrid.getServerSubscriptions();

			polyfill.runtimeSendMessage(
				{
					command: "settingsSaveProxySubscriptions",
					proxyServerSubscriptions: proxyServerSubscriptions
				},
				function (response) {
					if (!response) return;
					if (response.success) {
						if (response.message)
							messageBox.success(response.message);

						checkRestartRequired(response.restartRequired);

						// current list should become equal to saved list
						settingsUiData.proxyServerSubscriptions = proxyServerSubscriptions;

					} else {
						if (response.message)
							messageBox.error(response.message);
					}
				},
				function (error) {
					messageBox.error(browser.i18n.getMessage("settingsFailedToSaveProxySubscriptions") + " " + error.message);
				});

			changeTracking.serverSubscriptions = false;
		});

		$("#btnRejectServerSubscriptionsChanges").click(function () {
			// reset the data
			settingsUiData.proxyServerSubscriptions = originalSettingsData.proxyServerSubscriptions.slice();
			settingsGrid.loadServerSubscriptions(settingsUiData.proxyServerSubscriptions);
			$("#grdServerSubscriptions").jsGrid("refresh");
			settingsGrid.reloadActiveProxyServer();

			changeTracking.serverSubscriptions = false;

			// Changes reverted successfully
			messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
		});

	}

	function initialize() {
		polyfill.runtimeSendMessage("getDataForSettingsUi",
			function (dataForSettingsUi) {

				if (dataForSettingsUi != null) {
					settingsUiData = dataForSettingsUi.settings;
					populateSettingsUiData(dataForSettingsUi);

					settingsGrid.loadRules(settingsUiData.proxyRules);
					settingsGrid.loadServers(settingsUiData.proxyServers);
					settingsGrid.loadServerSubscriptions(settingsUiData.proxyServerSubscriptions);
					settingsGrid.reloadActiveProxyServer(settingsUiData.proxyServers, settingsUiData.proxyServerSubscriptions);
					settingsGrid.loadBypass(settingsUiData.bypass);

					// make copy
					originalSettingsData.proxyRules = settingsUiData.proxyRules.slice();
					originalSettingsData.proxyServers = settingsUiData.proxyServers.slice();
					originalSettingsData.activeProxyServer = settingsUiData.activeProxyServer;
					originalSettingsData.proxyServerSubscriptions = settingsUiData.proxyServerSubscriptions;
					originalSettingsData.bypass = jQuery.extend({}, settingsUiData.bypass);
				}

			},
			function (error) {
				polyfill.runtimeSendMessage("getDataForSettingsUi failed! > " + error);
				messageBox.error(browser.i18n.getMessage("settingsInitializeFailed"));
			});
	}

	function selectFileOnTheFly(form, inputName, onFileSelected, acceptFormat) {
		///<summary>Select a file from a detached file input</summary>
		let fileContainer = $(`<div style='display: none'><input style='display: none' type=file accept='${acceptFormat || ""}' class='' name='${inputName}'/></div>`);
		let fileInput = fileContainer.find("input");

		form = $(form);
		form.append(fileContainer);

		function onfile(evt) {
			fileContainer.remove();

			let files = evt.target.files;
			if (!files.length)
				return;

			if (onFileSelected) {
				onFileSelected(fileInput, files);
			}
		}
		fileInput.on("change", onfile);
		fileInput.trigger("click");
	}

	// ------------------
	const settingsGrid = {
		initialize: function () {
			settingsGrid.initializeServersGrid();
			settingsGrid.initializeRulesGrid();
			settingsGrid.initializeServerSubscriptionsGrid();

			$("#btnAddProxyServer").click(function () {
				settingsGrid.insertRowServersGrid();
			});
			$("#btnExportProxyServerOpen").click(function () {
				let proxyList = settingsGrid.exportProxyListFormatted();

				downloadData(proxyList, "SmartProxy-Servers.txt");
			});
			$("#btnImportProxyServer").click(function () {
				let modalContainer = $("#modalImportProxyServer");
				let append = modalContainer.find("#cmbImportProxyServerOverride_Append").prop("checked");
				let file, text;

				if (modalContainer.find("#rbtnImportProxyServer_File").prop("checked")) {
					// file should be selected

					let selectFileElement = modalContainer.find("#btnImportProxyServerSelectFile")[0];

					if (selectFileElement.files.length == 0) {
						// Please select a proxy list file
						messageBox.error(browser.i18n.getMessage("settingsImportProxiesFileNotSelected"));
						return;
					}
					file = selectFileElement.files[0];

				} else {
					let proxyServerListText = modalContainer.find("#btnImportProxyServerListText").val().trim();
					if (proxyServerListText == "") {
						// Please enter proxy list
						messageBox.error(browser.i18n.getMessage("settingsImportProxyListTextIsEmpty"));
						return;
					}
					text = proxyServerListText;
				}

				let proxyServers = settingsGrid.getServers();

				proxyImporter.importText(text, file,
					append,
					proxyServers,
					function (response) {
						if (!response) return;

						if (response.success) {
							if (response.message)
								messageBox.info(response.message);

							// empty the input
							modalContainer.find("#btnImportProxyServerSelectFile")[0].value = "";
							modalContainer.find("#btnImportProxyServerListText").val("");

							let servers = response.result;
							settingsGrid.loadServers(servers);

							// close the window
							modalContainer.modal("hide");
						} else {
							if (response.message)
								messageBox.error(response.message);
						}
					},
					function (error) {
						let message = "";
						if (error && error.message)
							message = error.message;
						messageBox.error(browser.i18n.getMessage("settingsImportProxyServersFailed") + " " + message);
					});

			});


			$("#btnImportRules").click(function () {
				let modalContainer = $("#modalImportRules");
				let selectFileElement = modalContainer.find("#btnImportRulesSelectFile")[0];

				if (selectFileElement.files.length == 0) {
					// Please select a rules file
					messageBox.error(browser.i18n.getMessage("settingsRulesFileNotSelected"));
					return;
				}

				let selectFile = selectFileElement.files[0];

				let append = modalContainer.find("#cmbImportRulesOverride_Append").prop("checked");
				let sourceType = modalContainer.find("#cmbImportRulesFormat").val();

				let proxyRules = settingsGrid.getRules();

				let importFunction;
				if (sourceType == "autoproxy") {
					importFunction = ruleImporter.importAutoProxy;
				} else if (sourceType == "switchy") {
					importFunction = ruleImporter.importSwitchyRules;
				} else {
					messageBox.warning(browser.i18n.getMessage("settingsSourceTypeNotSelected"));
				}

				if (importFunction)
					importFunction(selectFile,
						append,
						proxyRules,
						function (response) {
							if (!response) return;

							if (response.success) {
								if (response.message)
									messageBox.info(response.message);

								// empty the file input
								selectFileElement.value = "";

								let rules = response.result;
								settingsGrid.loadRules(rules);

								// close the window
								modalContainer.modal("hide");
							} else {
								if (response.message)
									messageBox.error(response.message);
							}
						},
						function (error) {
							let message = "";
							if (error && error.message)
								message = error.message;
							messageBox.error(browser.i18n.getMessage("settingsImportRulesFailed") + " " + message);
						});
			});

			$("#btnAddProxyRule").click(function () {
				settingsGrid.insertRowRulesGrid();
			});
		},
		findProxyServerByName: function (name) {
			let proxyServers = settingsGrid.getServers();
			let serverSubscriptions = settingsGrid.getServerSubscriptions();

			let proxy = proxyServers.find(item => item.name === name);
			if (proxy !== undefined) return proxy;

			for (let subscription of serverSubscriptions) {
				let subitem = subscription.proxies.find(item => item.name === name);
				if (subitem !== undefined) return proxy;
			}
			return null;
		},
		populateProxyServersToCombobox: function ($comboBox, selectedProxyName, proxyServers, serverSubscriptions) {
			if (!$comboBox) return;
			if (!proxyServers)
				proxyServers = settingsGrid.getServers();
			if (!serverSubscriptions)
				serverSubscriptions = settingsGrid.getServerSubscriptions();

			let hadSelected = false;

			// display select options
			$.each(proxyServers, function (index, proxyServer) {

				// proxyServer
				let option = $("<option>")
					.attr("value", proxyServer.name)
					.text(proxyServer.name)
					.appendTo($comboBox);

				let selected = (proxyServer.name === selectedProxyName);
				option.prop("selected", selected);

				if (selected) {
					hadSelected = true;
				}
			});

			if (serverSubscriptions && serverSubscriptions.length > 0) {
				let subscriptionGroup = $("<optgroup>")
					// -Subscriptions-
					.attr("label", browser.i18n.getMessage("settingsActiveProxyServerSubscriptions"))
					.appendTo($comboBox);

				let added = false;

				for (let subscription of serverSubscriptions) {
					if (!subscription.enabled || !subscription.proxies) continue;

					for (let proxyServer of subscription.proxies) {
						let option = $("<option>")
							.attr("value", proxyServer.name)
							.text(proxyServer.name)
							.appendTo(subscriptionGroup);

						let selected = (proxyServer.name === selectedProxyName);
						option.prop("selected", selected);
						hadSelected = selected;

						added = true;
					}
				}
				if (!added) {
					// no item to be shown
					subscriptionGroup.remove();
				}
			}

			if (!hadSelected) {
				// first item
				$comboBox[0].selectedIndex = 0;
				$comboBox.trigger("change");
			}
		},
		reloadActiveProxyServer: function (proxyServers, serverSubscriptions) {

			let activeProxyServer = settingsUiData.activeProxyServer;

			let activeProxyName = "";
			if (activeProxyServer != null) {
				activeProxyName = activeProxyServer.name;
			}

			let cmbActiveProxyServer = $("#cmbActiveProxyServer");

			// remove previous items
			cmbActiveProxyServer.find("option,optgroup").remove();

			// populate
			settingsGrid.populateProxyServersToCombobox(cmbActiveProxyServer, activeProxyName, proxyServers, serverSubscriptions);
		},
		insertRowServersGrid: function () {
			let grdServers = $("#grdServers");
			let inserting = grdServers.jsGrid("option", "inserting");
			grdServers.jsGrid("option", "inserting", !inserting);
		},
		insertRowRulesGrid: function () {
			let grdRules = $("#grdRules");
			let inserting = grdRules.jsGrid("option", "inserting");
			grdRules.jsGrid("option", "inserting", !inserting);
		},
		getServers: function () {
			return $("#grdServers").jsGrid("option", "data");
		},
		getRules: function () {
			return $("#grdRules").jsGrid("option", "data");
		},
		getServerSubscriptions: function () {
			return $("#grdServerSubscriptions").jsGrid("option", "data");
		},
		getBypassList: function () {
			return $("#txtBypassList").val().split(/[\r\n]+/);
		},
		loadServers: function (proxyServers) {
			if (proxyServers)
				$("#grdServers").jsGrid("option", "data", proxyServers);
		},
		loadRules: function (proxyRules) {
			if (proxyRules)
				$("#grdRules").jsGrid("option", "data", proxyRules);
		},
		loadBypass: function (bypass) {
			if (bypass) {
				$("#chkEnableBypassForAlwaysEnable").prop("checked", bypass.enableForAlways);
				$("#chkEnableBypassForSystemProxy").prop("checked", bypass.enableForSystem);
				if (bypass.bypassList && Array.isArray(bypass.bypassList)) {
					$("#txtBypassList").val(bypass.bypassList.join("\n"));
				}
			}
		},
		loadServerSubscriptions: function (proxyServerSubscriptions) {
			if (proxyServerSubscriptions)
				$("#grdServerSubscriptions").jsGrid("option", "data", proxyServerSubscriptions);
		},
		validateServersRecord: function (args, checkExisting) {
			let name = args.item.name;
			if (!name) {
				args.cancel = true;

				// Specify the name of the server
				messageBox.error(browser.i18n.getMessage("settingsServerNameRequired"));
				return;
			}

			if (checkExisting !== false) {
				if (args.grid.data.some(item => name == item.name)) {
					args.cancel = true;
					// A Server with the same name already exists!
					messageBox.error(browser.i18n.getMessage("settingsServerNameExists"));
				}
			}
		},
		generateNewSubscriptionName: function () {
			// generates a unique name for list subscription
			let subscriptions = settingsGrid.getServerSubscriptions();
			let itemNo = 1;
			let result = `Subscription ${itemNo}`;

			if (subscriptions && subscriptions.length > 0) {
				let exist;

				itemNo = subscriptions.length + 1;
				result = `Subscription ${itemNo}`;

				do {
					exist = false;
					for (let i = subscriptions.length - 1; i >= 0; i--) {
						if (subscriptions[i].name === result) {
							exist = true;
							itemNo++;
							result = `Subscription ${itemNo}`;
							break;
						}
					}
				} while (exist)
			}

			return result;
		},
		generateNewServerName: function () {
			// generates a unique name for proxy server
			let servers = settingsGrid.getServers();
			let serverNo = 1;
			let result = `Server ${serverNo}`;

			if (servers && servers.length > 0) {
				let exist;

				serverNo = servers.length + 1;
				result = `Server ${serverNo}`;

				do {
					exist = false;
					for (let i = servers.length - 1; i >= 0; i--) {
						if (servers[i].name === result) {
							exist = true;
							serverNo++;
							result = `Server ${serverNo}`;
							break;
						}
					}
				} while (exist)
			}

			return result;
		},
		initializeServersGrid: function () {

			let protocolSelect = proxyServerProtocols.map(function (item) {
				return { name: item }
			});

			$("#grdServers").jsGrid({
				width: "100%",
				height: "300px",

				inserting: true,
				editing: true,
				sorting: true,
				paging: false,
				noDataContent: browser.i18n.getMessage("settingsServersGridNoDataContent"),
				//data: clients,

				fields: [
					{
						name: "name", title: browser.i18n.getMessage("settingsServersGridColName"), type: "text", width: 150, validate: "required",
						insertTemplate: function () {
							// setting default value
							return jsGrid.fields.text.prototype.insertTemplate.call(this).val(settingsGrid.generateNewServerName());
						}
					},
					{ name: "protocol", align: "left", title: browser.i18n.getMessage("settingsServersGridColProtocol"), type: "select", items: protocolSelect, valueField: "name", textField: "name", validate: "required" },
					{
						name: "host", title: browser.i18n.getMessage("settingsServersGridColServer"), type: "text", width: 200, validate: "required",
						insertTemplate: function () {
							// setting default value
							return jsGrid.fields.text.prototype.insertTemplate.call(this).val("127.0.0.1");
						}
					},
					{ name: "port", title: browser.i18n.getMessage("settingsServersGridColPort"), align: "left", type: "number", width: 100, validate: "required" },
					{ type: "control" }
				],
				onItemDeleting: function (args) {
				},
				onItemDeleted: function (e) {

					settingsGrid.reloadActiveProxyServer();

					changeTracking.servers = true;
				},
				onItemInserting: function (args) {

					settingsGrid.validateServersRecord(args);

				},
				onItemInserted: function (e) {

					settingsGrid.reloadActiveProxyServer();

					changeTracking.servers = true;
				},
				onItemUpdating: function (args) {

					if (args.item.name != args.previousItem.name) {

						// validate the host
						settingsGrid.validateServersRecord(args);
					}
				},
				onItemUpdated: function (e) {

					settingsGrid.reloadActiveProxyServer();

					changeTracking.servers = true;
				}
			});

			if (settingsUiData && settingsUiData.proxyServers)
				settingsGrid.loadServers(settingsUiData.proxyServers);

		},
		validateRulesSource: function (args, checkExisting) {
			let source = args.item.source;
			if (!source) {
				args.cancel = true;
				// Please specify the source of the rule!
				messageBox.error(browser.i18n.getMessage("settingsRuleSourceRequired"));
				return;
			}

			if (!utils.isValidHost(source)) {
				args.cancel = true;
				// source is invalid, source name should be something like 'google.com'
				messageBox.error(browser.i18n.getMessage("settingsRuleSourceInvalid"));
				return;
			}

			if (utils.urlHasSchema(source)) {
				let extractedHost = utils.extractHostFromUrl(source);
				if (extractedHost == null || !utils.isValidHost(extractedHost)) {
					args.cancel = true;

					// `Host name '${extractedHost}' is invalid, host name should be something like 'google.com'`
					messageBox.error(
						browser.i18n.getMessage("settingsRuleHostInvalid")
							.replace("{0}", extractedHost)
					);
					return;
				}
			} else {
				// this extraction is to remove paths from rules, e.g. google.com/test/

				let extractedHost = utils.extractHostFromUrl("http://" + source);
				if (extractedHost == null || !utils.isValidHost(extractedHost)) {
					args.cancel = true;

					// `Host name '${extractedHost}' is invalid, host name should be something like 'google.com'`
					messageBox.error(
						browser.i18n.getMessage("settingsRuleHostInvalid")
							.replace("{0}", extractedHost)
					);
					return;
				}
			}

			// the pattern
			args.item.pattern = utils.hostToMatchPattern(source);

			if (checkExisting !== false) {
				let data = args.grid.data;
				for (let i = 0; i < data.length; i++) {

					// don't check the item itself
					if (i == args.itemIndex)
						continue;

					let item = data[i];
					if (source == item.source) {
						args.cancel = true;
						// A Rule with the same source already exists!
						messageBox.error(browser.i18n.getMessage("settingsRuleSourceAlreadyExists"));
						return;
					}
				}
			}
		},
		initializeRulesGrid: function () {

			$("#grdRules").jsGrid({
				width: "100%",

				inserting: true,
				editing: true,
				sorting: true,
				paging: true,
				noDataContent: browser.i18n.getMessage("settingsRulesGridNoDataContent"),
				//data: clients,

				fields: [
					{ name: "source", title: browser.i18n.getMessage("settingsRulesGridColSource"), type: "text", width: 250, validate: "required" },
					{ name: "pattern", title: browser.i18n.getMessage("settingsRulesGridColPattern"), type: "disabled", width: 250 },
					{ name: "enabled", title: browser.i18n.getMessage("settingsRulesGridColEnabled"), type: "checkbox", width: 80 },
					{
						name: "proxy", title: browser.i18n.getMessage("settingsRulesGridColProxy"), width: 150, align: "left",
						editTemplate: proxyColEditTemplate,
						type: "select", valueType: "string",
						editValue: function () {

							if (this._cmbProxySelect) {
								let selectedName = this._cmbProxySelect.val();
								return settingsGrid.findProxyServerByName(selectedName);
							}
							return null;
						},
						itemTemplate: function (value) {
							if (!value)
								return browser.i18n.getMessage("settingsRulesProxyDefault");
							return value.name;
						}
					},
					{ type: "control" }
				],
				onItemDeleting: function (args) {

				},
				onItemDeleted: function (e) {
					changeTracking.rules = true;
				},
				onItemInserting: function (args) {
					settingsGrid.validateRulesSource(args);
				},
				onItemInserted: function (e) {

					changeTracking.rules = true;
				},
				onItemUpdating: function (args) {
					if (args.item.source != args.previousItem.source) {

						// validate the host
						settingsGrid.validateRulesSource(args);
					}
				},
				onItemUpdated: function (args) {
					// because the changes to host in 'onItemUpdating' is applied we have to do it here, again!
					if (args.item.source != args.previousItem.source) {

						// don't check for existing rule
						settingsGrid.validateRulesSource(args, false);

						// to display the changes this is required
						$("#grdRules").jsGrid("refresh");
					}

					changeTracking.rules = true;

				}
			});

			function proxyColEditTemplate(value, item) {

				let selectedProxyName = "";
				if (value) {
					selectedProxyName = value.name;
				}

				let cmbProxySelect = jsGrid.fields.select.prototype.editTemplate.apply(this, arguments);
				cmbProxySelect.addClass("form-control");

				// the default value which is empty string
				$("<option>")
					.attr("value", "")
					// [General]
					.text(browser.i18n.getMessage("settingsRulesProxyDefault"))
					.appendTo(cmbProxySelect);

				// populate
				settingsGrid.populateProxyServersToCombobox(cmbProxySelect, selectedProxyName);

				this._cmbProxySelect = cmbProxySelect;
				return cmbProxySelect;
			}

			if (settingsUiData && settingsUiData.proxyRules)
				settingsGrid.loadRules(settingsUiData.proxyRules);
		},
		exportProxyListFormatted: function () {
			let proxyList = settingsGrid.getServers();
			let result = `[SmartProxy Servers]\r\n`;

			for (let proxy of proxyList) {
				let proxyExport = `${proxy.host}:${proxy.port} [${proxy.protocol}]`;

				if (proxy.username) {
					proxyExport += ` [${proxy.name}] [${proxy.username}] [${proxy.password}]`;
				}
				else if (proxy.name != `${proxy.host}:${proxy.port}`) {
					proxyExport += ` [${proxy.name}]`;
				}

				result += proxyExport + "\r\n";
			}
			return result;
		},
		initializeServerSubscriptionsGrid: function () {
			$("#grdServerSubscriptions").jsGrid({
				width: "100%",
				height: "300px",

				inserting: false,
				editing: false,
				sorting: true,
				paging: false,
				noDataContent: browser.i18n.getMessage("settingsServerSubscriptionsGridNoDataContent"),
				//data: clients,

				fields: [
					{ name: "name", title: browser.i18n.getMessage("settingsServerSubscriptionsGridColName"), type: "text", width: 150 },
					{ name: "url", title: browser.i18n.getMessage("settingsServerSubscriptionsGridColUrl"), type: "text", width: 200 },
					{ name: "totalCount", title: browser.i18n.getMessage("settingsServerSubscriptionsGridColCount"), type: "text", width: 50 },
					{ name: "enabled", title: browser.i18n.getMessage("settingsServerSubscriptionsGridColEnabled"), type: "checkbox", width: 50 },
					{
						name: "name", title: "", width: 80,
						itemTemplate: function (value, item) {
							let editButton = $(`<button class="btn btn-sm btn-default" data-name="${value}">${"Edit"}</button>`);
							editButton.click(function () {
								let name = $(this).attr("data-name");
								settingsGrid.serverSubscriptionsEdit(name);
							});
							return editButton;
						}
					},
					{ type: "control", editButton: false }
				],
				onItemDeleting: function (args) {
				},
				onItemDeleted: function (e) {

					changeTracking.serverSubscriptions = true;
					settingsGrid.reloadActiveProxyServer();
				},
				onItemInserting: function (args) {

				},
				onItemInserted: function (e) {

					changeTracking.serverSubscriptions = true;
					settingsGrid.reloadActiveProxyServer();
				},
				onItemUpdating: function (args) {
				},
				onItemUpdated: function (e) {

					changeTracking.serverSubscriptions = true;
					settingsGrid.reloadActiveProxyServer();
				}
			});

			if (settingsUiData && settingsUiData.proxyServerSubscriptions)
				settingsGrid.loadServerSubscriptions(settingsUiData.proxyServerSubscriptions);
		},
		serverSubscriptionsModelUpdate: function (modal, dataItem) {

			if (dataItem) {
				modal.find("#txtName").val(dataItem.name);
				modal.find("#txtUrl").val(dataItem.url);
				modal.find("#numRefereshRate").val(dataItem.refreshRate);
				modal.find("#chkEnabled").prop('checked', dataItem.enabled);
				modal.find("#cmbServerSubscriptionProtocol").val(dataItem.proxyProtocol);
				modal.find("#cmbServerSubscriptionObfuscation").val(dataItem.obfuscation);
				modal.find("#cmbServerSubscriptionUsername").val(dataItem.username);
				if (dataItem.password != null)
					// from BASE64
					modal.find("#cmbServerSubscriptionPassword").val(atob(dataItem.password));
				else
					modal.find("#cmbServerSubscriptionPassword").val("");

			} else {

				modal.find("#txtName").val(settingsGrid.generateNewSubscriptionName());
				modal.find("#txtUrl").val("");
				modal.find("#numRefereshRate").val(0);
				modal.find("#chkEnabled").prop('checked', true);
				modal.find("#cmbServerSubscriptionProtocol")[0].selectedIndex = 0;
				modal.find("#cmbServerSubscriptionObfuscation")[0].selectedIndex = 0;
				modal.find("#cmbServerSubscriptionUsername").val("");
				modal.find("#cmbServerSubscriptionPassword").val("");
			}
		},
		serverSubscriptionsGetModel: function (modal) {

			return {
				name: modal.find("#txtName").val(),
				url: modal.find("#txtUrl").val(),
				enabled: modal.find("#chkEnabled").prop('checked'),
				proxyProtocol: modal.find("#cmbServerSubscriptionProtocol").val(),
				refreshRate: modal.find("#numRefereshRate").val() || 0,
				obfuscation: modal.find("#cmbServerSubscriptionObfuscation").val(),
				username: modal.find("#cmbServerSubscriptionUsername").val(),
				// BASE 64 string
				password: btoa(modal.find("#cmbServerSubscriptionPassword").val()),
				totalCount: 0
			};
		},
		serverSubscriptionsModelCopy: function (src, dest) {
			dest.name = src.name;
			dest.url = src.url;
			dest.enabled = src.enabled;
			dest.proxyProtocol = src.proxyProtocol;
			dest.refreshRate = src.refreshRate;
			dest.obfuscation = src.obfuscation;
			dest.username = src.username;

			dest.password = src.password;
			dest.totalCount = src.totalCount;
		},
		serverSubscriptionsAdd: function () {
			let modal = $("#modalServerSubscription");
			modal.data("editing", null);

			// empty the form
			settingsGrid.serverSubscriptionsModelUpdate(modal, null);

			modal.modal("show");

			function focusUrl() {
				modal.off("shown.bs.modal", focusUrl);
				modal.find("#txtUrl").focus();
			}

			modal.on("shown.bs.modal", focusUrl);
		},
		serverSubscriptionsEdit: function (name) {
			if (!name) return;
			let subscriptionsList = settingsGrid.getServerSubscriptions();
			let theSubscription = subscriptionsList.find(item => item.name === name);
			if (!theSubscription) {
				return;
			}

			let modal = $("#modalServerSubscription");
			modal.data("editing", name);

			// display the data in the form
			settingsGrid.serverSubscriptionsModelUpdate(modal, theSubscription);

			modal.modal("show");
		},
		serverSubscriptionsSave: function () {
			let modal = $("#modalServerSubscription");


			if (!modal.find("form")[0].checkValidity()) {
				// Please fill the required fields in the right format
				messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionIncompleteForm"));
				return;
			}
			let subscriptionModel = settingsGrid.serverSubscriptionsGetModel(modal);
			if (!subscriptionModel) {
				messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionInvalidForm"));
				return;
			}

			let subscriptionsList = settingsGrid.getServerSubscriptions();
			let editingName = modal.data("editing");
			let editingSubscription = null;

			if (editingName) {
				let nameIsDuplicate = false;
				for (let item of subscriptionsList) {
					if (item.name === editingName) {
						editingSubscription = item;
					}

					if (item.name == subscriptionModel.name && subscriptionModel.name != editingName) {
						nameIsDuplicate = true;
					}
				}
				if (subscriptionModel.name != editingName)
					// check for duplicate
					if (nameIsDuplicate) {
						// The entered name is already used, please enter another name.
						messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionDuplicateName"));
						return;
					}
			}

			// Saving...
			$("#btnSaveServerSubscription").attr("data-loading-text", browser.i18n.getMessage("settingsServerSubscriptionSavingButton"));
			$("#btnSaveServerSubscription").button("loading");

			proxyImporter.readFromServer(subscriptionModel,
				function (response) {
					$("#btnSaveServerSubscription").button('reset');

					if (response.success) {
						let count = response.result.length;

						subscriptionModel.proxies = response.result;
						subscriptionModel.totalCount = count;

						if (editingSubscription) {
							$.extend(editingSubscription, subscriptionModel);

							$("#grdServerSubscriptions").jsGrid("refresh");

							// The subscription is updated with {0} proxies in it. <br/>Don't forget to save the changes.
							messageBox.success(browser.i18n.getMessage("settingsServerSubscriptionSaveUpdated").replace("{0}", count));
						} else {
							$("#grdServerSubscriptions").jsGrid("insertItem", subscriptionModel);

							// The subscription is added with {0} proxies in it. <br/>Don't forget to save the changes.
							messageBox.success(browser.i18n.getMessage("settingsServerSubscriptionSaveAdded").replace("{0}", count));
						}
						changeTracking.serverSubscriptions = true;

						settingsGrid.reloadActiveProxyServer();

						// close the window
						modal.modal("hide");
					} else {
						messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionSaveFailedGet"));
					}
				},
				function () {
					messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionSaveFailedGet"));
					$("#btnSaveServerSubscription").button('reset');
				});
		},
		serverSubscriptionsTest: function (updateButtonState) {
			let modal = $("#modalServerSubscription");

			if (!modal.find("form")[0].checkValidity()) {
				// Please fill the required fields in the right format
				messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionIncompleteForm"));
				return;
			}

			let subscriptionModel = settingsGrid.serverSubscriptionsGetModel(modal);

			if (!subscriptionModel) {
				messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionInvalidForm"));
				return;
			}

			if (updateButtonState) {
				// Testing...
				$("#btnTestServerSubscription").attr("data-loading-text", browser.i18n.getMessage("settingsServerSubscriptionTestingButton"));
				$("#btnTestServerSubscription").button("loading");
			}
			proxyImporter.readFromServer(subscriptionModel,
				function (response) {

					if (updateButtonState)
						$("#btnTestServerSubscription").button('reset');

					if (response.success) {
						let count = response.result.length;

						messageBox.success(browser.i18n.getMessage("settingsServerSubscriptionTestSuccess").replace("{0}", count));
					} else {
						messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionTestFailed"));
					}
				},
				function () {
					messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionTestFailed"));
					if (updateButtonState)
						$("#btnTestServerSubscription").button('reset');
				});

		},
	};

	// ------------------
	// ------------------

	// initialize the settings ui
	initialize();
	$(initializeUi);
	$(settingsGrid.initialize);

	// internationalization
	$(localizeHtmlPage);
})();
