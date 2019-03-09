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
import { Messages, ProxyableInternalDataType, ProxyableDataType } from "../../core/definitions";
import { PolyFill } from "../../lib/PolyFill";
import { jQuery, messageBox } from "../../lib/External";
import { browser } from "../../lib/environment";
import { Utils } from "../../lib/Utils";

export class proxyable {
	private static grdProxyable: any;
	private static sourceTabId: number = null;
	private static selfTabId: number;
	private static proxyableData: ProxyableInternalDataType;

	public static initialize() {

		let url = new URL(document.location.toString());
		let idStr = url.searchParams.get("id");
		let id = parseInt(idStr);
		proxyable.sourceTabId = id;

		// should be greater or equal to zero
		if (!(id > -1)) {
			window.close();
			return;
		}

		CommonUi.onDocumentReady(proxyable.bindEvents);
		CommonUi.onDocumentReady(proxyable.initializeGrids);

		PolyFill.runtimeSendMessage(
			{
				command: Messages.ProxyableGetInitialData,
				tabId: proxyable.sourceTabId,
			},
			(dataForProxyable: ProxyableInternalDataType) => {
				if (dataForProxyable == null) {
					// Source tab not found!
					messageBox.error(browser.i18n.getMessage("proxyableErrNoSourceTab"));
					return;
				}

				proxyable.proxyableData = dataForProxyable;
				proxyable.populateDataForProxyable(dataForProxyable);
			},
			(error: Error) => {
				PolyFill.runtimeSendMessage("ProxyableGetInitialData failed! > " + error);
			});

		// read own tab id
		PolyFill.tabsQuery({ active: true, currentWindow: true },
			(tabs: any[]) => {
				if (!tabs || !tabs[0])
					return;

				proxyable.selfTabId = tabs[0].id;
			});


		// start handling messages
		browser.runtime.onMessage.addListener(proxyable.handleMessages);

		CommonUi.onDocumentReady(CommonUi.localizeHtmlPage);
	}
	private static stopListeningToLogger() {
		// request log for this page
		PolyFill.runtimeSendMessage({
			command: Messages.ProxyableRemoveProxyableLog,
			tabId: proxyable.sourceTabId
		});
	}

	private static handleMessages(message: any, sender: any, sendResponse: Function) {

		if (typeof (message) != "object")
			return;
		if (message["command"] === Messages.ProxyableRequestLog &&
			message["tabId"] != null) {

			let tabId = message.tabId;
			if (tabId != proxyable.sourceTabId) {
				return;
			}

			// insert to the grid
			proxyable.insertNewLogInGrid(message.logInfo);

			// Chrome requires a response
			if (sendResponse)
				sendResponse(null);

			return;
		}

		if (message["command"] === Messages.ProxyableOriginTabRemoved &&
			message["tabId"] != null) {

			let tabId = message.tabId;
			if (tabId != proxyable.sourceTabId) {
				return;
			}

			// Chrome requires a response before current tab gets removed
			if (sendResponse)
				sendResponse(null);

			// Close this tab
			proxyable.closeSelf();

			return;
		}

		// Chrome requires a response
		if (sendResponse)
			sendResponse(null);
	}

	private static bindEvents() {
		window.onbeforeunload = proxyable.stopListeningToLogger;

		jQuery("#btnClose").click(() => {
			proxyable.closeSelf();
		});

		jQuery("#btnReload").click(() => {
			//proxyableGrid.clearLogData();
			PolyFill.tabsReload(proxyable.sourceTabId);
		});
	}

	private static initializeGrids() {

		let dataTableCustomDom = '<t><"row"<"col-sm-12 col-md-5"<"text-left float-left"f>><"col-sm-12 col-md-7"<"text-right"l>>><"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>';

		proxyable.grdProxyable = jQuery("#grdProxyable").DataTable({
			"dom": dataTableCustomDom,
			paging: false,
			select: false,
			ordering: false,
			scrollY: 600, scrollCollapse: true,
			lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
			columns: [
				{
					name: "url", data: "url", title: browser.i18n.getMessage("proxyableGridColUrl"),
					render: function (data: any, type: any, row: ProxyableDataType): string {
						return `<a class='wordwrap-anywhere' href="${data}" target="_blank">${data}</a>`;
					},
				},
				{
					name: "enabled", data: "enabled", title: browser.i18n.getMessage("proxyableGridColEnabled"),
					render: function (data: any, type: any, row: ProxyableDataType): string {
						return `<input type='checkbox' disabled ${row.enabled ? 'checked' : ''} />`
					}
				},
				{
					name: "sourceDomain", data: "sourceDomain", title: browser.i18n.getMessage("proxyableGridColSource"),
				},
				{
					name: "enabled",
					render: (data: any, type: any, row: ProxyableDataType): string => {
						let url = row.url;
						if (!url)
							return "";
						if (row.enabled) {
							return `<button id='btnDisable' data-domain="${row.sourceDomain}" class="btn btn-sm btn-danger whitespace-nowrap">
                                    <i class="fa fa-times" aria-hidden="true"></i> ${browser.i18n.getMessage("proxyableDisableButton")}</button>`;
						}
						else {
							let subDomains = Utils.extractSubdomainListFromUrl(url);

							if (subDomains && subDomains.length) {
								const template =
									`<div><div class="btn-group dropleft">
                                        <button type="button" class="btn btn-sm btn-success dropdown-toggle whitespace-nowrap" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                            ${browser.i18n.getMessage("proxyableEnableButton")}
                                            <i class="fa fa-plus" aria-hidden="true"></i>
                                        </button>
                                        <div class="subdomains-list dropdown-menu dropdown-menu-right">
                                            <a class="dropdown-item" href="#">(none)</a>
                                        </div>
                                    </div></div>`;

								let templateElement = jQuery(template);
								let subdomainContainer = templateElement.find(".subdomains-list");
								subdomainContainer.empty();

								for (let domain of subDomains) {
									let domainElement = jQuery(`<a class="dropdown-item" data-domain="${domain}" href="#"><small>${browser.i18n.getMessage("proxyableEnableButtonDomain")} 
                                                                <b class='font-url'>${domain}</b></small></a>`);

									subdomainContainer.append(domainElement);
								}

								return templateElement.html();
							}
						}

						return "";
					}
				}
			],
		});
		proxyable.grdProxyable.draw();

		if (proxyable.proxyableData &&
			proxyable.proxyableData.requests &&
			proxyable.proxyableData.requests.length > 0) {
			proxyable.loadRequests(proxyable.proxyableData.requests);
		}
	}

	private static populateDataForProxyable(dataForProxyable: ProxyableInternalDataType) {
		if (!dataForProxyable)
			return;

		jQuery("#spanPageUrl")
			.show()
			.text(dataForProxyable.url);
		jQuery("#txtPageUrl")
			.show()
			.val(dataForProxyable.url);

		if (dataForProxyable.requests && dataForProxyable.requests.length > 0) {
			proxyable.loadRequests(dataForProxyable.requests);
		}
	}

	private static loadRequests(requests: ProxyableDataType[]) {
		if (!this.grdProxyable)
			return;
		this.grdProxyable.clear();

		this.grdProxyable.rows.add(requests).draw('full-hold');
		this.grdProxyable.row(requests.length - 1).scrollTo();

		// binding the events for all the rows
		this.refreshGridAllRows();
	}


	private static insertNewLogInGrid(newRequest: any) {
		try {

			let row = this.grdProxyable.row
				.add(newRequest)
				.draw('full-hold');

			row.scrollTo();

			// binding the events
			proxyable.refreshGridRow(row);
		} catch (error) {
			PolyFill.runtimeSendMessage("insertNewLogInGrid failed! > " + error);
			throw error;
		}
	}
	private static refreshGridAllRows(invalidate?: boolean) {
		if (invalidate) {
			proxyable.grdProxyable
				.rows().invalidate()
				.draw('full-hold');
		}
		else {
			proxyable.grdProxyable.rows().draw('full-hold');
		}


		var nodes = this.grdProxyable.rows().nodes();
		for (let index = 0; index < nodes.length; index++) {
			const rowElement = jQuery(nodes[index]);

			rowElement.find(".subdomains-list a").on("click", proxyable.onToggleSubdomainClick);
			rowElement.find("#btnDisable").on("click", proxyable.onDisableSubdomainClick);
		}
	}

	private static refreshGridRow(row: any, invalidate?: boolean) {
		if (!row)
			return;
		if (invalidate)
			row.invalidate();

		let rowElement = jQuery(row.node());

		// NOTE: to display update data the row should be invalidated
		// and invalidated row loosed the event bindings.
		// so we need to bind the events each time data changes.

		rowElement.find(".subdomains-list a").on("click", proxyable.onToggleSubdomainClick);
	}

	private static onToggleSubdomainClick() {
		let element = jQuery(this);
		let domain = element.data("domain");
		if (!domain)
			return;

		let gridRow: ProxyableDataType = proxyable.grdProxyable.row(element.parents('tr'));

		messageBox.confirm(`${browser.i18n.getMessage("proxyableCreateRuleConfirm")} <b>'${domain}'</b>?`,
			() => {
				proxyable.toggleProxyableRequest(domain, null, gridRow);
			});
	}

	private static onDisableSubdomainClick() {
		let element = jQuery(this);
		let domain = element.data("domain");
		if (!domain)
			return;

		let gridRow: ProxyableDataType = proxyable.grdProxyable.row(element.parents('tr'));

		messageBox.confirm(`${browser.i18n.getMessage("proxyableDeleteRuleConfirm")} <b>'${domain}'</b>?`,
			() => {
				proxyable.toggleProxyableRequest(null, domain, gridRow);
			});
	}

	private static toggleProxyableRequest(enableByDomain: string, removeBySource?: string, gridRow?: ProxyableDataType) {

		PolyFill.runtimeSendMessage(
			{
				command: Messages.ProxyableToggleProxyableDomain,
				enableByDomain: enableByDomain,
				removeBySource: removeBySource,
				tabId: proxyable.sourceTabId
			},
			(response: any) => {
				if (!response)
					return;

				if (response.success) {
					if (response.message) {
						messageBox.success(response.message);
					}
					let requests: ProxyableDataType[] = response.requests;

					if (requests) {
						proxyable.proxyableData.requests = requests;
						proxyable.loadRequests(requests);
					}
					else {
						if (gridRow)
							proxyable.refreshGridRow(gridRow, true);
						else
							proxyable.refreshGridAllRows(true);
					}

				} else {
					if (response.message)
						messageBox.error(response.message);
				}
			});
	}

	private static closeSelf() {
		// signal stopping the logger
		proxyable.stopListeningToLogger();

		// close this tab
		PolyFill.tabsRemove(proxyable.selfTabId);
	}

}

proxyable.initialize();