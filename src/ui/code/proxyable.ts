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
import { CommandMessages, ProxyableInternalDataType, ProxyableLogDataType, CompiledProxyRule, CompiledProxyRuleSource, ProxyableProxifiedStatus } from "../../core/definitions";
import { PolyFill } from "../../lib/PolyFill";
import { jQuery, messageBox } from "../../lib/External";
import { api, environment } from "../../lib/environment";
import { Utils } from "../../lib/Utils";

export class proxyable {
	private static grdProxyable: any;
	private static sourceTabId: number = null;
	private static selfTabId: number;

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
				command: CommandMessages.ProxyableGetInitialData,
				tabId: proxyable.sourceTabId,
			},
			(dataForProxyable: ProxyableInternalDataType) => {
				if (dataForProxyable == null) {
					// Chrome Manifest 3 has this bug tha sends null message
					if (!environment.chrome) {
						// Source tab not found!
						messageBox.error(api.i18n.getMessage("proxyableErrNoSourceTab"));
					}
					return;
				}

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
		api.runtime.onMessage.addListener(proxyable.handleMessages);

		CommonUi.onDocumentReady(CommonUi.localizeHtmlPage);
	}

	private static stopListeningToLogger() {
		// request log for this page
		PolyFill.runtimeSendMessage({
			command: CommandMessages.ProxyableRemoveProxyableLog,
			tabId: proxyable.sourceTabId
		});
	}

	private static handleMessages(message: any, sender: any, sendResponse: Function) {

		if (typeof (message) != "object")
			return;
		if (message["command"] === CommandMessages.ProxyableGetInitialDataResponse &&
			message["dataForProxyable"] != null) {

			let tabId = message.tabId;
			if (tabId != proxyable.sourceTabId) {
				return;
			}
			let dataForProxyable = message.dataForProxyable;
			if (dataForProxyable) {
				proxyable.populateDataForProxyable(dataForProxyable);
			}
			return;
		}
		if (message["command"] === CommandMessages.ProxyableRequestLog &&
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

		if (message["command"] === CommandMessages.ProxyableOriginTabRemoved &&
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
			PolyFill.tabsReload(proxyable.sourceTabId);
		});
		jQuery("#btnClear").click(() => {
			proxyable.grdProxyable.clear();
			proxyable.grdProxyable.draw('full-hold');
		});
		jQuery("#btnBenchmark").click(() => {

			messageBox.info('Check the Console for results');

			PolyFill.runtimeSendMessage(
				{
					command: "BenchmarkTheRules",
					urls: proxyable.grdProxyable.data().toArray().map(a => a.url),
				},
				(response: {
					rules: CompiledProxyRule[],
					whiteListRules: CompiledProxyRule[]
				}) => {
				},
				(error: Error) => {
					PolyFill.runtimeSendMessage("BenchmarkTheRules failed! > " + error);
				});
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
					name: "url", data: "url", title: api.i18n.getMessage("proxyableGridColUrl"), className: "grid-ellipsis-text-cell", width: '60%',
					render: function (data: any, type: any, row: ProxyableLogDataType): string {
						return `<a class='wordwrap-anywhere grid-ellipsis-text-link' href="${data}" target="_blank">${data}</a>`;
					},
				},
				{
					name: "proxifiedStatus", data: "proxifiedStatusName", title: api.i18n.getMessage("proxyableGridColProxifiedStatus"), width: 100, className: 'grid-col-nowrap vertical-align-middle',
					render: function (data: any, type: any, row: ProxyableLogDataType): string {
						let reason = api.i18n.getMessage(`proxyableGridCol_ProxifiedStatus_${row.proxifiedStatusName}`);
						if (row.proxified) {
							return '<i class="fas fa-check text-success"></i> ' + reason;
						}
						else {
							return '<i class="fas fa-minus text-danger"></i> ' + reason;
						}
					}
				},
				{
					name: "matchedRuleStatus", data: "matchedRuleStatusName", title: api.i18n.getMessage("proxyableGridColRuleStatus"), width: 100, className: 'grid-col-nowrap vertical-align-middle',
					render: function (data: any, type: any, row: ProxyableLogDataType): string {
						return api.i18n.getMessage(`proxyableGridCol_RuleStatus_${row.matchedRuleStatusName}`);
					}
				},
				{
					name: "ruleHostName", data: "ruleHostName", title: api.i18n.getMessage("proxyableGridColRuleHost"), className: 'grid-status-col-text grid-col-nowrap vertical-align-middle',
					render: function (data: any, type: any, row: ProxyableLogDataType): string {
						return `<div class='wordwrap-anywhere grid-col-maxwidth-100' title="${data}">${data || ''}</div>`;
					}
				},
				{
					name: "rulePatternText", data: "rulePatternText", title: api.i18n.getMessage("proxyableGridColRulePattern"), className: "grid-status-col-text grid-col-nowrap vertical-align-middle",
					render: function (data: any, type: any, row: ProxyableLogDataType): string {
						return `<div class='wordwrap-anywhere grid-col-maxwidth-100' title="${data}">${data || ''}</div>`;
					}
				},
				{
					name: "enabled", width: 100, title: '', className: 'text-center vertical-align-middle',
					render: (data: any, type: any, row: ProxyableLogDataType): string => {
						let url = row.url;
						if (!url)
							return "";
						if (row.ruleSource == CompiledProxyRuleSource.Subscriptions) {
							return `<small class="grid-status-col-text grid-col-maxwidth-100 grid-col-nowrap">${api.i18n.getMessage("proxyableSubscriptionRule")}</small>`;
						}
						if (row.ruleId) {
							return `<button id='btnDisable' data-domain="${row.ruleHostName}" data-ruleId="${row.ruleId}" class="btn btn-sm btn-danger whitespace-nowrap">
									<i class="fa fa-times" aria-hidden="true"></i> ${api.i18n.getMessage("proxyableDisableButton")}</button>`;
						}
						else {
							// if (row.proxied) {
							// 	return '<i class="fas fa-minus text-danger"></i>';
							// }
							let subDomains: string[];
							if (row["subDomains"])
								subDomains = row["subDomains"];
							else
								subDomains = row["subDomains"] = Utils.extractSubdomainListFromUrl(url);

							if (subDomains && subDomains.length) {
								const template =
									`<div><div class="btn-group dropstart">
										<button type="button" class="btn btn-sm btn-success dropdown-toggle whitespace-nowrap" data-bs-toggle="dropdown">
											${api.i18n.getMessage("proxyableEnableButton")}
											<i class="fa fa-plus" aria-hidden="true"></i>
										</button>
										<ul class="subdomains-list dropdown-menu dropdown-menu-end">
											<li><a class="dropdown-item" href="#">(none)</a></li>
										</ul>
									</div></div>`;

								let templateElement = jQuery(template);
								let subdomainContainer = templateElement.find(".subdomains-list");
								subdomainContainer.empty();

								for (let domain of subDomains) {
									let domainElement = jQuery(`<li><a class="dropdown-item" data-domain="${domain}" href="#"><small>${api.i18n.getMessage("proxyableEnableButtonDomain")} 
																<b class='font-url'>${domain}</b></small></a></li>`);

									subdomainContainer.append(domainElement);
								}

								return templateElement.html();
							}
						}

						return "";
					}
				},
			],
		});
		proxyable.grdProxyable.draw();
	}

	private static populateDataForProxyable(dataForProxyable: ProxyableInternalDataType) {
		if (!dataForProxyable)
			return;

		CommonUi.applyThemes(dataForProxyable.themeData);

		jQuery("#spanPageUrl")
			.show()
			.text(dataForProxyable.url);
		jQuery("#txtPageUrl")
			.show()
			.val(dataForProxyable.url);
	}

	private static insertNewLogInGrid(newRequest: ProxyableLogDataType) {
		try {
			let request = new ProxyableLogDataType();
			Object.assign(request, newRequest);

			request.ruleHostName = request.ruleHostName || "";
			request.rulePatternText = request.rulePatternText || "";

			let row = this.grdProxyable.row
				.add(request)
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
		rowElement.find("#btnDisable").on("click", proxyable.onDisableSubdomainClick);
	}

	private static onToggleSubdomainClick() {
		let element = jQuery(this);
		let domain = element.data("domain");
		if (!domain)
			return;
		let ruleId = element.data("ruleId");

		let gridRow = proxyable.grdProxyable.row(element.parents('tr'));

		messageBox.confirm(`${api.i18n.getMessage("proxyableCreateRuleConfirm")} <b>'${domain}'</b>?`,
			() => {
				proxyable.toggleProxyableRequest(domain, null, ruleId, gridRow);
			});
	}

	private static onDisableSubdomainClick() {
		let element = jQuery(this);
		let domain = element.data("domain");
		if (!domain)
			return;
		let ruleId = element.data("ruleId");

		let gridRow = proxyable.grdProxyable.row(element.parents('tr'));

		messageBox.confirm(`${api.i18n.getMessage("proxyableDeleteRuleConfirm")} <b>'${domain}'</b>?`,
			() => {
				proxyable.toggleProxyableRequest(null, domain, ruleId, gridRow);
			});
	}

	private static toggleProxyableRequest(enableByDomain: string, removeBySource?: string, ruleId?: string, gridRow?: any) {
		PolyFill.runtimeSendMessage(
			{
				command: CommandMessages.ProxyableToggleProxyableDomain,
				enableByDomain: enableByDomain,
				removeBySource: removeBySource,
				ruleId: ruleId,
				tabId: proxyable.sourceTabId
			},
			(response: any) => {
				if (!response)
					return;

				if (response.success) {
					if (response.message) {
						messageBox.success(response.message);
					}
					if (gridRow) {
						var rowData: ProxyableLogDataType = gridRow.data();
						var rule = response.rule;

						if (rowData) {
							// Not a complete fix on displaying the rule. This is a temporary visual change, next time the rule should be displayed correctly
							if (enableByDomain) {
								if (rule)
									rowData.applyFromRule(rule);
								rowData.proxifiedStatus = ProxyableProxifiedStatus.MatchedRule;
							}
							else if (removeBySource) {
								rowData.removeRuleInfo();
								rowData.proxifiedStatus = ProxyableProxifiedStatus.NoProxy;
							}
						}
						proxyable.refreshGridRow(gridRow, true);
					}
					else
						proxyable.refreshGridAllRows(true);

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