import { api, environment } from "../lib/environment";
import { CommandMessages, getSmartProfileTypeDefaultId, getSmartProfileTypeName, ShortcutCommands, SmartProfileType } from "./definitions";
import { Core } from "./Core";
import { Settings } from "./Settings";
import { PolyFill } from "../lib/PolyFill";
import { Debug } from "../lib/Debug";
import { ProfileOperations } from "./ProfileOperations";

export class KeyboardShortcuts {

    public static startMonitor() {
        if (api["commands"])
            api.commands.onCommand.addListener(KeyboardShortcuts.handleCommand);
    }

    private static handleCommand(command: string) {
        if (!Settings.current.options.enableShortcuts)
            return;

        switch (command) {
            case ShortcutCommands.NextProxyServer:

                let nextResult = Core.CycleToNextProxyServer();
                if (nextResult.success) {
                    KeyboardShortcuts.displayShortcutNotification(
                        api.i18n.getMessage("notificationShortcutProxyServerChanged").replace("{0}", nextResult.value.name),
                        "cycle-proxy-server",
                        PolyFill.extensionGetURL("icons/smartproxy-48.png"));
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
                        api.i18n.getMessage("notificationShortcutProxyServerChanged").replace("{0}", previousResult.value.name),
                        "cycle-proxy-server",
                        PolyFill.extensionGetURL("icons/smartproxy-48.png"));
                }
                else {
                    KeyboardShortcuts.displayShortcutNotification(
                        previousResult.message,
                        "cycle-proxy-server",
                        null);
                }
                break;

            case ShortcutCommands.BuiltinProfileNone:
                // change proxy mode
                KeyboardShortcuts.ChangeActiveProfile(SmartProfileType.Direct);

                KeyboardShortcuts.displayShortcutNotification(
                    api.i18n.getMessage("notificationShortcutProxyModeMessage").replace("{0}", getSmartProfileTypeName(SmartProfileType.Direct)),
                    CommandMessages.PopupChangeActiveProfile,
                    PolyFill.extensionGetURL("icons/proxymode-disabled-48.png"));
                break;

            case ShortcutCommands.BuiltinProfileSmart:
                // change proxy mode
                KeyboardShortcuts.ChangeActiveProfile(SmartProfileType.SmartRules);

                KeyboardShortcuts.displayShortcutNotification(
                    api.i18n.getMessage("notificationShortcutProxyModeMessage").replace("{0}", getSmartProfileTypeName(SmartProfileType.SmartRules)),
                    CommandMessages.PopupChangeActiveProfile,
                    PolyFill.extensionGetURL("icons/smartproxy-48.png"));
                break;

            case ShortcutCommands.BuiltinProfileAlways:
                // change proxy mode
                KeyboardShortcuts.ChangeActiveProfile(SmartProfileType.AlwaysEnabledBypassRules);

                KeyboardShortcuts.displayShortcutNotification(
                    api.i18n.getMessage("notificationShortcutProxyModeMessage").replace("{0}", getSmartProfileTypeName(SmartProfileType.AlwaysEnabledBypassRules)),
                    CommandMessages.PopupChangeActiveProfile,
                    PolyFill.extensionGetURL("icons/proxymode-always-48.png"));
                break;

            case ShortcutCommands.BuiltinProfileSystem:
                // change proxy mode
                KeyboardShortcuts.ChangeActiveProfile(SmartProfileType.SystemProxy);

                KeyboardShortcuts.displayShortcutNotification(
                    api.i18n.getMessage("notificationShortcutProxyModeMessage").replace("{0}", getSmartProfileTypeName(SmartProfileType.SystemProxy)),
                    CommandMessages.PopupChangeActiveProfile,
                    PolyFill.extensionGetURL("icons/proxymode-system-48.png"));
                break;
            default:
                Debug.warn('The following shortcut is not mapped', command);
                break;
        }
    }

    private static ChangeActiveProfile(profileType: SmartProfileType) {
        let profileId = getSmartProfileTypeDefaultId(profileType);

        if (!profileId) {
            // getting the very first one
            let profile = ProfileOperations.findFirstSmartProfileType(profileType, Settings.current.proxyProfiles);
            if (profile) {
                profileId = profile.profileId;
            }
            else {
                Debug.warn('Failed to find a profile of type ' + SmartProfileType[profileType]);
                return;
            }
        }
        Core.ChangeActiveProfileId(profileId);

    }

    private static displayShortcutNotification(message: string, id: string, iconUrl?: string) {
        if (!Settings.current.options.shortcutNotification)
            return;

        if (environment.chrome) {
            if (iconUrl)
                iconUrl = PolyFill.extensionGetURL("icons/smartproxy-48.png");
        }

        PolyFill.browserNotificationsCreate(id, {
            "type": "basic",
            "iconUrl": iconUrl,
            "title": api.i18n.getMessage("notificationShortcutTitle"),
            "message": message
        });
    }
}