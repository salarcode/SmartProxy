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
import { jQuery } from "../../lib/External";
import { browser } from "../../lib/environment";
import { GeneralOptions, PartialThemeDataType, themesCustomType, themesDarkFix, themesDataTablesDarkFix, ThemeType } from "../../core/definitions";
import { Utils } from "../../lib/Utils";

export class CommonUi {

	public static downloadData(data: any, fileName: string) {

		let downloadUrl = "data:application/json;charset=utf-8," + encodeURIComponent(data);
		let a = jQuery("<a/>")
			.attr("download", fileName || "")
			.attr("href", downloadUrl);
		a[0].dispatchEvent(new MouseEvent("click"));
	}

	public static onDocumentReady(callback: Function) {
		jQuery(document).ready(callback);
	}

	public static selectFileOnTheFly(form: HTMLElement, inputName: string, onFileSelected: Function, acceptFormat?: string) {
		///<summary>Select a file from a detached file input</summary>
		let fileContainer = jQuery(`<div style='display: none'><input style='display: none' type=file accept='${acceptFormat || ""}' class='' name='${inputName}'/></div>`);
		let fileInput = fileContainer.find("input");

		form = jQuery(form);
		form.append(fileContainer);

		function onFile(evt: any) {
			fileContainer.remove();

			let files = evt.target.files;
			if (!files.length)
				return;

			if (onFileSelected) {
				onFileSelected(fileInput, files);
			}
		}
		fileInput.on("change", onFile);
		fileInput.trigger("click");
	}

	//** localize the ui */
	public static localizeHtmlPage() {

		function replace_i18n(obj: any, tag: string) {
			let msg = browser.i18n.getMessage(tag.trim());

			if (msg && msg != tag) obj.innerHTML = msg;
		}

		// page direction
		let dir = browser.i18n.getMessage("uiDirection");
		if (dir) {
			jQuery(document.body).addClass(dir).css("direction", dir);
		}

		// Localize using data-localize tags
		let data = document.querySelectorAll("[data-localize]");

		for (let i = 0; i < data.length; i++) {
			const obj: any = data[i];
			let tag = obj.dataset["localize"];

			replace_i18n(obj, tag);
		}
	}

	public static applyThemes(options: GeneralOptions | PartialThemeDataType) {

		if (options.themeType == ThemeType.Auto) {
			insertColorSchema("dark light");
			if (options.themesDark == themesCustomType &&
				options.themesDarkCustomUrl) {
				insertDataTablesDarkThemeFix("(prefers-color-scheme: dark)");
				insertDarkThemeFix("(prefers-color-scheme: dark)");
				insertStyleSheet(options.themesDarkCustomUrl, "(prefers-color-scheme: dark)");
			}
			else if (options.themesDark) {
				insertDataTablesDarkThemeFix("(prefers-color-scheme: dark)");
				insertDarkThemeFix("(prefers-color-scheme: dark)");
				insertStyleSheet(options.themesDark + ".css", "(prefers-color-scheme: dark)");
			}

			if (options.themesLight == themesCustomType &&
				options.themesLightCustomUrl) {
				insertStyleSheet(options.themesLightCustomUrl, "(prefers-color-scheme: light)");
			}
			else if (options.themesLight) {
				insertStyleSheet(options.themesLight + ".css", "(prefers-color-scheme: light)");
			}
		}
		else if (options.themeType == ThemeType.Dark) {
			insertColorSchema("dark");
			if (options.themesDark == themesCustomType &&
				options.themesDarkCustomUrl) {
				insertDataTablesDarkThemeFix();
				insertDarkThemeFix();
				insertStyleSheet(options.themesDarkCustomUrl);
			}
			else if (options.themesDark) {
				insertDataTablesDarkThemeFix();
				insertDarkThemeFix();
				insertStyleSheet(options.themesDark + ".css");
			}
		}
		else if (options.themeType == ThemeType.Light) {
			insertColorSchema("light");
			if (options.themesLight == themesCustomType &&
				options.themesLightCustomUrl) {
				insertStyleSheet(options.themesLightCustomUrl);
			}
			else if (options.themesLight) {
				insertStyleSheet(options.themesLight + ".css");
			}
		}

		function insertDarkThemeFix(media: string = undefined) {
			insertStyleSheet(themesDarkFix, media);
		}
		function insertDataTablesDarkThemeFix(media: string = undefined) {
			insertStyleSheet(themesDataTablesDarkFix, media);
		}
		function insertStyleSheet(url: string, media: string = undefined) {
			const linkTheme = document.createElement('link');
			linkTheme.type = 'text/css';
			linkTheme.rel = 'stylesheet';
			if (Utils.urlHasSchema(url))
				linkTheme.href = url;
			else
				linkTheme.href = `css/${url}`;
			if (media)
				linkTheme.media = media;
			document.getElementsByTagName('head')[0].appendChild(linkTheme);
		}
		function insertColorSchema(content: string) {
			const linkTheme = document.createElement('meta');
			linkTheme.name = 'color-scheme';
			linkTheme.content = content;
			document.getElementsByTagName('head')[0].appendChild(linkTheme);
			let styles = `<style>
				:root {
					color-scheme: ${content};
				}</style>`;
			jQuery(styles).appendTo(jQuery("head"));
		}
	}
}