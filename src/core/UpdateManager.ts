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
import { Debug } from "../lib/Debug";
import { browser } from "../lib/environment";

export class UpdateManager {
    private static updateInfoUrl: "https://raw.githubusercontent.com/salarcode/SmartProxy/master/updateinfo.json";
    private static unlistedVersionIndicator = "-unlisted";
    public static updateIsAvailable = false;
    public static updateInfo: UpdateInfoType = null;

    public static readUpdateInfo() {

        let addonId = browser.runtime.id || "";

        // IMPORTANT NOTE:
        // this code will not run in listed versions (listed in AMO or WebStore)
        if (addonId.indexOf(UpdateManager.unlistedVersionIndicator) != -1) {

            let xhr = new XMLHttpRequest();
            xhr.open("GET", UpdateManager.updateInfoUrl);

            xhr.onload = () => {
                if (xhr.status === 200) {
                    try {
                        let updateInfoObj = JSON.parse(xhr.responseText);

                        if (updateInfoObj && updateInfoObj.latestVersion) {
                            let updateInfo: UpdateInfoType =
                                Object.assign(new updateInfoObj(), updateInfoObj.latestVersion);

                            UpdateManager.updateInfo = updateInfo;
                        }
                        else {
                            UpdateManager.updateInfo = null;
                        }

                        checkForUpdate(UpdateManager.updateInfo);

                    } catch (e) {
                        Debug.error("readUpdateInfo>", e);
                    }
                }
            };
            xhr.send();
        }

        function checkForUpdate(updateInfo: UpdateInfoType) {

            let manifest = browser.runtime.getManifest();

            if (updateInfo && updateInfo.version > manifest.version) {
                UpdateManager.updateIsAvailable = true;
            }
            else
                UpdateManager.updateIsAvailable = false;
        }
    }
}

export type UpdateInfoType = {
    version: string,
    versionName: string,
    downloadPage: URL
}