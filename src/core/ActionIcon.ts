import { api, environment } from "../lib/environment";
import { CommandMessages, getSmartProfileTypeName, SmartProfileType } from "./definitions";
import { Core } from "./Core";
import { Settings } from "./Settings";
import { Debug } from "../lib/Debug";
import { KeyboardShortcuts } from "./KeyboardShortcuts";

const settingsLib = Settings;
const apiAction = api.action || api.browserAction;

export class ActionIcon {
	private static originalPopupPath: string | null = null;

	public static startMonitor() {
		if (environment.chrome)
			// Chrome doesn't include modifier data in the onClicked event
			return;

		if (!apiAction || !apiAction.onClicked || !apiAction.onClicked.addListener)
			return;

		try {
			// read popup from manifest (if any)
			try {
				const mf: any = api.runtime.getManifest();
				ActionIcon.originalPopupPath = (mf.action && mf.action.default_popup) || (mf.browser_action && mf.browser_action.default_popup) || null;
			} catch (e) {
				ActionIcon.originalPopupPath = null;
			}

			// disable runtime popup so we receive onClicked events
			try {
				apiAction.setPopup({ popup: '' });
			} catch (e) { }

			apiAction.onClicked.addListener(ActionIcon.onClickedHandler);
		} catch (e) {
			Debug.warn('ActionIcon.startMonitor failed to add listener', e);
		}
	}

	private static normalizeModifiers(input: any): string[] {
		if (!input) return [];
		if (Array.isArray(input)) {
			return input.map((m: any) => (m || '').toString().toLowerCase());
		}
		if (typeof input === 'string') {
			return input.split(/[+,\s]+/).map((s: string) => s.toLowerCase());
		}
		return [];
	}

	private static onClickedHandler(...args: any[]) {
		try {
			const details = args[1] || {};
			const modifiers = ActionIcon.normalizeModifiers(details.modifiers);

			if (modifiers.length) {
				const hasCtrl = modifiers.includes('ctrl') || modifiers.includes('control') || modifiers.includes('macctrl') || modifiers.includes('meta') || modifiers.includes('command');

				if (hasCtrl) {
					ActionIcon.CycleProfiles();
					return;
				}
				const hasShift = modifiers.includes('shift');
				if (hasShift) {
					KeyboardShortcuts.CycleToNextProxyServer();
					return;
				}
				const hasAlt = modifiers.includes('alt') || modifiers.includes('altgraph');
				if (hasAlt) {
					KeyboardShortcuts.CycleToPreviousProxyServer();
					return;
				}
			}

			// No modifiers: open the popup if possible. Restore the original popup path
			// briefly (if known), call openPopup, then disable it again so we keep
			// receiving future onClicked events.
			try {
				if (ActionIcon.originalPopupPath) {
					try {
						apiAction.setPopup({ popup: ActionIcon.originalPopupPath });
					} catch (e) { }
				}

				try {
					apiAction.openPopup();
				} catch (e) {
					// openPopup may throw if popup is not available on active tab; ignore
				}

				// re-disable runtime popup after short arbitrary delay
				setTimeout(() => {
					try {
						apiAction.setPopup({ popup: '' });
					} catch (e) { }
				}, 200);
			} catch (e) { }
		} catch (e) {
			Debug.warn('ActionIcon.onClickedHandler error', e);
		}
	}

	static CycleProfiles() {
		const profiles = settingsLib.current.proxyProfiles;
		if (profiles.length == 0)
			return;

		const currentId = settingsLib.current.activeProfileId;
		const startIndex = profiles.findIndex(p => p.profileId === currentId);

		// Iterate profiles by offset starting at 1 (the item after `startIndex`) and
		// wrap around using modulo. When offset == profiles.length the computed index
		// becomes `startIndex` again, so every profile is checked once and the
		// current profile is evaluated last.
		for (let offset = 1; offset <= profiles.length; offset++) {
			const index = (startIndex + offset) % profiles.length;

			const profile = profiles[index];

			if (!profile.enabled || !profile.profileTypeConfig.selectable) {
				continue;
			}
			if (profile.profileType == SmartProfileType.SystemProxy && environment.notSupported.setProxySettings) {
				continue;
			}

			// found next selectable profile
			Core.ChangeActiveProfileId(profile.profileId);

			// show notification
			KeyboardShortcuts.displayShortcutNotification(
				api.i18n.getMessage("notificationShortcutProxyModeMessage").replace("{0}", getSmartProfileTypeName(profile.profileType)),
				CommandMessages.PopupChangeActiveProfile,
				null
			)
			return;
		}
	}
}