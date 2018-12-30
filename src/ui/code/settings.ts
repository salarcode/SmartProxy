import { CommonUi } from "./CommonUi";
import { PolyFill } from "../../lib/PolyFill";
import { Messages } from "../../core/definitions";
import { messageBox, jQuery } from "../../lib/External";
import { environment } from "../../lib/environment";

export class settingsPage {

    public static initialize() {

        CommonUi.onDocumentReady(this.bindEvents);
        CommonUi.onDocumentReady(this.initializeGrids);

        PolyFill.runtimeSendMessage(Messages.SettingsPageGetInitialData,
            function (dataForSettings) {
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

    private static populateDataForSettings(dataForSettings) {
        // settingsUiData = dataForSettingsUi.settings;
        // settings.populateSettingsUiData(dataForSettingsUi);

        // settingsGrid.loadRules(settingsUiData.proxyRules);
        // settingsGrid.loadServers(settingsUiData.proxyServers);
        // settingsGrid.loadServerSubscriptions(settingsUiData.proxyServerSubscriptions);
        // settingsGrid.reloadActiveProxyServer(settingsUiData.proxyServers, settingsUiData.proxyServerSubscriptions);
        // settingsGrid.loadBypass(settingsUiData.bypass);
        // settingsGrid.loadGeneralOptions(settingsUiData.options);

        // // make copy
        // originalSettingsData.proxyRules = settingsUiData.proxyRules.slice();
        // originalSettingsData.proxyServers = settingsUiData.proxyServers.slice();
        // originalSettingsData.activeProxyServer = settingsUiData.activeProxyServer;
        // originalSettingsData.proxyServerSubscriptions = settingsUiData.proxyServerSubscriptions;
        // originalSettingsData.bypass = jQuery.extend({}, settingsUiData.bypass);
        // originalSettingsData.options = jQuery.extend({}, settingsUiData.options);
    }

    private static bindEvents() {
        if (environment.chrome) {
            jQuery("#divAlertChrome").show();

            // not supported by Chrome
            jQuery("#chkEnableBypassForSystemProxy").attr("disabled", "disabled");
        } else {
            jQuery("#divAlertFirefox").show();
        }

        // // general options
        // jQuery("#btnSaveGeneralOptions").click(uiEvents.onClickSaveGeneralOptions);

        // jQuery("#btnRejectGeneralOptions").click(uiEvents.onClickRejectGeneralOptions);

        // // proxy servers
        // jQuery("#cmbActiveProxyServer").on("change", uiEvents.onChangeActiveProxyServer);

        // jQuery("#btnAddProxyServer").click(uiEvents.onClickAddProxyServer);

        // jQuery("#btnSubmitProxyServer").click(uiEvents.onClickSubmitProxyServer);

        // jQuery("#btnSaveProxyServers").click(uiEvents.onClickSaveProxyServers);

        // jQuery("#btnRejectProxyServers").click(uiEvents.onClickRejectProxyServers);

        // jQuery("#btnClearProxyServers").click(uiEvents.onClickClearProxyServers);

        // jQuery("#btnExportProxyServerOpen,#btnExportProxyServerOpenBackup").click(uiEvents.onClickExportProxyServerOpenBackup);

        // jQuery("#btnImportProxyServer").click(uiEvents.onClickImportProxyServer);

        // // rules
        // jQuery("#btnSubmitRule").click(uiEvents.onClickSubmitProxyRule);

        // jQuery("#btnImportRules").click(uiEvents.onClickImportRules);

        // jQuery("#btnAddProxyRule").click(uiEvents.onClickAddProxyRule);

        // jQuery("#btnSaveProxyRules").click(uiEvents.onClickSaveProxyRules);

        // jQuery("#btnRejectProxyRules").click(uiEvents.onClickRejectProxyRules);

        // jQuery("#btnClearProxyRules").click(uiEvents.onClickClearProxyRules);

        // // bypass list
        // jQuery("#btnSaveBypassChanges").click(uiEvents.onClickSaveBypassChanges);

        // jQuery("#btnRejectBypass").click(uiEvents.onClickRejectBypass);

        // // backup
        // jQuery("#btnBackupComplete").click(uiEvents.onClickBackupComplete);

        // jQuery("#btnBackupRules").click(uiEvents.onClickBackupRules);

        // jQuery("#btnRestoreBackup").click(uiEvents.onClickRestoreBackup);

        // // proxy server subscriptions
        // jQuery("#btnAddServerSubscription").click(function () {
        //     settingsGrid.serverSubscriptionsAdd();
        // });
        // jQuery("#btnSaveServerSubscription").click(function () {
        //     settingsGrid.serverSubscriptionsSave();
        // });
        // jQuery("#btnTestServerSubscription").click(function () {
        //     settingsGrid.serverSubscriptionsTest(true);
        // });

        // jQuery("#btnClearServerSubscriptions").click(uiEvents.onClickClearServerSubscriptions);

        // jQuery("#btnSaveServerSubscriptionsChanges").click(uiEvents.onClickSaveServerSubscriptionsChanges);

        // jQuery("#btnRejectServerSubscriptionsChanges").click(uiEvents.onClickRejectServerSubscriptionsChanges);

        // (function () {
        //     // the default values
        //     let cmbServerSubscriptionProtocol = jQuery("#cmbServerSubscriptionProtocol");

        //     // the default values
        //     let cmbServerSubscriptionObfuscation = jQuery("#cmbServerSubscriptionObfuscation");

        //     jQuery("<option>").attr("value", "")
        //         // (Auto detect with HTTP fallback)
        //         .text(browser.i18n.getMessage("settingsServerSubscriptionProtocolDefault"))
        //         .appendTo(cmbServerSubscriptionProtocol);
        //     proxyServerProtocols.forEach(function (item) {
        //         jQuery("<option>").attr("value", item)
        //             .text(item)
        //             .appendTo(cmbServerSubscriptionProtocol);
        //     });

        //     proxyServerSubscriptionObfuscate.forEach(function (item) {
        //         jQuery("<option>").attr("value", item)
        //             .text(item)
        //             .appendTo(cmbServerSubscriptionObfuscation);
        //     });
        // })();
    }

    private static initializeGrids() {

    }


}

settingsPage.initialize();