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
import { Utils } from "./Utils";
import { api } from "./environment";
import { ProxyServerSubscription, ProxyServer, ProxyServerSubscriptionFormat } from "../core/definitions";
import { Debug } from "./Debug";
import { ProxyEngineSpecialRequests } from "../core/ProxyEngineSpecialRequests";

export const ProxyImporter = {
    readFromServer(serverDetail: ProxyServerSubscription, success?: Function, fail?: Function) {
        if (!serverDetail || !serverDetail.url) {
            if (fail) fail();
            return;
        }
        if (!success) throw "onSuccess callback is mandatory";

        function ajaxSuccess(response: any) {
            if (!response) {
                if (fail) fail();
                return;
            }
            ProxyImporter.importText(response,
                null,
                false,
                null,
                (importResult: { success: boolean, message: string, result: ProxyServer[] }) => {
                    if (!importResult.success) {
                        if (fail) fail(importResult);
                        return;
                    }
                    if (success) success(importResult);
                },
                (error: Error) => {
                    if (fail) fail(error);
                },
                serverDetail);
        }

        if (serverDetail.applyProxy !== null)
            ProxyEngineSpecialRequests.setSpecialUrl(serverDetail.url, serverDetail.applyProxy);

        fetch(serverDetail.url, {
            method: "GET",
            cache: 'no-store',
            headers: {
                ...(serverDetail.username
                    ? { Authorization: 'Basic ' + btoa(serverDetail.username + ':' + atob(serverDetail.password)) }
                    : {}),
            }
        })
            .then(async res => {
                if (res.status === 200) {
                    ajaxSuccess(await res.text());
                } else if (fail) {
                    fail(new Error(`${res.status}, ${res.statusText}`));
                }
            })
            .catch(err => {
                if (fail) fail(err);
            });
    },

    importText(text: string | ArrayBuffer, file: any, append: boolean, currentProxies: ProxyServer[], success: Function, fail?: Function, options?: ProxyServerSubscription) {
        if (!file && !text) {
            if (fail) fail();
            return;
        }

        if (text) {
            doImport(text as string, options);
        } else {
            let reader = new FileReader();
            reader.onerror = event => { if (fail) fail(event); };
            reader.onload = () => {
                doImport(reader.result as string, options);
            };
            reader.readAsText(file);
        }

        function doImport(text: string, options?: ProxyServerSubscription) {
            let parsedProxies: ProxyServer[] = (options && options.format === ProxyServerSubscriptionFormat.Json)
                ? ProxyImporter.parseJson(text, options)
                : ProxyImporter.parseText(text, options);

            if (parsedProxies == null) {
                if (fail) fail();
                return;
            }

            let importedProxies: ProxyServer[] = Utils.removeDuplicatesFunc(parsedProxies,
                (item1: ProxyServer, item2: ProxyServer) =>
                    item1.host === item2.host &&
                    item1.port === item2.port &&
                    item1.username === item2.username &&
                    item1.password === item2.password);

            if (append) {
                if (!currentProxies) currentProxies = [];
                let appendedProxyList: ProxyServer[] = currentProxies.slice();
                let appendedProxyCount = 0;

                for (let importedProxy of importedProxies) {
                    let exists = currentProxies.some(cp =>
                        cp.host === importedProxy.host &&
                        cp.port === importedProxy.port &&
                        cp.username === importedProxy.username &&
                        cp.password === importedProxy.password);
                    if (exists) continue;

                    appendedProxyList.push(importedProxy);
                    appendedProxyCount++;
                }

                let message = api.i18n.getMessage("importerImportProxySuccess")
                    .replace("{0}", appendedProxyCount.toString())
                    .replace("{1}", importedProxies.length.toString());

                success({ success: true, message: message, result: appendedProxyList });
            } else {
                let message = api.i18n.getMessage("importerImportProxySuccess")
                    .replace("{0}", importedProxies.length.toString())
                    .replace("{1}", parsedProxies.length.toString());

                success({ success: true, message: message, result: importedProxies });
            }
        }
    },

    /** Финальная версия parseText с поддержкой IPv6, протоколов и авторизации */
    parseText: (proxyListText: string, options?: ProxyServerSubscription): ProxyServer[] => {
        ///<summary>Parses proxy list with robust support for IPv4, IPv6, protocols, auth and names</summary>
        if (!proxyListText || typeof proxyListText !== "string") return null;

        // Обработка base64 обфускации
        if (options?.obfuscation?.toLowerCase() === "base64") {
            try {
                proxyListText = atob(proxyListText);
            } catch (e) {
                return null;
            }
        }

        const lines = proxyListText.split(/\r?\n/);
        const parsedProxies: ProxyServer[] = [];
        const defaultProtocol = (options?.proxyProtocol || "HTTP").toUpperCase();

        for (let line of lines) {
            line = line.trim();
            if (line.length < 4 || line.startsWith('#') || line.startsWith('//')) continue;

            let protocol = defaultProtocol;
            let name: string | null = null;
            let username = '';
            let password = '';
            let host = '';
            let port = 0;
            let workingLine = line;

            // 1. Префикс протокола (http:// https:// socks4:// socks5:// socks://)
            const prefixMatch = workingLine.match(/^(https?|socks[45]?):\/\//i);
            if (prefixMatch) {
                let p = prefixMatch[1].toUpperCase();
                protocol = (p === 'SOCKS') ? 'SOCKS5' : p;
                workingLine = workingLine.replace(prefixMatch[0], '').trim();
            }

            // 2. Протокол в квадратных скобках [HTTP], [HTTPS], [SOCKS4], [SOCKS5]
            const protoBracket = workingLine.match(/\[(HTTP|HTTPS|SOCKS4|SOCKS5)\]/i);
            if (protoBracket) {
                protocol = protoBracket[1].toUpperCase();
                workingLine = workingLine.replace(protoBracket[0], '').trim();
            }

            // 3. Имя в квадратных скобках [My Proxy Name]
            const nameBracket = workingLine.match(/\[([^\]]+)\]/);
            if (nameBracket) {
                name = nameBracket[1].trim();
                workingLine = workingLine.replace(nameBracket[0], '').trim();
            }

            // НЕ удаляем все оставшиеся квадратные скобки — это ломает IPv6!

            // ==================== 4. Надёжный парсинг адреса с IPv6 ====================

            let addressPart = workingLine;
            let authPart = '';

            // Отделяем user:pass@ (используем последний @)
            const atIndex = workingLine.lastIndexOf('@');
            if (atIndex !== -1) {
                authPart = workingLine.substring(0, atIndex);
                addressPart = workingLine.substring(atIndex + 1).trim();

                const colonIndex = authPart.indexOf(':');
                if (colonIndex !== -1) {
                    username = authPart.substring(0, colonIndex).trim();
                    password = authPart.substring(colonIndex + 1).trim();
                } else {
                    username = authPart.trim();
                }
            }

            // Парсим host:port или [IPv6]:port
            let portSeparatorIndex = -1;

            // IPv6 в скобках — ищем маркер ']:'
            if (addressPart.startsWith('[')) {
                const closingBracket = addressPart.indexOf(']');
                if (closingBracket !== -1 && addressPart[closingBracket + 1] === ':') {
                    portSeparatorIndex = closingBracket + 1;
                }
            }

            // Обычный случай — последнее двоеточие
            if (portSeparatorIndex === -1) {
                portSeparatorIndex = addressPart.lastIndexOf(':');
            }

            // Fallback — пробел как разделитель
            if (portSeparatorIndex === -1) {
                const partsBySpace = addressPart.split(/\s+/);
                if (partsBySpace.length >= 2) {
                    host = partsBySpace[0].trim();
                    port = parseInt(partsBySpace[1], 10);
                }
            } else {
                host = addressPart.substring(0, portSeparatorIndex).trim();
                port = parseInt(addressPart.substring(portSeparatorIndex + 1), 10);
            }

            // Убираем квадратные скобки вокруг IPv6
            if (host.startsWith('[') && host.endsWith(']')) {
                host = host.slice(1, -1);
            }

            if (!host || !port || isNaN(port) || port < 1 || port > 65535) continue;

            // =====================================================================

            const proxy = new ProxyServer();
            proxy.CopyFrom({
                name: name || `${host}:${port}`,
                host: host,
                port: port,
                protocol: protocol,
                username: username,
                password: password,
                rating: 0,
                order: 999999
            });

            parsedProxies.push(proxy);
        }

        return parsedProxies;
    },

    parseJson: (jsonText: string, options?: ProxyServerSubscription): ProxyServer[] => {
        try {
            const data = JSON.parse(jsonText);
            if (!Array.isArray(data)) return null;

            const proxies: ProxyServer[] = [];
            for (const item of data) {
                if (typeof item === 'object' && item !== null) {
                    const proxy = new ProxyServer();
                    proxy.CopyFrom({
                        ...item,
                        rating: item.rating ?? 0,
                        order: item.order ?? 999999
                    });
                    proxies.push(proxy);
                }
            }
            return proxies;
        } catch (e) {
            Debug.error("ProxyImporter.parseJson failed", e);
            return null;
        }
    }
};