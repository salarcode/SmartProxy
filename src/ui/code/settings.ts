import { CommonUi } from "./CommonUi";
import { PolyFill } from "../../lib/PolyFill";
import { Messages, SettingsPageInternalDataType, proxyServerProtocols, proxyServerSubscriptionObfuscate, ProxyServerForProtocol, ResultHolder, ProxyRuleType } from "../../core/definitions";
import { messageBox, jQuery } from "../../lib/External";
import { environment } from "../../lib/environment";
import { SettingsConfig, ProxyServer, BypassOptions, GeneralOptions, ProxyRule } from "../../core/Settings";
import { Utils } from "../../lib/Utils";
import { ProxyImporter } from "../../lib/ProxyImporter";
import { RuleImporter } from "../../lib/RuleImporter";

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
        jQuery("#cmdRuleType").change(settingsPage.uiEvents.onChangeRuleType);

        jQuery("#chkRuleGeneratePattern").change(settingsPage.uiEvents.onChangeRuleGeneratePattern);

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
                    name: "name", data: "name", title: browser.i18n.getMessage("settingsServersGridColName")
                },
                {
                    name: "protocol", data: "protocol", title: browser.i18n.getMessage("settingsServersGridColProtocol"),
                },
                {
                    name: "host", data: "host", title: browser.i18n.getMessage("settingsServersGridColServer"),
                },
                {
                    name: "port", data: "port", type: "num", title: browser.i18n.getMessage("settingsServersGridColPort"),
                },
                {
                    "data": null,
                    "defaultContent": "<button class='btn btn-sm btn-success' id='btnServersEdit'>Edit</button> <button class='btn btn-sm btn-danger' id='btnServersRemove'><i class='fas fa-times'></button>",
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
                    name: "ruleType", data: "ruleTypeName", title: browser.i18n.getMessage("settingsRulesGridColRuleType")
                },
                {
                    name: "sourceDomain", data: "sourceDomain", title: browser.i18n.getMessage("settingsRulesGridColSource")
                },
                {
                    name: "rule", data: "rule", title: browser.i18n.getMessage("settingsRulesGridColRule")
                },
                {
                    name: "enabled", data: "enabled", title: browser.i18n.getMessage("settingsRulesGridColEnabled")
                },
                {
                    name: "proxy", data: "proxy", title: browser.i18n.getMessage("settingsRulesGridColProxy"),
                    defaultContent: browser.i18n.getMessage("settingsRulesProxyDefault")
                },
                {
                    width: "70px",
                    "data": null,
                    "defaultContent": "<button class='btn btn-sm btn-success' id='btnRulesEdit'>Edit</button> <button class='btn btn-sm btn-danger' id='btnRulesRemove'><i class='fas fa-times'></button>",
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
                    name: "name", data: "name", title: browser.i18n.getMessage("settingsServerSubscriptionsGridColName")
                },
                {
                    name: "url", data: "url", title: browser.i18n.getMessage("settingsServerSubscriptionsGridColUrl")
                },
                {
                    name: "totalCount", data: "totalCount", type: "num", title: browser.i18n.getMessage("settingsServerSubscriptionsGridColCount")
                },
                {
                    name: "enabled", data: "enabled", title: browser.i18n.getMessage("settingsServerSubscriptionsGridColEnabled"),
                },
                {
                    "data": null,
                    "defaultContent": "<button class='btn btn-sm btn-success' onclick='settingsPage.onSubscriptionsEditClick(event)'>Edit</button> <button class='btn btn-sm btn-danger' onclick='settingsPage.onSubscriptionsRemoveClick(event)'><i class='fas fa-times'></button>",
                }
            ],
        });
        settingsPage.grdServerSubscriptions.draw();

        if (settingsPage.currentSettings) {
            if (settingsPage.currentSettings.proxyServers)
                settingsPage.loadServers(settingsPage.currentSettings.proxyServers);

            if (settingsPage.currentSettings.proxyRules)
                settingsPage.loadRules(settingsPage.currentSettings.proxyRules);

            if (settingsPage.currentSettings.proxyServerSubscriptions)
                settingsPage.loadServerSubscriptions(settingsPage.currentSettings.proxyServerSubscriptions);
        }
        else {
            settingsPage.loadServers([]);
            settingsPage.loadRules([]);
            settingsPage.loadServerSubscriptions([]);
        }

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

    //#region Servers tab functions ------------------------------


    private static loadServers(servers: any[]) {
        if (!this.grdServers)
            return;
        this.grdServers.clear();
        this.grdServers.rows.add(servers).draw('full-hold');

        // binding the events for all the rows
        this.refreshServersGridAllRows();
    }

    private static readServers(): any[] {
        return this.grdServers.data().toArray();
    }

    private static readSelectedServer(e?: any): any {
        let dataItem;

        if (e && e.target)
            dataItem = this.grdServers.row(jQuery(e.target).parents('tr')).data();
        else
            dataItem = this.grdServers.row({ selected: true }).data();

        return dataItem;
    }

    private static readSelectedServerRow(e: any): any {
        if (e && e.target)
            return this.grdServers.row(jQuery(e.target).parents('tr'));

        return null;
    }

    private static refreshServersGrid() {
        let currentRow = this.grdServers.row();
        if (currentRow)
            // displaying the possible data change
            settingsPage.refreshServersGridRow(currentRow, true);

        this.grdServers.draw('full-hold');
    }

    private static refreshServersGridRow(row, invalidate?) {
        if (!row)
            return;
        if (invalidate)
            row.invalidate();

        let rowElement = jQuery(row.node());

        // NOTE: to display update data the row should be invalidated
        // and invalidated row loosed the event bindings.
        // so we need to bind the events each time data changes.

        rowElement.find("#btnServersRemove").on("click", settingsPage.uiEvents.onServersRemoveClick);
        rowElement.find("#btnServersEdit").on("click", settingsPage.uiEvents.onServersEditClick);
    }

    private static refreshServersGridAllRows() {
        var nodes = this.grdServers.rows().nodes();
        for (let index = 0; index < nodes.length; index++) {
            const rowElement = jQuery(nodes[index]);

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

    private static loadActiveProxyServer(proxyServers?: ProxyServer[], serverSubscriptions?: any[]) {
        let activeProxyServer = this.currentSettings.activeProxyServer;

        let activeProxyName = "";
        if (activeProxyServer != null) {
            activeProxyName = activeProxyServer.name;
        }

        let cmbActiveProxyServer = jQuery("#cmbActiveProxyServer");

        // remove previous items
        cmbActiveProxyServer.children().remove();

        // populate
        this.populateProxyServersToComboBox(cmbActiveProxyServer, activeProxyName, proxyServers, serverSubscriptions);
    }

    /** find proxy from Servers or Subscriptions */
    private static findProxyServerByName(name: string) {
        let proxyServers = settingsPage.readServers();
        let serverSubscriptions = settingsPage.readServerSubscriptions();

        let proxy = proxyServers.find(item => item.name === name);
        if (proxy !== undefined) return proxy;

        for (let subscription of serverSubscriptions) {
            proxy = subscription.proxies.find(item => item.name === name);
            if (proxy !== undefined) return proxy;
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

    //#region Rules tab functions ------------------------------

    private static loadRules(rules: ProxyRule[]) {
        if (!this.grdRules)
            return;
        this.grdRules.clear();

        // prototype needed
        let fixedRules = ProxyRule.assignArray(rules);
        this.grdRules.rows.add(fixedRules).draw('full-hold');

        // binding the events for all the rows
        this.refreshRulesGridAllRows();
    }

    private static readRules(): any[] {
        return this.grdRules.data().toArray();
    }

    private static readSelectedRule(e?: any): any {
        let dataItem;

        if (e && e.target)
            dataItem = this.grdRules.row(jQuery(e.target).parents('tr')).data();
        else
            dataItem = this.grdRules.row({ selected: true }).data();

        return dataItem;
    }

    private static readSelectedRuleRow(e: any): any {
        if (e && e.target)
            return this.grdRules.row(jQuery(e.target).parents('tr'));

        return null;
    }

    private static refreshRulesGrid() {
        let currentRow = this.grdRules.row();
        if (currentRow)
            // displaying the possible data change
            settingsPage.refreshRulesGridRow(currentRow, true);

        this.grdRules.draw('full-hold');
    }

    private static refreshRulesGridRow(row, invalidate?) {
        if (!row)
            return;
        if (invalidate)
            row.invalidate();

        let rowElement = jQuery(row.node());

        // NOTE: to display update data the row should be invalidated
        // and invalidated row loosed the event bindings.
        // so we need to bind the events each time data changes.

        rowElement.find("#btnRulesRemove").on("click", settingsPage.uiEvents.onRulesRemoveClick);
        rowElement.find("#btnRulesEdit").on("click", settingsPage.uiEvents.onRulesEditClick);
    }

    private static refreshRulesGridAllRows() {
        var nodes = this.grdRules.rows().nodes();
        for (let index = 0; index < nodes.length; index++) {
            const rowElement = jQuery(nodes[index]);

            rowElement.find("#btnRulesRemove").on("click", settingsPage.uiEvents.onRulesRemoveClick);
            rowElement.find("#btnRulesEdit").on("click", settingsPage.uiEvents.onRulesEditClick);
        }
    }

    private static insertNewRuleInGrid(newRule: ProxyRule) {
        try {

            let row = this.grdRules.row
                .add(newRule)
                .draw('full-hold');

            // binding the events
            settingsPage.refreshRulesGridRow(row);

        } catch (error) {
            PolyFill.runtimeSendMessage("insertNewRuleInGrid failed! > " + error);
            throw error;
        }
    }

    //#endregion

    //#region ServerSubscriptions tab functions --------------

    private static loadServerSubscriptions(rules: any[]) {
        if (!this.grdServerSubscriptions)
            return;
        this.grdServerSubscriptions.clear();
        this.grdServerSubscriptions.rows.add(rules);
    }

    private static readServerSubscriptions(): any[] {
        return this.grdServerSubscriptions.data().toArray();
    }

    //#endregion

    /** Load/Reload the action proxy combobox */

    //private static 


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

    /** Used for ActiveProxy and ... */
    static populateProxyServersToComboBox(comboBox: any, selectedProxyName?: string, proxyServers?: ProxyServer[], serverSubscriptions?: any[]) {
        if (!comboBox) return;
        if (!proxyServers)
            proxyServers = settingsPage.readServers();
        if (!serverSubscriptions)
            serverSubscriptions = settingsPage.readServerSubscriptions();

        let hasSelectedItem = false;

        // adding select options
        proxyServers.forEach((proxyServer: ProxyServer) => {

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

    private static populateServerModal(modalContainer: any, server?: ProxyServer) {

        if (server) {

            modalContainer.find("#txtServerName").val(server.name);
            modalContainer.find("#txtServerAddressHttp").val(server.host);
            modalContainer.find("#txtServerPortHttp").val(server.port);
            modalContainer.find("#cmdServerProtocolHttp").val(server.protocol);
            modalContainer.find("#chkServerProxyDNSHttp").prop('checked', server.proxyDNS);
            modalContainer.find("#txtServerUsernameHttp").val(server.username);
            modalContainer.find("#txtServerPasswordHttp").val(server.password);
        } else {
            modalContainer.find("#txtServerName").val(this.generateNewServerName());

            modalContainer.find("#txtServerAddress").val("127.0.0.1");
            modalContainer.find("#txtServerPort").val("");
            modalContainer.find("#cmdServerProtocol").val("HTTP");
            modalContainer.find("#chkServerProxyDNS").prop('checked', false);
            modalContainer.find("#txtServerUsername").val("");
            modalContainer.find("#txtServerPassword").val("");
        }
    }

    private static readServerModel(modalContainer: any): ProxyServer {
        let proxy = new ProxyServer();

        proxy.name = modalContainer.find("#txtServerName").val().trim();
        proxy.host = modalContainer.find("#txtServerAddress").val().trim();
        proxy.port = modalContainer.find("#txtServerPort").val();
        proxy.protocol = modalContainer.find("#cmdServerProtocol").val();
        proxy.username = modalContainer.find("#txtServerUsername").val().trim();
        proxy.password = modalContainer.find("#txtServerPassword").val().trim();
        proxy.proxyDNS = modalContainer.find("#chkServerProxyDNS").prop("checked");

        return proxy;
    }

    private static populateRuleModal(modalContainer: any, proxyRule?: ProxyRule) {
        // populate servers
        let cmdRuleProxyServer = modalContainer.find("#cmdRuleProxyServer");
        cmdRuleProxyServer.empty();

        // the default value which is empty string
        jQuery("<option>")
            .attr("value", "")
            // [General]
            .text(browser.i18n.getMessage("settingsRulesProxyDefault"))
            .appendTo(cmdRuleProxyServer);

        if (proxyRule) {

            modalContainer.find("#chkRuleGeneratePattern").prop('checked', proxyRule.autoGeneratePattern);
            modalContainer.find("#cmdRuleType").val(proxyRule.ruleType);

            modalContainer.find("#txtRuleSource").val(proxyRule.sourceDomain);
            modalContainer.find("#txtRuleMatchPattern").val(proxyRule.rulePattern);
            modalContainer.find("#txtRuleUrlRegex").val(proxyRule.ruleRegex);
            modalContainer.find("#txtRuleUrlExact").val(proxyRule.ruleExact);
            modalContainer.find("#chkRuleEnabled").prop('checked', proxyRule.enabled);

            let proxyServerName = null;
            if (proxyRule.proxy)
                proxyServerName = proxyRule.proxy.name;

            settingsPage.populateProxyServersToComboBox(cmdRuleProxyServer, proxyServerName);

        } else {

            modalContainer.find("#chkRuleGeneratePattern").prop('checked', true);
            modalContainer.find("#cmdRuleType").val(ProxyRuleType.MatchPattern);

            modalContainer.find("#txtRuleSource").val("");
            modalContainer.find("#txtRuleMatchPattern").val("");
            modalContainer.find("#txtRuleUrlRegex").val("");
            modalContainer.find("#txtRuleUrlExact").val("");
            modalContainer.find("#chkRuleEnabled").prop('checked', true);

            settingsPage.populateProxyServersToComboBox(cmdRuleProxyServer, null);
        }

        settingsPage.updateProxyRuleModal();
    }

    private static updateProxyRuleModal() {
        let autoPattern = jQuery("#chkRuleGeneratePattern").prop('checked');
        if (autoPattern) {
            jQuery("#txtRuleMatchPattern").attr('disabled', 'disabled');
        }
        else {
            jQuery("#txtRuleMatchPattern").removeAttr('disabled');
        }

        let ruleType = jQuery("#cmdRuleType").val();

        if (ruleType == ProxyRuleType.MatchPattern) {
            jQuery("#divRuleMatchPattern").show();
            jQuery("#divRuleGeneratePattern").show();
            jQuery("#divRuleUrlRegex").hide();
            jQuery("#divRuleUrlExact").hide();
        }
        else if (ruleType == ProxyRuleType.Regex) {
            jQuery("#divRuleMatchPattern").hide();
            jQuery("#divRuleGeneratePattern").hide();
            jQuery("#divRuleUrlRegex").show();
            jQuery("#divRuleUrlExact").hide();
        }
        else {
            jQuery("#divRuleMatchPattern").hide();
            jQuery("#divRuleGeneratePattern").hide();
            jQuery("#divRuleUrlRegex").hide();
            jQuery("#divRuleUrlExact").show();
        }
    }

    private static readProxyRuleModel(modalContainer: any): ProxyRule {
        let selectedProxyName = modalContainer.find("#cmdRuleProxyServer").val();
        let selectedProxy = null;

        if (selectedProxyName)
            selectedProxy = settingsPage.findProxyServerByName(selectedProxyName);

        let ruleInfo = new ProxyRule();
        ruleInfo.autoGeneratePattern = modalContainer.find("#chkRuleGeneratePattern").prop('checked');
        ruleInfo.ruleType = modalContainer.find("#cmdRuleType").val();
        ruleInfo.sourceDomain = modalContainer.find("#txtRuleSource").val();
        ruleInfo.rulePattern = modalContainer.find("#txtRuleMatchPattern").val();
        ruleInfo.ruleRegex = modalContainer.find("#txtRuleUrlRegex").val();
        ruleInfo.ruleExact = modalContainer.find("#txtRuleUrlExact").val();
        ruleInfo.proxy = selectedProxy;
        ruleInfo.enabled = modalContainer.find("#chkRuleEnabled").prop("checked");
        return ruleInfo;
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
                function (response: ResultHolder) {
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
            let proxyName = jQuery("#cmbActiveProxyServer").val();

            let server = settingsPage.findProxyServerByName(proxyName);

            // this can be null
            settingsPage.currentSettings.activeProxyServer = server;
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

            let modal = jQuery("#modalModifyProxyServer");
            let editingModel = modal.data("editing");

            let serverInputInfo = settingsPage.readServerModel(modal);

            if (!serverInputInfo.name) {
                messageBox.error(browser.i18n.getMessage("settingsServerNameRequired"));
                return;
            }

            // ------------------
            let editingServerName = null;
            if (editingModel)
                editingServerName = editingModel.name;

            let existingServers = settingsPage.readServers();
            let serverExists = existingServers.some(server => {
                return (server.name === serverInputInfo.name && server.name != editingServerName);
            });
            if (serverExists) {
                // A Server with the same name already exists!
                messageBox.error(browser.i18n.getMessage("settingsServerNameExists"));
                return;
            }

            // ------------------
            if (!serverInputInfo.host) {
                messageBox.error(browser.i18n.getMessage("settingsServerServerAddressIsEmpty"));
                return;
            }
            if (!serverInputInfo.port || serverInputInfo.port <= 0) {
                messageBox.error(browser.i18n.getMessage("settingsServerPortNoInvalid"));
                return;
            }

            if (!serverInputInfo.username && serverInputInfo.password) {
                messageBox.error(browser.i18n.getMessage("settingsServerAuthenticationInvalid"));
                return;
            }

            if (editingModel) {
                // just copy the values
                jQuery.extend(editingModel, serverInputInfo);

                settingsPage.refreshServersGrid();

            } else {

                // insert to the grid
                settingsPage.insertNewServerInGrid(serverInputInfo);
            }

            settingsPage.changeTracking.servers = true;

            modal.modal("hide");

            settingsPage.loadActiveProxyServer();
        },
        onServersEditClick: function (e) {
            let item = settingsPage.readSelectedServer(e);
            if (!item)
                return;

            let modal = jQuery("#modalModifyProxyServer");
            modal.data("editing", item);

            settingsPage.populateServerModal(modal, item);

            modal.modal("show");
            modal.find("#txtServerAddress").focus();
        },
        onServersRemoveClick: function (e) {
            var row = settingsPage.readSelectedServerRow(e);
            if (!row)
                return;

            messageBox.confirm(browser.i18n.getMessage("settingsConfirmRemoveProxyServer"),
                () => {

                    // remove then redraw the grid page
                    row.remove().draw('full-hold');

                    settingsPage.changeTracking.servers = true;

                    settingsPage.loadActiveProxyServer();
                });
        },
        onClickSaveProxyServers: function () {

            // update the active proxy server data
            jQuery("#cmbActiveProxyServer").trigger("change");
            let saveData = {
                proxyServers: settingsPage.readServers(),
                activeProxyServer: settingsPage.currentSettings.activeProxyServer
            };

            PolyFill.runtimeSendMessage(
                {
                    command: Messages.SettingsPageSaveProxyServers,
                    saveData: saveData
                },
                (response: ResultHolder) => {
                    if (!response) return;
                    if (response.success) {
                        if (response.message)
                            messageBox.success(response.message);

                        // current server should become equal to saved servers
                        settingsPage.currentSettings.proxyServers = saveData.proxyServers;
                        settingsPage.currentSettings.activeProxyServer = saveData.activeProxyServer;

                        settingsPage.changeTracking.servers = false;
                        settingsPage.changeTracking.activeProxy = false;

                    } else {
                        if (response.message)
                            messageBox.error(response.message);
                    }
                },
                function (error) {
                    messageBox.error(browser.i18n.getMessage("settingsErrorFailedToSaveServers") + " " + error.message);
                });

        },
        onClickRejectProxyServers: function () {
            // reset the data
            settingsPage.currentSettings.proxyServers = settingsPage.originalSettings.proxyServers.slice();
            settingsPage.loadServers(settingsPage.currentSettings.proxyServers);
            settingsPage.loadActiveProxyServer();

            settingsPage.changeTracking.servers = false;

            // Changes reverted successfully
            messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
        },
        onClickClearProxyServers: function () {
            // Are you sure to remove all the servers?
            messageBox.confirm(browser.i18n.getMessage("settingsRemoveAllProxyServers"),
                function () {
                    settingsPage.loadServers([]);
                    settingsPage.loadActiveProxyServer();

                    settingsPage.changeTracking.servers = true;

                    // All the proxy servers are removed.<br/>You have to save to apply the changes.
                    messageBox.info(browser.i18n.getMessage("settingsRemoveAllProxyServersSuccess"));
                });
        },
        onClickAddProxyRule: function () {
            let modal = jQuery("#modalModifyRule");
            modal.data("editing", null);

            // update form
            settingsPage.populateRuleModal(modal, null);

            modal.modal("show");
            modal.find("#txtRuleSource").focus();
        },
        onChangeRuleGeneratePattern: function () {
            settingsPage.updateProxyRuleModal();
        },
        onChangeRuleType: function () {
            settingsPage.updateProxyRuleModal();
        },
        onClickSubmitProxyRule: function () {

            let modal = jQuery("#modalModifyRule");
            let editingModel = modal.data("editing");

            let ruleInfo = settingsPage.readProxyRuleModel(modal);

            let source = ruleInfo.sourceDomain;
            if (!source) {
                // Please specify the source of the rule!
                messageBox.error(browser.i18n.getMessage("settingsRuleSourceRequired"));
                return;
            }

            if (!Utils.isValidHost(source)) {
                // source is invalid, source name should be something like 'google.com'
                messageBox.error(browser.i18n.getMessage("settingsRuleSourceInvalid"));
                return;
            }

            if (Utils.urlHasSchema(source)) {
                let extractedHost = Utils.extractHostFromUrl(source);
                if (extractedHost == null || !Utils.isValidHost(extractedHost)) {

                    // `Host name '${extractedHost}' is invalid, host name should be something like 'google.com'`
                    messageBox.error(
                        browser.i18n.getMessage("settingsRuleHostInvalid")
                            .replace("{0}", extractedHost)
                    );
                    return;
                }
            } else {
                // this extraction is to remove paths from rules, e.g. google.com/test/

                let extractedHost = Utils.extractHostFromUrl("http://" + source);
                if (extractedHost == null || !Utils.isValidHost(extractedHost)) {

                    // `Host name '${extractedHost}' is invalid, host name should be something like 'google.com'`
                    messageBox.error(
                        browser.i18n.getMessage("settingsRuleHostInvalid")
                            .replace("{0}", extractedHost)
                    );
                    return;
                }
            }

            if (ruleInfo.ruleType == ProxyRuleType.MatchPattern) {

                if (ruleInfo.autoGeneratePattern) {
                    // the pattern
                    // TODO: Feature #41 Allow entering/modifying custom pattern for rules 
                    ruleInfo.rulePattern = Utils.hostToMatchPattern(source);
                }
            }
            else if (ruleInfo.ruleType == ProxyRuleType.Regex) {
                try {

                    new RegExp(ruleInfo.ruleExact);

                } catch (error) {
                    // Regex rule '{0}' is not valid
                    messageBox.error(
                        browser.i18n.getMessage("AAAAAAAAAAAAAAAAAAAAA").replace("{0}", ruleInfo.ruleExact)
                    );
                    return;
                }
            }
            else {
                try {

                    new URL(ruleInfo.ruleExact);

                } catch (error) {
                    // Url '{0}' is not valid
                    messageBox.error(
                        browser.i18n.getMessage("AAAAAAAAAAAAAAAAAAAAA").replace("{0}", ruleInfo.ruleExact)
                    );
                    return;
                }
            }

            // ------------------
            let editingSource = null;
            if (editingModel)
                editingSource = editingModel.sourceDomain;

            let existingRules = settingsPage.readRules();
            let ruleExists = existingRules.some(rule => {
                return (rule.sourceDomain === ruleInfo.sourceDomain && rule.sourceDomain != editingSource);
            });
            if (ruleExists) {
                // A Rule with the same source already exists!
                messageBox.error(browser.i18n.getMessage("settingsRuleSourceAlreadyExists"));
                return;
            }

            if (editingModel) {
                jQuery.extend(editingModel, ruleInfo);


                settingsPage.refreshRulesGrid();

            } else {

                // insert to the grid
                settingsPage.insertNewRuleInGrid(ruleInfo);
            }

            settingsPage.changeTracking.rules = true;

            modal.modal("hide");
        },
        onRulesEditClick: function (e) {
            let item = settingsPage.readSelectedRule(e);
            if (!item)
                return;

            let modal = jQuery("#modalModifyRule");
            modal.data("editing", item);

            settingsPage.populateRuleModal(modal, item);

            modal.modal("show");
            modal.find("#txtRuleSource").focus();
        },
        onRulesRemoveClick: function (e) {
            var row = settingsPage.readSelectedRuleRow(e);
            if (!row)
                return;

            messageBox.confirm(browser.i18n.getMessage("settingsConfirmRemoveProxyRule"),
                () => {

                    // remove then redraw the grid page
                    row.remove().draw('full-hold');

                    settingsPage.changeTracking.rules = true;
                });
        },
        onClickSaveProxyRules: function () {

            let rules = settingsPage.readRules();

            PolyFill.runtimeSendMessage(
                {
                    command: Messages.SettingsPageSaveProxyRules,
                    proxyRules: rules
                },
                function (response: ResultHolder) {
                    if (!response) return;
                    if (response.success) {
                        if (response.message)
                            messageBox.success(response.message);

                        // current rules should become equal to saved rules
                        settingsPage.currentSettings.proxyRules = rules;

                        settingsPage.changeTracking.rules = false;

                    } else {
                        if (response.message)
                            messageBox.error(response.message);
                    }
                },
                function (error) {
                    messageBox.error(browser.i18n.getMessage("settingsErrorFailedToSaveRules") + " " + error.message);
                });
        },
        onClickRejectProxyRules: function () {
            // reset the data
            settingsPage.currentSettings.proxyRules = settingsPage.originalSettings.proxyRules.slice();
            settingsPage.loadRules(settingsPage.currentSettings.proxyRules);
            settingsPage.refreshRulesGrid();

            settingsPage.changeTracking.rules = false;

            // Changes reverted successfully
            messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
        },
        onClickClearProxyRules: function () {
            // Are you sure to remove all the rules?
            messageBox.confirm(browser.i18n.getMessage("settingsRemoveAllRules"),
                function () {
                    debugger;
                    settingsPage.loadRules([]);

                    settingsPage.changeTracking.rules = true;

                    // All rules are removed.<br/>You have to save to apply the changes.
                    messageBox.info(browser.i18n.getMessage("settingsRemoveAllRulesSuccess"));
                });
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
            // 	function (response: ResultHolder) {
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
            // 		function (response: ResultHolder) {

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
            // 	function (response: ResultHolder) {
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
            let proxyList = settingsPage.exportServersListFormatted();

            CommonUi.downloadData(proxyList, "SmartProxy-Servers.txt");
        },
        onClickImportProxyServer: function () {
            let modalContainer = jQuery("#modalImportProxyServer");
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

            let proxyServers = settingsPage.readServers();

            ProxyImporter.importText(text, file,
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
                        settingsPage.loadServers(servers);
                        settingsPage.loadActiveProxyServer();

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

        },
        onClickImportRules: function () {
            let modalContainer = jQuery("#modalImportRules");
            let selectFileElement = modalContainer.find("#btnImportRulesSelectFile")[0];

            if (selectFileElement.files.length == 0) {
                // Please select a rules file
                messageBox.error(browser.i18n.getMessage("settingsRulesFileNotSelected"));
                return;
            }

            let selectFile = selectFileElement.files[0];

            let append = modalContainer.find("#cmbImportRulesOverride_Append").prop("checked");
            let sourceType = modalContainer.find("#cmbImportRulesFormat").val();

            let proxyRules = settingsPage.readRules();

            let importFunction: Function;
            if (sourceType == "autoproxy") {
                importFunction = RuleImporter.importAutoProxy;
            } else if (sourceType == "switchy") {
                importFunction = RuleImporter.importSwitchyRules;
            } else {
                messageBox.warning(browser.i18n.getMessage("settingsSourceTypeNotSelected"));
                return;
            }

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
                        settingsPage.loadRules(rules);

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
        }
    };

    //#endregion

}

settingsPage.initialize();