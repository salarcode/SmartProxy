/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2022 Salar Khalilzadeh <salar2k@gmail.com>
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
import { CommonUi } from "./CommonUi";
import { PolyFill } from "../../lib/PolyFill";
import { messageBox, jQuery, bootstrap } from "../../lib/External";
import { environment, api } from "../../lib/environment";
import { Utils } from "../../lib/Utils";
import { ProxyImporter } from "../../lib/ProxyImporter";
import { RuleImporter } from "../../lib/RuleImporter";
import { SettingsConfig, CommandMessages, SettingsPageInternalDataType, proxyServerProtocols, proxyServerSubscriptionObfuscate, ProxyServer, ProxyRule, ProxyRuleType, ProxyServerSubscription, GeneralOptions, ResultHolder, proxyServerSubscriptionFormat, SpecialRequestApplyProxyMode, specialRequestApplyProxyModeKeys, ProxyRulesSubscription, SubscriptionProxyRule, SmartProfile, SettingsPageSmartProfile, SmartProfileType, getSmartProfileTypeIcon, ProxyRuleSpecialProxyServer, getUserSmartProfileTypeConfig, themesCustomType, ThemeType, getSmartProfileTypeConfig, SubscriptionStats, getSmartProfileTypeName } from "../../core/definitions";
import { Debug } from "../../lib/Debug";
import { ProfileOperations } from "../../core/ProfileOperations";
import { SettingsOperation } from "../../core/SettingsOperation";

const jq = jQuery;

export class settingsPage {
	private static localized = false;
	private static settingsLoaded = false;
	private static grdServers: any;
	private static grdServerSubscriptions: any;
	private static currentSettings: SettingsConfig;
	private static pageSmartProfiles: SettingsPageSmartProfile[] = [];
	private static debugDiagnosticsRequested = false;

	/** Used to track changes and restore when reject changes selected */
	private static originalSettings: SettingsConfig;

	private static changeTracking = {
		options: false,
		smartProfiles: false,
		servers: false,
		activeProxy: false,
		serverSubscriptions: false,
		rulesSubscriptions: false
	};

	public static initialize() {
		settingsPage.registerMessageReader();
		CommonUi.onDocumentReady(this.localizeUi);
		CommonUi.onDocumentReady(this.bindEvents);
		CommonUi.onDocumentReady(this.initializeGrids);
		CommonUi.onDocumentReady(this.initializeUi);

		settingsPage.readSettingsPageData();
	}

	private static handleMessages(message: any, sender: any, sendResponse: Function) {
		let command: string;
		if (typeof message == 'string') command = message;
		else {
			command = message['command'];
		}

		if (command === CommandMessages.SettingsPageGetInitialDataResponse) {
			let dataForSettings: SettingsPageInternalDataType = message.settingsPageInitialData;

			settingsPage.applySettingsPageData(dataForSettings);
		}
	}

	private static registerMessageReader() {
		// start handling messages
		api.runtime.onMessage.addListener(settingsPage.handleMessages);
	}

	private static readSettingsPageData() {
		PolyFill.runtimeSendMessage(CommandMessages.SettingsPageGetInitialData,
			(dataForSettings: SettingsPageInternalDataType) => {
				if (!dataForSettings) {
					// Chrome Manifest 3 has this bug tha sends null message
					if (!environment.chrome) {
						// Source tab not found!
						messageBox.error(api.i18n.getMessage("settingsInitializeFailed"));
					}
					return;
				}
				settingsPage.applySettingsPageData(dataForSettings);
			},
			(error: Error) => {
				PolyFill.runtimeSendMessage("SettingsPageGetInitialData failed! > " + error);
				messageBox.error(api.i18n.getMessage("settingsInitializeFailed"));
			});
	}

	private static applySettingsPageData(dataForSettings: SettingsPageInternalDataType) {
		if (!dataForSettings) {
			return;
		}
		if (settingsPage.settingsLoaded)
			return;

		settingsPage.settingsLoaded = true;
		settingsPage.localizeUi();

		CommonUi.applyThemes(dataForSettings.settings.options);
		CommonUi.onDocumentReady(() =>
			settingsPage.populateDataForSettings(dataForSettings)
		);
		CommonUi.onDocumentReady(settingsPage.showNewUserWelcome);
	}

	private static populateDataForSettings(settingsData: SettingsPageInternalDataType) {
		this.currentSettings = settingsData.settings;
		CommonUi.applyThemes(this.currentSettings.options);
		this.populateSettingsUiData(settingsData);
		this.loadServersGrid(this.currentSettings.proxyServers);
		this.loadServerSubscriptionsGrid(this.currentSettings.proxyServerSubscriptions);
		this.loadDefaultProxyServer(this.currentSettings.proxyServers, this.currentSettings.proxyServerSubscriptions);
		this.loadSmartProfiles(this.currentSettings.proxyProfiles);
		this.loadGeneralOptions(this.currentSettings.options);
		CommonUi.onDocumentReady(this.loadAllProfilesProxyServers);

		// make copy
		this.originalSettings = new SettingsConfig();
		this.originalSettings.CopyFrom(this.currentSettings);
	}

	private static bindEvents() {
		// off canvas
		jq("#tabSettingsOffCanvas .nav-link").click(settingsPage.uiEvents.onClickMenuOffCanvas)

		// general options
		jq("#btnSkipWelcome").click(settingsPage.uiEvents.onClickSkipWelcome);

		jq("#cmbGeneralIncognitoProfile").on('focus', settingsPage.uiEvents.onGeneralIncognitoProfileFocus);

		jq("#btnSaveGeneralOptions").click(settingsPage.uiEvents.onClickSaveGeneralOptions);

		jq("#btnRejectGeneralOptions").click(settingsPage.uiEvents.onClickRejectGeneralOptions);

		jq("#chkSyncSettings").change(settingsPage.uiEvents.onSyncSettingsChanged);

		jq("#btnIgnoreRequestFailuresForDomains").click(settingsPage.uiEvents.onClickIgnoreRequestFailuresForDomains);

		jq("#btnViewShortcuts").click(settingsPage.uiEvents.onClickViewShortcuts);

		jq("#cmbThemesLight").change(settingsPage.uiEvents.onChangeThemesLight);

		jq("#cmbThemesDark").change(settingsPage.uiEvents.onChangeThemesDark);

		// Smart profiles
		jq(".menu-add-smart-profile").click(settingsPage.uiEvents.onClickAddNewSmartProfile);

		jq("#btnSubmitContinueAddingProfile").click(settingsPage.uiEvents.onClickSubmitContinueAddingProfile);

		// proxy servers
		jq("#cmbActiveProxyServer").on("change", settingsPage.uiEvents.onChangeActiveProxyServer);

		jq("#btnAddProxyServer").click(settingsPage.uiEvents.onClickAddProxyServer);

		jq("#cmdServerProtocol").on("change", settingsPage.uiEvents.onChangeServerProtocol);

		jq("#btnSubmitProxyServer").click(settingsPage.uiEvents.onClickSubmitProxyServer);

		jq("#btnSaveProxyServers").click(settingsPage.uiEvents.onClickSaveProxyServers);

		jq("#btnRejectProxyServers").click(settingsPage.uiEvents.onClickRejectProxyServers);

		jq("#btnClearProxyServers").click(settingsPage.uiEvents.onClickClearProxyServers);

		jq("#btnExportProxyServerOpen,#btnExportProxyServerOpenBackup").click(settingsPage.uiEvents.onClickExportProxyServerOpenBackup);

		jq("#btnImportProxyServer").click(settingsPage.uiEvents.onClickImportProxyServer);

		// backup
		jq("#btnBackupComplete").click(settingsPage.uiEvents.onClickBackupComplete);

		jq("#btnRestoreBackup").click(settingsPage.uiEvents.onClickRestoreBackup);

		jq("#btnFactoryReset").click(settingsPage.uiEvents.onClickFactoryReset);

		// proxy server subscriptions
		jq("#btnAddServerSubscription").click(settingsPage.uiEvents.onClickAddServerSubscription);

		jq("#btnSaveServerSubscription").click(settingsPage.uiEvents.onClickSaveServerSubscription);

		jq("#btnTestServerSubscription").click(settingsPage.uiEvents.onClickTestServerSubscription);

		jq("#btnClearServerSubscriptions").click(settingsPage.uiEvents.onClickClearServerSubscriptions);

		jq("#btnSaveServerSubscriptionsChanges").click(settingsPage.uiEvents.onClickSaveServerSubscriptionsChanges);

		jq("#btnRejectServerSubscriptionsChanges").click(settingsPage.uiEvents.onClickRejectServerSubscriptionsChanges);

		// Debug
		jq("#btnEnableDiagnostics").click(settingsPage.uiEvents.onClickEnableDiagnostics);
	}

	private static initializeGrids() {

		let dataTableCustomDom = '<t><"row"<"col-sm-12 col-md-5"<"text-left float-left"f>><"col-sm-12 col-md-7"<"text-right"l>>><"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>';

		settingsPage.grdServers = jq("#grdServers").DataTable({
			"dom": dataTableCustomDom,
			paging: true,
			select: true,
			scrollY: 460,
			scrollCollapse: true,
			responsive: true,
			lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
			ordering: true,
			rowReorder: {
				dataSrc: 'order',
				selector: 'tr>td:first-child>i',
				snapX: true
			},
			columnDefs: [
				{ targets: 0, visible: false }
			],
			columns: [
				{
					name: "order", data: "order", title: '', defaultContent: `<i class="fas fa-random"></i>`, width: 20, orderable: false
				},
				{
					name: "name", data: "name", title: api.i18n.getMessage("settingsServersGridColName"),
					render: (data, type, row: ProxyServer) => {
						return `<i class="fas fa-bars fa-xs px-2 cursor-move"></i>  ` + (row.name || '')
					},
					orderable: false,
					responsivePriority: 1
				},
				{
					name: "protocol", data: "protocol", title: api.i18n.getMessage("settingsServersGridColProtocol"), orderable: false
				},
				{
					name: "host", data: "host", title: api.i18n.getMessage("settingsServersGridColServer"), orderable: false
				},
				{
					name: "port", data: "port", type: "num", title: api.i18n.getMessage("settingsServersGridColPort"), orderable: false
				},
				{
					"width": "70px",
					"data": null, orderable: false,
					"className": "text-nowrap",
					"defaultContent": "<button class='btn btn-sm btn-success' id='btnServersEdit'>Edit</button> <button class='btn btn-sm btn-danger' id='btnServersRemove'><i class='fas fa-times'></button>",
					responsivePriority: 2
				}
			],
		});
		settingsPage.grdServers.on('responsive-display',
			function (e, dataTable, row, showHide, update) {
				let rowChild = row.child();

				if (showHide && rowChild && rowChild.length)
					settingsPage.refreshServersGridRowElement(rowChild[0]);
			}
		);
		settingsPage.grdServers.draw();

		settingsPage.grdServerSubscriptions = jq("#grdServerSubscriptions").DataTable({
			"dom": dataTableCustomDom,
			paging: true,
			select: true,
			scrollY: 460,
			scrollCollapse: true,
			responsive: true,
			lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
			ordering: false,
			columns: [
				{
					name: "name", data: "name", title: api.i18n.getMessage("settingsServerSubscriptionsGridColName"),
					responsivePriority: 1
				},
				{
					name: "url", data: "url", title: api.i18n.getMessage("settingsServerSubscriptionsGridColUrl"),
					responsivePriority: 3,
					render: (data, type, row: ProxyServerSubscription) => {
						let render = row.url;
						let stats = row.stats;
						if (stats) {
							let status = SubscriptionStats.ToString(stats);

							if (row.stats.lastStatus) {
								render += ` <div id='btnServerSubscriptionsViewStats' title='${status}' class='cursor-pointer float-end'><i class="fas fa-check-circle text-success"></i></div> `;
							}
							else {
								render += ` <div id='btnServerSubscriptionsViewStats' title='${status}' class='cursor-pointer float-end'><i class="fas fa-exclamation-triangle text-danger"></i></div> `;
							}
						}
						return render;
					},
				},
				{
					name: "totalCount", data: "totalCount", type: "num", title: api.i18n.getMessage("settingsServerSubscriptionsGridColCount")
				},
				{
					name: "enabled", data: "enabled", title: api.i18n.getMessage("settingsServerSubscriptionsGridColEnabled"),
				},
				{
					"width": "70px",
					"data": null,
					"className": "text-nowrap",
					"defaultContent": "<button class='btn btn-sm btn-success' id='btnSubscriptionsEdit'>Edit</button> <button class='btn btn-sm btn-danger' id='btnSubscriptionsRemove'><i class='fas fa-times'></button>",
					responsivePriority: 2
				}
			],
		});
		settingsPage.grdServerSubscriptions.on('responsive-display',
			function (e, dataTable, row, showHide, update) {
				let rowChild = row.child();
				if (showHide && rowChild && rowChild.length)
					settingsPage.refreshServerSubscriptionsGridRowElement(rowChild[0]);
			}
		);
		settingsPage.grdServerSubscriptions.draw();

		if (settingsPage.currentSettings) {
			if (settingsPage.currentSettings.proxyServers)
				settingsPage.loadServersGrid(settingsPage.currentSettings.proxyServers);

			if (settingsPage.currentSettings.proxyServerSubscriptions)
				settingsPage.loadServerSubscriptionsGrid(settingsPage.currentSettings.proxyServerSubscriptions);
		}
		else {
			settingsPage.loadServersGrid([]);
			settingsPage.loadServerSubscriptionsGrid([]);
		}

		jq(`.nav-link[href='#tab-servers'],
			.nav-link[href='#tab-server-subscriptions']`).on('shown.bs.tab', (e: any) => {

			// DataTables columns are not adjusted when hidden, needs to be done manually
			settingsPage.grdServers.columns.adjust().draw();
			settingsPage.grdServerSubscriptions.columns.adjust().draw();
		});
	}

	private static localizeUi() {
		if (settingsPage.localized)
			return;

		settingsPage.localized = true;
		CommonUi.localizeHtmlPage();
	}

	private static initializeUi() {
		if (environment.chrome) {
			jq("#divAlertChrome").show().remove('d-none');
			jq(".firefox-only").hide();
			jq(".chrome-only").show().remove('d-none');
			if (environment.manifestV3) {
				jq(".chrome-mv3-only").show().remove('d-none');
			}
		} else {
			jq("#divAlertFirefox").show().remove('d-none');
			jq(".firefox-only").show().remove('d-none');
			jq(".chrome-only").hide();
		}
		jq("#linkAddonsMarket")
			.text(environment.browserConfig.marketName)
			.attr("href", environment.browserConfig.marketUrl || "#");


		// -- ServerSubscription --------
		// applying the default values
		let cmbServerSubscriptionProtocol = jq("#cmbServerSubscriptionProtocol");
		let cmbServerSubscriptionObfuscation = jq("#cmbServerSubscriptionObfuscation");

		jq("<option>").attr("value", "")
			// (Auto detect with HTTP fallback)
			.text(api.i18n.getMessage("settingsServerSubscriptionProtocolDefault"))
			.appendTo(cmbServerSubscriptionProtocol);
		proxyServerProtocols.forEach(item => {
			jq("<option>").attr("value", item)
				.text(item)
				.appendTo(cmbServerSubscriptionProtocol);
		});

		proxyServerSubscriptionObfuscate.forEach(item => {
			jq("<option>").attr("value", item)
				.text(item)
				.appendTo(cmbServerSubscriptionObfuscation);
		});

		let cmbServerSubscriptionFormat = jq("#cmbServerSubscriptionFormat");
		proxyServerSubscriptionFormat.forEach((item, index) => {
			jq("<option>").attr("value", index)
				.text(item)
				.appendTo(cmbServerSubscriptionFormat);
		});

		let cmbServerSubscriptionApplyProxy = jq("#cmbServerSubscriptionApplyProxy");
		specialRequestApplyProxyModeKeys.forEach((item, index) => {
			jq("<option>").attr("value", index)
				.text(api.i18n.getMessage("settingsServerSubscriptionApplyProxy_" + item))
				.appendTo(cmbServerSubscriptionApplyProxy);
		});
		if (environment.chrome)
			cmbServerSubscriptionApplyProxy.attr("disabled", "disabled");


		var ww = document.body.clientWidth;
		if (ww < 576) {
			// show off-canvas on mobile
			const tabSettingsOffCanvas = bootstrap.Offcanvas.getOrCreateInstance(jq("#tabSettingsOffCanvas"));
			tabSettingsOffCanvas.show();
		}
	}

	private static showNewUserWelcome() {
		if (settingsPage.currentSettings.firstEverInstallNotified === true ||
			(settingsPage.currentSettings.proxyServers != null && settingsPage.currentSettings.proxyServers.length > 0))
			return;
		let modal = jq("#modalWelcome");
		modal.modal("show");
	}

	//#region Populate UI ----------------------

	/** Display General UI data */

	private static hideMenuOffCanvas() {
		const tabSettingsOffCanvas = bootstrap.Offcanvas.getInstance(jq("#tabSettingsOffCanvas"));
		if (tabSettingsOffCanvas) {
			tabSettingsOffCanvas.hide();
		}
	}

	private static windowScrollToTop(delayed?: boolean) {
		if (delayed) {
			setTimeout(() => {
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}, 300);
		}
		else {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	private static populateSettingsUiData(settingsData: SettingsPageInternalDataType) {
		let currentSettings = settingsData.settings;

		let divNoServersWarning = jq("#divNoServersWarning");
		if (currentSettings.proxyServers.length > 0 ||
			(currentSettings.proxyServerSubscriptions && currentSettings.proxyServerSubscriptions.length > 0)) {

			divNoServersWarning.hide();
		} else {
			divNoServersWarning.show().remove('d-none');
		}

		jq("#spanVersion").text("Version: " + currentSettings.version);

		if (settingsData.updateAvailableText && settingsData.updateInfo) {
			jq(".menu-update-available").show().remove('d-none')
				.find("a")
				.attr("href", settingsData.updateInfo.downloadPage)
				.find("span")
				.text(settingsData.updateAvailableText);
		}
	}

	/** Used for ActiveProxy and ... */
	private static populateProxyServersToComboBox(comboBox: any, selectedProxyId?: string, proxyServers?: ProxyServer[], serverSubscriptions?: ProxyServerSubscription[], dontIncludeAuthServers?: boolean) {
		if (!comboBox) return;
		if (!proxyServers)
			proxyServers = settingsPage.readServers();
		if (!serverSubscriptions)
			serverSubscriptions = settingsPage.readServerSubscriptions();

		let hasSelectedItem = false;
		// adding select options
		proxyServers.forEach((proxyServer: ProxyServer) => {

			if (dontIncludeAuthServers && proxyServer.username)
				// exit loop
				return;

			// proxyServer
			let option = jq("<option>")
				.attr("value", proxyServer.id)
				.text(proxyServer.name)
				.appendTo(comboBox);

			let selected = (proxyServer.id === selectedProxyId);
			option.prop("selected", selected);

			if (selected) {
				hasSelectedItem = true;
			}
		});

		if (serverSubscriptions && serverSubscriptions.length > 0) {
			let subscriptionGroup = jq("<optgroup>")
				// -Subscriptions-
				.attr("label", api.i18n.getMessage("settingsActiveProxyServerSubscriptions"))
				.appendTo(comboBox);

			let added = false;

			for (let subscription of serverSubscriptions) {
				if (!subscription.enabled || !subscription.proxies) continue;


				for (let proxyServer of subscription.proxies) {

					if (dontIncludeAuthServers && proxyServer.username)
						// exit loop
						return;

					let option = jq("<option>")
						.attr("value", proxyServer.name)
						.text(proxyServer.id)
						.appendTo(subscriptionGroup);

					let selected = (proxyServer.id === selectedProxyId);
					option.prop("selected", selected);
					if (selected) {
						hasSelectedItem = true;
					}

					added = true;
				}
			}
			if (!added) {
				// no item to be shown
				subscriptionGroup.remove();
			}
		}
		if (!hasSelectedItem) {
			// first item
			comboBox[0].selectedIndex = 0;
			comboBox.trigger("change");
		}
	}

	private static populateServerProtocol() {
		let modal = jq("#modalModifyProxyServer");
		let serverInputInfo = settingsPage.readServerModel(modal);

		if (serverInputInfo.protocol == "SOCKS5")
			modal.find("#chkServerProxyDNS-Control").show().remove('d-none');
		else
			modal.find("#chkServerProxyDNS-Control").hide();

		if (serverInputInfo.protocol == "SOCKS4")
			modal.find("#chkServerProxy-Authentication").hide();
		else if (serverInputInfo.protocol == "SOCKS5") {
			if (environment.chrome) {
				modal.find("#chkServerProxy-Authentication").hide();
			}
			else
				modal.find("#chkServerProxy-Authentication").show().remove('d-none');
		}
		else {
			modal.find("#chkServerProxy-Authentication").show().remove('d-none');
		}
	}

	private static populateServerModal(modalContainer: any, server?: ProxyServer) {

		if (server) {

			modalContainer.find("#txtServerOrder").val(server.order);
			modalContainer.find("#txtServerName").val(server.name);
			modalContainer.find("#txtServerAddress").val(server.host);
			modalContainer.find("#txtServerPort").val(server.port);
			modalContainer.find("#cmdServerProtocol").val(server.protocol);
			modalContainer.find("#chkServerProxyDNS").prop('checked', server.proxyDNS);
			modalContainer.find("#txtServerUsername").val(server.username);
			modalContainer.find("#txtServerPassword").val(server.password);
		} else {
			modalContainer.find("#txtServerOrder").val(0);
			modalContainer.find("#txtServerName").val(this.generateNewServerName());

			modalContainer.find("#txtServerAddress").val("127.0.0.1");
			modalContainer.find("#txtServerPort").val("");
			modalContainer.find("#cmdServerProtocol").val("HTTP");
			modalContainer.find("#chkServerProxyDNS").prop('checked', true);
			modalContainer.find("#txtServerUsername").val("");
			modalContainer.find("#txtServerPassword").val("");
		}
		settingsPage.populateServerProtocol();
	}

	private static readServerModel(modalContainer: any): ProxyServer {
		let proxy = new ProxyServer();

		proxy.order = +modalContainer.find("#txtServerOrder").val().trim();
		proxy.name = modalContainer.find("#txtServerName").val().trim();
		proxy.host = modalContainer.find("#txtServerAddress").val().trim();
		proxy.port = modalContainer.find("#txtServerPort").val();
		proxy.protocol = modalContainer.find("#cmdServerProtocol").val();
		proxy.username = modalContainer.find("#txtServerUsername").val().trim();
		proxy.password = modalContainer.find("#txtServerPassword").val().trim();
		proxy.proxyDNS = modalContainer.find("#chkServerProxyDNS").prop("checked");
		if (proxy.order == 0) {
			let proxyServers = settingsPage.readServers();
			proxy.order = proxyServers.length + 1;
		}

		return proxy;
	}

	private static populateRuleModal(pageProfile: SettingsPageSmartProfile, modalContainer: any, proxyRule?: ProxyRule) {
		// populate servers
		let cmdRuleProxyServer = modalContainer.find("#cmdRuleProxyServer");
		cmdRuleProxyServer.empty();
		let cmdRuleAction = modalContainer.find("#cmdRuleAction");

		if (cmdRuleProxyServer.length) {
			// the default value which is empty string
			jq("<option>")
				.attr("value", ProxyRuleSpecialProxyServer.DefaultGeneral)
				.text(api.i18n.getMessage("settingsRulesProxyDefault")) // [Use Active Proxy]
				.appendTo(cmdRuleProxyServer);
			jq("<option>")
				.attr("value", ProxyRuleSpecialProxyServer.ProfileProxy)
				.text(api.i18n.getMessage("settingsRulesProxyFromProfile")) // [Use Profile Proxy]
				.appendTo(cmdRuleProxyServer);
		}

		let dontIncludeAuthServers = false;
		if (environment.chrome)
			dontIncludeAuthServers = true;

		if (proxyRule) {

			modalContainer.find("#chkRuleGeneratePattern").prop('checked', proxyRule.autoGeneratePattern);
			modalContainer.find("#cmdRuleType").val(proxyRule.ruleType);

			modalContainer.find("#txtRuleSource").val(proxyRule.hostName);
			modalContainer.find("#txtRuleMatchPattern").val(proxyRule.rulePattern);
			modalContainer.find("#txtRuleUrlRegex").val(proxyRule.ruleRegex);
			modalContainer.find("#txtRuleUrlExact").val(proxyRule.ruleExact);
			modalContainer.find("#chkRuleEnabled").prop('checked', proxyRule.enabled);
			modalContainer.find("#cmdRuleAction").val(proxyRule.whiteList ? "1" : "0");

			let proxyServerId = null;
			if (proxyRule.proxy)
				proxyServerId = proxyRule.proxy.id;

			if (cmdRuleProxyServer.length)
				settingsPage.populateProxyServersToComboBox(cmdRuleProxyServer, proxyServerId, null, null, dontIncludeAuthServers);

		} else {

			modalContainer.find("#chkRuleGeneratePattern").prop('checked', true);
			modalContainer.find("#cmdRuleType").val(ProxyRuleType.MatchPatternHost);

			modalContainer.find("#txtRuleSource").val("");
			modalContainer.find("#txtRuleMatchPattern").val("");
			modalContainer.find("#txtRuleUrlRegex").val("");
			modalContainer.find("#txtRuleUrlExact").val("");
			modalContainer.find("#chkRuleEnabled").prop('checked', true);

			if (cmdRuleAction.length) {
				if (pageProfile.smartProfile.profileTypeConfig.defaultRuleActionIsWhitelist == true)
					cmdRuleAction[0].selectedIndex = 1;
				else
					cmdRuleAction[0].selectedIndex = 0;
			}

			if (cmdRuleProxyServer.length)
				settingsPage.populateProxyServersToComboBox(cmdRuleProxyServer, null, null, null, dontIncludeAuthServers);
		}

		settingsPage.updateProxyRuleModal(pageProfile.htmlProfileTab);
	}

	private static updateProxyRuleModal(tabContainer: any) {
		let autoPattern = tabContainer.find("#chkRuleGeneratePattern").prop('checked');
		if (autoPattern) {
			tabContainer.find("#txtRuleMatchPattern").attr('disabled', 'disabled');
		}
		else {
			tabContainer.find("#txtRuleMatchPattern").removeAttr('disabled');
		}

		let ruleType = tabContainer.find("#cmdRuleType").val();

		if (ruleType == ProxyRuleType.MatchPatternHost ||
			ruleType == ProxyRuleType.MatchPatternUrl) {
			tabContainer.find("#divRuleMatchPattern").show();
			tabContainer.find("#divRuleGeneratePattern").show();
			tabContainer.find("#divRuleUrlRegex").hide();
			tabContainer.find("#divRuleUrlExact").hide();
		}
		else if (ruleType == ProxyRuleType.RegexHost ||
			ruleType == ProxyRuleType.RegexUrl) {
			tabContainer.find("#divRuleMatchPattern").hide();
			tabContainer.find("#divRuleGeneratePattern").hide();
			tabContainer.find("#divRuleUrlRegex").show();
			tabContainer.find("#divRuleUrlExact").hide();
		} else if (ruleType == ProxyRuleType.DomainSubdomain) {
			tabContainer.find("#divRuleMatchPattern").hide();
			tabContainer.find("#divRuleGeneratePattern").hide();
			tabContainer.find("#divRuleUrlRegex").hide();
			tabContainer.find("#divRuleUrlExact").hide();
		}
		else {
			tabContainer.find("#divRuleMatchPattern").hide();
			tabContainer.find("#divRuleGeneratePattern").hide();
			tabContainer.find("#divRuleUrlRegex").hide();
			tabContainer.find("#divRuleUrlExact").show();
		}
	}

	private static readProxyRuleModel(modalContainer: any): ProxyRule {
		let selectedProxyId = modalContainer.find("#cmdRuleProxyServer").val();
		let selectedProxy = null;

		if (selectedProxyId)
			selectedProxy = settingsPage.findProxyServerById(selectedProxyId);

		let ruleInfo = new ProxyRule();
		ruleInfo.autoGeneratePattern = modalContainer.find("#chkRuleGeneratePattern").prop('checked');
		ruleInfo.ruleType = parseInt(modalContainer.find("#cmdRuleType").val());
		ruleInfo.hostName = modalContainer.find("#txtRuleSource").val();
		ruleInfo.rulePattern = modalContainer.find("#txtRuleMatchPattern").val();
		ruleInfo.ruleRegex = modalContainer.find("#txtRuleUrlRegex").val();
		ruleInfo.ruleExact = modalContainer.find("#txtRuleUrlExact").val();
		ruleInfo.proxy = selectedProxy;
		ruleInfo.proxyServerId = selectedProxyId;
		ruleInfo.enabled = modalContainer.find("#chkRuleEnabled").prop("checked");
		ruleInfo.whiteList = parseInt(modalContainer.find("#cmdRuleAction").val()) != 0;
		return ruleInfo;
	}

	private static populateServerSubscriptionsModal(modalContainer: any, subscription?: ProxyServerSubscription) {
		if (subscription) {
			modalContainer.find("#txtName").val(subscription.name);
			modalContainer.find("#txtUrl").val(subscription.url);
			modalContainer.find("#numRefreshRate").val(subscription.refreshRate);
			modalContainer.find("#chkServerSubscriptionEnabled").prop('checked', subscription.enabled);
			modalContainer.find("#cmbServerSubscriptionProtocol").val(subscription.proxyProtocol);
			modalContainer.find("#cmbServerSubscriptionObfuscation").val(subscription.obfuscation);
			modalContainer.find("#cmbServerSubscriptionFormat").val(subscription.format);
			modalContainer.find("#cmbServerSubscriptionApplyProxy").val(subscription.applyProxy || SpecialRequestApplyProxyMode.CurrentProxy);
			modalContainer.find("#cmbServerSubscriptionUsername").val(subscription.username);
			if (subscription.password != null)
				// from BASE64
				modalContainer.find("#cmbServerSubscriptionPassword").val(atob(subscription.password));
			else
				modalContainer.find("#cmbServerSubscriptionPassword").val("");

		} else {

			modalContainer.find("#txtName").val(settingsPage.generateNewSubscriptionName());
			modalContainer.find("#txtUrl").val("");
			modalContainer.find("#numRefreshRate").val(0);
			modalContainer.find("#chkServerSubscriptionEnabled").prop('checked', true);
			modalContainer.find("#cmbServerSubscriptionProtocol")[0].selectedIndex = 0;
			modalContainer.find("#cmbServerSubscriptionObfuscation")[0].selectedIndex = 0;
			modalContainer.find("#cmbServerSubscriptionFormat")[0].selectedIndex = 0;
			modalContainer.find("#cmbServerSubscriptionApplyProxy")[0].selectedIndex = 0;
			modalContainer.find("#cmbServerSubscriptionUsername").val("");
			modalContainer.find("#cmbServerSubscriptionPassword").val("");
		}
	}

	private static readServerSubscriptionModel(modalContainer: any): ProxyServerSubscription {
		let subscription = new ProxyServerSubscription();

		subscription.name = modalContainer.find("#txtName").val();
		subscription.url = modalContainer.find("#txtUrl").val();
		subscription.enabled = modalContainer.find("#chkServerSubscriptionEnabled").prop('checked');
		subscription.proxyProtocol = modalContainer.find("#cmbServerSubscriptionProtocol").val();
		subscription.refreshRate = +(modalContainer.find("#numRefreshRate").val() || 0);
		subscription.obfuscation = modalContainer.find("#cmbServerSubscriptionObfuscation").val();
		subscription.format = +modalContainer.find("#cmbServerSubscriptionFormat").val();
		subscription.applyProxy = +modalContainer.find("#cmbServerSubscriptionApplyProxy").val();
		subscription.username = modalContainer.find("#cmbServerSubscriptionUsername").val();
		// BASE 64 string
		subscription.password = btoa(modalContainer.find("#cmbServerSubscriptionPassword").val());
		subscription.totalCount = 0;

		return subscription;
	}

	private static populateRulesSubscriptionsModal(pageProfile: SettingsPageSmartProfile, modalContainer: any, subscription?: ProxyRulesSubscription) {
		if (subscription) {
			modalContainer.find("#txtName").val(subscription.name);
			modalContainer.find("#txtUrl").val(subscription.url);
			modalContainer.find("#numRefreshRate").val(subscription.refreshRate);
			modalContainer.find("#chkRulesSubscriptionEnabled").prop('checked', subscription.enabled);
			modalContainer.find("#cmbRulesSubscriptionObfuscation").val(subscription.obfuscation);
			modalContainer.find("#cmbRulesSubscriptionFormat").val(subscription.format);
			modalContainer.find("#cmbRulesSubscriptionApplyProxy").val(subscription.applyProxy || SpecialRequestApplyProxyMode.CurrentProxy);
			modalContainer.find("#cmbRulesSubscriptionUsername").val(subscription.username);
			if (subscription.password != null)
				// from BASE64
				modalContainer.find("#cmbRulesSubscriptionPassword").val(atob(subscription.password));
			else
				modalContainer.find("#cmbRulesSubscriptionPassword").val("");

		} else {

			modalContainer.find("#txtName").val(settingsPage.generateNewRulesSubscriptionName(pageProfile));
			modalContainer.find("#txtUrl").val("");
			modalContainer.find("#numRefreshRate").val(0);
			modalContainer.find("#chkRulesSubscriptionEnabled").prop('checked', true);
			modalContainer.find("#cmbRulesSubscriptionObfuscation")[0].selectedIndex = -1; // default is not selected
			modalContainer.find("#cmbRulesSubscriptionFormat")[0].selectedIndex = -1; // default is not selected
			modalContainer.find("#cmbRulesSubscriptionApplyProxy")[0].selectedIndex = 0;
			modalContainer.find("#cmbRulesSubscriptionUsername").val("");
			modalContainer.find("#cmbRulesSubscriptionPassword").val("");
		}
	}

	private static readRulesSubscriptionModel(modalContainer: any): ProxyRulesSubscription {
		let subscription = new ProxyRulesSubscription();

		subscription.name = modalContainer.find("#txtName").val();
		subscription.url = modalContainer.find("#txtUrl").val();
		subscription.enabled = modalContainer.find("#chkRulesSubscriptionEnabled").prop('checked');
		subscription.refreshRate = +(modalContainer.find("#numRefreshRate").val() || 0);
		subscription.obfuscation = modalContainer.find("#cmbRulesSubscriptionObfuscation").val();
		subscription.format = +modalContainer.find("#cmbRulesSubscriptionFormat").val();
		subscription.applyProxy = +modalContainer.find("#cmbRulesSubscriptionApplyProxy").val();
		subscription.username = modalContainer.find("#cmbRulesSubscriptionUsername").val();
		// BASE 64 string
		subscription.password = btoa(modalContainer.find("#cmbRulesSubscriptionPassword").val());
		subscription.totalCount = 0;

		return subscription;
	}
	//#endregion

	//#region General tab functions --------------

	private static loadGeneralOptions(options: GeneralOptions) {
		if (!options)
			return;
		let divGeneral = jq("#tab-general");

		divGeneral.find("#chkProxyPerOrigin").prop("checked", options.proxyPerOrigin || false);
		if (options.activeIncognitoProfileId) {
			this.populateIncognitoProfileDropDown(options.activeIncognitoProfileId);
		}
		divGeneral.find("#cmbGeneralIncognitoProfile").val(options.activeIncognitoProfileId || '');

		divGeneral.find("#chkSyncSettings").prop("checked", options.syncSettings || false);
		divGeneral.find("#chkSyncProxyMode").prop("checked", options.syncActiveProfile || false);
		divGeneral.find("#chkSyncActiveProxy").prop("checked", options.syncActiveProxy || false);

		divGeneral.find("#chkDetectRequestFailures").prop("checked", options.detectRequestFailures || false);
		divGeneral.find("#chkDisplayFailedOnBadge").prop("checked", options.displayFailedOnBadge || false);

		divGeneral.find("#chkEnableShortcuts").prop("checked", options.enableShortcuts || false);
		divGeneral.find("#chkShortcutNotification").prop("checked", options.shortcutNotification || false);
		divGeneral.find("#chkDisplayAppliedProxyOnBadge").prop("checked", options.displayAppliedProxyOnBadge || false);
		divGeneral.find("#chkDisplayMatchedRuleOnBadge").prop("checked", options.displayMatchedRuleOnBadge || false);
		divGeneral.find("#chkRefreshTabOnConfigChanges").prop("checked", options.refreshTabOnConfigChanges || false);

		divGeneral.find("#rbtnThemesAutoSwitchBySystem").prop("checked", options.themeType == ThemeType.Auto);
		divGeneral.find("#rbtnThemesLight").prop("checked", options.themeType == ThemeType.Light);
		divGeneral.find("#rbtnThemesDark").prop("checked", options.themeType == ThemeType.Dark);
		divGeneral.find("#cmbThemesLight").val(options.themesLight);
		divGeneral.find("#txtThemesLightCustomUrl").val(options.themesLightCustomUrl);
		divGeneral.find("#cmbThemesDark").val(options.themesDark);
		divGeneral.find("#txtThemesDarkCustomUrl").val(options.themesDarkCustomUrl);

		// this is needed to enabled/disable UI based on settings
		settingsPage.uiEvents.onSyncSettingsChanged();
		settingsPage.uiEvents.onChangeThemesLight();
		settingsPage.uiEvents.onChangeThemesDark();

		if (environment.chrome) {
			divGeneral.find("#chkProxyPerOrigin").attr("disabled", "disabled")
				.parents("label").attr("disabled", "disabled");
			divGeneral.find("#cmbGeneralIncognitoProfile").attr("disabled", "disabled")
				.parents("label").attr("disabled", "disabled");
		}
	}

	private static readGeneralOptions(generalOptions?: GeneralOptions): GeneralOptions {
		if (!generalOptions)
			generalOptions = new GeneralOptions();
		let divGeneral = jq("#tab-general");

		generalOptions.proxyPerOrigin = divGeneral.find("#chkProxyPerOrigin").prop("checked");
		generalOptions.activeIncognitoProfileId = divGeneral.find("#cmbGeneralIncognitoProfile").val();

		generalOptions.syncSettings = divGeneral.find("#chkSyncSettings").prop("checked");
		generalOptions.syncActiveProfile = divGeneral.find("#chkSyncProxyMode").prop("checked");
		generalOptions.syncActiveProxy = divGeneral.find("#chkSyncActiveProxy").prop("checked");

		generalOptions.detectRequestFailures = divGeneral.find("#chkDetectRequestFailures").prop("checked");
		generalOptions.displayFailedOnBadge = divGeneral.find("#chkDisplayFailedOnBadge").prop("checked");

		generalOptions.enableShortcuts = divGeneral.find("#chkEnableShortcuts").prop("checked");
		generalOptions.shortcutNotification = divGeneral.find("#chkShortcutNotification").prop("checked");
		generalOptions.displayAppliedProxyOnBadge = divGeneral.find("#chkDisplayAppliedProxyOnBadge").prop("checked");
		generalOptions.displayMatchedRuleOnBadge = divGeneral.find("#chkDisplayMatchedRuleOnBadge").prop("checked");
		generalOptions.refreshTabOnConfigChanges = divGeneral.find("#chkRefreshTabOnConfigChanges").prop("checked");
		if (divGeneral.find("#rbtnThemesLight").prop("checked")) {
			generalOptions.themeType = ThemeType.Light;
		}
		else if (divGeneral.find("#rbtnThemesDark").prop("checked")) {
			generalOptions.themeType = ThemeType.Dark;
		}
		else {
			generalOptions.themeType = ThemeType.Auto;
		}
		generalOptions.themesLight = divGeneral.find("#cmbThemesLight").val();
		generalOptions.themesLightCustomUrl = divGeneral.find("#txtThemesLightCustomUrl").val();
		generalOptions.themesDark = divGeneral.find("#cmbThemesDark").val();
		generalOptions.themesDarkCustomUrl = divGeneral.find("#txtThemesDarkCustomUrl").val();

		return generalOptions;
	}

	private static populateIncognitoProfileDropDown(selectedId?: string) {

		const cmbGeneralIncognitoProfile = jq("#cmbGeneralIncognitoProfile");
		const selectedValue = selectedId || cmbGeneralIncognitoProfile.val();
		cmbGeneralIncognitoProfile.empty();

		jq("<option>").attr("value", "")
			// (Auto detect with HTTP fallback)
			.text(api.i18n.getMessage("settingsGeneralIncognitoProfileDisabled"))
			.appendTo(cmbGeneralIncognitoProfile);

		for (const pgProfile of settingsPage.pageSmartProfiles) {
			const smartProfile = pgProfile.smartProfile;

			jq("<option>").attr("value", smartProfile.profileId)
				.text(smartProfile.profileName)
				.appendTo(cmbGeneralIncognitoProfile);
		}
		cmbGeneralIncognitoProfile.val(selectedValue);
	}


	//#endregion

	//#region Servers tab functions --------------

	private static loadServersGrid(servers: any[]) {
		if (!this.grdServers)
			return;
		this.grdServers.clear();
		this.grdServers.rows.add(servers).draw('full-hold');

		// binding the events for all the rows
		this.refreshServersGridAllRows();
	}

	private static loadDefaultProxyServer(proxyServers?: ProxyServer[], serverSubscriptions?: any[]) {
		let defaultProxyServerId = this.currentSettings.defaultProxyServerId;

		let cmbActiveProxyServer = jq("#cmbActiveProxyServer");

		// remove previous items
		cmbActiveProxyServer.children().remove();

		// populate
		this.populateProxyServersToComboBox(cmbActiveProxyServer, defaultProxyServerId, proxyServers, serverSubscriptions);
	}

	private static readServers(): any[] {
		return this.grdServers.data().toArray();
	}

	private static readSelectedServer(e?: any): any {
		let dataItem;

		if (e && e.target) {
			let rowElement = jq(e.target).parents('tr');
			if (rowElement.hasClass('child')) {
				this.grdServers.rows().deselect();
				dataItem = this.grdServers.row(rowElement.prev('tr.parent')).select().data();
			}
			else
				dataItem = this.grdServers.row(rowElement).data();
		}
		else
			dataItem = this.grdServers.row({ selected: true }).data();

		return dataItem;
	}

	private static readSelectedServerRow(e: any): any {
		if (e && e.target) {
			let rowElement = jq(e.target).parents('tr');
			if (rowElement.hasClass('child'))
				return this.grdServers.row({ selected: true });
			else
				return this.grdServers.row(rowElement);
		}

		return null;
	}

	private static refreshServersGrid() {
		let currentRow = this.grdServers.row(".selected");
		if (currentRow && currentRow.data())
			// displaying the possible data change
			settingsPage.refreshServersGridRow(currentRow, true);
		else {
			this.grdServers.rows().invalidate();
			settingsPage.refreshServersGridAllRows();
		}

		this.grdServers.draw('full-hold');
	}

	private static refreshServersGridRow(row: any, invalidate?: boolean) {
		if (!row)
			return;
		if (invalidate)
			row.invalidate();

		let rowElement = jq(row.node());

		// NOTE: to display update data the row should be invalidated
		// and invalidated row loosed the event bindings.
		// so we need to bind the events each time data changes.

		rowElement.find("#btnServersRemove").on("click", settingsPage.uiEvents.onServersRemoveClick);
		rowElement.find("#btnServersEdit").on("click", settingsPage.uiEvents.onServersEditClick);
	}

	private static refreshServersGridRowElement(rowElement: any, invalidate?: boolean) {
		if (!rowElement)
			return;
		rowElement = jq(rowElement);

		rowElement.find("#btnServersRemove").on("click", settingsPage.uiEvents.onServersRemoveClick);
		rowElement.find("#btnServersEdit").on("click", settingsPage.uiEvents.onServersEditClick);
	}

	private static refreshServersGridAllRows() {
		var nodes = this.grdServers.rows().nodes();
		for (let index = 0; index < nodes.length; index++) {
			const rowElement = jq(nodes[index]);

			rowElement.find("#btnServersRemove").on("click", settingsPage.uiEvents.onServersRemoveClick);
			rowElement.find("#btnServersEdit").on("click", settingsPage.uiEvents.onServersEditClick);
		}
	}

	private static insertNewServerInGrid(newServer: ProxyServer) {
		try {

			let row = this.grdServers.row
				.add(newServer)
				.draw('full-hold');

			// binding the events
			settingsPage.refreshServersGridRow(row);

		} catch (error) {
			PolyFill.runtimeSendMessage("insertNewServerInGrid failed! > " + error);
			throw error;
		}
	}

	/** find proxy by Id from Servers or Subscriptions */
	private static findProxyServerById(proxyServerId: string): ProxyServer | null {
		let proxyServers = settingsPage.readServers();

		let proxy = proxyServers.find(item => item.id === proxyServerId);
		if (proxy !== undefined)
			return proxy;

		let serverSubscriptions = settingsPage.readServerSubscriptions();
		for (let subscription of serverSubscriptions) {
			proxy = subscription.proxies.find(item => item.id === proxyServerId);
			if (proxy !== undefined)
				return proxy;
		}
		return null;
	}

	private static exportServersListFormatted(): string {
		let proxyList = settingsPage.readServers();
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
	}
	//#endregion

	//#region Smart Profiles tab functions ------------------------------
	private static readSmartProfile(pageProfile: SettingsPageSmartProfile): SmartProfile {
		let previousProfile = pageProfile.smartProfile;
		let tabContainer = pageProfile.htmlProfileTab;

		let smartProfile = new SmartProfile();
		ProfileOperations.copySmartProfileBase(previousProfile, smartProfile);

		smartProfile.profileName = tabContainer.find("#txtSmartProfileName").val();
		smartProfile.profileProxyServerId = tabContainer.find("#cmbProfileProxyServer").val();
		smartProfile.proxyRules = this.readRules(pageProfile);
		smartProfile.rulesSubscriptions = this.readRulesSubscriptions(pageProfile);
		let chkSmartProfileEnabled = tabContainer.find("#chkSmartProfileEnabled");
		if (chkSmartProfileEnabled.length)
			smartProfile.enabled = chkSmartProfileEnabled.prop('checked');

		return smartProfile;
	}

	private static loadSmartProfiles(profiles: SmartProfile[]) {

		let profileMenuTemplate = jq(".menu-smart-profile").hide();
		let profileTabTemplate = jq("#tab-smart-profile").hide();

		let lastMenu = profileMenuTemplate;
		let lastTab = profileTabTemplate;

		for (const profile of profiles) {
			if (!profile.profileTypeConfig.editable)
				continue;

			profile.rulesSubscriptions = profile.rulesSubscriptions || [];
			profile.proxyRules = profile.proxyRules || [];

			let pageSmartProfile = this.createProfileContainer(profile, false, true);
			let profileMenu = pageSmartProfile.htmlProfileMenu;
			let profileTab = pageSmartProfile.htmlProfileTab;

			// -----
			let newProfileMenuList = profileMenu.insertAfter(lastMenu);
			lastTab.after(profileTab);
			lastMenu = newProfileMenuList;
			lastTab = profileTab;

			// -----
			this.pageSmartProfiles.push(pageSmartProfile);
		}
	}

	private static removePageSmartProfile(removedPageSmartProfile: SettingsPageSmartProfile) {
		removedPageSmartProfile.modalAddMultipleRules.remove();
		removedPageSmartProfile.modalAddMultipleRules = null;
		removedPageSmartProfile.modalImportRules.remove();
		removedPageSmartProfile.modalImportRules = null;
		removedPageSmartProfile.modalModifyRule.remove();
		removedPageSmartProfile.modalModifyRule = null;
		removedPageSmartProfile.modalRulesSubscription.remove();
		removedPageSmartProfile.modalRulesSubscription = null;

		removedPageSmartProfile.htmlProfileMenu.remove();
		removedPageSmartProfile.htmlProfileMenu = null;
		removedPageSmartProfile.htmlProfileTab.remove();
		removedPageSmartProfile.htmlProfileTab = null;
		removedPageSmartProfile.grdRules = null;
		removedPageSmartProfile.grdRulesSubscriptions = null;
	}

	private static removePageProfileAndReset(pageSmartProfile: SettingsPageSmartProfile) {

		let prevProfileMenu = pageSmartProfile.htmlProfileMenu.prev();

		// clean up
		this.removePageSmartProfile(pageSmartProfile);

		// show the tab now
		prevProfileMenu.tab('show');
	}

	private static removeUnsavedProfileAndReload(unsavedPageSmartProfile: SettingsPageSmartProfile, savedProfile: SmartProfile) {
		// clean up
		this.removePageSmartProfile(unsavedPageSmartProfile);

		// adding the new one
		let pageSmartProfile = this.createProfileContainer(savedProfile, false, true);
		this.pageSmartProfiles.push(pageSmartProfile);

		let profileMenu = pageSmartProfile.htmlProfileMenu;
		let profileTab = pageSmartProfile.htmlProfileTab;

		let profileTabTemplate = jq("#tab-smart-profile");
		let btnAddNewSmartProfile = jq(".menu-add-smart-profile");
		profileTabTemplate.after(profileTab);
		btnAddNewSmartProfile.before(profileMenu);

		// show the tab now
		profileMenu.tab('show');

		settingsPage.loadProfileProxyServer(pageSmartProfile);
	}

	private static createNewUnsavedProfile(profileType: SmartProfileType): SettingsPageSmartProfile {
		let newProfile = new SmartProfile();
		newProfile.profileType = profileType;
		newProfile.profileTypeConfig = getUserSmartProfileTypeConfig(profileType);
		newProfile.profileName = '';

		return this.createProfileContainerAttached(newProfile, true, false);
	}

	private static createProfileContainerAttached(profile: SmartProfile, isNewProfile: boolean = false, displayInMenu: boolean = true): SettingsPageSmartProfile {

		let pageSmartProfile = this.createProfileContainer(profile, isNewProfile, displayInMenu);
		let profileMenu = pageSmartProfile.htmlProfileMenu;
		let profileTab = pageSmartProfile.htmlProfileTab;

		let profileTabTemplate = jq("#tab-smart-profile");
		let btnAddNewSmartProfile = jq(".menu-add-smart-profile");
		profileTabTemplate.after(profileTab);
		btnAddNewSmartProfile.before(profileMenu);

		settingsPage.updateProfileGridsLayout(pageSmartProfile);

		return pageSmartProfile;
	}

	private static createProfileContainer(profile: SmartProfile, isNewProfile: boolean = false, displayInMenu: boolean = true): SettingsPageSmartProfile {
		let pageSmartProfile = new SettingsPageSmartProfile();
		pageSmartProfile.smartProfile = profile;

		// tab
		let newProfileTab = this.createProfileTab(profile, isNewProfile);
		let tabId = newProfileTab.tabId;
		let profileTab = newProfileTab.profileTab;

		pageSmartProfile.modalModifyRule = profileTab.find("#modalModifyRule").hide();
		pageSmartProfile.modalAddMultipleRules = profileTab.find("#modalAddMultipleRules").hide();
		pageSmartProfile.modalRulesSubscription = profileTab.find("#modalRulesSubscription").hide();
		pageSmartProfile.modalImportRules = profileTab.find("#modalImportRules").hide();

		pageSmartProfile.htmlProfileTab = profileTab;

		// menu
		let profileMenu = this.createProfileMenu(profile, tabId, isNewProfile);

		pageSmartProfile.htmlProfileMenu = profileMenu;

		// -----
		this.initializeSmartProfileGrids(pageSmartProfile);
		this.bindSmartProfileEvents(pageSmartProfile);
		this.initializeSmartProfileUi(pageSmartProfile);

		this.loadRulesSubscriptions(pageSmartProfile, profile.rulesSubscriptions);
		this.loadRules(pageSmartProfile, profile.proxyRules);

		// NOTE: in this step we only keeping an empty profile proxy combobox
		if (isNewProfile)
			this.loadProfileProxyServer(pageSmartProfile);
		else
			// the list will be updated later
			this.loadProfileProxyServer(pageSmartProfile, [], []);

		if (displayInMenu)
			profileMenu.show().remove('d-none');
		profileTab.css('display', '');

		return pageSmartProfile;
	}

	private static createProfileMenu(profile: SmartProfile, tabId: string, isNewProfile: boolean = false) {
		let profileMenuTemplate = jq(".menu-smart-profile");

		let newId = 'smart-profile-' + Utils.getNewUniqueIdNumber();
		let menuId = 'menu-' + newId;
		if (isNewProfile)
			menuId += '-new';
		let profileMenu = profileMenuTemplate.first().clone();

		// menu
		profileMenu.find("#menu-smart-profile-name").text(profile.profileName);
		profileMenu.find(".icon").addClass(getSmartProfileTypeIcon(profile.profileType));
		profileMenu.attr("id", menuId);
		profileMenu.attr("href", '#' + tabId);
		profileMenu.addClass('nav-smart-profile-item');
		profileMenu.click(() => {
			settingsPage.hideMenuOffCanvas();
			settingsPage.windowScrollToTop(true);
		});

		return profileMenu;
	}

	private static createProfileTab(profile: SmartProfile, isNewProfile: boolean = false): any {
		let profileTabTemplate = jq("#tab-smart-profile");
		let newId = 'smart-profile-' + Utils.getNewUniqueIdNumber();
		let tabId = 'tab-' + newId;
		if (isNewProfile)
			tabId += '-new';
		let profileTab = profileTabTemplate.clone();

		// tab
		profileTab.attr("id", tabId);
		profileTab.addClass('tab-smart-profile-item');
		profileTab.find("#lblProfileName").html(profile.profileName + ` <i class="fas fa-pencil-alt fa-xs"></i>`);
		profileTab.find("#txtSmartProfileName").val(profile.profileName);
		profileTab.find("#lblProfileType").text(getSmartProfileTypeName(profile.profileType));
		profileTab.find("#lblProfileTypeIcon").addClass(getSmartProfileTypeIcon(profile.profileType));
		profileTab.find(".label-profile-type-description").hide();
		profileTab.find(`.label-profile-type-description-for-${SmartProfileType[profile.profileType]}`).show();
		profileTab.find("#chkSmartProfileEnabled").prop("checked", profile.enabled);

		if (isNewProfile) {
			this.showProfileNameEdit(profileTab);
		}

		if (isNewProfile ||
			profile.profileTypeConfig.builtin) {
			profileTab.find("#btnDeleteSmartProfile").remove();
		}
		if (!profile.profileTypeConfig.canBeDisabled) {
			profileTab.find("#divSmartProfileEnabled").remove();
		}
		if (!profile.profileTypeConfig.supportsProfileProxy) {
			profileTab.find("#divProfileProxyServer").remove();
		}
		if (!profile.profileTypeConfig.supportsSubscriptions) {
			profileTab.find("#divSmartProfileSubscription").remove();
		}
		if (!profile.profileTypeConfig.customProxyPerRule) {
			profileTab.find("#divRuleProxyServer").remove();
		}

		return {
			profileTab,
			tabId
		};
	}

	private static updateProfileGridsLayout(pageProfile: SettingsPageSmartProfile) {
		// DataTables columns are not adjusted when hidden, needs to be done manually

		pageProfile.grdRules.columns.adjust().draw();
		pageProfile.grdRulesSubscriptions.columns.adjust().draw();
	}

	private static showProfileTab(pageProfile: SettingsPageSmartProfile) {
		let profileTab = pageProfile.htmlProfileTab;
		let profileMenu = pageProfile.htmlProfileMenu;

		jq("#tabSettingsContent").find('.tab-pane').removeClass('active show')
		profileTab.css('display', '');
		profileMenu.tab('show');
	}

	private static showProfileNameEdit(htmlProfileTab: any) {
		htmlProfileTab.find("#lblProfileName").hide();
		htmlProfileTab.find("#txtSmartProfileName").addClass("d-inline").removeClass("d-none")
			.focus()
			.select();
	}
	private static selectAddNewProfileMenu() {
		jq('.menu-add-smart-profile').first().tab('show');
	}

	private static updateProfileMenuName(pageProfile: SettingsPageSmartProfile) {
		pageProfile.htmlProfileMenu.find("#menu-smart-profile-name")
			.text(pageProfile.smartProfile.profileName);
	}

	private static loadProfileProxyServer(pageProfile: SettingsPageSmartProfile, proxyServers?: ProxyServer[], serverSubscriptions?: any[]) {
		let profileProxyServerId = pageProfile.smartProfile.profileProxyServerId;

		let tabContainer = pageProfile.htmlProfileTab;
		let cmbProfileProxyServer = tabContainer.find("#cmbProfileProxyServer");

		if (cmbProfileProxyServer.length) {
			// remove previous items
			cmbProfileProxyServer.children().remove();
			jq("<option>")
				.attr("value", "")
				.text(api.i18n.getMessage("settingsProfilesProxyServer"))
				.appendTo(cmbProfileProxyServer);

			// populate
			this.populateProxyServersToComboBox(cmbProfileProxyServer, profileProxyServerId, proxyServers, serverSubscriptions);
		}
	}

	private static loadAllProfilesProxyServers() {
		for (const pageProfile of settingsPage.pageSmartProfiles) {
			settingsPage.loadProfileProxyServer(pageProfile);
		}
	}
	private static initializeSmartProfileGrids(pageProfile: SettingsPageSmartProfile) {
		let dataTableCustomDom = '<t><"row"<"col-sm-12 col-md-5"<"text-left float-left"f>><"col-sm-12 col-md-7"<"text-right"l>>><"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>';

		let tabContainer = pageProfile.htmlProfileTab;

		let grdRulesColumns = [
			{
				name: "ruleType", data: "ruleTypeName", title: api.i18n.getMessage("settingsRulesGridColRuleType"), responsivePriority: 3
			},
			{
				name: "hostName", data: "hostName", title: api.i18n.getMessage("settingsRulesGridColSource"), responsivePriority: 1
			},
			{
				name: "rule", data: "rule", title: api.i18n.getMessage("settingsRulesGridColRule")
			},
			{
				name: "enabled", data: "enabled", title: api.i18n.getMessage("settingsRulesGridColEnabled"),
				render: function (data, type, row: ProxyRule) {
					if (row && row.whiteList)
						return `${data} <i class="far fa-hand-paper" title="${api.i18n.getMessage("settingsRuleActionWhitelist")}"></i>`;
					return data;
				},
			},
			{
				name: "proxy", data: "proxyName", title: api.i18n.getMessage("settingsRulesGridColProxy"),
				defaultContent: api.i18n.getMessage("settingsRulesProxyDefault")
			},
			{
				"width": "60px",
				"data": null,
				"className": "text-nowrap",
				"defaultContent": "<button class='btn btn-sm btn-success' id='btnRulesEdit'>Edit</button> <button class='btn btn-sm btn-danger' id='btnRulesRemove'><i class='fas fa-times'></button>",
				responsivePriority: 2
			}
		];
		if (!pageProfile.smartProfile.profileTypeConfig.customProxyPerRule) {
			let index = grdRulesColumns.findIndex(x => x.name == "proxy");
			grdRulesColumns.splice(index, 1);
		}
		let grdRules = tabContainer.find("#grdRules").DataTable({
			"dom": dataTableCustomDom,
			paging: true,
			select: true,
			scrollY: 460,
			scrollCollapse: true,
			responsive: true,
			lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
			ordering: false,
			columns: grdRulesColumns
		});
		grdRules.on('responsive-display',
			function (e, dataTable, row, showHide, update) {
				let rowChild = row.child();

				if (showHide && rowChild && rowChild.length)
					settingsPage.refreshRulesGridRowElement(pageProfile, rowChild[0]);
			}
		);
		grdRules.draw();
		new jq.fn.dataTable.Responsive(grdRules);
		jq.fn.dataTable.select.init(grdRules);

		// -----
		let grdRulesSubscriptions = tabContainer.find("#grdRulesSubscriptions").DataTable({
			"dom": dataTableCustomDom,
			paging: true,
			select: true,
			scrollY: 460,
			scrollCollapse: true,
			responsive: true,
			lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
			ordering: false,
			columns: [
				{
					name: "name", data: "name", title: api.i18n.getMessage("settingsRulesSubscriptionsGridColName"),
					responsivePriority: 1
				},
				{
					name: "url", data: "url", className: "text-break-word", title: api.i18n.getMessage("settingsRulesSubscriptionsGridColUrl"),
					responsivePriority: 3,
					render: (data, type, row: ProxyRulesSubscription) => {
						let render = row.url;
						let stats = row.stats;
						if (stats) {
							let status = SubscriptionStats.ToString(stats);

							if (row.stats.lastStatus) {
								render += ` <div id='btnRuleSubscriptionsViewStats' title='${status}' class='cursor-pointer float-end'><i class="fas fa-check-circle text-success"></i></div> `;
							}
							else {
								render += ` <div id='btnRuleSubscriptionsViewStats' title='${status}' class='cursor-pointer float-end'><i class="fas fa-exclamation-triangle text-danger"></i></div> `;
							}
						}
						return render;
					},
				},
				{
					name: "totalCount", data: "totalCount", type: "num", title: api.i18n.getMessage("settingsRulesSubscriptionsGridColCount")
				},
				{
					name: "enabled", data: "enabled", title: api.i18n.getMessage("settingsRulesSubscriptionsGridColEnabled"),
				},
				{
					"width": "100px",
					"data": null,
					"className": "text-nowrap",
					"defaultContent": "<button class='btn btn-sm btn-success' id='btnRuleSubscriptionsEdit'>Edit</button> <button class='btn btn-sm btn-info' id='btnRuleSubscriptionsRefresh'><i class='fas fa-sync'></i></button> <button class='btn btn-sm btn-danger' id='btnRuleSubscriptionsRemove'><i class='fas fa-times'></button>",
					responsivePriority: 2
				}
			],
		});
		grdRulesSubscriptions.on('responsive-display',
			function (e, dataTable, row, showHide, update) {
				let rowChild = row.child();
				if (showHide && rowChild && rowChild.length)
					settingsPage.refreshRulesSubscriptionsGridRowElement(pageProfile, rowChild[0]);
			}
		);
		grdRulesSubscriptions.draw();
		//new jq.fn.dataTable.Responsive(grdRulesSubscriptions);
		//jq.fn.dataTable.select.init(grdRulesSubscriptions);

		// -----
		pageProfile.grdRules = grdRules;
		pageProfile.grdRulesSubscriptions = grdRulesSubscriptions;
	}

	private static initializeSmartProfileUi(pageProfile: SettingsPageSmartProfile) {
		let tabContainer = pageProfile.htmlProfileTab;
		if (environment.chrome) {
			tabContainer.find("#divAlertChrome").show().remove('d-none');
			tabContainer.find(".firefox-only").hide();
			tabContainer.find(".chrome-only").show().remove('d-none');
			if (environment.manifestV3) {
				tabContainer.find(".chrome-mv3-only").show().remove('d-none');
			}
		} else {
			tabContainer.find("#divAlertFirefox").show().remove('d-none');
			tabContainer.find(".firefox-only").show().remove('d-none');
			tabContainer.find(".chrome-only").hide();
		}

		// -- RulesSubscription --------
		// applying the default values
		let cmbRulesSubscriptionObfuscation = tabContainer.find("#cmbRulesSubscriptionObfuscation");

		proxyServerSubscriptionObfuscate.forEach(item => {
			jq("<option>").attr("value", item)
				.text(item)
				.appendTo(cmbRulesSubscriptionObfuscation);
		});

		let cmbRulesSubscriptionApplyProxy = tabContainer.find("#cmbRulesSubscriptionApplyProxy");
		specialRequestApplyProxyModeKeys.forEach((item, index) => {
			jq("<option>").attr("value", index)
				.text(api.i18n.getMessage("settingsServerSubscriptionApplyProxy_" + item))
				.appendTo(cmbRulesSubscriptionApplyProxy);
		});
		if (environment.chrome)
			cmbRulesSubscriptionApplyProxy.attr("disabled", "disabled");
	}

	private static bindSmartProfileEvents(pageProfile: SettingsPageSmartProfile) {

		let profileMenu = pageProfile.htmlProfileMenu;
		let tabContainer = pageProfile.htmlProfileTab;

		tabContainer.find("#lblProfileName").click(() => settingsPage.uiEvents.onProfileNameClick(pageProfile));

		// rules
		tabContainer.find("#cmdRuleType").change(() => settingsPage.uiEvents.onChangeRuleType(pageProfile));

		tabContainer.find("#chkRuleGeneratePattern").change(() => settingsPage.uiEvents.onChangeRuleGeneratePattern(pageProfile));

		tabContainer.find("#btnSubmitRule").click(() => settingsPage.uiEvents.onClickSubmitProxyRule(pageProfile));

		tabContainer.find("#btnImportRulesOpen").click(() => settingsPage.uiEvents.onClickImportRulesOpenDialog(pageProfile));

		tabContainer.find("#btnAddProxyRule").click(() => settingsPage.uiEvents.onClickAddProxyRule(pageProfile));

		tabContainer.find("#btnImportRules").click(() => settingsPage.uiEvents.onClickImportRules(pageProfile));

		tabContainer.find("#btnAddProxyMultipleRule").click(() => settingsPage.uiEvents.onClickAddProxyMultipleRule(pageProfile));

		tabContainer.find("#btnSubmitMultipleRule").click(() => settingsPage.uiEvents.onClickSubmitMultipleRule(pageProfile));

		tabContainer.find("#btnClearProxyRules").click(() => settingsPage.uiEvents.onClickClearProxyRules(pageProfile));

		// proxy rules subscriptions
		tabContainer.find("#btnAddRulesSubscription").click(() => settingsPage.uiEvents.onClickAddRulesSubscription(pageProfile));

		tabContainer.find("#btnSaveRulesSubscriptions").click(() => settingsPage.uiEvents.onClickSaveRulesSubscription(pageProfile));

		tabContainer.find("#btnTestRulesSubscriptions").click(() => settingsPage.uiEvents.onClickTestRulesSubscription(pageProfile));

		tabContainer.find("#btnClearRulesSubscriptions").click(() => settingsPage.uiEvents.onClickClearRulesSubscriptions(pageProfile));

		// final
		tabContainer.find("#btnSaveSmartProfile").click(() => settingsPage.uiEvents.onClickSaveSmartProfile(pageProfile));

		tabContainer.find("#btnRejectSmartProfile").click(() => settingsPage.uiEvents.onClickRejectSmartProfile(pageProfile));

		tabContainer.find("#btnDeleteSmartProfile").click(() => settingsPage.uiEvents.onClickDeleteSmartProfile(pageProfile));

		pageProfile.grdRules.columns.adjust().draw();
		pageProfile.grdRulesSubscriptions.columns.adjust().draw();

		profileMenu.on('shown.bs.tab', (e: any) => {
			// DataTables columns are not adjusted when hidden, needs to be done manually

			settingsPage.updateProfileGridsLayout(pageProfile);
		});
	}

	//#endregion

	//#region Rules tab functions ------------------------------

	private static loadRules(pageProfile: SettingsPageSmartProfile, rules: ProxyRule[]) {
		if (!pageProfile.grdRules)
			return;
		pageProfile.grdRules.clear();

		// prototype needed
		let fixedRules = ProxyRule.assignArray(rules);
		pageProfile.grdRules.rows.add(fixedRules).draw('full-hold');

		// binding the events for all the rows
		this.refreshRulesGridAllRows(pageProfile);
	}

	private static readRules(pageProfile: SettingsPageSmartProfile): ProxyRule[] {
		return pageProfile.grdRules.data().toArray();
	}

	private static readSelectedRule(pageProfile: SettingsPageSmartProfile, e?: any): ProxyRule {
		let dataItem;

		if (e && e.target) {
			let rowElement = jq(e.target).parents('tr');
			if (rowElement.hasClass('child')) {
				pageProfile.grdRules.rows().deselect();
				dataItem = pageProfile.grdRules.row(rowElement.prev('tr.parent')).select().data();
			}
			else
				dataItem = pageProfile.grdRules.row(rowElement).data();
		}
		else
			dataItem = pageProfile.grdRules.row({ selected: true }).data();

		return dataItem;
	}

	private static readSelectedRuleRow(pageProfile: SettingsPageSmartProfile, e: any): any {
		if (e && e.target) {
			let rowElement = jq(e.target).parents('tr');
			if (rowElement.hasClass('child'))
				return pageProfile.grdRules.row({ selected: true });
			else
				return pageProfile.grdRules.row(rowElement);
		}

		return null;
	}

	private static refreshRulesGrid(pageProfile: SettingsPageSmartProfile) {
		let currentRow = pageProfile.grdRules.row('.selected');
		if (currentRow && currentRow.data())
			// displaying the possible data change
			settingsPage.refreshRulesGridRow(pageProfile, currentRow, true);
		else {
			pageProfile.grdRules.rows().invalidate();
			settingsPage.refreshRulesGridAllRows(pageProfile);
		}

		pageProfile.grdRules.draw('full-hold');
	}

	private static refreshRulesGridRow(pageProfile: SettingsPageSmartProfile, row: any, invalidate?: any) {
		if (!row)
			return;
		if (invalidate)
			row.invalidate();

		let rowElement = jq(row.node());

		// NOTE: to display update data the row should be invalidated
		// and invalidated row loosed the event bindings.
		// so we need to bind the events each time data changes.

		rowElement.find("#btnRulesRemove").on("click", (e: any) => settingsPage.uiEvents.onRulesRemoveClick(pageProfile, e));
		rowElement.find("#btnRulesEdit").on("click", (e: any) => settingsPage.uiEvents.onRulesEditClick(pageProfile, e));
	}

	private static refreshRulesGridRowElement(pageProfile: SettingsPageSmartProfile, rowElement: any) {
		if (!rowElement)
			return;

		rowElement = jq(rowElement);

		rowElement.find("#btnRulesRemove").on("click", (e: any) => settingsPage.uiEvents.onRulesRemoveClick(pageProfile, e));
		rowElement.find("#btnRulesEdit").on("click", (e: any) => settingsPage.uiEvents.onRulesEditClick(pageProfile, e));
	}

	private static refreshRulesGridAllRows(pageProfile: SettingsPageSmartProfile) {
		var nodes = pageProfile.grdRules.rows().nodes();
		for (let index = 0; index < nodes.length; index++) {
			const rowElement = jq(nodes[index]);

			rowElement.find("#btnRulesRemove").on("click", (e: any) => settingsPage.uiEvents.onRulesRemoveClick(pageProfile, e));
			rowElement.find("#btnRulesEdit").on("click", (e: any) => settingsPage.uiEvents.onRulesEditClick(pageProfile, e));
		}
	}

	private static insertNewRuleInGrid(pageProfile: SettingsPageSmartProfile, newRule: ProxyRule) {
		try {

			let row = pageProfile.grdRules.row
				.add(newRule)
				.draw('full-hold');

			// binding the events
			settingsPage.refreshRulesGridRow(pageProfile, row);

		} catch (error) {
			PolyFill.runtimeSendMessage("insertNewRuleInGrid failed! > " + error);
			throw error;
		}
	}

	private static insertNewRuleListInGrid(pageProfile: SettingsPageSmartProfile, newRuleList: ProxyRule[]) {
		try {

			let lastRow;
			for (const rule of newRuleList) {
				lastRow = pageProfile.grdRules.row
					.add(rule);
			}
			if (lastRow) {
				lastRow.draw('full-hold');

				// binding the events
				settingsPage.refreshRulesGridAllRows(pageProfile);
			}
		} catch (error) {
			PolyFill.runtimeSendMessage("insertNewRuleInGrid failed! > " + error);
			throw error;
		}
	}

	//#endregion

	//#region ServerSubscriptions tab functions --------------

	private static loadServerSubscriptionsGrid(subscriptions: any[]) {
		if (!this.grdServerSubscriptions)
			return;
		this.grdServerSubscriptions.clear();
		this.grdServerSubscriptions.rows.add(subscriptions).draw('full-hold');

		// binding the events for all the rows
		this.refreshServerSubscriptionsGridAllRows();
	}

	private static readServerSubscriptions(): ProxyServerSubscription[] {
		return this.grdServerSubscriptions.data().toArray();
	}

	private static readSelectedServerSubscription(e?: any): ProxyServerSubscription {
		let dataItem;

		if (e && e.target) {
			let rowElement = jq(e.target).parents('tr');
			if (rowElement.hasClass('child')) {
				this.grdServerSubscriptions.rows().deselect();
				dataItem = this.grdServerSubscriptions.row(rowElement.prev('tr.parent')).select().data();
			}
			else
				dataItem = this.grdServerSubscriptions.row(rowElement).data();
		}
		else
			dataItem = this.grdServerSubscriptions.row({ selected: true }).data();

		return dataItem;
	}

	private static readSelectedServerSubscriptionRow(e: any): any {
		if (e && e.target) {
			let rowElement = jq(e.target).parents('tr');
			if (rowElement.hasClass('child'))
				return this.grdServerSubscriptions.row({ selected: true });
			else
				return this.grdServerSubscriptions.row(rowElement);
		}

		return null;
	}

	private static refreshServerSubscriptionsGrid() {
		let currentRow = this.grdServerSubscriptions.row('.selected');
		if (currentRow && currentRow.data())
			// displaying the possible data change
			settingsPage.refreshServerSubscriptionsGridRow(currentRow, true);
		else {
			this.grdServerSubscriptions.rows().invalidate();
			settingsPage.refreshServerSubscriptionsGridAllRows();
		}

		this.grdServerSubscriptions.draw('full-hold');
	}

	private static refreshServerSubscriptionsGridRow(row: any, invalidate?: any) {
		if (!row)
			return;
		if (invalidate)
			row.invalidate();

		let rowElement = jq(row.node());

		// NOTE: to display update data the row should be invalidated
		// and invalidated row loosed the event bindings.
		// so we need to bind the events each time data changes.

		rowElement.find("#btnSubscriptionsRemove").on("click", settingsPage.uiEvents.onServerSubscriptionRemoveClick);
		rowElement.find("#btnSubscriptionsEdit").on("click", settingsPage.uiEvents.onServerSubscriptionEditClick);
		rowElement.find("#btnServerSubscriptionsViewStats").on("click", settingsPage.uiEvents.onServerSubscriptionViewStatsClick);
	}

	private static refreshServerSubscriptionsGridRowElement(rowElement: any, invalidate?: any) {
		if (!rowElement)
			return;

		rowElement = jq(rowElement);

		rowElement.find("#btnSubscriptionsRemove").on("click", settingsPage.uiEvents.onServerSubscriptionRemoveClick);
		rowElement.find("#btnSubscriptionsEdit").on("click", settingsPage.uiEvents.onServerSubscriptionEditClick);
		rowElement.find("#btnServerSubscriptionsViewStats").on("click", settingsPage.uiEvents.onServerSubscriptionViewStatsClick);
	}

	private static refreshServerSubscriptionsGridAllRows() {
		var nodes = this.grdServerSubscriptions.rows().nodes();
		for (let index = 0; index < nodes.length; index++) {
			const rowElement = jq(nodes[index]);

			rowElement.find("#btnSubscriptionsRemove").on("click", settingsPage.uiEvents.onServerSubscriptionRemoveClick);
			rowElement.find("#btnSubscriptionsEdit").on("click", settingsPage.uiEvents.onServerSubscriptionEditClick);
			rowElement.find("#btnServerSubscriptionsViewStats").on("click", settingsPage.uiEvents.onServerSubscriptionViewStatsClick);
		}
	}

	private static insertNewServerSubscriptionInGrid(newSubscription: ProxyServerSubscription) {
		try {

			let row = this.grdServerSubscriptions.row
				.add(newSubscription)
				.draw('full-hold');

			// binding the events
			settingsPage.refreshServerSubscriptionsGridRow(row);

		} catch (error) {
			PolyFill.runtimeSendMessage("insertNewServerSubscriptionInGrid failed! > " + error);
			throw error;
		}
	}
	//#endregion

	//#region RulesSubscriptions tab functions --------------

	private static loadRulesSubscriptions(pageProfile: SettingsPageSmartProfile, subscriptions: any[]) {
		if (!pageProfile.grdRulesSubscriptions)
			return;

		pageProfile.grdRulesSubscriptions.clear();
		pageProfile.grdRulesSubscriptions.rows.add(subscriptions).draw('full-hold');

		// binding the events for all the rows
		this.refreshRulesSubscriptionsGridAllRows(pageProfile);
	}

	private static readRulesSubscriptions(pageProfile: SettingsPageSmartProfile): any[] {
		return pageProfile.grdRulesSubscriptions.data().toArray();
	}

	private static readSelectedRulesSubscription(pageProfile: SettingsPageSmartProfile, e?: any): any {
		let dataItem;

		if (e && e.target) {
			let rowElement = jq(e.target).parents('tr');
			if (rowElement.hasClass('child')) {
				pageProfile.grdRulesSubscriptions.rows().deselect();
				dataItem = pageProfile.grdRulesSubscriptions.row(rowElement.prev('tr.parent')).select().data();
			}
			else
				dataItem = pageProfile.grdRulesSubscriptions.row(rowElement).data();
		}
		else
			dataItem = pageProfile.grdRulesSubscriptions.row({ selected: true }).data();

		return dataItem;
	}

	private static readSelectedRulesSubscriptionRow(pageProfile: SettingsPageSmartProfile, e: any): any {
		if (e && e.target) {
			let rowElement = jq(e.target).parents('tr');
			if (rowElement.hasClass('child'))
				return pageProfile.grdRulesSubscriptions.row({ selected: true });
			else
				return pageProfile.grdRulesSubscriptions.row(rowElement);
		}

		return null;
	}

	private static refreshRulesSubscriptionsGrid(pageProfile: SettingsPageSmartProfile) {
		let currentRow = pageProfile.grdRulesSubscriptions.row('.selected');
		if (currentRow && currentRow.data())
			// displaying the possible data change
			settingsPage.refreshRulesSubscriptionsGridRow(currentRow, true);
		else {
			pageProfile.grdRulesSubscriptions.rows().invalidate();
			settingsPage.refreshRulesSubscriptionsGridAllRows(pageProfile);
		}

		pageProfile.grdRulesSubscriptions.draw('full-hold');
	}
	private static rulesSubscriptionsGridRowBindEvents(pageProfile: SettingsPageSmartProfile, rowElement: any) {
		rowElement.find("#btnRuleSubscriptionsRemove").on("click", (e: any) => settingsPage.uiEvents.onRulesSubscriptionRemoveClick(pageProfile, e));
		rowElement.find("#btnRuleSubscriptionsEdit").on("click", (e: any) => settingsPage.uiEvents.onRulesSubscriptionEditClick(pageProfile, e));
		rowElement.find("#btnRuleSubscriptionsRefresh").on("click", (e: any) => settingsPage.uiEvents.onRulesSubscriptionRefreshClick(pageProfile, e));
		rowElement.find("#btnRuleSubscriptionsViewStats").on("click", (e: any) => settingsPage.uiEvents.onRulesSubscriptionViewStatsClick(pageProfile, e));
	}
	private static refreshRulesSubscriptionsGridRow(pageProfile: SettingsPageSmartProfile, row: any, invalidate?: any) {
		if (!row)
			return;
		if (invalidate)
			row.invalidate();

		let rowElement = jq(row.node());

		// NOTE: to display update data the row should be invalidated
		// and invalidated row loosed the event bindings.
		// so we need to bind the events each time data changes.

		// bind events
		settingsPage.rulesSubscriptionsGridRowBindEvents(pageProfile, rowElement);
	}

	private static refreshRulesSubscriptionsGridRowElement(pageProfile: SettingsPageSmartProfile, rowElement: any, invalidate?: any) {
		if (!rowElement)
			return;

		rowElement = jq(rowElement);

		// bind events
		settingsPage.rulesSubscriptionsGridRowBindEvents(pageProfile, rowElement);
	}

	private static refreshRulesSubscriptionsGridAllRows(pageProfile: SettingsPageSmartProfile) {
		var nodes = pageProfile.grdRulesSubscriptions.rows().nodes();
		for (let index = 0; index < nodes.length; index++) {
			const rowElement = jq(nodes[index]);

			// bind events
			settingsPage.rulesSubscriptionsGridRowBindEvents(pageProfile, rowElement);
		}
	}

	private static insertNewRulesSubscriptionInGrid(pageProfile: SettingsPageSmartProfile, newSubscription: ProxyRulesSubscription) {
		try {

			let row = pageProfile.grdRulesSubscriptions.row
				.add(newSubscription)
				.draw('full-hold');

			// binding the events
			settingsPage.refreshRulesSubscriptionsGridRow(pageProfile, row);

		} catch (error) {
			PolyFill.runtimeSendMessage("insertNewRulesSubscriptionInGrid failed! > " + error);
			throw error;
		}
	}
	//#endregion

	//#region Events --------------------------
	private static uiEvents = {
		onClickMenuOffCanvas() {
			settingsPage.hideMenuOffCanvas();
			settingsPage.windowScrollToTop(true);
		},
		onClickSkipWelcome() {
			PolyFill.runtimeSendMessage(
				{
					command: CommandMessages.SettingsPageSkipWelcome
				});
		},
		onGeneralIncognitoProfileFocus() {
			settingsPage.populateIncognitoProfileDropDown();
		},
		onClickSaveGeneralOptions() {
			let generalOptions = settingsPage.readGeneralOptions();

			if (generalOptions.themesLight == themesCustomType) {
				if (!Utils.isValidUrl(generalOptions.themesLightCustomUrl)) {
					// Please enter a valid Light Theme and the url should be 'https'.
					messageBox.error(api.i18n.getMessage("settingsGeneralThemesLight_ErrorValidUrl"));
					return;
				}
				if (!Utils.isUrlHttps(generalOptions.themesLightCustomUrl)) {
					messageBox.error(api.i18n.getMessage("settingsGeneralThemesLight_ErrorValidUrl"));
					return;
				}
			}
			if (generalOptions.themesDark == themesCustomType) {
				if (!Utils.isValidUrl(generalOptions.themesDarkCustomUrl)) {
					// Please enter a valid Dark Theme and the url should be 'https'.
					messageBox.error(api.i18n.getMessage("settingsGeneralThemesDark_ErrorValidUrl"));
					return;
				}
				if (!Utils.isUrlHttps(generalOptions.themesDarkCustomUrl)) {
					messageBox.error(api.i18n.getMessage("settingsGeneralThemesDark_ErrorValidUrl"));
					return;
				}
			}

			PolyFill.runtimeSendMessage(
				{
					command: CommandMessages.SettingsPageSaveOptions,
					options: generalOptions
				},
				(response: ResultHolder) => {
					if (!response) return;
					if (response.success) {
						if (response.message)
							messageBox.success(response.message);

						settingsPage.currentSettings.options = generalOptions;
						settingsPage.changeTracking.options = false;
					} else {
						if (response.message)
							messageBox.error(response.message);
					}
				},
				(error: Error) => {
					messageBox.error(api.i18n.getMessage("settingsErrorFailedToSaveGeneral") + " " + error.message);
				});
		},
		onClickRejectGeneralOptions() {
			// reset the data
			settingsPage.currentSettings.options = jQuery.extend({}, settingsPage.originalSettings.options);
			settingsPage.loadGeneralOptions(settingsPage.currentSettings.options);

			settingsPage.changeTracking.options = false;

			// Changes reverted successfully
			messageBox.info(api.i18n.getMessage("settingsChangesReverted"));
		},
		onSyncSettingsChanged() {
			// reset the data
			var checked = jq("#chkSyncSettings").prop("checked")
			if (checked) {
				jq("#chkSyncProxyMode").removeAttr("disabled");
				jq("#chkSyncActiveProxy").removeAttr("disabled");
			}
			else {
				jq("#chkSyncProxyMode").attr("disabled", "disabled");
				jq("#chkSyncActiveProxy").attr("disabled", "disabled");
			}
		},
		onClickIgnoreRequestFailuresForDomains() {
			let settings = settingsPage.currentSettings;
			
			let pageSmartProfile = settingsPage.pageSmartProfiles.find(x => x.smartProfile.profileType == SmartProfileType.IgnoreFailureRules);
			if (pageSmartProfile) {
				settingsPage.showProfileTab(pageSmartProfile);
			}
			else {
				let ignoreProfile = settings.proxyProfiles.find(x => x.profileType == SmartProfileType.IgnoreFailureRules);
				if (ignoreProfile) {
					pageSmartProfile = settingsPage.createProfileContainerAttached(ignoreProfile, false, false);
					settingsPage.pageSmartProfiles.push(pageSmartProfile);

					settingsPage.showProfileTab(pageSmartProfile);
				}
				else {
					ignoreProfile = new SmartProfile();
					ignoreProfile.profileType = SmartProfileType.IgnoreFailureRules;
					ignoreProfile.profileTypeConfig = getSmartProfileTypeConfig(SmartProfileType.IgnoreFailureRules);
					ignoreProfile.profileName = 'Ignore Failure Rules';
					settings.proxyProfiles.push(ignoreProfile);
					ProfileOperations.addUpdateProfile(ignoreProfile);

					pageSmartProfile = settingsPage.createProfileContainerAttached(ignoreProfile, false, false);
					settingsPage.pageSmartProfiles.push(pageSmartProfile);

					settingsPage.showProfileTab(pageSmartProfile);
				}
			}
		},
		onClickViewShortcuts(): boolean {

			if (environment.notSupported.keyboardShortcuts) {
				messageBox.info("Keyboard shortcuts are not supported on mobile devices.");
				return;
			}

			let modal = jq("#modalShortcuts");

			PolyFill.browserCommandsGetAll((commands: any[]) => {
				let content = `<dl>`;
				for (const cmd of commands) {
					content += `<dt>${cmd.description}</dt><dd>${api.i18n.getMessage("settingsGeneralViewShortcutKeys")} : <span class='text-primary'>${cmd.shortcut}</span></dd>`;
				}
				content += `</dl>`;
				modal.find('.modal-body').html(content);

				modal.modal("show");
			});
			return false;
		},
		onChangeThemesLight() {
			var value = jq("#cmbThemesLight").val();
			if (value == themesCustomType) {
				jq("#divThemesLightCustom").removeClass('d-none');
			}
			else {
				jq("#divThemesLightCustom").addClass('d-none');
			}
		},
		onChangeThemesDark() {
			var value = jq("#cmbThemesDark").val();
			if (value == themesCustomType) {
				jq("#divThemesDarkCustom").removeClass('d-none');
			}
			else {
				jq("#divThemesDarkCustom").addClass('d-none');
			}
		},
		onClickAddNewSmartProfile() {
			let modal = jq("#modalAddNewSmartProfile");
			modal.find("#rbtnNewSmartProfile_SmartRules").prop("checked", true);
		},
		onClickSubmitContinueAddingProfile() {
			let modal = jq("#modalAddNewSmartProfile");
			let profileTypeIsSmartRule = modal.find("#rbtnNewSmartProfile_SmartRules").prop("checked");
			let profileTypeIsAlwaysEnabled = modal.find("#rbtnNewSmartProfile_AlwaysEnabled").prop("checked");

			let profileType: SmartProfileType;

			if (profileTypeIsSmartRule) {
				profileType = SmartProfileType.SmartRules;
			}
			else if (profileTypeIsAlwaysEnabled) {
				profileType = SmartProfileType.AlwaysEnabledBypassRules;
			}
			else {
				// Message: Please select a profile type
				messageBox.error(api.i18n.getMessage("settingsProfilesAddErrorTypeRequired"));
				return;
			}

			let pageSmartProfile = settingsPage.createNewUnsavedProfile(profileType);

			settingsPage.showProfileTab(pageSmartProfile);
			settingsPage.updateProfileGridsLayout(pageSmartProfile);
			settingsPage.selectAddNewProfileMenu();

			// ---
			modal.modal("hide");
		},
		onChangeActiveProxyServer() {
			let proxyServerId = jq("#cmbActiveProxyServer").val();

			let server = settingsPage.findProxyServerById(proxyServerId);

			if (server) {
				// this can be null
				settingsPage.currentSettings.defaultProxyServerId = server.id;
			}
			else {
				Debug.warn("Settings> Selected ActiveProxyServer ID not found!");
			}
		},
		onClickAddProxyServer() {

			let modal = jq("#modalModifyProxyServer");
			modal.data("editing", null);

			settingsPage.populateServerModal(modal, null);

			modal.modal("show");
			modal.find("#txtServerAddress").focus();
		},
		onChangeServerProtocol() {
			settingsPage.populateServerProtocol();
		},
		onClickSubmitProxyServer() {

			let modal = jq("#modalModifyProxyServer");
			let editingModel: ProxyServer = modal.data("editing");

			let serverInputInfo = settingsPage.readServerModel(modal);

			if (!serverInputInfo.name) {
				messageBox.error(api.i18n.getMessage("settingsServerNameRequired"));
				return;
			}

			// ------------------
			let editingServerName: string = null;
			if (editingModel)
				editingServerName = editingModel.name;

			let existingServers = settingsPage.readServers();
			let serverExists = existingServers.some(server => {
				return (server.name === serverInputInfo.name && server.name != editingServerName);
			});
			if (serverExists) {
				// A Server with the same name already exists!
				messageBox.error(api.i18n.getMessage("settingsServerNameExists"));
				return;
			}

			// ------------------
			if (!serverInputInfo.host) {
				messageBox.error(api.i18n.getMessage("settingsServerServerAddressIsEmpty"));
				return;
			}
			if (!serverInputInfo.port || serverInputInfo.port <= 0) {
				messageBox.error(api.i18n.getMessage("settingsServerPortNoInvalid"));
				return;
			}

			if (!serverInputInfo.username && serverInputInfo.password) {
				messageBox.error(api.i18n.getMessage("settingsServerAuthenticationInvalid"));
				return;
			}

			if (editingModel) {
				// just copy the values
				const proxyServerId = editingModel.id;
				jQuery.extend(editingModel, serverInputInfo);
				editingModel.id = proxyServerId;

				settingsPage.refreshServersGrid();

			} else {

				// insert to the grid
				settingsPage.insertNewServerInGrid(serverInputInfo);
			}

			settingsPage.changeTracking.servers = true;

			modal.modal("hide");

			settingsPage.loadDefaultProxyServer();
		},
		onServersEditClick(e: any) {
			let item = settingsPage.readSelectedServer(e);
			if (!item)
				return;

			let modal = jq("#modalModifyProxyServer");
			modal.data("editing", item);

			settingsPage.populateServerModal(modal, item);

			modal.modal("show");
			modal.find("#txtServerAddress").focus();
		},
		onServersRemoveClick(e: any) {
			var row = settingsPage.readSelectedServerRow(e);
			if (!row)
				return;

			messageBox.confirm(api.i18n.getMessage("settingsConfirmRemoveProxyServer"),
				() => {

					// remove then redraw the grid page
					row.remove().draw('full-hold');

					settingsPage.changeTracking.servers = true;

					settingsPage.loadDefaultProxyServer();
				});
		},
		onClickSaveProxyServers() {

			// update the active proxy server data
			jq("#cmbActiveProxyServer").trigger("change");
			let saveData = {
				proxyServers: settingsPage.readServers(),
				defaultProxyServerId: settingsPage.currentSettings.defaultProxyServerId
			};

			PolyFill.runtimeSendMessage(
				{
					command: CommandMessages.SettingsPageSaveProxyServers,
					saveData: saveData
				},
				(response: ResultHolder) => {
					if (!response) return;
					if (response.success) {
						if (response.message)
							messageBox.success(response.message);

						// current server should become equal to saved servers
						settingsPage.currentSettings.proxyServers = saveData.proxyServers;
						settingsPage.currentSettings.defaultProxyServerId = saveData.defaultProxyServerId;

						settingsPage.changeTracking.servers = false;
						settingsPage.changeTracking.activeProxy = false;

					} else {
						if (response.message)
							messageBox.error(response.message);
					}
				},
				(error: Error) => {
					messageBox.error(api.i18n.getMessage("settingsErrorFailedToSaveServers") + " " + error.message);
				});

		},
		onClickRejectProxyServers() {
			// reset the data
			settingsPage.currentSettings.proxyServers = settingsPage.originalSettings.proxyServers.slice();
			settingsPage.loadServersGrid(settingsPage.currentSettings.proxyServers);
			settingsPage.loadDefaultProxyServer();

			settingsPage.changeTracking.servers = false;

			// Changes reverted successfully
			messageBox.info(api.i18n.getMessage("settingsChangesReverted"));
		},
		onClickClearProxyServers() {
			// Are you sure to remove all the servers?
			messageBox.confirm(api.i18n.getMessage("settingsRemoveAllProxyServers"),
				() => {
					settingsPage.loadServersGrid([]);
					settingsPage.loadDefaultProxyServer();

					settingsPage.changeTracking.servers = true;

					// All the proxy servers are removed.<br/>You have to save to apply the changes.
					messageBox.info(api.i18n.getMessage("settingsRemoveAllProxyServersSuccess"));
				});
		},
		onClickAddProxyMultipleRule(pageProfile: SettingsPageSmartProfile) {
			let tabContainer = pageProfile.htmlProfileTab;

			let modal = tabContainer.find("#modalAddMultipleRules");
			modal.data("editing", null);

			// update form
			modal.find("#cmdMultipleRuleType").val(0);
			modal.find("#txtMultipleRuleList").val("");

			modal.modal("show");
			modal.find("#txtMultipleRuleList").focus();
		},
		onClickSubmitMultipleRule(pageProfile: SettingsPageSmartProfile) {
			let tabContainer = pageProfile.htmlProfileTab;

			let modal = tabContainer.find("#modalAddMultipleRules");

			let ruleType = +modal.find("#cmdMultipleRuleType").val();
			let rulesStr = modal.find("#txtMultipleRuleList").val();

			let ruleList = rulesStr.split(/[\r\n]+/);
			let resultRuleList: ProxyRule[] = [];

			let existingRules = settingsPage.readRules(pageProfile);
			for (let ruleLine of ruleList) {
				if (!ruleLine)
					continue;
				ruleLine = ruleLine.trim().toLowerCase();
				let hostName: string;
				let newRule = new ProxyRule();

				if (ruleType == ProxyRuleType.Exact) {
					if (!Utils.isValidUrl(ruleLine)) {
						messageBox.error(
							api.i18n.getMessage("settingsRuleExactUrlInvalid").replace("{0}", ruleLine)
						);
						return;
					}
					newRule.ruleExact = ruleLine;
					hostName = Utils.extractHostFromUrl(ruleLine);
				}
				else if (ruleType == ProxyRuleType.MatchPatternHost) {

					if (!Utils.urlHasSchema(ruleLine))
						ruleLine = "http://" + ruleLine;

					hostName = Utils.extractHostFromUrl(ruleLine);

					if (!Utils.isValidHost(hostName)) {
						messageBox.error(api.i18n.getMessage("settingsMultipleRuleInvalidHost").replace("{0}", hostName));
						return;
					}

					hostName = Utils.extractHostFromUrl(ruleLine);
					newRule.rulePattern = Utils.hostToMatchPattern(hostName, false);
				}
				else if (ruleType == ProxyRuleType.MatchPatternUrl) {

					if (!Utils.isValidUrl(ruleLine)) {
						messageBox.error(api.i18n.getMessage("settingsRuleUrlInvalid"));
						return;
					}

					hostName = Utils.extractHostFromUrl(ruleLine);
					newRule.rulePattern = Utils.hostToMatchPattern(ruleLine, true);
				}
				else {
					// not supported
					continue;
				}

				let ruleExists = existingRules.some(rule => {
					return (rule.hostName === hostName);
				});

				if (ruleExists)
					continue;

				newRule.autoGeneratePattern = true;
				newRule.enabled = true;
				newRule.proxy = null;
				newRule.hostName = hostName;
				newRule.ruleType = ruleType;

				resultRuleList.push(newRule);
			}

			if (!resultRuleList.length) {
				messageBox.error(api.i18n.getMessage("settingsMultipleRuleNoNewRuleAdded"));
				return;
			}

			// insert to the grid
			settingsPage.insertNewRuleListInGrid(pageProfile, resultRuleList);

			modal.modal("hide");
		},
		onClickAddProxyRule(pageProfile: SettingsPageSmartProfile) {
			let tabContainer = pageProfile.htmlProfileTab;

			let modal = tabContainer.find("#modalModifyRule");
			modal.data("editing", null);

			// update form
			settingsPage.populateRuleModal(pageProfile, modal, null);

			modal.modal("show");
			modal.find("#txtRuleSource").focus();
		},
		onClickImportRulesOpenDialog(pageProfile: SettingsPageSmartProfile) {
			let tabContainer = pageProfile.htmlProfileTab;

			let modal = tabContainer.find("#modalImportRules");
			modal.data("editing", null);

			modal.modal("show");
			modal.find("#txtRuleSource").focus();
		},
		onChangeRuleGeneratePattern(pageProfile: SettingsPageSmartProfile) {
			settingsPage.updateProxyRuleModal(pageProfile.htmlProfileTab);
		},
		onChangeRuleType(pageProfile: SettingsPageSmartProfile) {
			settingsPage.updateProxyRuleModal(pageProfile.htmlProfileTab);
		},
		onClickSubmitProxyRule(pageProfile: SettingsPageSmartProfile) {
			let tabContainer = pageProfile.htmlProfileTab;

			let modal = tabContainer.find("#modalModifyRule");
			let editingModel: ProxyRule = modal.data("editing");

			let ruleInfo = settingsPage.readProxyRuleModel(modal);
			let hostName = ruleInfo.hostName;

			function checkHostName(): boolean {
				if (!hostName) {
					// Please specify the source of the rule!
					messageBox.error(api.i18n.getMessage("settingsRuleSourceRequired"));
					return false;
				}
				return true;
			}

			if (hostName) {
				// NOTE: if hostName is entered it must be a valid one, without RegEx or MatchPattern chars
				if (!Utils.isValidHost(hostName)) {
					// source is invalid, source name should be something like 'google.com'
					messageBox.error(api.i18n.getMessage("settingsRuleSourceInvalid"));
					return;
				}

				let checkHostName = hostName;
				if (!Utils.urlHasSchema(hostName)) {
					checkHostName = "http://" + hostName;
				}

				let extractedHost = Utils.extractHostFromUrl(checkHostName);
				if (extractedHost == null || !Utils.isValidHost(extractedHost)) {

					// `Host name '${extractedHost}' is invalid, host name should be something like 'google.com'`
					messageBox.error(
						api.i18n.getMessage("settingsRuleHostInvalid")
							.replace("{0}", extractedHost || hostName)
					);
					return;
				}
				hostName = extractedHost;
			}
			ruleInfo.hostName = hostName;

			if (ruleInfo.ruleType == ProxyRuleType.MatchPatternHost) {

				if (ruleInfo.autoGeneratePattern) {
					if (!checkHostName())
						return;

					// Feature #41 Allow entering/modifying custom pattern for rules 
					ruleInfo.rulePattern = Utils.hostToMatchPattern(hostName, false);
				}
				else if (hostName && !ruleInfo.rulePattern.includes(hostName)) {
					// The rule does not match the source domain '{0}'
					messageBox.error(
						api.i18n.getMessage("settingsRuleDoesntIncludeDomain").replace("{0}", hostName)
					);
					return;
				}
			}
			else if (ruleInfo.ruleType == ProxyRuleType.MatchPatternUrl) {

				if (ruleInfo.autoGeneratePattern) {
					if (!checkHostName())
						return;

					// Feature #41 Allow entering/modifying custom pattern for rules 
					ruleInfo.rulePattern = Utils.hostToMatchPattern(hostName, true);
				}
				else if (hostName && !ruleInfo.rulePattern.includes(hostName)) {
					// The rule does not match the source domain '{0}'
					messageBox.error(
						api.i18n.getMessage("settingsRuleDoesntIncludeDomain").replace("{0}", hostName)
					);
					return;
				}
			}
			else if (ruleInfo.ruleType == ProxyRuleType.RegexHost) {

				try {
					if (!ruleInfo.ruleRegex) {
						messageBox.error(
							api.i18n.getMessage("settingsRuleRegexInvalid").replace("{0}", ruleInfo.ruleRegex)
						);
						return;
					}

					let regex = new RegExp(ruleInfo.ruleRegex);
					if (hostName) {
						if (!regex.test(hostName)) {
							// Regex rule does not match the source domain '{0}'
							messageBox.error(
								api.i18n.getMessage("settingsRuleRegexNotMatchDomain").replace("{0}", hostName)
							);
							return;
						}
					}

				} catch (error) {
					// Regex rule '{0}' is not valid
					messageBox.error(
						api.i18n.getMessage("settingsRuleRegexInvalid").replace("{0}", ruleInfo.ruleRegex)
					);
					return;
				}
			}
			else if (ruleInfo.ruleType == ProxyRuleType.RegexUrl) {

				try {
					if (!ruleInfo.ruleRegex) {
						messageBox.error(
							api.i18n.getMessage("settingsRuleRegexInvalid").replace("{0}", ruleInfo.ruleRegex)
						);
						return;
					}

					let regex = new RegExp(ruleInfo.ruleRegex);

					if (hostName) {
						if (!regex.test(hostName)) {
							// Regex rule does not match the source domain '{0}'
							messageBox.error(
								api.i18n.getMessage("settingsRuleRegexNotMatchDomain").replace("{0}", hostName)
							);
							return;
						}
					}
				} catch (error) {
					// Regex rule '{0}' is not valid
					messageBox.error(
						api.i18n.getMessage("settingsRuleRegexInvalid").replace("{0}", ruleInfo.ruleRegex)
					);
					return;
				}
			}
			else if (ruleInfo.ruleType == ProxyRuleType.DomainSubdomain) {
				if (!checkHostName())
					return;

				// no validation required
				ruleInfo.ruleSearch = hostName;
			}
			else {
				if (!Utils.isValidUrl(ruleInfo.ruleExact)) {
					messageBox.error(
						api.i18n.getMessage("settingsRuleExactUrlInvalid").replace("{0}", ruleInfo.ruleExact)
					);
					return;
				}
			}

			// ------------------
			let editingSource: string = null;
			if (editingModel)
				editingSource = editingModel.hostName;

			let existingRules = settingsPage.readRules(pageProfile);
			let ruleExists = false;
			if (hostName)
				ruleExists = existingRules.some(rule => {
					return (rule.hostName === hostName && rule.hostName != editingSource);
				});

			if (ruleExists) {
				// A Rule with the same source already exists!
				messageBox.error(api.i18n.getMessage("settingsRuleSourceAlreadyExists"));
				return;
			}

			if (!editingModel) {
				do {
					// making sure the ruleId is unique
					ruleExists = existingRules.some(rule => {
						return (rule.ruleId === ruleInfo.ruleId);
					});

					if (ruleExists)
						ruleInfo.ruleId = Utils.getNewUniqueIdNumber();
				} while (ruleExists);
			}

			if (editingModel) {
				jQuery.extend(editingModel, ruleInfo);

				settingsPage.refreshRulesGrid(pageProfile);

			} else {

				// insert to the grid
				settingsPage.insertNewRuleInGrid(pageProfile, ruleInfo);
			}

			modal.modal("hide");
		},
		onRulesEditClick(pageProfile: SettingsPageSmartProfile, e: any) {
			let item = settingsPage.readSelectedRule(pageProfile, e);
			if (!item)
				return;
			let tabContainer = pageProfile.htmlProfileTab;

			let modal = tabContainer.find("#modalModifyRule");
			modal.data("editing", item);

			settingsPage.populateRuleModal(pageProfile, modal, item);

			modal.modal("show");
			modal.find("#txtRuleSource").focus();
		},
		onRulesRemoveClick(pageProfile: SettingsPageSmartProfile, e: any) {
			var row = settingsPage.readSelectedRuleRow(pageProfile, e);
			if (!row)
				return;

			messageBox.confirm(api.i18n.getMessage("settingsConfirmRemoveProxyRule"),
				() => {

					// remove then redraw the grid page
					row.remove().draw('full-hold');
				});
		},
		onClickClearProxyRules(pageProfile: SettingsPageSmartProfile) {
			// Are you sure to remove all the rules?
			messageBox.confirm(api.i18n.getMessage("settingsRemoveAllRules"),
				() => {
					settingsPage.loadRules(pageProfile, []);

					// All rules are removed.<br/>You have to save to apply the changes.
					messageBox.info(api.i18n.getMessage("settingsRemoveAllRulesSuccess"));
				});
		},
		onProfileNameClick(pageProfile: SettingsPageSmartProfile) {
			let tabContainer = pageProfile.htmlProfileTab;
			settingsPage.showProfileNameEdit(tabContainer);
		},
		onClickSaveSmartProfile(pageProfile: SettingsPageSmartProfile) {

			let smartProfileModel = settingsPage.readSmartProfile(pageProfile);
			let smartProfile = pageProfile.smartProfile;
			Object.assign(smartProfile, smartProfileModel);

			if (smartProfile.profileName.trim() == '') {
				// Profile name is mandatory
				messageBox.error(api.i18n.getMessage("settingsProfilesAddErrorNameRequired"));
				return;
			}

			if (settingsPage.currentSettings.proxyProfiles.find(x => x.profileName == smartProfile.profileName &&
				x.profileId != smartProfile.profileId) != null) {
				// Profile name already exists, please enter another one
				messageBox.error(api.i18n.getMessage("settingsProfilesAddErrorNameExists"));
				return;
			}

			PolyFill.runtimeSendMessage(
				{
					command: CommandMessages.SettingsPageSaveSmartProfile,
					smartProfile: smartProfile
				},
				(response: any) => {
					if (!response) return;
					if (response.success) {
						if (response.message)
							messageBox.success(response.message);
						let updatedProfile: SmartProfile = response.smartProfile || smartProfile;

						settingsPage.changeTracking.smartProfiles = false;

						if (smartProfile.profileId || smartProfile.profileType == SmartProfileType.IgnoreFailureRules) {
							// sync the change to menu
							settingsPage.updateProfileMenuName(pageProfile);
						}
						else {
							// unsaved profile
							settingsPage.currentSettings.proxyProfiles.push(updatedProfile);
							settingsPage.removeUnsavedProfileAndReload(pageProfile, updatedProfile);
						}

					} else {
						if (response.message)
							messageBox.error(response.message);
					}
				},
				(error: Error) => {
					messageBox.error(api.i18n.getMessage("settingsErrorFailedToSaveSmartProfile") + " " + error.message);
				});
		},
		onClickRejectSmartProfile(pageProfile: SettingsPageSmartProfile) {
			// // reset the data
			// settingsPage.currentSettings.proxyRules = settingsPage.originalSettings.proxyRules.slice();
			// settingsPage.loadRules(pageProfile, settingsPage.currentSettings.proxyRules);
			// settingsPage.refreshRulesGrid(pageProfile);

			// settingsPage.changeTracking.rules = false;

			// // Changes reverted successfully
			// messageBox.info(api.i18n.getMessage("settingsChangesReverted"));

			// 	// reset the data
			// 	settingsPage.currentSettings.proxyRulesSubscriptions = settingsPage.originalSettings.proxyRulesSubscriptions.slice();
			// 	settingsPage.loadRulesSubscriptions(pageProfile, settingsPage.currentSettings.proxyRulesSubscriptions);

			// 	settingsPage.changeTracking.rulesSubscriptions = false;

			// 	// Changes reverted successfully
			// 	messageBox.info(api.i18n.getMessage("settingsChangesReverted"));			
		},
		onClickDeleteSmartProfile(pageProfile: SettingsPageSmartProfile) {
			let profile = pageProfile.smartProfile;
			if (!profile.profileId)
				return;

			if (profile.profileTypeConfig.builtin)
				return;

			// Are you sure to delete this profile? Warning, this action cannot be undone!
			messageBox.confirm(api.i18n.getMessage("settingsProfilesDeleteConfirm"),
				() => {

					PolyFill.runtimeSendMessage(
						{
							command: CommandMessages.SettingsPageDeleteSmartProfile,
							smartProfileId: profile.profileId
						},
						(response: any) => {
							if (!response) return;
							if (response.success) {
								if (response.message)
									messageBox.success(response.message);

								settingsPage.removePageProfileAndReset(pageProfile);
							} else {
								if (response.message)
									messageBox.error(response.message);
							}
						},
						(error: Error) => {
							// message: Failed to delete the profile with error: 
							messageBox.error(api.i18n.getMessage("settingsProfilesDeleteFailed") + " " + error.message);
						});

				});
		},
		onClickAddServerSubscription() {
			let modal = jq("#modalServerSubscription");
			modal.data("editing", null);

			// empty the form
			settingsPage.populateServerSubscriptionsModal(modal, null);

			modal.modal("show");

			function focusUrl() {
				modal.off("shown.bs.modal", focusUrl);
				modal.find("#txtUrl").focus();
			}

			modal.on("shown.bs.modal", focusUrl);
		},
		onServerSubscriptionEditClick(e: any) {

			let item = settingsPage.readSelectedServerSubscription(e);
			if (!item)
				return;

			let modal = jq("#modalServerSubscription");
			modal.data("editing", item);

			settingsPage.populateServerSubscriptionsModal(modal, item);

			modal.modal("show");
		},
		onServerSubscriptionRemoveClick(e: any) {
			var row = settingsPage.readSelectedServerSubscriptionRow(e);
			if (!row)
				return;

			messageBox.confirm(api.i18n.getMessage("settingsConfirmRemoveServerSubscription"),
				() => {
					// remove then redraw the grid page
					row.remove().draw('full-hold');

					settingsPage.changeTracking.serverSubscriptions = true;
				});
		},
		onServerSubscriptionViewStatsClick(e: any) {
			let status = e.currentTarget?.title;
			if (status) {
				status = status.replaceAll('\r\n', '<br\>').replaceAll('\n', '<br\>');
				messageBox.info(status);
			}
		},
		onClickSaveServerSubscription() {
			let modal = jq("#modalServerSubscription");


			if (!modal.find("form")[0].checkValidity()) {
				// Please fill the required fields in the right format
				messageBox.error(api.i18n.getMessage("settingsServerSubscriptionIncompleteForm"));
				return;
			}
			let subscriptionModel = settingsPage.readServerSubscriptionModel(modal);
			if (!subscriptionModel) {
				messageBox.error(api.i18n.getMessage("settingsServerSubscriptionInvalidForm"));
				return;
			}

			let subscriptionsList = settingsPage.readServerSubscriptions();
			let editingSubscription = modal.data("editing");
			let editingName = "";
			if (editingSubscription)
				editingName = editingSubscription.name;

			// let editingSubscription = null;

			if (editingSubscription) {
				let nameIsDuplicate = false;
				for (let item of subscriptionsList) {
					// if (item.name === editingName) {
					//     editingSubscription = item;
					// }

					if (item.name == subscriptionModel.name && subscriptionModel.name != editingName) {
						nameIsDuplicate = true;
					}
				}
				if (subscriptionModel.name != editingName)
					// check for duplicate
					if (nameIsDuplicate) {
						// The entered name is already used, please enter another name.
						messageBox.error(api.i18n.getMessage("settingsServerSubscriptionDuplicateName"));
						return;
					}
			}

			if (!subscriptionModel.stats) {
				subscriptionModel.stats = new SubscriptionStats();
			}

			// Saving...
			jq("#btnSaveServerSubscription").attr("data-loading-text", api.i18n.getMessage("settingsServerSubscriptionSavingButton"));
			jq("#btnSaveServerSubscription").button("loading");

			ProxyImporter.readFromServer(subscriptionModel,
				(response: {
					success: boolean,
					message: string,
					result: ProxyServer[]
				}) => {
					jq("#btnSaveServerSubscription").button('reset');

					if (response.success) {
						let count = response.result.length;

						if (subscriptionModel.enabled)
							subscriptionModel.proxies = response.result;
						else
							subscriptionModel.proxies = [];
						subscriptionModel.totalCount = count;
						SubscriptionStats.updateStats(subscriptionModel.stats, true);

						if (editingSubscription) {

							// updating the model
							jQuery.extend(editingSubscription, subscriptionModel);

							settingsPage.refreshServerSubscriptionsGrid();

							// The subscription is updated with {0} proxies in it. <br/>Don't forget to save the changes.
							messageBox.success(api.i18n.getMessage("settingsServerSubscriptionSaveUpdated").replace("{0}", count));
						} else {

							// insert to the grid
							settingsPage.insertNewServerSubscriptionInGrid(subscriptionModel);

							// The subscription is added with {0} proxies in it. <br/>Don't forget to save the changes.
							messageBox.success(api.i18n.getMessage("settingsServerSubscriptionSaveAdded").replace("{0}", count));
						}

						settingsPage.changeTracking.serverSubscriptions = true;
						settingsPage.loadDefaultProxyServer();

						// close the window
						modal.modal("hide");

					} else {
						SubscriptionStats.updateStats(subscriptionModel.stats, false);
						messageBox.error(api.i18n.getMessage("settingsServerSubscriptionSaveFailedGet"));
					}
				},
				(errorResult) => {
					SubscriptionStats.updateStats(subscriptionModel.stats, false, errorResult);

					messageBox.error(api.i18n.getMessage("settingsServerSubscriptionSaveFailedGet"));
					jq("#btnSaveServerSubscription").button('reset');
				});
		},
		onClickTestServerSubscription() {
			let modal = jq("#modalServerSubscription");

			if (!modal.find("form")[0].checkValidity()) {
				// Please fill the required fields in the right format
				messageBox.error(api.i18n.getMessage("settingsServerSubscriptionIncompleteForm"));
				return;
			}

			let subscriptionModel = settingsPage.readServerSubscriptionModel(modal);

			if (!subscriptionModel) {
				messageBox.error(api.i18n.getMessage("settingsServerSubscriptionInvalidForm"));
				return;
			}

			// Testing...
			jq("#btnTestServerSubscription").attr("data-loading-text", api.i18n.getMessage("settingsServerSubscriptionTestingButton"));
			jq("#btnTestServerSubscription").button("loading");

			// mark this request as special
			var applyProxyMode = subscriptionModel.applyProxy;
			// prevent the importer mark it again as special request
			subscriptionModel.applyProxy = null;

			PolyFill.runtimeSendMessage(
				{
					command: CommandMessages.SettingsPageMakeRequestSpecial,
					url: subscriptionModel.url,
					applyProxy: applyProxyMode,
					selectedProxy: null
				},
				(response: any) => {
					if (!response) return;
					if (!response.success) {
						if (response.message)
							messageBox.error(response.message);
						return;
					}
					if (response.message)
						messageBox.success(response.message);

					ProxyImporter.readFromServer(subscriptionModel,
						(response: {
							success: boolean,
							message: string,
							result: ProxyServer[]
						}) => {

							jq("#btnTestServerSubscription").button('reset');

							if (response.success) {
								let count = response.result.length;

								messageBox.success(api.i18n.getMessage("settingsServerSubscriptionTestSuccess").replace("{0}", count));
							} else {
								messageBox.error(api.i18n.getMessage("settingsServerSubscriptionTestFailed"));
							}
						},
						() => {
							messageBox.error(api.i18n.getMessage("settingsServerSubscriptionTestFailed"));
							jq("#btnTestServerSubscription").button('reset');
						});
				},
				(error: Error) => {
					messageBox.error(api.i18n.getMessage("settingsServerSubscriptionTestFailed"));
					jq("#btnTestServerSubscription").button('reset');
				});
		},
		onClickSaveServerSubscriptionsChanges() {
			let proxyServerSubscriptions = settingsPage.readServerSubscriptions();

			PolyFill.runtimeSendMessage(
				{
					command: CommandMessages.SettingsPageSaveProxySubscriptions,
					proxyServerSubscriptions: proxyServerSubscriptions
				},
				(response: any) => {
					if (!response) return;
					if (response.success) {
						if (response.message)
							messageBox.success(response.message);

						// current list should become equal to saved list
						settingsPage.currentSettings.proxyServerSubscriptions = proxyServerSubscriptions;

						settingsPage.changeTracking.serverSubscriptions = false;

						settingsPage.loadDefaultProxyServer();
					} else {
						if (response.message)
							messageBox.error(response.message);
					}
				},
				(error: Error) => {
					messageBox.error(api.i18n.getMessage("settingsFailedToSaveProxySubscriptions") + " " + error.message);
				});
		},
		onClickRejectServerSubscriptionsChanges() {
			// reset the data
			settingsPage.currentSettings.proxyServerSubscriptions = settingsPage.originalSettings.proxyServerSubscriptions.slice();
			settingsPage.loadServerSubscriptionsGrid(settingsPage.currentSettings.proxyServerSubscriptions);
			settingsPage.loadDefaultProxyServer();

			settingsPage.changeTracking.serverSubscriptions = false;

			// Changes reverted successfully
			messageBox.info(api.i18n.getMessage("settingsChangesReverted"));
		},
		onClickClearServerSubscriptions() {

			// Are you sure to remove all the proxy server subscriptions?
			messageBox.confirm(api.i18n.getMessage("settingsRemoveAllProxyServerSubscriptions"),
				() => {
					settingsPage.loadServerSubscriptionsGrid([]);
					settingsPage.loadDefaultProxyServer();

					settingsPage.changeTracking.serverSubscriptions = true;

					// All the proxy server subscriptions are removed.<br/>You have to save to apply the changes.
					messageBox.info(api.i18n.getMessage("settingsRemoveAllProxyServerSubscriptionsSuccess"));
				});
		},
		onClickAddRulesSubscription(pageProfile: SettingsPageSmartProfile) {
			let tabContainer = pageProfile.htmlProfileTab;

			let modal = tabContainer.find("#modalRulesSubscription");
			modal.data("editing", null);

			// empty the form
			settingsPage.populateRulesSubscriptionsModal(pageProfile, modal, null);

			modal.modal("show");

			function focusUrl() {
				modal.off("shown.bs.modal", focusUrl);
				modal.find("#txtUrl").focus();
			}

			modal.on("shown.bs.modal", focusUrl);
		},
		onRulesSubscriptionEditClick(pageProfile: SettingsPageSmartProfile, e: any) {

			let item = settingsPage.readSelectedRulesSubscription(pageProfile, e);
			if (!item)
				return;

			let tabContainer = pageProfile.htmlProfileTab;

			let modal = tabContainer.find("#modalRulesSubscription");
			modal.data("editing", item);

			settingsPage.populateRulesSubscriptionsModal(pageProfile, modal, item);

			modal.modal("show");
		},
		onRulesSubscriptionRemoveClick(pageProfile: SettingsPageSmartProfile, e: any) {
			var row = settingsPage.readSelectedRulesSubscriptionRow(pageProfile, e);
			if (!row)
				return;

			messageBox.confirm(api.i18n.getMessage("settingsConfirmRemoveRulesSubscription"),
				() => {
					// remove then redraw the grid page
					row.remove().draw('full-hold');

					settingsPage.changeTracking.rulesSubscriptions = true;
				});
		},
		onRulesSubscriptionRefreshClick(pageProfile: SettingsPageSmartProfile, e: any) {
			var row = settingsPage.readSelectedRulesSubscriptionRow(pageProfile, e);
			if (!row)
				return;
			let editingSubscription = settingsPage.readSelectedRulesSubscription(pageProfile, e);
			if (!editingSubscription)
				return;
			if (!editingSubscription.enabled) {
				messageBox.error(api.i18n.getMessage("settingsRulesSubscriptionRefreshOnDisabled"));
				return;
			}

			if (!editingSubscription.stats) {
				editingSubscription.stats = new SubscriptionStats();
			}

			RuleImporter.readFromServer(editingSubscription,
				(response: {
					success: boolean,
					message: string,
					result: {
						whiteList: SubscriptionProxyRule[],
						blackList: SubscriptionProxyRule[]
					}
				}) => {
					if (response.success) {
						let count = response.result.blackList.length + response.result.whiteList.length;

						if (editingSubscription.enabled) {
							editingSubscription.proxyRules = response.result.blackList;
							editingSubscription.whitelistRules = response.result.whiteList;
						}
						else {
							editingSubscription.proxyRules = [];
							editingSubscription.whitelistRules = [];
						}
						editingSubscription.totalCount = count;
						SubscriptionStats.updateStats(editingSubscription.stats, true);

						settingsPage.refreshRulesSubscriptionsGrid(pageProfile);

						// The subscription is updated with {0} proxy rules and {1} white listed rules in it. <br/>Don't forget to save the changes.
						messageBox.success(api.i18n.getMessage("settingsRulesSubscriptionSaveUpdated")
							.replace("{0}", response.result.blackList.length)
							.replace("{1}", response.result.whiteList.length));

						settingsPage.changeTracking.rulesSubscriptions = true;

					} else {
						SubscriptionStats.updateStats(editingSubscription.stats, false);
						messageBox.error(api.i18n.getMessage("settingsRulesSubscriptionSaveFailedGet"));
					}
				},
				(errorResult) => {
					SubscriptionStats.updateStats(editingSubscription.stats, false, errorResult);
					messageBox.error(api.i18n.getMessage("settingsRulesSubscriptionSaveFailedGet"));
				});
		},
		onRulesSubscriptionViewStatsClick(pageProfile: SettingsPageSmartProfile, e: any) {
			let status = e.currentTarget?.title;
			if (status) {
				status = status.replaceAll('\r\n', '<br\>').replaceAll('\n', '<br\>');
				messageBox.info(status);
			}
		},
		onClickSaveRulesSubscription(pageProfile: SettingsPageSmartProfile) {
			let tabContainer = pageProfile.htmlProfileTab;
			let modal = tabContainer.find("#modalRulesSubscription");

			if (!modal.find("form")[0].checkValidity()) {
				// Please fill the required fields in the right format
				messageBox.error(api.i18n.getMessage("settingsRulesSubscriptionIncompleteForm"));
				return;
			}
			let subscriptionModel = settingsPage.readRulesSubscriptionModel(modal);
			if (!subscriptionModel) {
				messageBox.error(api.i18n.getMessage("settingsRulesSubscriptionInvalidForm"));
				return;
			}

			let subscriptionsList = settingsPage.readRulesSubscriptions(pageProfile);
			let editingSubscription: ProxyRulesSubscription = modal.data("editing");
			let editingName = "";
			if (editingSubscription)
				editingName = editingSubscription.name;

			// let editingSubscription = null;

			if (editingSubscription) {
				let nameIsDuplicate = false;
				for (let item of subscriptionsList) {
					// if (item.name === editingName) {
					//     editingSubscription = item;
					// }

					if (item.name == subscriptionModel.name && subscriptionModel.name != editingName) {
						nameIsDuplicate = true;
					}
				}
				if (subscriptionModel.name != editingName)
					// check for duplicate
					if (nameIsDuplicate) {
						// The entered name is already used, please enter another name.
						messageBox.error(api.i18n.getMessage("settingsRulesSubscriptionDuplicateName"));
						return;
					}
			}

			if (!subscriptionModel.stats) {
				subscriptionModel.stats = new SubscriptionStats();
			}

			// Saving...
			tabContainer.find("#btnSaveRulesSubscriptions").attr("data-loading-text", api.i18n.getMessage("settingsRulesSubscriptionSavingButton"));
			tabContainer.find("#btnSaveRulesSubscriptions").button("loading");

			RuleImporter.readFromServer(subscriptionModel,
				(response: {
					success: boolean,
					message: string,
					result: {
						whiteList: SubscriptionProxyRule[],
						blackList: SubscriptionProxyRule[]
					}
				}) => {
					tabContainer.find("#btnSaveRulesSubscriptions").button('reset');

					if (response.success) {
						let count = response.result.blackList.length + response.result.whiteList.length;

						if (subscriptionModel.enabled) {
							subscriptionModel.proxyRules = response.result.blackList;
							subscriptionModel.whitelistRules = response.result.whiteList;
						}
						else {
							subscriptionModel.proxyRules = [];
							subscriptionModel.whitelistRules = [];
						}
						subscriptionModel.totalCount = count;
						SubscriptionStats.updateStats(subscriptionModel.stats, true);

						if (editingSubscription) {

							// updating the model
							jQuery.extend(editingSubscription, subscriptionModel);

							settingsPage.refreshRulesSubscriptionsGrid(pageProfile);

							// The subscription is updated with {0} proxy rules and {1} white listed rules in it. <br/>Don't forget to save the changes.
							messageBox.success(api.i18n.getMessage("settingsRulesSubscriptionSaveUpdated")
								.replace("{0}", response.result.blackList.length)
								.replace("{1}", response.result.whiteList.length));
						} else {

							// insert to the grid
							settingsPage.insertNewRulesSubscriptionInGrid(pageProfile, subscriptionModel);

							// The subscription is added with {0} proxy rules and {1} white listed rules in it. <br/>Don't forget to save the changes.
							messageBox.success(api.i18n.getMessage("settingsRulesSubscriptionSaveAdded")
								.replace("{0}", response.result.blackList.length)
								.replace("{1}", response.result.whiteList.length));
						}

						settingsPage.changeTracking.rulesSubscriptions = true;

						// close the window
						modal.modal("hide");

					} else {
						SubscriptionStats.updateStats(subscriptionModel.stats, false);

						messageBox.error(api.i18n.getMessage("settingsRulesSubscriptionSaveFailedGet"));
					}
				},
				(errorResult) => {
					SubscriptionStats.updateStats(subscriptionModel.stats, false, errorResult);

					messageBox.error(api.i18n.getMessage("settingsRulesSubscriptionSaveFailedGet"));
					tabContainer.find("#btnSaveRulesSubscriptions").button('reset');
				});
		},
		onClickTestRulesSubscription(pageProfile: SettingsPageSmartProfile) {
			let tabContainer = pageProfile.htmlProfileTab;
			let modal = tabContainer.find("#modalRulesSubscription");

			if (!modal.find("form")[0].checkValidity()) {
				// Please fill the required fields in the right format
				messageBox.error(api.i18n.getMessage("settingsRulesSubscriptionIncompleteForm"));
				return;
			}

			let subscriptionModel = settingsPage.readRulesSubscriptionModel(modal);

			if (!subscriptionModel) {
				messageBox.error(api.i18n.getMessage("settingsRulesSubscriptionInvalidForm"));
				return;
			}

			// Testing...
			tabContainer.find("#btnTestRulesSubscriptions").attr("data-loading-text", api.i18n.getMessage("settingsRulesSubscriptionTestingButton"));
			tabContainer.find("#btnTestRulesSubscriptions").button("loading");

			// mark this request as special
			var applyProxyMode = subscriptionModel.applyProxy;
			// prevent the importer mark it again as special request
			subscriptionModel.applyProxy = null;

			PolyFill.runtimeSendMessage(
				{
					command: CommandMessages.SettingsPageMakeRequestSpecial,
					url: subscriptionModel.url,
					applyProxy: applyProxyMode,
					selectedProxy: null
				},
				(response: any) => {
					if (!response) return;
					if (!response.success) {
						if (response.message)
							messageBox.error(response.message);
						return;
					}
					if (response.message)
						messageBox.success(response.message);

					RuleImporter.readFromServer(subscriptionModel,
						(response: {
							success: boolean,
							message: string,
							result: {
								whiteList: string[],
								blackList: string[]
							}
						}) => {
							tabContainer.find("#btnTestRulesSubscriptions").button('reset');

							if (response.success) {

								messageBox.success(api.i18n.getMessage("settingsRulesSubscriptionTestSuccess")
									.replace("{0}", response.result.blackList.length)
									.replace("{1}", response.result.whiteList.length));
							} else {
								messageBox.error(api.i18n.getMessage("settingsRulesSubscriptionTestFailed"));
							}
						},
						() => {
							messageBox.error(api.i18n.getMessage("settingsRulesSubscriptionTestFailed"));
							tabContainer.find("#btnTestRulesSubscriptions").button('reset');
						});
				},
				(error: Error) => {
					messageBox.error(api.i18n.getMessage("settingsRulesSubscriptionTestFailed"));
					tabContainer.find("#btnTestRulesSubscriptions").button('reset');
				});
		},
		onClickClearRulesSubscriptions(pageProfile: SettingsPageSmartProfile) {

			// Are you sure to remove all the proxy rules subscriptions?
			messageBox.confirm(api.i18n.getMessage("settingsRemoveAllProxyRulesSubscriptions"),
				() => {
					settingsPage.loadRulesSubscriptions(pageProfile, []);

					settingsPage.changeTracking.rulesSubscriptions = true;

					// All the proxy server subscriptions are removed.<br/>You have to save to apply the changes.
					messageBox.info(api.i18n.getMessage("settingsRemoveAllProxyRulesSubscriptionsSuccess"));
				});
		},
		onClickExportProxyServerOpenBackup() {
			let proxyList = settingsPage.exportServersListFormatted();

			CommonUi.downloadData(proxyList, "SmartProxy-Servers.txt");
		},
		onClickImportProxyServer() {
			let modalContainer = jq("#modalImportProxyServer");
			let append = modalContainer.find("#cmbImportProxyServerOverride_Append").prop("checked");
			let file, text;

			if (modalContainer.find("#rbtnImportProxyServer_File").prop("checked")) {
				// file should be selected

				let selectFileElement = modalContainer.find("#btnImportProxyServerSelectFile")[0];

				if (selectFileElement.files.length == 0) {
					// Please select a proxy list file
					messageBox.error(api.i18n.getMessage("settingsImportProxiesFileNotSelected"));
					return;
				}
				file = selectFileElement.files[0];

			} else {
				let proxyServerListText = modalContainer.find("#btnImportProxyServerListText").val().trim();
				if (proxyServerListText == "") {
					// Please enter proxy list
					messageBox.error(api.i18n.getMessage("settingsImportProxyListTextIsEmpty"));
					return;
				}
				text = proxyServerListText;
			}

			let proxyServers = settingsPage.readServers();

			ProxyImporter.importText(text, file,
				append,
				proxyServers,
				(response: {
					success: boolean,
					message: string,
					result: ProxyServer[]
				}) => {
					if (!response) return;

					if (response.success) {
						if (response.message)
							messageBox.info(response.message);

						// empty the input
						modalContainer.find("#btnImportProxyServerSelectFile")[0].value = "";
						modalContainer.find("#btnImportProxyServerListText").val("");

						let servers = response.result;
						settingsPage.loadServersGrid(servers);
						settingsPage.loadDefaultProxyServer();

						// close the window
						modalContainer.modal("hide");
					} else {
						if (response.message)
							messageBox.error(response.message);
					}
				},
				(error: Error) => {
					let message = "";
					if (error && error.message)
						message = error.message;
					messageBox.error(api.i18n.getMessage("settingsImportProxyServersFailed") + " " + message);
				});

		},
		onClickImportRules(pageProfile: SettingsPageSmartProfile) {
			let tabContainer = pageProfile.htmlProfileTab;

			let modalContainer = tabContainer.find("#modalImportRules");
			let selectFileElement = modalContainer.find("#btnImportRulesSelectFile")[0];

			if (selectFileElement.files.length == 0) {
				// Please select a rules file
				messageBox.error(api.i18n.getMessage("settingsRulesFileNotSelected"));
				return;
			}

			let selectFile = selectFileElement.files[0];

			let append = modalContainer.find("#cmbImportRulesOverride_Append").prop("checked");
			let sourceType = modalContainer.find("#cmbImportRulesFormat").val();

			let proxyRules = settingsPage.readRules(pageProfile);

			let importFunction: Function;
			if (sourceType == "autoproxy") {
				importFunction = RuleImporter.importAutoProxy;
			} else {
				messageBox.warning(api.i18n.getMessage("settingsSourceTypeNotSelected"));
				return;
			}

			importFunction(selectFile,
				append,
				proxyRules,
				(response: any) => {
					if (!response) return;

					if (response.success) {
						if (response.message)
							messageBox.info(response.message);

						// empty the file input
						selectFileElement.value = "";

						let rules = response.result;
						settingsPage.loadRules(pageProfile, rules);

						// close the window
						modalContainer.modal("hide");
					} else {
						if (response.message)
							messageBox.error(response.message);
					}
				},
				(error: Error) => {
					let message = "";
					if (error && error.message)
						message = error.message;
					messageBox.error(api.i18n.getMessage("settingsImportRulesFailed") + " " + message);
				});
		},
		onClickFactoryReset() {
			// Are you sure to reset EVERYTHING ? Sure? There is no way back!
			messageBox.confirm(api.i18n.getMessage("settingsFactoryResetConfirm"),
				() => {
					PolyFill.runtimeSendMessage(
						{
							command: CommandMessages.SettingsPageFactoryReset,
						},
						(response: ResultHolder) => {
							if (response.success) {
								if (response.message) {
									messageBox.success(response.message,
										800,
										() => {
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
						});
				});
		},
		onClickBackupComplete() {

			let backupSettings = SettingsOperation.getStrippedSyncableSettings(settingsPage.currentSettings);
			let data = JSON.stringify(backupSettings);
			CommonUi.downloadData(data, "SmartProxy-FullBackup.json");
		},
		onClickRestoreBackup() {
			function callRestoreSettings(fileData: any) {
				PolyFill.runtimeSendMessage(
					{
						command: CommandMessages.SettingsPageRestoreSettings,
						fileData: fileData
					},
					(response: ResultHolder) => {
						if (response.success) {
							if (response.message) {
								messageBox.success(response.message,
									500,
									() => {
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
					(error: Error) => {
						// There was an error in restoring the backup
						messageBox.error(api.i18n.getMessage("settingsRestoreBackupFailed"));
						PolyFill.runtimeSendMessage("restoreSettings failed with> " + error.message);
					});
			}

			CommonUi.selectFileOnTheFly(jq("#frmRestoreBackup")[0],
				"restore-file",
				(inputElement: any, files: any[]) => {
					let file = files[0];

					let reader = new FileReader();
					reader.onerror = event => {
						// Failed to read the selected file
						messageBox.error(api.i18n.getMessage("settingsRestoreBackupFileError"));
					};
					reader.onload = event => {
						//let textFile = event.target;
						let fileText = reader.result;

						callRestoreSettings(fileText);
					};
					reader.readAsText(file);
				},
				"application/json");
		},
		onClickEnableDiagnostics() {
			if (settingsPage.debugDiagnosticsRequested) {
				PolyFill.runtimeSendMessage({ command: CommandMessages.DebugGetDiagnosticsLogs }, (result) => {
					const fileName = `smartproxy-diag-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}.json`;
					CommonUi.downloadData(result, fileName);
				});
			}
			else if (confirm("Are you sure to enable diagnostics?")) {
				settingsPage.debugDiagnosticsRequested = true;
				PolyFill.runtimeSendMessage({ command: CommandMessages.DebugEnableDiagnostics });

				alert("Diagnostics are enabled for this session only. Check this page for more info.");
				window.open("https://github.com/salarcode/SmartProxy/wiki/Enable-Diagnostics")
			}
		}
	};

	//#endregion

	//#region Common functions ---------------
	private static generateNewServerName(): string {
		// generates a unique name for proxy server
		let servers = this.readServers();
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
	}

	private static generateNewSubscriptionName(): string {
		// generates a unique name for list subscription
		let subscriptions = settingsPage.readServerSubscriptions();
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
	}

	private static generateNewRulesSubscriptionName(pageProfile: SettingsPageSmartProfile): string {
		// generates a unique name for list subscription
		let subscriptions = settingsPage.readRulesSubscriptions(pageProfile);
		let itemNo = 1;
		let result = `Rules Sub ${itemNo}`;

		if (subscriptions && subscriptions.length > 0) {
			let exist;

			itemNo = subscriptions.length + 1;
			result = `Rules Sub ${itemNo}`;

			do {
				exist = false;
				for (let i = subscriptions.length - 1; i >= 0; i--) {
					if (subscriptions[i].name === result) {
						exist = true;
						itemNo++;
						result = `Rules Sub ${itemNo}`;
						break;
					}
				}
			} while (exist)
		}

		return result;
	}

	//#endregion

}

settingsPage.initialize();
