import { browser, environment } from "../lib/environment";
import { ShortcutCommands, Messages, ProxyModeType } from "./definitions";
import { Core } from "./Core";
import { Settings } from "./Settings";
import { PolyFill } from "../lib/PolyFill";

export class KeyboardShortcuts {

    public static startMonitor() {
        if (browser["commands"])
            browser.commands.onCommand.addListener(KeyboardShortcuts.handleCommand);
    }

    private static handleCommand(command: string) {
        if (!Settings.current.options.enableShortcuts)
            return;

        switch (command) {
            case ShortcutCommands.NextProxyServer:

                let nextResult = Core.CycleToNextProxyServer();
                if (nextResult.success) {
                    KeyboardShortcuts.displayShortcutNotification(
                        browser.i18n.getMessage("notificationShortcutProxyServerChanged").replace("{0}", nextResult.value.name),
                        "cycle-proxy-server",
                        browser.extension.getURL("icons/smartproxy-48.png"));
                }
                else {
                    KeyboardShortcuts.displayShortcutNotification(
                        nextResult.message,
                        "cycle-proxy-server",
                        null);
                }
                break;

            case ShortcutCommands.PreviousProxyServer:

                let previousResult = Core.CycleToPreviousProxyServer();
                if (previousResult.success) {
                    KeyboardShortcuts.displayShortcutNotification(
                        browser.i18n.getMessage("notificationShortcutProxyServerChanged").replace("{0}", previousResult.value.name),
                        "cycle-proxy-server",
                        browser.extension.getURL("icons/smartproxy-48.png"));
                }
                else {
                    KeyboardShortcuts.displayShortcutNotification(
                        previousResult.message,
                        "cycle-proxy-server",
                        null);
                }
                break;

            case ShortcutCommands.ProxyModeNone:
                // change proxy mode
                Core.ChangeProxyMode(ProxyModeType.Direct);

                KeyboardShortcuts.displayShortcutNotification(
                    browser.i18n.getMessage("notificationShortcutProxyModeMessage").replace("{0}", ProxyModeType[ProxyModeType.Direct]),
                    Messages.PopupChangeProxyMode,
                    browser.extension.getURL("icons/proxymode-disabled-48.png"));
                break;

            case ShortcutCommands.ProxyModeSmart:
                // change proxy mode
                Core.ChangeProxyMode(ProxyModeType.SmartProxy);

                KeyboardShortcuts.displayShortcutNotification(
                    browser.i18n.getMessage("notificationShortcutProxyModeMessage").replace("{0}", ProxyModeType[ProxyModeType.SmartProxy]),
                    Messages.PopupChangeProxyMode,
                    browser.extension.getURL("icons/smartproxy-48.png"));
                break;

            case ShortcutCommands.ProxyModeAlways:
                // change proxy mode
                Core.ChangeProxyMode(ProxyModeType.Always);

                KeyboardShortcuts.displayShortcutNotification(
                    browser.i18n.getMessage("notificationShortcutProxyModeMessage").replace("{0}", ProxyModeType[ProxyModeType.Always]),
                    Messages.PopupChangeProxyMode,
                    browser.extension.getURL("icons/proxymode-always-48.png"));
                break;

            case ShortcutCommands.ProxyModeSystem:
                // change proxy mode
                Core.ChangeProxyMode(ProxyModeType.SystemProxy);

                KeyboardShortcuts.displayShortcutNotification(
                    browser.i18n.getMessage("notificationShortcutProxyModeMessage").replace("{0}", ProxyModeType[ProxyModeType.SystemProxy]),
                    Messages.PopupChangeProxyMode,
                    browser.extension.getURL("icons/proxymode-system-48.png"));
                break;
        }
    }

    private static displayShortcutNotification(message: string, id: string, iconUrl?: string) {
        if (!Settings.current.options.shortcutNotification)
            return;

        if (environment.chrome) {
            if (iconUrl)
                iconUrl = browser.extension.getURL("icons/smartproxy-48.png");
        }

        PolyFill.browserNotificationsCreate(id, {
            "type": "basic",
            "iconUrl": iconUrl,
            "title": browser.i18n.getMessage("notificationShortcutTitle"),
            "message": message
        });
    }
}