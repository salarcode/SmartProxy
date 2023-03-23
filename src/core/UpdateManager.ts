/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2023 Salar Khalilzadeh <salar2k@gmail.com>
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
import { Debug, DiagDebug } from "../lib/Debug";
import { api, environment } from "../lib/environment";
import { SettingsOperation } from "./SettingsOperation";

export class UpdateManager {
	private static updateIsChecking = false;

	public static readUpdateInfo() {

		if (UpdateManager.updateIsChecking) {
			DiagDebug?.trace("Checking for update is already in progress...");
			return;
		}
		UpdateManager.updateIsChecking = true;
		DiagDebug?.trace("Checking for update...");

		let updateInfoUrl = "https://raw.githubusercontent.com/salarcode/SmartProxy/master/updateinfo.json";

		if (Debug.isEnabled()) {
			updateInfoUrl = "http://localhost:5500/updateinfo.json";
		}

		fetch(updateInfoUrl, {
			method: 'GET',
		})
			.then((response) => response.json())
			.then((result) => {
				DiagDebug?.trace("Checking for update result", result);
				checkForUpdate(result);
			})
			.catch((error) => {
				Debug.warn(`Checking for update has failed`, error);
			})
			.finally(() => {
				UpdateManager.updateIsChecking = false;
			});


		function checkForUpdate(updatePackage: any) {
			if (!updatePackage || !updatePackage.latestVersion || !updatePackage.latestVersion.version) {
				Debug.warn("Invalid update info has received", updatePackage);
				return;
			}
			let latestVersion: UpdateInfoType = updatePackage.latestVersion;

			let manifestVersion = api.runtime.getManifest().version;
			let isBrowserSpecific = false;
			if (updatePackage.browsers) {
				const browserSpecificVersion: UpdateInfoType = updatePackage.browsers[environment.browserConfig.name]?.latestVersion;

				// overriding with browser specific version
				if (browserSpecificVersion) {
					if (browserSpecificVersion.version) {
						latestVersion.version = browserSpecificVersion.version || latestVersion.version;
						latestVersion.versionName = browserSpecificVersion.versionName || latestVersion.versionName;
						isBrowserSpecific = true;
					}
					latestVersion.downloadPage = browserSpecificVersion.downloadPage || latestVersion.downloadPage;
				}
			}

			// checking...
			if (latestVersion.version > manifestVersion) {
				DiagDebug?.trace("New update is found", latestVersion);

				SettingsOperation.saveUpdateInfo({
					updateIsAvailable: true,
					downloadPage: latestVersion.downloadPage,
					version: latestVersion.version,
					versionName: latestVersion.versionName,
					isBrowserSpecific: isBrowserSpecific
				});
			}
			else {

				SettingsOperation.saveUpdateInfo({
					updateIsAvailable: false,
					downloadPage: null,
					version: null,
					versionName: null,
					isBrowserSpecific: isBrowserSpecific
				});
			}
		}
	}
}

export type UpdateInfoType = {
	version: string,
	versionName: string,
	downloadPage: URL
}