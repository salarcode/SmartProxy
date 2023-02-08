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
import { api, environment } from "../../lib/environment";
import { jQuery, messageBox } from "../../lib/External";
import { CommandMessages, PopupInternalDataType, ProxyableDomainType, FailedRequestType, ProxyServer, CompiledProxyRuleSource, SmartProfileBase, SmartProfileType, getSmartProfileTypeIcon } from "../../core/definitions";
import { PolyFill } from "../../lib/PolyFill";
import { CommonUi } from "./CommonUi";
import { Utils } from "../../lib/Utils";
import { ProfileOperations } from "../../core/ProfileOperations";

export class popup {
	private static popupData: PopupInternalDataType = null;
	private static activeProfile: SmartProfileBase;

	public static initialize() {

		popup.onDocumentReady(popup.bindEvents);

		PolyFill.runtimeSendMessage(CommandMessages.PopupGetInitialData,
			(dataForPopup: PopupInternalDataType) => {

				if (dataForPopup != null) {
					popup.popupData = dataForPopup;
					popup.populateDataForPopup(dataForPopup);
				}
			},
			(error: Error) => {
				PolyFill.runtimeSendMessage("PopupGetInitialData failed! > " + error);
			});

		// start handling messages
		api.runtime.onMessage.addListener(popup.handleMessages);

		popup.onDocumentReady(CommonUi.localizeHtmlPage);
	}

	private static handleMessages(message: string, sender: any, sendResponse: Function) {

		if (message != null && typeof (message) == "object") {

			if (message!["command"] === CommandMessages.WebFailedRequestNotification) {
				if (message!["tabId"] == null)
					return;

				let sourceTabId = popup.popupData?.currentTabId;
				if (sourceTabId == null) {
					PolyFill.runtimeSendMessage("Popup has invalid data. popupData is null" + JSON.stringify(popup.popupData));
					return;
				}

				let tabId = message!["tabId"];
				if (tabId != sourceTabId) {
					return;
				}

				let failedRequests: FailedRequestType[] = message!["failedRequests"];

				// display the failed requests
				popup.populateFailedRequests(failedRequests);

				// Chrome requires a response
				if (sendResponse)
					sendResponse(null);

				return;
			}
		}
		// Chrome requires a response
		if (sendResponse)
			sendResponse(null);
	}

	private static onDocumentReady(callback: Function) {
		jQuery(document).ready(callback);
	}

	private static bindEvents() {
		jQuery("#openSettings").click(() => {
			PolyFill.runtimeOpenOptionsPage();
			popup.closeSelf();
		});
		jQuery("#openProxyable").click(() => {
			if (!popup.popupData)
				return;

			var sourceTabId = popup.popupData.currentTabId;
			api.tabs.create(
				{
					active: true,
					//openerTabId: null,
					url: PolyFill.extensionGetURL(`ui/proxyable.html?id=${sourceTabId}`)
				}
			);
			popup.closeSelf();
		});

		jQuery("#divFailedRequests a").click(() => {
			jQuery(".popup-menu-failed").toggle();
		});

		jQuery("#btnAddFailedRequests").click(popup.onAddFailedRequestsClick);
		jQuery("#btnAddIgnoredFailures").click(popup.onAddIgnoredFailuresClick);
	}

	private static populateDataForPopup(dataForPopup: PopupInternalDataType) {

		CommonUi.applyThemes(dataForPopup.themeData);
		popup.updateActiveProfile(dataForPopup);
		popup.populateUpdateAvailable(dataForPopup);
		popup.populateUnsupportedFeatures(dataForPopup);
		popup.populateSmartProfiles(dataForPopup.proxyProfiles, dataForPopup.activeProfileId);
		popup.populateActiveProxy(dataForPopup);
		popup.populateProxyableDomainList(dataForPopup.proxyableDomains);
		popup.populateFailedRequests(dataForPopup.failedRequests);
	}

	static updateActiveProfile(dataForPopup: PopupInternalDataType) {

		if (dataForPopup.activeProfileId) {
			popup.activeProfile = dataForPopup.proxyProfiles.find(a => a.profileId == dataForPopup.activeProfileId);
		}
		else
			popup.activeProfile = null;
	}

	private static populateUpdateAvailable(dataForPopup: PopupInternalDataType) {
		if (dataForPopup.updateAvailableText && dataForPopup.updateInfo) {
			jQuery("#divUpdateIsAvailable").show()
				.find("a")
				.text(dataForPopup.updateAvailableText)
				.attr("href", dataForPopup.updateInfo.downloadPage);
		}
	}

	private static populateUnsupportedFeatures(dataForPopup: PopupInternalDataType) {
		if (dataForPopup.notSupportedSetProxySettings) {
			jQuery("#linkSystemProxy").hide();
		}
	}

	private static populateSmartProfiles(profiles: SmartProfileBase[], activeProfileId: string) {
		let divProxyProfiles = jQuery("#divProxyProfiles");
		let divProfileTemplate = divProxyProfiles.find("#divProfileTemplate").hide();
		let popupData = popup.popupData;
		let lastMenu = divProfileTemplate;

		if (popupData.currentTabIsIncognito && popupData.activeIncognitoProfileId) {
			let incognitoProfile = profiles.find(a => a.profileId == popupData.activeIncognitoProfileId);
			if (incognitoProfile != null) {
				jQuery("#divIncognitoProxyProfileHead").removeClass("d-none").show();
				divProxyProfiles.addClass("proxy-profiles-incognito-mode");

				let profileMenu = createMenuItem(incognitoProfile);
				profileMenu.addClass('active');
				profileMenu.show();

				profileMenu.on("click", (e: any) => {
					PolyFill.runtimeOpenOptionsPage();
					popup.closeSelf();
				});

				lastMenu.after(profileMenu);
				lastMenu = profileMenu;

				// completed
				return;
			}
		}

		for (const profile of profiles) {
			if (!profile.enabled)
				continue;
			if (!profile.profileTypeConfig.selectable)
				continue;
			if (profile.profileType === SmartProfileType.SystemProxy &&
				popupData.notSupportedSetProxySettings)
				continue;

			let profileMenu = createMenuItem(profile);

			if (profile.profileId == activeProfileId)
				profileMenu.addClass('active');

			profileMenu.show();
			profileMenu.on("click", (e: any) => popup.onSmartProfileClick(profile, e));

			lastMenu.after(profileMenu);
			lastMenu = profileMenu;
		}

		function createMenuItem(profile: SmartProfileBase): any {
			let newId = 'smart-profile-' + profile.profileId;

			let profileMenu = divProfileTemplate.clone();
			profileMenu.find("span").text(profile.profileName);
			profileMenu.find(".icon").addClass(getSmartProfileTypeIcon(profile.profileType));
			profileMenu.attr("id", newId);

			return profileMenu;
		}
	}

	private static populateActiveProxy(dataForPopup: PopupInternalDataType) {
		let divActiveProxy = jQuery("#divActiveProxy");
		let cmbActiveProxy = divActiveProxy.find("#cmbActiveProxy");
		let lblActiveProxyLabel = jQuery("#lblActiveProxyLabel");

		if (!dataForPopup.proxyServers)
			dataForPopup.proxyServers = [];
		if (!dataForPopup.proxyServersSubscribed)
			dataForPopup.proxyServersSubscribed = [];

		// remove previous items
		cmbActiveProxy.find("option").remove();

		let isProfileProxyServer = false;
		if (dataForPopup.activeProfileId) {
			let activeProfile = popup.activeProfile;
			if (!activeProfile)
				activeProfile = dataForPopup.proxyProfiles.find(a => a.profileId == dataForPopup.activeProfileId);

			if (activeProfile?.profileProxyServerId) {
				isProfileProxyServer = true;
			}
		}
		if (isProfileProxyServer) {
			lblActiveProxyLabel.text(api.i18n.getMessage("popupActiveProxy"));
		}
		else {
			lblActiveProxyLabel.text(api.i18n.getMessage("popupActiveProxyDefault"));
		}

		if (dataForPopup.proxyServers.length > 1 ||
			dataForPopup.proxyServersSubscribed.length) {

			// display select combo
			divActiveProxy.show();

			let currentProxyServerId = dataForPopup.currentProxyServerId;

			// display select options
			jQuery.each(dataForPopup.proxyServers, (index: number, proxyServer: ProxyServer) => {
				// proxyServer
				cmbActiveProxy.append(
					jQuery("<option>")
						.attr("value", proxyServer.id)
						.text(proxyServer.name)
						.prop("selected", proxyServer.id === currentProxyServerId));
			});

			if (dataForPopup.proxyServersSubscribed.length > 0) {
				let subscriptionGroup = jQuery("<optgroup>")
					// -Subscriptions-
					.attr("label", api.i18n.getMessage("popupSubscriptions"))
					.appendTo(cmbActiveProxy);

				dataForPopup.proxyServersSubscribed.forEach(proxyServer => {
					// proxyServer
					let $option = jQuery("<option>")
						.attr("value", proxyServer.id)
						.text(proxyServer.name)
						.appendTo(subscriptionGroup);

					$option.prop("selected", (proxyServer.id === currentProxyServerId));
				});
			}

			cmbActiveProxy.on("change", popup.onActiveProxyChange);

		} else {
			// for one or less we dont show the select proxy
			divActiveProxy.hide();
		}
	}

	private static populateProxyableDomainList(proxyableDomainList: ProxyableDomainType[]) {
		if (!proxyableDomainList || !proxyableDomainList.length)
			return;

		var divProxyableContainer = jQuery("#divProxyableContainer");
		var divProxyableDomain = divProxyableContainer.find("#divProxyableDomains");
		var divProxyableDomainItem = divProxyableDomain.find("#divProxyableDomainItem");

		if (popup.activeProfile && popup.activeProfile.profileType == SmartProfileType.AlwaysEnabledBypassRules) {
			divProxyableContainer.find("#lblIgnoreTheseDomains").removeClass('d-none');
		}
		else {
			divProxyableContainer.find("#lblEnableProxyOn").removeClass('d-none');
		}

		// display the list container
		divProxyableContainer.show();

		// this is proxyable
		jQuery("#openProxyable").show();

		for (let i = 0; i < proxyableDomainList.length; i++) {
			let proxyableDomain = proxyableDomainList[i];
			let domain = proxyableDomain.domain;

			let item = divProxyableDomainItem.clone();
			item.show()
				.find("span.proxyable-host-name")
				.text(domain);
			item.appendTo(divProxyableDomain);
			item.data("proxyable-domain-type", proxyableDomain);

			var itemIcon = item.find(".proxyable-status-icon");
			if (proxyableDomain.ruleSource == CompiledProxyRuleSource.Subscriptions) {
				// disabling the item for subscriptions since these rules can't be disabled/enabled individually

				if (proxyableDomain.ruleHasWhiteListMatch) {
					itemIcon.removeClass("fa-square")
						.addClass("far fa-hand-paper fa-sm");
					item.attr("title", api.i18n.getMessage("settingsRuleActionWhitelist"));
				}
				else {
					itemIcon.removeClass("fa-square")
						.addClass("fas fa-check fa-sm");
				}
				item.show().find("div.proxyable-is-subscription").show();

				item.find(".nav-link").addClass("disabled")
					.attr("title", `Subscription Rule, can't be disabled individually`);
			}
			else if (proxyableDomain.ruleMatched) {
				itemIcon.removeClass("fa-square")
					.addClass("fa-check-square");

				// if the matching rule is not for this host
				if (!proxyableDomain.ruleMatchedThisHost) {
					item.find(".nav-link").addClass("disabled")
						.attr("title", `Enabled by other domains`);
				}
			} else {
				itemIcon.removeClass("fa-check-square")
					.addClass("fa-square");
			}

			item.on("click", popup.onProxyableDomainClick);

			divProxyableDomainItem.hide();
		}
	}

	private static populateFailedRequests(failedRequests: FailedRequestType[]) {

		var divFailedRequests = jQuery("#divFailedRequests");

		if (failedRequests && failedRequests.length) {

			let failedRequestCount = 0;
			let failedRequestsItemsContainer = jQuery(".popup-menu-failed .failed-request-container");

			// the item template
			let failedRequestsItemTemplate = failedRequestsItemsContainer.find(".failed-request-template");
			failedRequestsItemTemplate.hide();

			// save checked domains, preventing check change on refresh
			let domainsStatus: { [index: string]: any } = {};
			failedRequestsItemsContainer.find(".request-box input:checkbox").each((index: number, e: any) => {
				var element = jQuery(e);
				domainsStatus[element.attr("data-domain")] = element.prop("checked");
			});

			// remove previous items
			failedRequestsItemsContainer.find(".request-box:not(.failed-request-template)").remove();

			// Order by parent domain
			failedRequests = failedRequests.sort((a, b) => {
				if (a._domainSortable === null)
					a._domainSortable = Utils.reverseString(a.domain);
				if (b._domainSortable === null)
					b._domainSortable = Utils.reverseString(b.domain);

				if (a._domainSortable > b._domainSortable)
					return 1;
				if (a._domainSortable < b._domainSortable)
					return -1;
				return 0;
			});

			for (let i = 0; i < failedRequests.length; i++) {
				let request = failedRequests[i];

				if (request.hasRule || request.ignored)
					// don't add if the request has rule
					continue;

				let newItem = failedRequestsItemTemplate.clone();
				newItem.find(".request-name a").attr("href", request.url);
				newItem.find(".request-name label>span").text(request.domain);

				let newItemCheckbox = newItem.find("input");
				newItemCheckbox.attr("data-domain", request.domain);
				newItemCheckbox.attr("data-ruleId", request.ruleId);

				if (request.isRootHost) {
					failedRequestCount += request.hitCount;

					newItemCheckbox.prop("checked", false);
				} else {
					newItem.find(".failed-request-root").show();
					newItemCheckbox.prop("checked", true);
					newItem.addClass("request-box-dependant");
				}
				newItem.find(".failed-request-count").text(request.hitCount).show();

				// set previous status, preventing check change on refresh
				let previousStatus = domainsStatus[request.domain];
				if (previousStatus != null) {
					newItemCheckbox.prop("checked", previousStatus);
				}

				newItem.removeClass("failed-request-template");
				newItem.show();

				failedRequestsItemsContainer.append(newItem);
			}

			// updating the failed request count
			divFailedRequests.find("#lblFailedRequestCount").text(failedRequestCount);

			if (failedRequestCount) {
				// display the failed requests block
				divFailedRequests.show();
			} else {
				divFailedRequests.hide();
			}
		} else {
			divFailedRequests.hide();
		}
	}

	//#region Events
	private static onSmartProfileClick(profile: SmartProfileBase, e: any) {

		if (popup.popupData.notAllowedSetProxySettings &&
			profile.profileType == SmartProfileType.SystemProxy) {

			let message: string;
			if (environment.chrome)
				message = api.i18n.getMessage("popupNotAllowedSetProxySettingsChrome");
			else
				message = api.i18n.getMessage("popupNotAllowedSetProxySettingsFirefox");

			messageBox.error(message, 5000);
			return;
		}

		PolyFill.runtimeSendMessage({
			command: CommandMessages.PopupChangeActiveProfile,
			profileId: profile.profileId
		});

		if (profile.profileType != SmartProfileType.Direct &&
			profile.profileType != SmartProfileType.SystemProxy &&
			!popup.popupData.hasProxyServers) {
			// open the settings page
			PolyFill.runtimeOpenOptionsPage();
		}
		popup.refreshActiveTabIfNeeded();
		popup.closeSelf();
	}

	private static refreshActiveTabIfNeeded() {
		if (popup.popupData.refreshTabOnConfigChanges) {
			PolyFill.tabsReload(popup.popupData.currentTabId);
		}
	}

	private static onActiveProxyChange() {
		let cmbActiveProxy = jQuery("#divActiveProxy #cmbActiveProxy");

		let id = cmbActiveProxy.val();
		if (!id) return;

		PolyFill.runtimeSendMessage(
			{
				command: CommandMessages.PopupChangeActiveProxyServer,
				id
			});
		popup.refreshActiveTabIfNeeded();
	}

	private static onProxyableDomainClick() {
		let proxyableDomain: ProxyableDomainType = jQuery(this).data("proxyable-domain-type");

		if (proxyableDomain.ruleSource == CompiledProxyRuleSource.Subscriptions)
			return;

		let domain = proxyableDomain.domain;
		let hasMatchingRule = proxyableDomain.ruleMatched;
		let ruleIsForThisHost = proxyableDomain.ruleMatchedThisHost;

		if (!hasMatchingRule || (hasMatchingRule && ruleIsForThisHost == true)) {
			PolyFill.runtimeSendMessage(`proxyable-host-name: ${domain}`);

			PolyFill.runtimeSendMessage({
				command: CommandMessages.PopupToggleProxyForDomain,
				domain: domain,
				ruleId: proxyableDomain.ruleId
			});

			popup.closeSelf();
		} else {
			PolyFill.runtimeSendMessage(`rule is not for this domain: ${domain}`);
		}
	}

	private static getSelectedFailedRequests(): string[] {
		let domainList: string[] = [];

		jQuery(".failed-request-container .request-box input:checked").each((index: number, e: any) => {
			let element = jQuery(e);
			let domain = element.attr("data-domain");
			if (domain)
				domainList.push(domain);
		});
		return domainList;
	}
	private static onAddFailedRequestsClick() {

		let domainList = popup.getSelectedFailedRequests();

		if (domainList.length) {

			if (!popup.activeProfile.profileTypeConfig.editable ||
				!ProfileOperations.profileTypeSupportsRules(popup.activeProfile.profileType)) {
				let message = api.i18n.getMessage("popupProfileTypeDoesNotSupportsRules").replace("{0}", popup.activeProfile.profileName);
				messageBox.error(message);
				return;
			}

			// Add the selected domains to rule list?
			if ((!environment.chrome && environment.version < environment.bugFreeVersions.firefoxConfirmInPopupWorks) ||
				confirm(api.i18n.getMessage("popupAddFailedRequestsConfirm"))) {

				// send message to the core
				PolyFill.runtimeSendMessage(
					{
						// TODO: change, should include active or previous profile id
						command: CommandMessages.PopupAddDomainListToProxyRule,
						domainList: domainList,
						tabId: popup.popupData.currentTabId
					},
					(response: any) => {
						let close = true;
						try {
							if (!response) return;
							if (response.failedRequests) {

								// display the updated failed requests
								popup.populateFailedRequests(response.failedRequests);
							}
							let result = response.result;
							if (result) {
								if (result.success && result.message) {
									messageBox.success(result.message, 4000);
									close = false;
								}
								else if (!result.success && result.message) {
									messageBox.error(result.message);
									close = false;
								}
							}
						} finally {
							if (close) {
								popup.closeSelf();
							}
						}
					});
			}
		}
	}

	private static onAddIgnoredFailuresClick() {

		let domainList = popup.getSelectedFailedRequests();

		if (domainList.length) {

			// Add the selected domains to rule list?
			if ((!environment.chrome && environment.version < environment.bugFreeVersions.firefoxConfirmInPopupWorks) ||
				confirm(api.i18n.getMessage("popupAddIgnoredFailuresConfirm"))) {

				// send message to the core
				PolyFill.runtimeSendMessage(
					{
						// TODO: change, should include active or previous profile id
						command: CommandMessages.PopupAddDomainListToIgnored,
						domainList: domainList,
						tabId: popup.popupData.currentTabId
					},
					(response: any) => {
						let close = true;
						try {
							if (!response) return;
							if (response.failedRequests) {

								// display the updated failed requests
								popup.populateFailedRequests(response.failedRequests);
							}
							let result = response.result;
							if (result) {
								if (result.success && result.message) {
									messageBox.success(result.message, 4000);
									close = false;
								}
								else if (!result.success && result.message) {
									messageBox.error(result.message);
									close = false;
								}
							}
						} finally {
							if (close) {
								popup.closeSelf();
							}
						}
					});
			}
		}
	}
	private static closeSelf() {
		if (!environment.mobile) {
			window.close();
		}
		else {
			PolyFill.tabsGetCurrent(details => {
				return PolyFill.tabsRemove(details.id);
			});
		}
	}
	//#endregion
}

popup.initialize();
