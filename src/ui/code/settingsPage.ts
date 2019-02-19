/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2019 Salar Khalilzadeh <salar2k@gmail.com>
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
import { messageBox, jQuery } from "../../lib/External";
import { environment, browser } from "../../lib/environment";
import { Utils } from "../../lib/Utils";
import { ProxyImporter } from "../../lib/ProxyImporter";
import { RuleImporter } from "../../lib/RuleImporter";
import { SettingsConfig, Messages, SettingsPageInternalDataType, proxyServerProtocols, proxyServerSubscriptionObfuscate, ProxyServer, ProxyRule, ProxyRuleType, ProxyServerSubscription, GeneralOptions, BypassOptions, ResultHolder } from "../../core/definitions";

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
        serverSubscriptions: false,
        bypass: false
    };

    public static initialize() {

        CommonUi.onDocumentReady(this.bindEvents);
        CommonUi.onDocumentReady(this.initializeGrids);
        CommonUi.onDocumentReady(this.initializeUi);

        PolyFill.runtimeSendMessage(Messages.SettingsPageGetInitialData,
            (dataForSettings: SettingsPageInternalDataType) => {
                if (!dataForSettings)
                    return;

                settingsPage.populateDataForSettings(dataForSettings);
            },
            error => {
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

        jQuery("#chkSyncSettings").change(settingsPage.uiEvents.onSyncSettingsChanged);

        jQuery("#btnIgnoreRequestFailuresForDomains").click(settingsPage.uiEvents.onClickIgnoreRequestFailuresForDomains);

        jQuery("#btnSubmitIgnoreRequestDomains").click(settingsPage.uiEvents.onClickSubmitIgnoreRequestDomains);

        jQuery("#btnViewShortcuts").click(settingsPage.uiEvents.onClickViewShortcuts);

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
        jQuery("#btnAddServerSubscription").click(settingsPage.uiEvents.onClickAddServerSubscription);

        jQuery("#btnSaveServerSubscription").click(settingsPage.uiEvents.onClickSaveServerSubscription);

        jQuery("#btnTestServerSubscription").click(settingsPage.uiEvents.onClickTestServerSubscription);

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
                    "defaultContent": "<button class='btn btn-sm btn-success' id='btnSubscriptionsEdit'>Edit</button> <button class='btn btn-sm btn-danger' id='btnSubscriptionsRemove'><i class='fas fa-times'></button>",
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

        jQuery("#tabSettings").on('shown.bs.tab', e => {
            // DataTables columns are not adjusted when hidden, needs to be done manually
            settingsPage.grdServers.columns.adjust().draw();
            settingsPage.grdRules.columns.adjust().draw();
            settingsPage.grdServerSubscriptions.columns.adjust().draw();
        });
    }

    private static initializeUi() {
        if (environment.chrome) {
            jQuery("#divAlertChrome").show();
            jQuery(".ff-only").show();

            // not supported by Chrome
            jQuery("#chkEnableBypassForSystemProxy").attr("disabled", "disabled");
        } else {
            jQuery("#divAlertFirefox").show();
            jQuery(".ff-only").hide();
        }

        // the default values
        let cmbServerSubscriptionProtocol = jQuery("#cmbServerSubscriptionProtocol");

        // the default values
        let cmbServerSubscriptionObfuscation = jQuery("#cmbServerSubscriptionObfuscation");

        jQuery("<option>").attr("value", "")
            // (Auto detect with HTTP fallback)
            .text(browser.i18n.getMessage("settingsServerSubscriptionProtocolDefault"))
            .appendTo(cmbServerSubscriptionProtocol);
        proxyServerProtocols.forEach(item => {
            jQuery("<option>").attr("value", item)
                .text(item)
                .appendTo(cmbServerSubscriptionProtocol);
        });

        proxyServerSubscriptionObfuscate.forEach(item => {
            jQuery("<option>").attr("value", item)
                .text(item)
                .appendTo(cmbServerSubscriptionObfuscation);
        });
    }

    //#region Populate UI ----------------------

    /** Display General UI data */
    private static populateSettingsUiData(settingsData: SettingsPageInternalDataType) {
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
    private static populateProxyServersToComboBox(comboBox: any, selectedProxyName?: string, proxyServers?: ProxyServer[], serverSubscriptions?: any[], dontIncludeAuthServers?: boolean) {
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

                    if (dontIncludeAuthServers && proxyServer.username)
                        // exit loop
                        return;

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

    private static populateServerModal(modalContainer: any, server?: ProxyServer) {

        if (server) {

            modalContainer.find("#txtServerName").val(server.name);
            modalContainer.find("#txtServerAddress").val(server.host);
            modalContainer.find("#txtServerPort").val(server.port);
            modalContainer.find("#cmdServerProtocol").val(server.protocol);
            modalContainer.find("#chkServerProxyDNS").prop('checked', server.proxyDNS);
            modalContainer.find("#txtServerUsername").val(server.username);
            modalContainer.find("#txtServerPassword").val(server.password);
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

            settingsPage.populateProxyServersToComboBox(cmdRuleProxyServer, proxyServerName, null, null, true);

        } else {

            modalContainer.find("#chkRuleGeneratePattern").prop('checked', true);
            modalContainer.find("#cmdRuleType").val(ProxyRuleType.MatchPatternHost);

            modalContainer.find("#txtRuleSource").val("");
            modalContainer.find("#txtRuleMatchPattern").val("");
            modalContainer.find("#txtRuleUrlRegex").val("");
            modalContainer.find("#txtRuleUrlExact").val("");
            modalContainer.find("#chkRuleEnabled").prop('checked', true);

            settingsPage.populateProxyServersToComboBox(cmdRuleProxyServer, null, null, null, true);
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

        if (ruleType == ProxyRuleType.MatchPatternHost ||
            ruleType == ProxyRuleType.MatchPatternUrl) {
            jQuery("#divRuleMatchPattern").show();
            jQuery("#divRuleGeneratePattern").show();
            jQuery("#divRuleUrlRegex").hide();
            jQuery("#divRuleUrlExact").hide();
        }
        else if (ruleType == ProxyRuleType.RegexHost ||
            ruleType == ProxyRuleType.RegexUrl) {
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
        ruleInfo.ruleType = parseInt(modalContainer.find("#cmdRuleType").val());
        ruleInfo.sourceDomain = modalContainer.find("#txtRuleSource").val();
        ruleInfo.rulePattern = modalContainer.find("#txtRuleMatchPattern").val();
        ruleInfo.ruleRegex = modalContainer.find("#txtRuleUrlRegex").val();
        ruleInfo.ruleExact = modalContainer.find("#txtRuleUrlExact").val();
        ruleInfo.proxy = selectedProxy;
        ruleInfo.enabled = modalContainer.find("#chkRuleEnabled").prop("checked");
        return ruleInfo;
    }

    private static populateServerSubscriptionsModal(modalContainer: any, subscription?: ProxyServerSubscription) {
        if (subscription) {
            modalContainer.find("#txtName").val(subscription.name);
            modalContainer.find("#txtUrl").val(subscription.url);
            modalContainer.find("#numRefreshRate").val(subscription.refreshRate);
            modalContainer.find("#chkEnabled").prop('checked', subscription.enabled);
            modalContainer.find("#cmbServerSubscriptionProtocol").val(subscription.proxyProtocol);
            modalContainer.find("#cmbServerSubscriptionObfuscation").val(subscription.obfuscation);
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
            modalContainer.find("#chkEnabled").prop('checked', true);
            modalContainer.find("#cmbServerSubscriptionProtocol")[0].selectedIndex = 0;
            modalContainer.find("#cmbServerSubscriptionObfuscation")[0].selectedIndex = 0;
            modalContainer.find("#cmbServerSubscriptionUsername").val("");
            modalContainer.find("#cmbServerSubscriptionPassword").val("");
        }
    }

    private static readServerSubscriptionModel(modalContainer: any): ProxyServerSubscription {
        let subscription = new ProxyServerSubscription();

        subscription.name = modalContainer.find("#txtName").val();
        subscription.url = modalContainer.find("#txtUrl").val();
        subscription.enabled = modalContainer.find("#chkEnabled").prop('checked');
        subscription.proxyProtocol = modalContainer.find("#cmbServerSubscriptionProtocol").val();
        subscription.refreshRate = modalContainer.find("#numRefreshRate").val() || 0;
        subscription.obfuscation = modalContainer.find("#cmbServerSubscriptionObfuscation").val();
        subscription.username = modalContainer.find("#cmbServerSubscriptionUsername").val();
        // BASE 64 string
        subscription.password = btoa(modalContainer.find("#cmbServerSubscriptionPassword").val());
        subscription.totalCount = 0;

        return subscription;
    }
    //#endregion

    //#region General tab functions --------------

    private static populateIgnoreRequestFailuresModal(modalContainer: any, domains?: string[]) {
        if (domains && Array.isArray(domains)) {
            modalContainer.find("#txtRequestFailuresIgnoredDomains").val(domains.join("\n"));
        }
        else {
            modalContainer.find("#txtRequestFailuresIgnoredDomains").val();
        }
    }

    private static readIgnoreRequestFailuresModal(modalContainer: any): string[] {
        return modalContainer.find("#txtRequestFailuresIgnoredDomains").val().split(/[\r\n]+/);
    }

    private static loadGeneralOptions(options: GeneralOptions) {
        if (!options)
            return;
        let divGeneral = jQuery("#tab-general");

        divGeneral.find("#chkSyncSettings").prop("checked", options.syncSettings || false);
        divGeneral.find("#chkProxyPerOrigin").prop("checked", options.proxyPerOrigin || false);

        divGeneral.find("#chkSyncSettings").prop("checked", options.proxyPerOrigin || false);
        divGeneral.find("#chkSyncProxyMode").prop("checked", options.syncProxyMode || false);
        divGeneral.find("#chkSyncActiveProxy").prop("checked", options.syncActiveProxy || false);

        divGeneral.find("#chkDetectRequestFailures").prop("checked", options.detectRequestFailures || false);
        divGeneral.find("#chkDisplayFailedOnBadge").prop("checked", options.displayFailedOnBadge || false);

        divGeneral.find("#chkEnableShortcuts").prop("checked", options.enableShortcuts || false);
        divGeneral.find("#chkShortcutNotification").prop("checked", options.shortcutNotification || false);
        divGeneral.find("#chkDisplayAppliedProxyOnBadge").prop("checked", options.displayAppliedProxyOnBadge || false);

        // this is needed to enabled/disable syn check boxes based on settings
        settingsPage.uiEvents.onSyncSettingsChanged();

        if (environment.chrome) {
            divGeneral.find("#chkProxyPerOrigin").attr("disabled", "disabled")
                .parents("label").attr("disabled", "disabled");
        }
    }

    private static readGeneralOptions(generalOptions?: GeneralOptions): GeneralOptions {
        if (!generalOptions)
            generalOptions = new GeneralOptions();
        let divGeneral = jQuery("#tab-general");

        generalOptions.proxyPerOrigin = divGeneral.find("#chkProxyPerOrigin").prop("checked");

        generalOptions.syncSettings = divGeneral.find("#chkSyncSettings").prop("checked");
        generalOptions.syncProxyMode = divGeneral.find("#chkSyncProxyMode").prop("checked");
        generalOptions.syncActiveProxy = divGeneral.find("#chkSyncActiveProxy").prop("checked");

        generalOptions.detectRequestFailures = divGeneral.find("#chkDetectRequestFailures").prop("checked");
        generalOptions.ignoreRequestFailuresForDomains = settingsPage.currentSettings.options.ignoreRequestFailuresForDomains;
        generalOptions.displayFailedOnBadge = divGeneral.find("#chkDisplayFailedOnBadge").prop("checked");

        generalOptions.enableShortcuts = divGeneral.find("#chkEnableShortcuts").prop("checked");
        generalOptions.shortcutNotification = divGeneral.find("#chkShortcutNotification").prop("checked");
        generalOptions.displayAppliedProxyOnBadge = divGeneral.find("#chkDisplayAppliedProxyOnBadge").prop("checked");

        return generalOptions;
    }

    //#endregion

    //#region Servers tab functions --------------

    private static loadServers(servers: any[]) {
        if (!this.grdServers)
            return;
        this.grdServers.clear();
        this.grdServers.rows.add(servers).draw('full-hold');

        // binding the events for all the rows
        this.refreshServersGridAllRows();
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

    private static refreshServersGridRow(row: any, invalidate?: boolean) {
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

    private static loadServerSubscriptions(subscriptions: any[]) {
        if (!this.grdServerSubscriptions)
            return;
        this.grdServerSubscriptions.clear();
        this.grdServerSubscriptions.rows.add(subscriptions).draw('full-hold');

        // binding the events for all the rows
        this.refreshServerSubscriptionsGridAllRows();
    }

    private static readServerSubscriptions(): any[] {
        return this.grdServerSubscriptions.data().toArray();
    }

    private static readSelectedServerSubscription(e?: any): any {
        let dataItem;

        if (e && e.target)
            dataItem = this.grdServerSubscriptions.row(jQuery(e.target).parents('tr')).data();
        else
            dataItem = this.grdServerSubscriptions.row({ selected: true }).data();

        return dataItem;
    }

    private static readSelectedServerSubscriptionRow(e: any): any {
        if (e && e.target)
            return this.grdServerSubscriptions.row(jQuery(e.target).parents('tr'));

        return null;
    }

    private static refreshServerSubscriptionsGrid() {
        let currentRow = this.grdServerSubscriptions.row();
        if (currentRow)
            // displaying the possible data change
            settingsPage.refreshServerSubscriptionsGridRow(currentRow, true);

        this.grdServerSubscriptions.draw('full-hold');
    }

    private static refreshServerSubscriptionsGridRow(row, invalidate?) {
        if (!row)
            return;
        if (invalidate)
            row.invalidate();

        let rowElement = jQuery(row.node());

        // NOTE: to display update data the row should be invalidated
        // and invalidated row loosed the event bindings.
        // so we need to bind the events each time data changes.

        rowElement.find("#btnSubscriptionsRemove").on("click", settingsPage.uiEvents.onServerSubscriptionRemoveClick);
        rowElement.find("#btnSubscriptionsEdit").on("click", settingsPage.uiEvents.onServerSubscriptionEditClick);
    }

    private static refreshServerSubscriptionsGridAllRows() {
        var nodes = this.grdServerSubscriptions.rows().nodes();
        for (let index = 0; index < nodes.length; index++) {
            const rowElement = jQuery(nodes[index]);

            rowElement.find("#btnSubscriptionsRemove").on("click", settingsPage.uiEvents.onServerSubscriptionRemoveClick);
            rowElement.find("#btnSubscriptionsEdit").on("click", settingsPage.uiEvents.onServerSubscriptionEditClick);
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

    //#region Bypass tab functions --------------

    private static loadBypass(bypass: BypassOptions) {
        if (!bypass)
            return;

        jQuery("#chkEnableBypassForAlwaysEnable").prop("checked", bypass.enableForAlways);
        jQuery("#chkEnableBypassForSystemProxy").prop("checked", bypass.enableForSystem);
        if (bypass.bypassList && Array.isArray(bypass.bypassList)) {
            jQuery("#txtBypassList").val(bypass.bypassList.join("\n"));
        }
    }

    private static readBypassList() {
        return jQuery("#txtBypassList").val().split(/[\r\n]+/);
    }

    private static readBypassOptionsModel(): BypassOptions {
        let bypass = new BypassOptions();
        let divBypass = jQuery("#tab-bypass");

        bypass.bypassList = settingsPage.readBypassList();
        bypass.enableForAlways = divBypass.find("#chkEnableBypassForAlwaysEnable").prop("checked");
        bypass.enableForSystem = divBypass.find("#chkEnableBypassForSystemProxy").prop("checked");

        return bypass;
    }
    //#endregion

    //#region Events --------------------------
    private static uiEvents = {
        onClickSaveGeneralOptions() {
            let generalOptions = settingsPage.readGeneralOptions();

            PolyFill.runtimeSendMessage(
                {
                    command: Messages.SettingsPageSaveOptions,
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
                error => {
                    messageBox.error(browser.i18n.getMessage("settingsErrorFailedToSaveGeneral") + " " + error.message);
                });
        },
        onClickRejectGeneralOptions() {
            // reset the data
            settingsPage.currentSettings.options = jQuery.extend({}, settingsPage.originalSettings.options);
            settingsPage.loadGeneralOptions(settingsPage.currentSettings.options);

            settingsPage.changeTracking.options = false;

            // Changes reverted successfully
            messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
        },
        onSyncSettingsChanged() {
            // reset the data
            var checked = jQuery("#chkSyncSettings").prop("checked")
            if (checked) {
                jQuery("#chkSyncProxyMode").removeAttr("disabled");
                jQuery("#chkSyncActiveProxy").removeAttr("disabled");
            }
            else {
                jQuery("#chkSyncProxyMode").attr("disabled", "disabled");
                jQuery("#chkSyncActiveProxy").attr("disabled", "disabled");
            }
        },
        onClickIgnoreRequestFailuresForDomains() {

            let modal = jQuery("#modalIgnoreRequestFailures");
            modal.data("editing", null);

            settingsPage.populateIgnoreRequestFailuresModal(modal,
                settingsPage.currentSettings.options.ignoreRequestFailuresForDomains);

            modal.modal("show");
            modal.find("#txtRequestFailuresIgnoredDomains").focus();
        },
        onClickSubmitIgnoreRequestDomains() {
            let modal = jQuery("#modalIgnoreRequestFailures");

            let domainList = settingsPage.readIgnoreRequestFailuresModal(modal);
            settingsPage.currentSettings.options.ignoreRequestFailuresForDomains = domainList;

            settingsPage.changeTracking.options = true;

            modal.modal("hide");
        },
        onClickViewShortcuts() {
            let modal = jQuery("#modalShortcuts");
            modal.modal("show");
        },
        onChangeActiveProxyServer() {
            let proxyName = jQuery("#cmbActiveProxyServer").val();

            let server = settingsPage.findProxyServerByName(proxyName);

            // this can be null
            settingsPage.currentSettings.activeProxyServer = server;
        },
        onClickAddProxyServer() {

            let modal = jQuery("#modalModifyProxyServer");
            modal.data("editing", null);

            settingsPage.populateServerModal(modal, null);

            modal.modal("show");
            modal.find("#txtServerAddress").focus();
        },
        onClickSubmitProxyServer() {

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
        onServersEditClick(e) {
            let item = settingsPage.readSelectedServer(e);
            if (!item)
                return;
			
            let modal = jQuery("#modalModifyProxyServer");
            modal.data("editing", item);

            settingsPage.populateServerModal(modal, item);

            modal.modal("show");
            modal.find("#txtServerAddress").focus();
        },
        onServersRemoveClick(e) {
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
        onClickSaveProxyServers() {

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
                error => {
                    messageBox.error(browser.i18n.getMessage("settingsErrorFailedToSaveServers") + " " + error.message);
                });

        },
        onClickRejectProxyServers() {
            // reset the data
            settingsPage.currentSettings.proxyServers = settingsPage.originalSettings.proxyServers.slice();
            settingsPage.loadServers(settingsPage.currentSettings.proxyServers);
            settingsPage.loadActiveProxyServer();

            settingsPage.changeTracking.servers = false;

            // Changes reverted successfully
            messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
        },
        onClickClearProxyServers() {
            // Are you sure to remove all the servers?
            messageBox.confirm(browser.i18n.getMessage("settingsRemoveAllProxyServers"),
                () => {
                    settingsPage.loadServers([]);
                    settingsPage.loadActiveProxyServer();

                    settingsPage.changeTracking.servers = true;

                    // All the proxy servers are removed.<br/>You have to save to apply the changes.
                    messageBox.info(browser.i18n.getMessage("settingsRemoveAllProxyServersSuccess"));
                });
        },
        onClickAddProxyRule() {
            let modal = jQuery("#modalModifyRule");
            modal.data("editing", null);

            // update form
            settingsPage.populateRuleModal(modal, null);

            modal.modal("show");
            modal.find("#txtRuleSource").focus();
        },
        onChangeRuleGeneratePattern() {
            settingsPage.updateProxyRuleModal();
        },
        onChangeRuleType() {
            settingsPage.updateProxyRuleModal();
        },
        onClickSubmitProxyRule() {

            let modal = jQuery("#modalModifyRule");
            let editingModel = modal.data("editing");

            let ruleInfo = settingsPage.readProxyRuleModel(modal);

            let sourceDomain = ruleInfo.sourceDomain;
            if (!sourceDomain) {
                // Please specify the source of the rule!
                messageBox.error(browser.i18n.getMessage("settingsRuleSourceRequired"));
                return;
            }

            if (!Utils.isValidHost(sourceDomain)) {
                // source is invalid, source name should be something like 'google.com'
                messageBox.error(browser.i18n.getMessage("settingsRuleSourceInvalid"));
                return;
            }

            if (Utils.urlHasSchema(sourceDomain)) {
                let extractedHost = Utils.extractHostFromUrl(sourceDomain);
                if (extractedHost == null || !Utils.isValidHost(extractedHost)) {

                    // `Host name '${extractedHost}' is invalid, host name should be something like 'google.com'`
                    messageBox.error(
                        browser.i18n.getMessage("settingsRuleHostInvalid")
                            .replace("{0}", extractedHost)
                    );
                    return;
                }
                sourceDomain = extractedHost;

            } else {
                // this extraction is to remove paths from rules, e.g. google.com/test/

                let extractedHost = Utils.extractHostFromUrl("http://" + sourceDomain);
                if (extractedHost == null || !Utils.isValidHost(extractedHost)) {

                    // `Host name '${extractedHost}' is invalid, host name should be something like 'google.com'`
                    messageBox.error(
                        browser.i18n.getMessage("settingsRuleHostInvalid")
                            .replace("{0}", extractedHost)
                    );
                    return;
                }
            }
            ruleInfo.sourceDomain = sourceDomain;

            if (ruleInfo.ruleType == ProxyRuleType.MatchPatternHost) {

                if (ruleInfo.autoGeneratePattern) {
                    // Feature #41 Allow entering/modifying custom pattern for rules 
                    ruleInfo.rulePattern = Utils.hostToMatchPattern(sourceDomain, false);
                }
                else if (!ruleInfo.rulePattern.includes(sourceDomain)) {
                    // The rule does not match the source domain '{0}'
                    messageBox.error(
                        browser.i18n.getMessage("settingsRuleDoesntIncludeDomain").replace("{0}", sourceDomain)
                    );
                    return;
                }
            }
            else if (ruleInfo.ruleType == ProxyRuleType.MatchPatternUrl) {

                if (ruleInfo.autoGeneratePattern) {
                    // Feature #41 Allow entering/modifying custom pattern for rules 
                    ruleInfo.rulePattern = Utils.hostToMatchPattern(sourceDomain, true);
                }
                else if (!ruleInfo.rulePattern.includes(sourceDomain)) {
                    // The rule does not match the source domain '{0}'
                    messageBox.error(
                        browser.i18n.getMessage("settingsRuleDoesntIncludeDomain").replace("{0}", sourceDomain)
                    );
                    return;
                }
            }
            else if (ruleInfo.ruleType == ProxyRuleType.RegexHost) {

                try {

                    let regex = new RegExp(ruleInfo.ruleRegex);

                    if (!regex.test(sourceDomain)) {
                        // Regex rule does not match the source domain '{0}'
                        messageBox.error(
                            browser.i18n.getMessage("settingsRuleRegexNotMatchDomain").replace("{0}", sourceDomain)
                        );
                        return;
                    }

                } catch (error) {
                    // Regex rule '{0}' is not valid
                    messageBox.error(
                        browser.i18n.getMessage("settingsRuleRegexInvalid").replace("{0}", ruleInfo.ruleRegex)
                    );
                    return;
                }
            }
            else if (ruleInfo.ruleType == ProxyRuleType.RegexUrl) {

                try {

                    let regex = new RegExp(ruleInfo.ruleRegex);

                    if (!regex.test(sourceDomain)) {
                        // Regex rule does not match the source domain '{0}'
                        messageBox.error(
                            browser.i18n.getMessage("settingsRuleRegexNotMatchDomain").replace("{0}", sourceDomain)
                        );
                        return;
                    }

                } catch (error) {
                    // Regex rule '{0}' is not valid
                    messageBox.error(
                        browser.i18n.getMessage("settingsRuleRegexInvalid").replace("{0}", ruleInfo.ruleRegex)
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
                        browser.i18n.getMessage("settingsRuleExactUrlInvalid").replace("{0}", ruleInfo.ruleExact)
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
                return (rule.sourceDomain === sourceDomain && rule.sourceDomain != editingSource);
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
        onRulesEditClick(e) {
            let item = settingsPage.readSelectedRule(e);
            if (!item)
                return;

            let modal = jQuery("#modalModifyRule");
            modal.data("editing", item);

            settingsPage.populateRuleModal(modal, item);

            modal.modal("show");
            modal.find("#txtRuleSource").focus();
        },
        onRulesRemoveClick(e) {
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
        onClickSaveProxyRules() {

            let rules = settingsPage.readRules();

            PolyFill.runtimeSendMessage(
                {
                    command: Messages.SettingsPageSaveProxyRules,
                    proxyRules: rules
                },
                (response: ResultHolder) => {
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
                error => {
                    messageBox.error(browser.i18n.getMessage("settingsErrorFailedToSaveRules") + " " + error.message);
                });
        },
        onClickRejectProxyRules() {
            // reset the data
            settingsPage.currentSettings.proxyRules = settingsPage.originalSettings.proxyRules.slice();
            settingsPage.loadRules(settingsPage.currentSettings.proxyRules);
            settingsPage.refreshRulesGrid();

            settingsPage.changeTracking.rules = false;

            // Changes reverted successfully
            messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
        },
        onClickClearProxyRules() {
            // Are you sure to remove all the rules?
            messageBox.confirm(browser.i18n.getMessage("settingsRemoveAllRules"),
                () => {
                    settingsPage.loadRules([]);

                    settingsPage.changeTracking.rules = true;

                    // All rules are removed.<br/>You have to save to apply the changes.
                    messageBox.info(browser.i18n.getMessage("settingsRemoveAllRulesSuccess"));
                });
        },
        onClickAddServerSubscription() {
            let modal = jQuery("#modalServerSubscription");
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
        onServerSubscriptionEditClick(e) {

            let item = settingsPage.readSelectedServerSubscription(e);
            if (!item)
                return;

            let modal = jQuery("#modalServerSubscription");
            modal.data("editing", item);

            settingsPage.populateServerSubscriptionsModal(modal, item);

            modal.modal("show");
        },
        onServerSubscriptionRemoveClick(e) {
            var row = settingsPage.readSelectedServerSubscriptionRow(e);
            if (!row)
                return;

            messageBox.confirm(browser.i18n.getMessage("settingsConfirmRemoveServerSubscription"),
                () => {
                    // remove then redraw the grid page
                    row.remove().draw('full-hold');

                    settingsPage.changeTracking.serverSubscriptions = true;
                });
        },
        onClickSaveServerSubscription() {
            let modal = jQuery("#modalServerSubscription");


            if (!modal.find("form")[0].checkValidity()) {
                // Please fill the required fields in the right format
                messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionIncompleteForm"));
                return;
            }
            let subscriptionModel = settingsPage.readServerSubscriptionModel(modal);
            if (!subscriptionModel) {
                messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionInvalidForm"));
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
                        messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionDuplicateName"));
                        return;
                    }
            }

            // Saving...
            jQuery("#btnSaveServerSubscription").attr("data-loading-text", browser.i18n.getMessage("settingsServerSubscriptionSavingButton"));
            jQuery("#btnSaveServerSubscription").button("loading");

            ProxyImporter.readFromServer(subscriptionModel,
                response => {
                    jQuery("#btnSaveServerSubscription").button('reset');

                    if (response.success) {
                        let count = response.result.length;

                        subscriptionModel.proxies = response.result;
                        subscriptionModel.totalCount = count;

                        if (editingSubscription) {

                            // updating the model
                            jQuery.extend(editingSubscription, subscriptionModel);

                            settingsPage.refreshServerSubscriptionsGrid();

                            // The subscription is updated with {0} proxies in it. <br/>Don't forget to save the changes.
                            messageBox.success(browser.i18n.getMessage("settingsServerSubscriptionSaveUpdated").replace("{0}", count));
                        } else {

                            // insert to the grid
                            settingsPage.insertNewServerSubscriptionInGrid(subscriptionModel);

                            // The subscription is added with {0} proxies in it. <br/>Don't forget to save the changes.
                            messageBox.success(browser.i18n.getMessage("settingsServerSubscriptionSaveAdded").replace("{0}", count));
                        }

                        settingsPage.changeTracking.serverSubscriptions = true;
                        settingsPage.loadActiveProxyServer();

                        // close the window
                        modal.modal("hide");

                    } else {
                        messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionSaveFailedGet"));
                    }
                },
                () => {
                    messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionSaveFailedGet"));
                    jQuery("#btnSaveServerSubscription").button('reset');
                });
        },
        onClickTestServerSubscription() {
            let modal = jQuery("#modalServerSubscription");

            if (!modal.find("form")[0].checkValidity()) {
                // Please fill the required fields in the right format
                messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionIncompleteForm"));
                return;
            }

            let subscriptionModel = settingsPage.readServerSubscriptionModel(modal);

            if (!subscriptionModel) {
                messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionInvalidForm"));
                return;
            }

            // Testing...
            jQuery("#btnTestServerSubscription").attr("data-loading-text", browser.i18n.getMessage("settingsServerSubscriptionTestingButton"));
            jQuery("#btnTestServerSubscription").button("loading");

            ProxyImporter.readFromServer(subscriptionModel,
                response => {

                    jQuery("#btnTestServerSubscription").button('reset');

                    if (response.success) {
                        let count = response.result.length;

                        messageBox.success(browser.i18n.getMessage("settingsServerSubscriptionTestSuccess").replace("{0}", count));
                    } else {
                        messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionTestFailed"));
                    }
                },
                () => {
                    messageBox.error(browser.i18n.getMessage("settingsServerSubscriptionTestFailed"));
                    jQuery("#btnTestServerSubscription").button('reset');
                });
        },
        onClickSaveServerSubscriptionsChanges() {
            let proxyServerSubscriptions = settingsPage.readServerSubscriptions();

            PolyFill.runtimeSendMessage(
                {
                    command: Messages.SettingsPageSaveProxySubscriptions,
                    proxyServerSubscriptions: proxyServerSubscriptions
                },
                response => {
                    if (!response) return;
                    if (response.success) {
                        if (response.message)
                            messageBox.success(response.message);

                        // current list should become equal to saved list
                        settingsPage.currentSettings.proxyServerSubscriptions = proxyServerSubscriptions;

                        settingsPage.changeTracking.serverSubscriptions = false;

                    } else {
                        if (response.message)
                            messageBox.error(response.message);
                    }
                },
                error => {
                    messageBox.error(browser.i18n.getMessage("settingsFailedToSaveProxySubscriptions") + " " + error.message);
                });
        },
        onClickRejectServerSubscriptionsChanges() {
            // reset the data
            settingsPage.currentSettings.proxyServerSubscriptions = settingsPage.originalSettings.proxyServerSubscriptions.slice();
            settingsPage.loadServerSubscriptions(settingsPage.currentSettings.proxyServerSubscriptions);
            settingsPage.loadActiveProxyServer();

            settingsPage.changeTracking.serverSubscriptions = false;

            // Changes reverted successfully
            messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
        },
        onClickClearServerSubscriptions() {

            // Are you sure to remove all the proxy server subscriptions?
            messageBox.confirm(browser.i18n.getMessage("settingsRemoveAllProxyServerSubscriptions"),
                () => {
                    settingsPage.loadServerSubscriptions([]);
                    settingsPage.loadActiveProxyServer();

                    settingsPage.changeTracking.serverSubscriptions = true;

                    // All the proxy server subscriptions are removed.<br/>You have to save to apply the changes.
                    messageBox.info(browser.i18n.getMessage("settingsRemoveAllProxyServerSubscriptionsSuccess"));
                });
        },
        onClickSaveBypassChanges() {
            let bypassOptions = settingsPage.readBypassOptionsModel();

            PolyFill.runtimeSendMessage(
                {
                    command: Messages.SettingsPageSaveBypass,
                    bypass: bypassOptions
                },
                (response: ResultHolder) => {
                    if (!response) return;
                    if (response.success) {
                        if (response.message)
                            messageBox.success(response.message);

                        settingsPage.currentSettings.bypass = bypassOptions;
                        settingsPage.changeTracking.bypass = false;

                    } else {
                        if (response.message)
                            messageBox.error(response.message);
                    }
                },
                error => {
                    messageBox.error(browser.i18n.getMessage("settingsErrorFailedToSaveBypass") + " " + error.message);
                });
        },
        onClickRejectBypass() {
            // reset the data
            settingsPage.currentSettings.bypass = jQuery.extend({}, settingsPage.originalSettings.bypass);
            settingsPage.loadBypass(settingsPage.currentSettings.bypass);

            settingsPage.changeTracking.bypass = false;

            // Changes reverted successfully
            messageBox.info(browser.i18n.getMessage("settingsChangesReverted"));
        },
        onClickExportProxyServerOpenBackup() {
            let proxyList = settingsPage.exportServersListFormatted();

            CommonUi.downloadData(proxyList, "SmartProxy-Servers.txt");
        },
        onClickImportProxyServer() {
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
                response => {
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
                error => {
                    let message = "";
                    if (error && error.message)
                        message = error.message;
                    messageBox.error(browser.i18n.getMessage("settingsImportProxyServersFailed") + " " + message);
                });

        },
        onClickImportRules() {
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
                response => {
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
                error => {
                    let message = "";
                    if (error && error.message)
                        message = error.message;
                    messageBox.error(browser.i18n.getMessage("settingsImportRulesFailed") + " " + message);
                });
        },
        onClickBackupComplete() {

            let data = JSON.stringify(settingsPage.currentSettings);
            CommonUi.downloadData(data, "SmartProxy-FullBackup.json");
        },
        onClickBackupRules() {
            let data = JSON.stringify(
                {
                    proxyRules: settingsPage.currentSettings.proxyRules
                }
            );
            CommonUi.downloadData(data, "SmartProxy-RulesBackup.json");
        },
        onClickRestoreBackup() {

            function callRestoreSettings(fileData: any);
            function callRestoreSettings(fileData) {

                PolyFill.runtimeSendMessage(
                    {
                        command: Messages.SettingsPageRestoreSettings,
                        fileData: fileData
                    },
                    (response: ResultHolder) => {

                        if (response.success) {
                            if (response.message) {
                                messageBox.success(response.message,
                                    false,
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
                    error => {
                        // There was an error in restoring the backup
                        messageBox.error(browser.i18n.getMessage("settingsRestoreBackupFailed"));
                        PolyFill.runtimeSendMessage("restoreSettings failed with> " + error.message);
                    });
            }

            CommonUi.selectFileOnTheFly(jQuery("#frmRestoreBackup")[0],
                "restore-file",
                (inputElement, files) => {
                    let file = files[0];

                    let reader = new FileReader();
                    reader.onerror = event => {
                        // Failed to read the selected file
                        messageBox.error(browser.i18n.getMessage("settingsRestoreBackupFileError"));
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
    //#endregion

}

settingsPage.initialize();