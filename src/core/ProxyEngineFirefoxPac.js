let proxyMode = "1";
let compiledRules = [];
let bypass = {};
let activeProxyServer = null;
let resultActiveProxy = "DIRECT";
const ResultDirect = "DIRECT";

const ProxyRuleType = {
    MatchPatternHost: 0,
    MatchPatternUrl: 1,
    RegexHost: 2,
    RegexUrl: 3,
    Exact: 4
};
const ProxyModeType = {
    Direct: 0,
    SmartProxy: 1,
    Always: 2,
    SystemProxy: 3
}
let environment = {
    chrome: false
};

// Google Chrome polyfill
if (typeof browser === "undefined") {
    browser = chrome;
    environment.chrome = true;
}

//-----------------------------
// Subset of polyfill api for proxy, since it doesn't have access to 'polyfill.js'
//-----------------------------
const polyfill = {
    lastError: function () {
        if (environment.chrome) {
            // chrome.extension.lastError Deprecated since Chrome 58
            return chrome.runtime.lastError;
        } else {
            return browser.runtime.lastError;
        }
    },

    runtimeSendMessage: function (message, success, fail, options, extensionId) {
        if (environment.chrome) {
            chrome.runtime.sendMessage(extensionId,
                message,
                options,
                function (response) {
                    let error = polyfill.lastError();
                    if (error) {
                        if (fail) fail(error);
                    } else {
                        if (success) success(response);
                    }
                });
        } else {
            browser.runtime.sendMessage(
                extensionId,
                message,
                options
            ).then(success, fail);
        }
    }
};

(function () {
    browser.runtime.onMessage.addListener(handleMessages);
    initialize();

    function handleMessages(message, sender, sendResponse) {
        if (typeof (message) !== "object")
            return;

        // NOTE: The messages are coming from PacScriptEventDispatcher class
        // NOTE: and they are listed there.

        let command = message["command"];

        if (command == "proxyModeChanged" &&
            message["proxyMode"] != null) {

            let newProxyMode = message["proxyMode"];
            if (newProxyMode !== null) {
                proxyMode = newProxyMode;
            }

        } else if (command == "activeProxyServerChanged" &&
            message["proxyServer"] != null) {

            let proxyServer = message["activeProxyServer"];

            activeProxyServer = proxyServer;
            resultActiveProxy = convertProxyToResult(proxyServer);

        } else if (command == "proxyRulesChanged" &&
            message["proxyRules"] != null) {

            let newProxyRules = message["proxyRules"];

            compiledRules = compileRules(newProxyRules);

        } else if (command == "bypassChanged" &&
            message["bypass"] != null) {

            bypass = fixBypass(message["bypass"]);
        }
    }

    function initialize() {
        polyfill.runtimeSendMessage("PacScript_GetInitialData",
            function (proxyInitData) {
                if (!proxyInitData) {
                    polyfill.runtimeSendMessage('PacScript init response received empty!!');
                    return;
                }

                proxyMode = proxyInitData.proxyMode;
                compiledRules = compileRules(proxyInitData.proxyRules);
                bypass = fixBypass(proxyInitData.bypass);

                activeProxyServer = proxyInitData.activeProxyServer;
                resultActiveProxy = convertProxyToResult(activeProxyServer);
            },
            function (e) {
                polyfill.runtimeSendMessage('PacScript_GetInitialData failed! > ' + e);
            });
    }

    function compileRules(proxyRules) {
        if (!proxyRules || !proxyRules.length)
            return [];
        let result = [];

        for (let i = 0; i < proxyRules.length; i++) {
            const rule = proxyRules[i];

            if (!rule.enabled)
                continue;

            let newCompiled = rule;

            switch (rule.ruleType) {
                case ProxyRuleType.Exact:
                    newCompiled.ruleExact = newCompiled.ruleExact.toLowerCase();
                    break;

                case ProxyRuleType.MatchPatternHost:
                    {
                        let regex = matchPatternToRegExp(rule.rulePattern, false);
                        if (regex == null)
                            continue;
                        newCompiled.regex = regex;
                    }
                    break;

                case ProxyRuleType.MatchPatternUrl:
                    {
                        let regex = matchPatternToRegExp(rule.rulePattern, true);
                        if (regex == null)
                            continue;
                        newCompiled.regex = regex;
                    }
                    break;

                case ProxyRuleType.RegexHost:
                case ProxyRuleType.RegexUrl:
                    {
                        // TODO: is this simple construction good enough? is ^(?:)$ needed?
                        newCompiled.regex = new RegExp(rule.ruleRegex);
                    }
                    break;

                default:
                    continue;
            }

            if (newCompiled.proxy)
                newCompiled.proxy = convertProxyToResult(newCompiled.proxy);

            result.push(newCompiled);
        }

        return result;
    }

    function convertProxyToResult(proxyServer) {

        // invalid active proxy server
        if (!proxyServer || !proxyServer.host || !proxyServer.protocol || !proxyServer.port)
            return ResultDirect;

        switch (proxyServer.protocol) {
            case "SOCKS5":
                // "socks" refers to the SOCKS5 protocol
                return [{
                    type: "socks",
                    host: proxyServer.host,
                    port: proxyServer.port,
                    proxyDNS: proxyServer.proxyDNS,
                    username: proxyServer.username,
                    password: proxyServer.password
                }];

            default:
            case "HTTP":
            case "HTTPS":
            case "SOCKS4":
                return [{
                    type: proxyServer.protocol,
                    host: proxyServer.host,
                    port: proxyServer.port,
                }];

        }
    }

    function fixBypass(optionsBypass) {
        if (!optionsBypass)
            optionsBypass = {};

        if (!optionsBypass.enableForAlways)
            optionsBypass.enableForAlways = false;

        if (!optionsBypass.enableForSystem)
            optionsBypass.enableForSystem = false;

        if (!optionsBypass.bypassList ||
            !Array.isArray(optionsBypass.bypassList))
            optionsBypass.bypassList = [];

        return optionsBypass;
    }

    function matchPatternToRegExp(pattern, completeUrl = true) {
        // Source: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Match_patterns
        // Modified by Salar Khalilzadeh
		/**
		 * Transforms a valid match pattern into a regular expression
		 * which matches all URLs included by that pattern.
		 */

        // matches all valid match patterns (except '<all_urls>')
        // and extracts [ , scheme, host, path, ]
        let matchPattern = (/^(?:(\*|https?|file|ftp|app|wss?):\/\/([^/]+|)\/?(.*))$/i);

        if (pattern === "<all_urls>") {
            //return (/^(?:https?|file|ftp|app):\/\//);
            return null;
        }
        if (!completeUrl) {
            if (!pattern.includes("://")) {
                pattern = "http://" + pattern;
            }
        }

        const match = matchPattern.exec(pattern);
        if (!match) {
            //throw new TypeError(`"${pattern}" is not a valid MatchPattern`);
            return null;
        }
        const [, scheme, host, path,] = match;

        if (completeUrl) {
            return new RegExp("^(?:"
				+ (scheme === "*" ? "(?:https?|ftp|wss?)" : escape(scheme)) + ":\\/\\/"
                + (host === "*" ? "[^\\/]*" : escape(host).replace(/^\*\./g, "(?:(?:[^\\/]+)\\.|(?:[^\\/]+){0})"))
                + (path ? (path == "*" ? "(?:\\/.*)?" : ("\\/" + escape(path).replace(/\*/g, ".*"))) : "\\/?")
                + ")$");
        }
        else {
            return new RegExp("^(?:"
                + (host === "*" ? "[^\\/]*" : escape(host).replace(/^\*\./g, "(?:(?:[^\\/]+)\\.|(?:[^\\/]+){0})"))
                + (path ? (path == "*" ? "(?:\\/.*)?" : ("\\/" + escape(path).replace(/\*/g, ".*"))) : "\\/?")
                + ")$");
        }
    }
})();

/** 
 * In firefox only HTTP, HTTPS and WSS is handled by async proxy API
 * The rest should be handled in this PAC script
 */
function isAlreadyHandled(url) {
    url = url.toLowerCase();
    if (url.startsWith("http:") ||
        url.startsWith("https:") ||
        url.startsWith("wss:"))
        return true;

    return false;
}

function FindProxyForURL(url, host) {

    if (!url || isAlreadyHandled(url))
        return [{ type: "direct" }];

    if (proxyMode == ProxyModeType.Direct)
        return [{ type: "direct" }];

    if (proxyMode == ProxyModeType.SystemProxy)
        // system proxy mode is not handled here
        return [{ type: "direct" }];

    if (!activeProxyServer)
        return [{ type: "direct" }];

    if (proxyMode == ProxyModeType.Always) {
        polyfill.runtimeSendMessage('Error in FindProxyForURL for ' + url);
        // should bypass this host?
        if (bypass.enableForAlways === true) {

            host = host.toLowerCase();

            if (bypass.bypassList.indexOf(host) !== -1)
                return [{ type: "direct" }];
        }

        return resultActiveProxy;
    }

    try {
        let lowerCaseUrl;
        for (let i = 0; i < compiledRules.length; i++) {
            let rule = compiledRules[i];
            let matched = false;

            switch (rule.ruleType) {
                case ProxyRuleType.Exact:
                    if (lowerCaseUrl == null)
                        lowerCaseUrl = url.toLowerCase();

                    if (lowerCaseUrl == rule.ruleExact)
                        matched = true;
                    break;

                case ProxyRuleType.MatchPatternHost:
                case ProxyRuleType.RegexHost:

                    if (rule.regex.test(host))
                        matched = true;
                    break;

                case ProxyRuleType.MatchPatternUrl:
                case ProxyRuleType.RegexUrl:

                    if (rule.regex.test(url))
                        matched = true;
                    break;
            }

            if (matched) {
                if (rule.proxy)
                    // this rule has its own proxy setup
                    return rule.proxy;
                return resultActiveProxy;
            }
        }
    } catch (e) {
        polyfill.runtimeSendMessage('Error in FindProxyForURL for ' + url);
    }

    return [{ type: "direct" }];
}