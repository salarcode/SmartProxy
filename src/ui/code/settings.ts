import { CommonUi } from "./CommonUi";
import { PolyFill } from "../../lib/PolyFill";
import { Messages, SettingsPageInternalDataType, proxyServerProtocols, proxyServerSubscriptionObfuscate, ProxyServerForProtocol } from "../../core/definitions";
import { messageBox, jQuery } from "../../lib/External";
import { environment } from "../../lib/environment";
import { SettingsConfig, ProxyServer, BypassOptions, GeneralOptions } from "../../core/Settings";

export class settingsPage {

    private static grdServers: any;
    private static grdRules: any;
    private static grdServerSubscriptions: any;
    private static currentSettings: SettingsConfig;

    /** Used to track changes and restore when reject changes selected */
    private static originalSettings: SettingsConfig;

    private static changeTracking = {
        options: false,
        rules: false,
        servers: false,
        activeProxy: false,
        serverSubscriptions: false
    };

    public static initialize() {

        CommonUi.onDocumentReady(this.bindEvents);
        CommonUi.onDocumentReady(this.initializeGrids);
        CommonUi.onDocumentReady(this.initializeUi);

        PolyFill.runtimeSendMessage(Messages.SettingsPageGetInitialData,
            function (dataForSettings: SettingsPageInternalDataType) {
                if (!dataForSettings)
                    return;

                settingsPage.populateDataForSettings(dataForSettings);
            },
            function (error) {
                PolyFill.runtimeSendMessage("SettingsPageGetInitialData failed! > " + error);
                messageBox.error(browser.i18n.getMessage("settingsInitializeFailed"));
            });

        CommonUi.onDocumentReady(CommonUi.localizeHtmlPage);
    }

    private static populateDataForSettings(settingsData: SettingsPageInternalDataType) {
        this.currentSettings = settingsData.settings;
        this.populateSettingsUiData(settingsData);

        this.loadRules(this.currentSettings.proxyRules);
        this.loadServers(this.currentSettings.proxyServers);
        this.loadServerSubscriptions(this.currentSettings.proxyServerSubscriptions);
        this.loadActiveProxyServer(this.currentSettings.proxyServers, this.currentSettings.proxyServerSubscriptions);
        this.loadBypass(this.currentSettings.bypass);
        this.loadGeneralOptions(this.currentSettings.options);

        // make copy
        this.originalSettings = new SettingsConfig();
        this.originalSettings.proxyRules = this.currentSettings.proxyRules.slice();
        this.originalSettings.proxyServers = this.currentSettings.proxyServers.slice();
        this.originalSettings.activeProxyServer = this.currentSettings.activeProxyServer;
        this.originalSettings.proxyServerSubscriptions = this.currentSettings.proxyServerSubscriptions;
        this.originalSettings.bypass = jQuery.extend({}, this.currentSettings.bypass);
        this.originalSettings.options = jQuery.extend({}, this.currentSettings.options);
    }

    private static bindEvents() {
        // general options
        jQuery("#btnSaveGeneralOptions").click(settingsPage.uiEvents.onClickSaveGeneralOptions);

        jQuery("#btnRejectGeneralOptions").click(settingsPage.uiEvents.onClickRejectGeneralOptions);

        // proxy servers
        jQuery("#cmbActiveProxyServer").on("change", settingsPage.uiEvents.onChangeActiveProxyServer);

        jQuery("#btnAddProxyServer").click(settingsPage.uiEvents.onClickAddProxyServer);

        jQuery("#btnSubmitProxyServer").click(settingsPage.uiEvents.onClickSubmitProxyServer);

        jQuery("#btnSaveProxyServers").click(settingsPage.uiEvents.onClickSaveProxyServers);

        jQuery("#btnRejectProxyServers").click(settingsPage.uiEvents.onClickRejectProxyServers);

        jQuery("#btnClearProxyServers").click(settingsPage.uiEvents.onClickClearProxyServers);

        jQuery("#btnExportProxyServerOpen,#btnExportProxyServerOpenBackup").click(settingsPage.uiEvents.onClickExportProxyServerOpenBackup);

        jQuery("#btnImportProxyServer").click(settingsPage.uiEvents.onClickImportProxyServer);

        // rules
        jQuery("#btnSubmitRule").click(settingsPage.uiEvents.onClickSubmitProxyRule);

        jQuery("#btnImportRules").click(settingsPage.uiEvents.onClickImportRules);

        jQuery("#btnAddProxyRule").click(settingsPage.uiEvents.onClickAddProxyRule);

        jQuery("#btnSaveProxyRules").click(settingsPage.uiEvents.onClickSaveProxyRules);

        jQuery("#btnRejectProxyRules").click(settingsPage.uiEvents.onClickRejectProxyRules);

        jQuery("#btnClearProxyRules").click(settingsPage.uiEvents.onClickClearProxyRules);

        // bypass list
        jQuery("#btnSaveBypassChanges").click(settingsPage.uiEvents.onClickSaveBypassChanges);

        jQuery("#btnRejectBypass").click(settingsPage.uiEvents.onClickRejectBypass);

        // backup
        jQuery("#btnBackupComplete").click(settingsPage.uiEvents.onClickBackupComplete);

        jQuery("#btnBackupRules").click(settingsPage.uiEvents.onClickBackupRules);

        jQuery("#btnRestoreBackup").click(settingsPage.uiEvents.onClickRestoreBackup);

        // proxy server subscriptions
        jQuery("#btnAddServerSubscription").click(function () {
            //settingsGrid.serverSubscriptionsAdd();
        });
        jQuery("#btnSaveServerSubscription").click(function () {
            //settingsGrid.serverSubscriptionsSave();
        });
        jQuery("#btnTestServerSubscription").click(function () {
            //settingsGrid.serverSubscriptionsTest(true);
        });

        jQuery("#btnClearServerSubscriptions").click(settingsPage.uiEvents.onClickClearServerSubscriptions);

        jQuery("#btnSaveServerSubscriptionsChanges").click(settingsPage.uiEvents.onClickSaveServerSubscriptionsChanges);

        jQuery("#btnRejectServerSubscriptionsChanges").click(settingsPage.uiEvents.onClickRejectServerSubscriptionsChanges);

    }

    private static initializeGrids() {

        let dataTableCustomDom = '<t><"row"<"col-sm-12 col-md-5"<"text-left float-left"f>><"col-sm-12 col-md-7"<"text-right"l>>><"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>';

        settingsPage.grdServers = jQuery("#grdServers").DataTable({
            "dom": dataTableCustomDom,
            paging: true,
            select: true,
            scrollY: 300,
            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
            columns: [
                {
                    name: "name", title: browser.i18n.getMessage("settingsServersGridColName")
                },
                {
                    name: "protocol", title: browser.i18n.getMessage("settingsServersGridColProtocol"),
                },
                {
                    name: "host", title: browser.i18n.getMessage("settingsServersGridColServer"),
                },
                {
                    name: "port", title: browser.i18n.getMessage("settingsServersGridColPort"),
                },
                {
                    "data": null,
                    "defaultContent": "<button class='btn btn-sm btn-success' onclick='settingsPage.onServersEditClick(event)'>Edit</button> <button class='btn btn-sm btn-danger' onclick='settingsPage.onServersRemoveClick(event)'><i class='fas fa-times'></button>",
                }
            ],
        });
        settingsPage.grdServers.draw();


        settingsPage.grdRules = jQuery("#grdRules").DataTable({
            "dom": dataTableCustomDom,
            paging: true,
            select: true,
            scrollY: 300,
            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
            columns: [
                {
                    name: "source", title: browser.i18n.getMessage("settingsRulesGridColSource")
                },
                {
                    name: "pattern", title: browser.i18n.getMessage("settingsRulesGridColPattern")
                },
                {
                    name: "enabled", title: browser.i18n.getMessage("settingsRulesGridColEnabled")
                },
                {
                    name: "proxy", title: browser.i18n.getMessage("settingsRulesGridColProxy"),
                },
                {
                    "data": null,
                    "defaultContent": "<button class='btn btn-sm btn-success' onclick='settingsPage.onRulesEditClick(event)'>Edit</button> <button class='btn btn-sm btn-danger' onclick='settingsPage.onRulesRemoveClick(event)'><i class='fas fa-times'></button>",
                }
            ],
        });
        settingsPage.grdRules.draw();

        settingsPage.grdServerSubscriptions = jQuery("#grdServerSubscriptions").DataTable({
            "dom": dataTableCustomDom,
            paging: true,
            select: true,
            scrollY: 300,
            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
            columns: [
                {
                    name: "name", title: browser.i18n.getMessage("settingsServerSubscriptionsGridColName")
                },
                {
                    name: "url", title: browser.i18n.getMessage("settingsServerSubscriptionsGridColUrl")
                },
                {
                    name: "totalCount", title: browser.i18n.getMessage("settingsServerSubscriptionsGridColCount")
                },
                {
                    name: "enabled", title: browser.i18n.getMessage("settingsServerSubscriptionsGridColEnabled"),
                },
                {
                    "data": null,
                    "defaultContent": "<button class='btn btn-sm btn-success' onclick='settingsPage.onSubscriptionsEditClick(event)'>Edit</button> <button class='btn btn-sm btn-danger' onclick='settingsPage.onSubscriptionsRemoveClick(event)'><i class='fas fa-times'></button>",
                }
            ],
        });
        settingsPage.grdServerSubscriptions.draw();

        settingsPage.loadServers([]);
        settingsPage.loadRules([]);
        settingsPage.loadServerSubscriptions([]);

        jQuery("#tabSettings").on('shown.bs.tab', function (e) {
            // DataTables columns are not adjusted when hidden, needs to be done manually
            settingsPage.grdServers.columns.adjust().draw();
            settingsPage.grdRules.columns.adjust().draw();
            settingsPage.grdServerSubscriptions.columns.adjust().draw();
        })
    }

    private static initializeUi() {
        if (environment.chrome) {
            jQuery("#divAlertChrome").show();

            // not supported by Chrome
            jQuery("#chkEnableBypassForSystemProxy").attr("disabled", "disabled");
        } else {
            jQuery("#divAlertFirefox").show();
        }

        // the default values
        let cmbServerSubscriptionProtocol = jQuery("#cmbServerSubscriptionProtocol");

        // the default values
        let cmbServerSubscriptionObfuscation = jQuery("#cmbServerSubscriptionObfuscation");

        jQuery("<option>").attr("value", "")
            // (Auto detect with HTTP fallback)
            .text(browser.i18n.getMessage("settingsServerSubscriptionProtocolDefault"))
            .appendTo(cmbServerSubscriptionProtocol);
        proxyServerProtocols.forEach(function (item) {
            jQuery("<option>").attr("value", item)
                .text(item)
                .appendTo(cmbServerSubscriptionProtocol);
        });

        proxyServerSubscriptionObfuscate.forEach(function (item) {
            jQuery("<option>").attr("value", item)
                .text(item)
                .appendTo(cmbServerSubscriptionObfuscation);
        });
    }

    private static loadServers(servers: any[]) {
        if (!this.grdServers)
            return;
        this.grdServers.clear();
        this.grdServers.rows.add(servers);
    }

    private static readServers(): any[] {
        return this.grdServers.data();
    }

    private static loadRules(rules: any[]) {
        if (!this.grdRules)
            return;
        this.grdRules.clear();
        this.grdRules.rows.add(rules);
    }

    private static readRules(): any[] {
        return this.grdRules.data();
    }
    private static loadServerSubscriptions(rules: any[]) {
        if (!this.grdServerSubscriptions)
            return;
        this.grdServerSubscriptions.clear();
        this.grdServerSubscriptions.rows.add(rules);
    }

    private static loadActiveProxyServer(proxyServers: ProxyServer[], serverSubscriptions: any[]) {
        let activeProxyServer = this.currentSettings.activeProxyServer;

        let activeProxyName = "";
        if (activeProxyServer != null) {
            activeProxyName = activeProxyServer.name;
        }

        let cmbActiveProxyServer = jQuery("#cmbActiveProxyServer");

        // remove previous items
        cmbActiveProxyServer.find("option,optgroup").remove();

        // populate
        this.populateProxyServersToComboBox(cmbActiveProxyServer, activeProxyName, proxyServers, serverSubscriptions);
    }


    private static loadBypass(bypass: BypassOptions) {
        if (!bypass)
            return;

        jQuery("#chkEnableBypassForAlwaysEnable").prop("checked", bypass.enableForAlways);
        jQuery("#chkEnableBypassForSystemProxy").prop("checked", bypass.enableForSystem);
        if (bypass.bypassList && Array.isArray(bypass.bypassList)) {
            jQuery("#txtBypassList").val(bypass.bypassList.join("\n"));
        }
    }

    private static loadGeneralOptions(options: GeneralOptions) {
        if (!options)
            return;
        let divGeneral = jQuery("#tab-general");

        divGeneral.find("#chkSyncSettings").prop("checked", options.syncSettings || false);
    }

    //#region Populate UI ----------------------

    /** Display General UI data */
    static populateSettingsUiData(settingsData: SettingsPageInternalDataType) {
        let currentSettings = settingsData.settings;

        let divNoServersWarning = jQuery("#divNoServersWarning");
        if (currentSettings.proxyServers.length > 0 ||
            (currentSettings.proxyServerSubscriptions && currentSettings.proxyServerSubscriptions.length > 0)) {

            divNoServersWarning.hide();
        } else {
            divNoServersWarning.show();
        }

        jQuery("#spanVersion").text("Version: " + currentSettings.version);

        if (settingsData.updateAvailableText && settingsData.updateInfo) {
            jQuery("#divUpdateIsAvailable").show()
                .find("a")
                .attr("href", settingsData.updateInfo.downloadPage)
                .find("span")
                .text(settingsData.updateAvailableText);
        }
    }

    /** used for ActiveProxy and ... */
    static populateProxyServersToComboBox(comboBox: any, selectedProxyName: string, proxyServers: ProxyServer[], serverSubscriptions: any[]) {
        if (!comboBox) return;
        if (!proxyServers)
            // TODO: should we use local or grid data
            proxyServers = [];//settingsGrid.getServers();
        if (!serverSubscriptions)
            // TODO: should we use local or grid data
            serverSubscriptions = [];//settingsGrid.getServerSubscriptions();

        let hasSelectedItem = false;

        // adding select options
        jQuery.each(proxyServers, function (index: number, proxyServer: ProxyServer) {

            // proxyServer
            let option = jQuery("<option>")
                .attr("value", proxyServer.name)
                .text(proxyServer.name)
                .appendTo(comboBox);

            let selected = (proxyServer.name === selectedProxyName);
            option.prop("selected", selected);

            if (selected) {
                hasSelectedItem = true;
            }
        });

        if (serverSubscriptions && serverSubscriptions.length > 0) {
            let subscriptionGroup = jQuery("<optgroup>")
                // -Subscriptions-
                .attr("label", browser.i18n.getMessage("settingsActiveProxyServerSubscriptions"))
                .appendTo(comboBox);

            let added = false;

            for (let subscription of serverSubscriptions) {
                if (!subscription.enabled || !subscription.proxies) continue;

                for (let proxyServer of subscription.proxies) {
                    let option = jQuery("<option>")
                        .attr("value", proxyServer.name)
                        .text(proxyServer.name)
                        .appendTo(subscriptionGroup);

                    let selected = (proxyServer.name === selectedProxyName);
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

    private static populateRestartRequired(restartRequired: boolean) {
        if (restartRequired) {
            jQuery("#divRestartRequired").show();
        }
    }

    private static populateServerModal(modalContainer, server?: ProxyServer) {

        if (server) {

            modalContainer.find("#txtServerName").val(server.name);
            modalContainer.find("#txtServerAddressHttp").val(server.host);
            modalContainer.find("#txtServerPortHttp").val(server.port);
            modalContainer.find("#cmdServerProtocolHttp").val(server.protocol);
            modalContainer.find("#chkServerProxyDNSHttp").prop('checked', server.proxyDNS);
            modalContainer.find("#txtServerUsernameHttp").val(server.username);
            modalContainer.find("#txtServerPasswordHttp").val(server.password);

            if (server.protocolsServer && server.protocolsServer.length > 0) {
                for (let protocolsServer of server.protocolsServer) {
                    switch (protocolsServer.forProtocol) {
                        case ProxyServerForProtocol.Http:
                            {

                            }
                            break;
                        case ProxyServerForProtocol.SSL:
                            {

                            }
                            break;
                        case ProxyServerForProtocol.FTP:
                            {

                            }
                            break;
                        case ProxyServerForProtocol.SOCKS:
                            {

                            }
                            break;
                    }
                }
            }

        } else {

            modalContainer.find("#txtServerName").val(this.generateNewServerName());

            modalContainer.find("#txtServerAddressHttp").val("127.0.0.1");
            modalContainer.find("#txtServerPortHttp").val("");
            modalContainer.find("#cmdServerProtocolHttp").val("HTTP");
            modalContainer.find("#chkServerProxyDNSHttp").prop('checked', false);
            modalContainer.find("#txtServerUsernameHttp").val("");
            modalContainer.find("#txtServerPasswordHttp").val("");

            modalContainer.find("#txtServerAddressSSL").val("127.0.0.1");
            modalContainer.find("#txtServerPortSSL").val("");
            modalContainer.find("#cmdServerProtocolSSL").val("HTTPS");
            modalContainer.find("#chkServerProxyDNSSSL").prop('checked', false);
            modalContainer.find("#txtServerUsernameSSL").val("");
            modalContainer.find("#txtServerPasswordSSL").val("");

            modalContainer.find("#txtServerAddressFTP").val("127.0.0.1");
            modalContainer.find("#txtServerPortFTP").val("");
            modalContainer.find("#cmdServerProtocolFTP").val("SOCKS5");
            modalContainer.find("#chkServerProxyDNSFTP").prop('checked', false);
            modalContainer.find("#txtServerUsernameFTP").val("");
            modalContainer.find("#txtServerPasswordFTP").val("");

            modalContainer.find("#txtServerAddressSOCKS").val("127.0.0.1");
            modalContainer.find("#txtServerPortSOCKS").val("");
            modalContainer.find("#cmdServerProtocolSOCKS").val("SOCKS5");
            modalContainer.find("#chkServerProxyDNSSOCKS").prop('checked', false);
            modalContainer.find("#txtServerUsernameSOCKS").val("");
            modalContainer.find("#txtServerPasswordSOCKS").val("");

        }
    }
    //#endregion


    //#region Reading data ---------------------
    private static generateNewServerName() {
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

    static getGeneralOptions(generalOptions?: GeneralOptions): GeneralOptions {
        if (!generalOptions)
            generalOptions = new GeneralOptions();
        let divGeneral = jQuery("#tab-general");

        generalOptions.syncSettings = divGeneral.find("#chkSyncSettings").prop("checked");

        // TODO: complete other options

        return generalOptions;
    }
    //#endregion


    //#region Events --------------------------

    /** Servers Grid */
    public static onServersEditClick(e) {
        this.changeTracking.servers = true;

    }

    /** Servers Grid */
    public static onServersRemoveClick(e) {
        this.changeTracking.servers = true;

    }

    /** Rules Grid */
    public static onRulesEditClick(e) {
        this.changeTracking.rules = true;

    }

    /** Rules Grid */
    public static onRulesRemoveClick(e) {
        this.changeTracking.rules = true;

    }

    /** Rules Grid */
    public static onSubscriptionsEditClick(e) {
        this.changeTracking.serverSubscriptions = true;

    }

    /** Rules Grid */
    public static onSubscriptionsRemoveClick(e) {
        this.changeTracking.serverSubscriptions = true;

    }

    // ------------------
    private static uiEvents = {
        onClickSaveGeneralOptions: function () {
            let generalOptions = settingsPage.getGeneralOptions();

            PolyFill.runtimeSendMessage(
                {
                    command: Messages.SettingsPageSaveOptions,
                    options: generalOptions
                },
                function (response) {
                    if (!response) return;
                    if (response.success) {
                        if (response.message)
                            messageBox.success(response.message);

                        settingsPage.currentSettings.options = generalOptions;
                        settingsPage.changeTracking.options = false;
                        settingsPage.populateRestartRequired(response.restartRequired);
                    } else {
                        if (response.message)
                            messageBox.error(response.message);
                    }
                },
                function (error) {
                    messageBox.error(browser.i18n.getMessage("settingsErrorFailedToSaveGeneral") + " " + error.message);
                });
        },
        onClickRejectGeneralOptions: function () {
            // reset the data
            settingsPage.currentSettings.options = jQuery.extend({}, settingsPage.originalSettings.options);
            settingsPage.loadGeneralOptions(settingsPage.currentSettings.options);

            settingsPage.changeTracking.options = false;

            // Changes reverted successfully
            messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
        },
        onChangeActiveProxyServer: function () {
            // let proxyName = jQuery("#cmbActiveProxyServer").val();

            // let server = settingsGrid.findProxyServerByName(proxyName);

            // // this can be null
            // settingsUiData.activeProxyServer = server;
        },
        onClickAddProxyServer: function () {
            // settingsGrid.serverAdd();
            let modal = jQuery("#modalModifyProxyServer");
            modal.data("editing", null);

            settingsPage.populateServerModal(modal, null);

            modal.modal("show");
            modal.find("#txtServerAddress").focus();
        },
        onClickSubmitProxyServer: function () {

            // let modal = jQuery("#modalModifyProxyServer");
            // let editingModel = modal.data("editing");

            // let serverInputInfo = settingsGrid.serverReadModel(modal);

            // serverInputInfo.name = serverInputInfo.name.trim();
            // serverInputInfo.host = serverInputInfo.host.trim();
            // serverInputInfo.username = serverInputInfo.username.trim();
            // serverInputInfo.password = serverInputInfo.password.trim();

            // if (!serverInputInfo.name) {
            // 	messageBox.error(browser.i18n.getMessage("settingsServerNameRequired"));
            // 	return;
            // }

            // // ------------------
            // let editingServerName = null;
            // if (editingModel)
            // 	editingServerName = editingModel.name;

            // let existingServers = settingsGrid.getServers();
            // let serverExists = existingServers.some(server => {
            // 	return (server.name === serverInputInfo.name && server.name != editingServerName);
            // });
            // if (serverExists) {
            // 	// A Server with the same name already exists!
            // 	messageBox.error(browser.i18n.getMessage("settingsServerNameExists"));
            // 	return;
            // }

            // // ------------------
            // if (!serverInputInfo.host) {
            // 	messageBox.error(browser.i18n.getMessage("settingsServerServerAddressIsEmpty"));
            // 	return;
            // }
            // if (!serverInputInfo.port || serverInputInfo.port <= 0) {
            // 	messageBox.error(browser.i18n.getMessage("settingsServerPortNoInvalid"));
            // 	return;
            // }

            // if ((serverInputInfo.username && !serverInputInfo.password) || (!serverInputInfo.username && serverInputInfo.password)) {
            // 	messageBox.error(browser.i18n.getMessage("settingsServerAuthenticationInvalid"));
            // 	return;
            // }

            // if (editingModel) {
            // 	$.extend(editingModel, serverInputInfo);

            // 	jQuery("#grdServers").jsGrid("refresh");

            // } else {

            // 	// insert to the grid
            // 	jQuery("#grdServers").jsGrid("insertItem", serverInputInfo);
            // }

            // changeTracking.servers = true;

            // modal.modal("hide");

            // settingsGrid.reloadActiveProxyServer();
        },
        onClickSaveProxyServers: function () {

            // // update the active proxy server data
            // jQuery("#cmbActiveProxyServer").trigger("change");
            // let saveData = {
            // 	proxyServers: settingsGrid.getServers(),
            // 	activeProxyServer: settingsUiData.activeProxyServer
            // };

            // polyfill.runtimeSendMessage(
            // 	{
            // 		command: "settingsSaveProxyServers",
            // 		saveData: saveData
            // 	},
            // 	function (response) {
            // 		if (!response) return;
            // 		if (response.success) {
            // 			if (response.message)
            // 				messageBox.success(response.message);

            // 			settings.displayRestartRequired(response.restartRequired);

            // 			// current server should become equal to saved servers
            // 			settingsUiData.proxyServers = saveData.proxyServers;
            // 			settingsUiData.activeProxyServer = saveData.activeProxyServer;

            // 			changeTracking.servers = false;
            // 			changeTracking.activeProxy = false;

            // 		} else {
            // 			if (response.message)
            // 				messageBox.error(response.message);
            // 		}
            // 	},
            // 	function (error) {
            // 		messageBox.error(browser.i18n.getMessage("settingsErrorFailedToSaveServers") + " " + error.message);
            // 	});

        },
        onClickRejectProxyServers: function () {
            // // reset the data
            // settingsUiData.proxyServers = originalSettingsData.proxyServers.slice();
            // settingsGrid.loadServers(settingsUiData.proxyServers);
            // settingsGrid.reloadActiveProxyServer();
            // jQuery("#grdServers").jsGrid("refresh");

            // changeTracking.servers = false;

            // // Changes reverted successfully
            // messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
        },
        onClickClearProxyServers: function () {
            // // Are you sure to remove all the servers?
            // messageBox.confirm(browser.i18n.getMessage("settingsRemoveAllProxyServers"),
            // 	function () {
            // 		settingsGrid.loadServers([]);

            // 		changeTracking.servers = true;

            // 		// All the proxy servers are removed.<br/>You have to save to apply the changes.
            // 		messageBox.info(browser.i18n.getMessage("settingsRemoveAllProxyServersSuccess"));
            // 	});
        },
        onClickAddProxyRule: function () {

            // settingsGrid.proxyRuleAdd();
        },
        onClickSubmitProxyRule: function () {

            // let modal = jQuery("#modalModifyRule");
            // let editingModel = modal.data("editing");

            // let ruleInfo = settingsGrid.proxyRuleReadModel(modal);

            // let source = ruleInfo.source;
            // if (!source) {
            // 	// Please specify the source of the rule!
            // 	messageBox.error(browser.i18n.getMessage("settingsRuleSourceRequired"));
            // 	return;
            // }

            // if (!utils.isValidHost(source)) {
            // 	// source is invalid, source name should be something like 'google.com'
            // 	messageBox.error(browser.i18n.getMessage("settingsRuleSourceInvalid"));
            // 	return;
            // }

            // if (utils.urlHasSchema(source)) {
            // 	let extractedHost = utils.extractHostFromUrl(source);
            // 	if (extractedHost == null || !utils.isValidHost(extractedHost)) {

            // 		// `Host name '${extractedHost}' is invalid, host name should be something like 'google.com'`
            // 		messageBox.error(
            // 			browser.i18n.getMessage("settingsRuleHostInvalid")
            // 			.replace("{0}", extractedHost)
            // 		);
            // 		return;
            // 	}
            // } else {
            // 	// this extraction is to remove paths from rules, e.g. google.com/test/

            // 	let extractedHost = utils.extractHostFromUrl("http://" + source);
            // 	if (extractedHost == null || !utils.isValidHost(extractedHost)) {

            // 		// `Host name '${extractedHost}' is invalid, host name should be something like 'google.com'`
            // 		messageBox.error(
            // 			browser.i18n.getMessage("settingsRuleHostInvalid")
            // 			.replace("{0}", extractedHost)
            // 		);
            // 		return;
            // 	}
            // }

            // // the pattern
            // // TODO: Feature #41 Allow entering/modifying custom pattern for rules 
            // ruleInfo.pattern = utils.hostToMatchPattern(source);


            // // ------------------
            // let editingSource = null;
            // if (editingModel)
            // 	editingSource = editingModel.source;

            // let existingRules = settingsGrid.getRules();
            // let ruleExists = existingRules.some(rule => {
            // 	return (rule.source === ruleInfo.source && rule.source != editingSource);
            // });
            // if (ruleExists) {
            // 	// A Rule with the same source already exists!
            // 	messageBox.error(browser.i18n.getMessage("settingsRuleSourceAlreadyExists"));
            // 	return;
            // }

            // if (editingModel) {
            // 	$.extend(editingModel, ruleInfo);

            // 	jQuery("#grdRules").jsGrid("refresh");

            // } else {

            // 	// insert to the grid
            // 	jQuery("#grdRules").jsGrid("insertItem", ruleInfo);
            // }

            // changeTracking.rules = true;

            // modal.modal("hide");
        },
        onClickSaveProxyRules: function () {

            // let rules = settingsGrid.getRules();

            // polyfill.runtimeSendMessage(
            // 	{
            // 		command: "settingsSaveProxyRules",
            // 		proxyRules: rules
            // 	},
            // 	function (response) {
            // 		if (!response) return;
            // 		if (response.success) {
            // 			if (response.message)
            // 				messageBox.success(response.message);

            // 			settings.displayRestartRequired(response.restartRequired);

            // 			// current rules should become equal to saved rules
            // 			settingsUiData.proxyRules = rules;

            // 			changeTracking.rules = false;

            // 		} else {
            // 			if (response.message)
            // 				messageBox.error(response.message);
            // 		}
            // 	},
            // 	function (error) {
            // 		messageBox.error(browser.i18n.getMessage("settingsErrorFailedToSaveRules") + " " + error.message);
            // 	});
        },
        onClickRejectProxyRules: function () {
            // // reset the data
            // settingsUiData.proxyRules = originalSettingsData.proxyRules.slice();
            // settingsGrid.loadRules(settingsUiData.proxyRules);
            // jQuery("#grdRules").jsGrid("refresh");

            // changeTracking.rules = false;

            // // Changes reverted successfully
            // messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
        },
        onClickClearProxyRules: function () {
            // // Are you sure to remove all the rules?
            // messageBox.confirm(browser.i18n.getMessage("settingsRemoveAllRules"),
            // 	function () {
            // 		settingsGrid.loadRules([]);

            // 		changeTracking.rules = true;

            // 		// All rules are removed.<br/>You have to save to apply the changes.
            // 		messageBox.info(browser.i18n.getMessage("settingsRemoveAllRulesSuccess"));
            // 	});
        },
        onClickSaveBypassChanges: function () {
            // let bypassList = settingsGrid.getBypassList();
            // settingsUiData.bypass.bypassList = bypassList;
            // settingsUiData.bypass.enableForAlways = jQuery("#chkEnableBypassForAlwaysEnable").prop("checked");
            // settingsUiData.bypass.enableForSystem = jQuery("#chkEnableBypassForSystemProxy").prop("checked");

            // polyfill.runtimeSendMessage(
            // 	{
            // 		command: "settingsSaveBypass",
            // 		bypass: settingsUiData.bypass
            // 	},
            // 	function (response) {
            // 		if (!response) return;
            // 		if (response.success) {
            // 			if (response.message)
            // 				messageBox.success(response.message);

            // 			settings.displayRestartRequired(response.restartRequired);

            // 			changeTracking.rules = false;

            // 		} else {
            // 			if (response.message)
            // 				messageBox.error(response.message);
            // 		}
            // 	},
            // 	function (error) {
            // 		messageBox.error(browser.i18n.getMessage("settingsErrorFailedToSaveBypass") + " " + error.message);
            // 	});
        },
        onClickRejectBypass: function () {
            // // reset the data
            // settingsUiData.bypass = jQuery.extend({}, originalSettingsData.bypass);
            // settingsGrid.loadBypass(settingsUiData.bypass);

            // changeTracking.bypass = false;

            // // Changes reverted successfully
            // messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
        },
        onClickBackupComplete: function () {

            // let data = JSON.stringify(settingsUiData);
            // settings.downloadData(data, "SmartProxy-FullBackup.json");
        },
        onClickBackupRules: function () {
            // let data = JSON.stringify(
            // 	{
            // 		proxyRules: settingsUiData.proxyRules
            // 	}
            // );
            // settings.downloadData(data, "SmartProxy-RulesBackup.json");
        },
        onClickRestoreBackup: function () {

            // function callRestoreSettings(fileData) {

            // 	polyfill.runtimeSendMessage(
            // 		{
            // 			command: "restoreSettings",
            // 			fileData: fileData
            // 		},
            // 		function (response) {

            // 			if (response.success) {
            // 				if (response.message) {
            // 					messageBox.success(response.message,
            // 						false,
            // 						function () {
            // 							// reload the current settings page
            // 							document.location.reload();
            // 						});
            // 				} else {
            // 					// reload the current settings page
            // 					document.location.reload();
            // 				}
            // 			} else {
            // 				if (response.message) {
            // 					messageBox.error(response.message);
            // 				}
            // 			}
            // 		},
            // 		function (error) {
            // 			// There was an error in restoring the backup
            // 			messageBox.error(browser.i18n.getMessage("settingsRestoreBackupFailed"));
            // 			polyfill.runtimeSendMessage("restoreSettings failed with> " + error.message);
            // 		});
            // }

            // settings.selectFileOnTheFly(jQuery("#frmRestoreBackup")[0],
            // 	"retore-file",
            // 	function (inputElement, files) {
            // 		let file = files[0];

            // 		let reader = new FileReader();
            // 		reader.onerror = function (event) {
            // 			// Failed to read the selected file
            // 			messageBox.error(browser.i18n.getMessage("settingsRestoreBackupFileError"));
            // 		};
            // 		reader.onload = function (event) {
            // 			let textFile = event.target;
            // 			let fileText = textFile.result;

            // 			callRestoreSettings(fileText);
            // 		};
            // 		reader.readAsText(file);
            // 	},
            // 	"application/json");


        },
        onClickClearServerSubscriptions: function () {

            // // Are you sure to remove all the proxy server subscriptions?
            // messageBox.confirm(browser.i18n.getMessage("settingsRemoveAllProxyServerSubscriptions"),
            // 	function () {
            // 		settingsGrid.loadServerSubscriptions([]);
            // 		settingsGrid.reloadActiveProxyServer();

            // 		changeTracking.serverSubscriptions = true;

            // 		// All the proxy server subscriptions are removed.<br/>You have to save to apply the changes.
            // 		messageBox.info(browser.i18n.getMessage("settingsRemoveAllProxyServerSubscriptionsSuccess"));
            // 	});
        },
        onClickSaveServerSubscriptionsChanges: function () {
            // let proxyServerSubscriptions = settingsGrid.getServerSubscriptions();

            // polyfill.runtimeSendMessage(
            // 	{
            // 		command: "settingsSaveProxySubscriptions",
            // 		proxyServerSubscriptions: proxyServerSubscriptions
            // 	},
            // 	function (response) {
            // 		if (!response) return;
            // 		if (response.success) {
            // 			if (response.message)
            // 				messageBox.success(response.message);

            // 			settings.displayRestartRequired(response.restartRequired);

            // 			// current list should become equal to saved list
            // 			settingsUiData.proxyServerSubscriptions = proxyServerSubscriptions;

            // 		} else {
            // 			if (response.message)
            // 				messageBox.error(response.message);
            // 		}
            // 	},
            // 	function (error) {
            // 		messageBox.error(browser.i18n.getMessage("settingsFailedToSaveProxySubscriptions") + " " + error.message);
            // 	});

            // changeTracking.serverSubscriptions = false;
        },
        onClickRejectServerSubscriptionsChanges: function () {
            // // reset the data
            // settingsUiData.proxyServerSubscriptions = originalSettingsData.proxyServerSubscriptions.slice();
            // settingsGrid.loadServerSubscriptions(settingsUiData.proxyServerSubscriptions);
            // jQuery("#grdServerSubscriptions").jsGrid("refresh");
            // settingsGrid.reloadActiveProxyServer();

            // changeTracking.serverSubscriptions = false;

            // // Changes reverted successfully
            // messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
        },
        onClickExportProxyServerOpenBackup: function () {
            // let proxyList = settingsGrid.exportProxyListFormatted();

            // settings.downloadData(proxyList, "SmartProxy-Servers.txt");
        },
        onClickImportProxyServer: function () {
            // let modalContainer = jQuery("#modalImportProxyServer");
            // let append = modalContainer.find("#cmbImportProxyServerOverride_Append").prop("checked");
            // let file, text;

            // if (modalContainer.find("#rbtnImportProxyServer_File").prop("checked")) {
            // 	// file should be selected

            // 	let selectFileElement = modalContainer.find("#btnImportProxyServerSelectFile")[0];

            // 	if (selectFileElement.files.length == 0) {
            // 		// Please select a proxy list file
            // 		messageBox.error(browser.i18n.getMessage("settingsImportProxiesFileNotSelected"));
            // 		return;
            // 	}
            // 	file = selectFileElement.files[0];

            // } else {
            // 	let proxyServerListText = modalContainer.find("#btnImportProxyServerListText").val().trim();
            // 	if (proxyServerListText == "") {
            // 		// Please enter proxy list
            // 		messageBox.error(browser.i18n.getMessage("settingsImportProxyListTextIsEmpty"));
            // 		return;
            // 	}
            // 	text = proxyServerListText;
            // }

            // let proxyServers = settingsGrid.getServers();

            // proxyImporter.importText(text, file,
            // 	append,
            // 	proxyServers,
            // 	function (response) {
            // 		if (!response) return;

            // 		if (response.success) {
            // 			if (response.message)
            // 				messageBox.info(response.message);

            // 			// empty the input
            // 			modalContainer.find("#btnImportProxyServerSelectFile")[0].value = "";
            // 			modalContainer.find("#btnImportProxyServerListText").val("");

            // 			let servers = response.result;
            // 			settingsGrid.loadServers(servers);

            // 			// close the window
            // 			modalContainer.modal("hide");
            // 		} else {
            // 			if (response.message)
            // 				messageBox.error(response.message);
            // 		}
            // 	},
            // 	function (error) {
            // 		let message = "";
            // 		if (error && error.message)
            // 			message = error.message;
            // 		messageBox.error(browser.i18n.getMessage("settingsImportProxyServersFailed") + " " + message);
            // 	});

        },
        onClickImportRules: function () {
            // 	let modalContainer = jQuery("#modalImportRules");
            // 	let selectFileElement = modalContainer.find("#btnImportRulesSelectFile")[0];

            // 	if (selectFileElement.files.length == 0) {
            // 		// Please select a rules file
            // 		messageBox.error(browser.i18n.getMessage("settingsRulesFileNotSelected"));
            // 		return;
            // 	}

            // 	let selectFile = selectFileElement.files[0];

            // 	let append = modalContainer.find("#cmbImportRulesOverride_Append").prop("checked");
            // 	let sourceType = modalContainer.find("#cmbImportRulesFormat").val();

            // 	let proxyRules = settingsGrid.getRules();

            // 	let importFunction;
            // 	if (sourceType == "autoproxy") {
            // 		importFunction = ruleImporter.importAutoProxy;
            // 	} else if (sourceType == "switchy") {
            // 		importFunction = ruleImporter.importSwitchyRules;
            // 	} else {
            // 		messageBox.warning(browser.i18n.getMessage("settingsSourceTypeNotSelected"));
            // 	}

            // 	if (importFunction)
            // 		importFunction(selectFile,
            // 			append,
            // 			proxyRules,
            // 			function (response) {
            // 				if (!response) return;

            // 				if (response.success) {
            // 					if (response.message)
            // 						messageBox.info(response.message);

            // 					// empty the file input
            // 					selectFileElement.value = "";

            // 					let rules = response.result;
            // 					settingsGrid.loadRules(rules);

            // 					// close the window
            // 					modalContainer.modal("hide");
            // 				} else {
            // 					if (response.message)
            // 						messageBox.error(response.message);
            // 				}
            // 			},
            // 			function (error) {
            // 				let message = "";
            // 				if (error && error.message)
            // 					message = error.message;
            // 				messageBox.error(browser.i18n.getMessage("settingsImportRulesFailed") + " " + message);
            // 			});
        }
    };

    //#endregion

}

settingsPage.initialize();