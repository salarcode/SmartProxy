/*
 * This file is part of SmartProxy <https://github.com/salarcode/SmartProxy>,
 * Copyright (C) 2017 Salar Khalilzadeh <salar2k@gmail.com>
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

var proxyImporter = {
	readFromServer: function (serverDetail, success, fail) {
		if (!serverDetail || !serverDetail.url) {
			if (fail) fail();
			return;
		}
		if (!success) throw "onSuccess callback is mandatory";

		function ajaxSuccess(response) {
			if (!response)
				if (fail) fail();

			proxyImporter.importText(response,
				null,
				false,
				null,
				function (importResult) {
					if (!importResult.success) {
						if (fail)
							fail(importResult);
						return;
					}
					if (success)
						success(importResult);
				},
				function (error) {
					if (fail)
						fail(error);
				},
				{
					// options
					proxyProtocol: serverDetail.proxyProtocol,
					obfuscation: serverDetail.obfuscation
				});
		}

		var xhr = new XMLHttpRequest();
		xhr.open("GET", serverDetail.url);

		if (serverDetail.username && serverDetail.password) {
			var pass = atob(serverDetail.password);
			xhr.setRequestHeader("Authorization", "Basic " + btoa(serverDetail.username + ":" + pass));
		}

		xhr.onload = function () {
			if (xhr.status === 200) {
				ajaxSuccess(xhr.responseText);
			}
			else {
				if (fail) fail(xhr.status);
			}
		};
		xhr.send();
	},
	importText: function (text, file, append, currentProxies, success, fail, options) {
		if (!file && !text) {
			if (fail) fail();
			return;
		}

		if (text)
			doImport(text);
		else {
			var reader = new FileReader();
			reader.onerror = function (event) {
				if (fail) fail(event);
			};
			reader.onload = function (event) {
				var textFile = event.target;
				var fileText = textFile.result;

				doImport(fileText);
			};
			reader.readAsText(file);
		}


		function doImport(text) {

			var parsedProxies = proxyImporter.parseText(text, options);

			if (parsedProxies == null) {
				if (fail) fail();
				return;
			}

			var importedProxies = utils.removeDuplicatesFunc(parsedProxies,
				function (item1, item2) {
					return item1.host == item2.host &&
						item1.port == item2.port &&
						item1.username == item2.username &&
						item1.password == item2.password;
				});


			// proxies are ready
			if (append) {
				if (!currentProxies)
					currentProxies = [];

				// make a copy
				var appendedProxyList = currentProxies.slice();
				var appendedProxyCount = 0;

				for (let importedProxy of importedProxies) {
					let proxyExists = currentProxies.some(cp => 
					{
						return (cp.host == importedProxy.host &&
							cp.port == importedProxy.port &&
							cp.username == importedProxy.username &&
							cp.password == importedProxy.password) 
					});
					if (proxyExists)
						continue;

					// append imported proxy
					appendedProxyList.push(importedProxy);
					appendedProxyCount++;
				}

				// Total ${appendedProxyCount} out of ${appendedProxyList.length} proxies are appended.<br>Don't forget to save the changes.
				let message = browser.i18n.getMessage("importerImportProxySuccess")
					.replace("{0}", appendedProxyCount)
					.replace("{1}", importedProxies.length);

				if (success) {
					// not need for any check, return straight away
					success({
						success: true,
						message: message,
						result: appendedProxyList
					});
				}

			} else {

				// Total ${importedRuleList.length} out of ${parsedRuleList.length} proxies are imported.<br>Don't forget to save the changes.
				let message = browser.i18n.getMessage("importerImportProxySuccess")
					.replace("{0}", importedProxies.length)
					.replace("{1}", parsedProxies.length);

				if (success) {
					// not need for any check, return straight away
					success({
						success: true,
						message: message,
						result: importedProxies
					});
				}
			}
		}

	},
	parseText: function (proxyListText, options) {
		///<summary>Parses the proxy</summary>
		if (!proxyListText || typeof (proxyListText) !== "string") return null;

		// ip:port [protocol] [name] [username] [password]
		const proxyRegex = /(\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b)(?::+|[\t\s,]+)(\d{2,5})(?:[\t\s]+\[(\w+)\][\t\s]+\[([\w\s]+)\](?:[\t\s]+\[(.+)\][\t\s]+\[(.+)\])?)?/i;

		if (options && options.obfuscation) {
			try {
				if (options.obfuscation.toLowerCase() == "base64") {
					// decode base64
					proxyListText = atob(proxyListText);
				}
			} catch (e) {
				return null;
			}
		}

		let proxyListLines = proxyListText.split(/(\r|\n)/);
		let parsedProxies = [];

		var defaultProxyProtocol = "HTTP";
		if (options && options.proxyProtocol)
			defaultProxyProtocol = options.proxyProtocol;

		for (let proxyLine of proxyListLines) {
			// simple check
			if (proxyLine.length < 4)
				continue;

			var match = proxyRegex.exec(proxyLine);
			if (!match) {
				continue;
			}

			let [, ip, port, protocol, name, username, password] = match;
			if (!ip || !port) {
				continue;
			}
			if (!protocol)
				protocol = defaultProxyProtocol;
			else
				protocol = protocol.toUpperCase();

			parsedProxies.push({
				name: name || `${ip}:${port}`,
				host: ip,
				port: port,
				protocol: protocol,
				username: username,
				password: password
			});
		}

		return parsedProxies;
	}
}
var ruleImporter = {
	importSwitchyRules: function (file, append, currentRules, success, fail) {

		if (!file) {
			if (fail) fail();
			return;
		}
		var reader = new FileReader();
		reader.onerror = function (event) {
			if (fail) fail(event);
		};
		reader.onload = function (event) {
			var textFile = event.target;
			var fileText = textFile.result;

			try {

				// TODO: implement switchy import rules
				var parsedRuleList = externalAppRuleParser.Switchy.parse(fileText);


			} catch (e) {
				if (fail) fail(e);
			}
		};
		reader.readAsText(file);
	},
	importAutoProxy: function (file, append, currentRules, success, fail) {
		///<summary>
		/// Parses AutoProxy rules and *JUST* uses it as a way to extract domain list to be proxyfied
		/// Does not follow the rules of AutoProxy
		///</summary>
		if (!file) {
			if (fail) fail();
			return;
		}

		var reader = new FileReader();
		reader.onerror = function (event) {
			if (fail) fail(event);
		};
		reader.onload = function (event) {
			var textFile = event.target;
			var fileText = textFile.result;

			try {
				var parsedRuleList = externalAppRuleParser.AutoProxy.parse(fileText);

				var importedRuleList = [];
				var notImportedRules = 0;

				for (let parsedRule of parsedRuleList) {
					var convertResult = ruleImporter.convertAutoProxyRule(parsedRule.condition.pattern, parsedRule.condition.conditionType);
					if (!convertResult.success) {
						notImportedRules++;
						continue;
					}

					importedRuleList.push(
						{ pattern: convertResult.pattern, source: convertResult.source, enabled: true }
					);
				}

				// remove the duplicates from imported rules
				importedRuleList = utils.removeDuplicates(importedRuleList, "pattern");

				// rules are ready
				if (append) {
					if (!currentRules)
						currentRules = [];

					// make a copy
					var appendedRuleList = currentRules.slice();
					var appendedRuleCount = 0;

					for (let importedRuke of importedRuleList) {
						var ruleExists = false;
						for (let c of currentRules) {

							if (c.pattern == importedRuke.pattern) {
								ruleExists = true;
								break;
							}
						}

						if (ruleExists)
							continue;

						// append imported rule
						appendedRuleList.push(importedRuke);
						appendedRuleCount++;
					}

					// Total ${appendedRuleCount} out of ${parsedRuleList.length} rules are appended.<br>Don't forget to save the changes.
					let message = browser.i18n.getMessage("importerImportSuccess")
						.replace("{0}", appendedRuleCount)
						.replace("{1}", parsedRuleList.length);

					if (success) {
						// not need for any check, return straight away
						success({
							success: true,
							message: message,
							result: appendedRuleList
						});
					}

				} else {

					// Total ${importedRuleList.length} out of ${parsedRuleList.length} rules are imported.<br>Don't forget to save the changes.
					let message = browser.i18n.getMessage("importerImportSuccess")
						.replace("{0}", importedRuleList.length)
						.replace("{1}", parsedRuleList.length);

					if (success) {
						// not need for any check, return straight away
						success({
							success: true,
							message: message,
							result: importedRuleList
						});
					}
				}

			} catch (e) {
				if (fail) fail(e);
			}
		};
		reader.readAsText(file);
	},
	convertAutoProxyRule: function (cleanCondition, conditionType) {
		var source = "";
		var pattern = "";

		switch (conditionType) {
			case "KeywordCondition":
				// no (*) character

				// NOTE: keyword type is supported as domain name
				// it also works for https as well as http

				if (cleanCondition[0] === ".") {
					cleanCondition = cleanCondition.substring(1);
				}
				source = cleanCondition;

				if (cleanCondition.endsWith("/"))
					// no extra slash
					source = cleanCondition.substring(0, cleanCondition.length - 2);

				pattern = `*://*.${source}/*`;
				break;

			case "HostWildcardCondition":
				if (cleanCondition[0] === ".") {
					cleanCondition = cleanCondition.substring(1);
				}
				// remove (*) chars
				cleanCondition = cleanCondition.replace(/\*/g, "");

				// remove (.) duplicates
				cleanCondition = cleanCondition.replace(/([.])\1+/g, ".");

				if (cleanCondition[0] === ".") {
					cleanCondition = cleanCondition.substring(1);
				}

				// source
				source = cleanCondition;

				if (cleanCondition.endsWith("/"))
					// no extra slash
					source = cleanCondition.substring(0, cleanCondition.length - 2);

				pattern = `*://*.${source}/*`;
				break;

			case "UrlWildcardCondition":
				// very restricted support
				if (cleanCondition[0] === "*") {
					// no problem
					cleanCondition = cleanCondition.substring(1);
				}
				if (cleanCondition[0] === ".") {
					cleanCondition = cleanCondition.substring(1);
				}

				if (cleanCondition.indexOf("*") !== -1) {

					var cleanConditionRemMiddle = cleanCondition;

					if (cleanConditionRemMiddle.indexOf("://*.") !== -1) {
						cleanConditionRemMiddle = cleanConditionRemMiddle.replace("//*.", "://");
					}

					if (cleanConditionRemMiddle.endsWith("*")) {
						cleanCondition = cleanCondition.substring(0, cleanCondition.length - 2);
						cleanConditionRemMiddle = cleanConditionRemMiddle.substring(0, cleanCondition.length - 2);
					}

					if (cleanConditionRemMiddle.indexOf("*") !== -1) {

						// (/*/) is supported, lets remove them and check again for other rules)
						cleanConditionRemMiddle = cleanCondition.replace(/\/\*\//g, "/");

						if (cleanConditionRemMiddle.indexOf("*") !== -1) {
							// still there is some left
							// * in middle is not supported

							return {
								success: false
							}
						}
					}
				}


				// source
				source = cleanCondition;

				if (cleanCondition.endsWith("/"))
					// no extra slash
					source = cleanCondition.substring(0, cleanCondition.length - 2);

				if (source.indexOf("://") !== -1) {
					pattern = `${source}/*`;
				} else {
					pattern = `*://*.${source}/*`;
				}

				break;

			case "UrlRegexCondition":
				// not supported
				return {
					success: false
				}
		}

		return {
			success: true,
			source: source,
			pattern: pattern,
			toString: function () {
				return `[${source} , ${pattern}]`;
			}
		}
	}
}


// -----------------------------------------------
// -----------------------------------------------
// -----------------------------------------------
/*

-----------------------------------------------
AutoProxy Rules, from: https://web.archive.org/web/20150318182040/https://autoproxy.org/en/Rules
-----------------------------------------------

Currently these formats are supported in rules:

example.com
Matching: http://www.example.com/foo
Matching: http://www.google.com/search?q=www.example.com
Not match: https://www.example.com/
Use when example.com is a URL keyword, any http connection (notincluding https)

||example.com
Matching: http://example.com/foo
Matching: https://subdomain.example.com/bar
Not matching: http://www.google.com/search?q=example.com
Match the whole domain and second-level domain no matter http or https, used when site's IP is blocked.

|https://ssl.example.com
Match all address beginning with https://ssl.example.com, used when some IP's HTTPS is specifically blocked.

|http://example.com
Match all address beginning with http://example.com, used for short domains, like URL shortening services to avoid "slow rules". Also a temporary fix for issue 117.

/^https?:\/\/[^\/]+example\.com/
Match domain including "example.com" chars, it's a regex, used when the chars are DNS poisoning keyword.

@@||example.com
The highest privilege rule, all websites matching ||example.com aren't proxied, sometimes used for websites in China mainland.

!Foo bar
Beginning with !, just for explanation.
*/
// -----------------------------------------------
/*!
 * This piece of code is from SwitchyOmega_Firefox <omega_pac.min.js>
 * Modiefied to return the not generalized pattern
 *
 * @source   https://github.com/FelisCatus/SwitchyOmega
 * @license  GPL3
 */
var externalAppRuleParser = {
	'AutoProxy': {
		magicPrefix: "W0F1dG9Qcm94",
		detect: function (text) {
			if (utils.strStartsWith(text, externalAppRuleParser["AutoProxy"].magicPrefix)) {
				return true;
			} else if (utils.strStartsWith(text, "[AutoProxy")) {
				return true;
			}
		},
		preprocess: function (text) {
			if (utils.strStartsWith(text, externalAppRuleParser["AutoProxy"].magicPrefix)) {
				text = new Buffer(text, "base64").toString("utf8");
			}
			return text;
		},
		parse: function (text, matchProfileName, defaultProfileName) {
			var cond, exclusive_rules, line, list, normal_rules, profile, source, _i, _len, _ref;
			normal_rules = [];
			exclusive_rules = [];
			_ref = text.split(/\n|\r/);
			for (_i = 0, _len = _ref.length; _i < _len; _i++) {
				line = _ref[_i];
				line = line.trim();
				if (line.length === 0 || line[0] === "!" || line[0] === "[") {
					continue;
				}
				source = line;
				profile = matchProfileName;
				list = normal_rules;
				if (line[0] === "@" && line[1] === "@") {
					profile = defaultProfileName;
					list = exclusive_rules;
					line = line.substring(2);
				}
				cond = line[0] === "/"
					? {
						conditionType: "UrlRegexCondition",
						pattern: line.substring(1, line.length - 1)
					}
					: line[0] === "|"
						? line[1] === "|"
							? {
								conditionType: "HostWildcardCondition",
								pattern: "*." + line.substring(2),
								cleanCondition: line.substring(2)
							}
							: {
								conditionType: "UrlWildcardCondition",
								pattern: line.substring(1) + "*",
								cleanCondition: line.substring(1)
							}
						: line.indexOf("*") < 0
							? {
								conditionType: "KeywordCondition",
								pattern: line,
								cleanCondition: line
							}
							: {
								conditionType: "UrlWildcardCondition",
								pattern: "http://*" + line + "*",
								cleanCondition: line
							};
				list.push({
					condition: cond,
					profileName: profile,
					source: source
				});
			}
			return exclusive_rules.concat(normal_rules);
		}
	},
	'Switchy': {
		omegaPrefix: "[SwitchyOmega Conditions",
		specialLineStart: "[;#@!",
		detect: function (text) {
			if (utils.strStartsWith(text, externalAppRuleParser["Switchy"].omegaPrefix)) {
				return true;
			}
		},
		parse: function (text, matchProfileName, defaultProfileName) {
			var parser, switchy;
			switchy = externalAppRuleParser["Switchy"];
			parser = switchy.getParser(text);
			return switchy[parser](text, matchProfileName, defaultProfileName);
		},
		directReferenceSet: function (_arg) {
			var defaultProfileName, iSpace, line, matchProfileName, parser, profile, refs, ruleList, switchy, text, _i, _len, _ref;
			ruleList = _arg.ruleList, matchProfileName = _arg.matchProfileName, defaultProfileName = _arg.defaultProfileName;
			text = ruleList.trim();
			switchy = externalAppRuleParser["Switchy"];
			parser = switchy.getParser(text);
			if (parser !== "parseOmega") {
				return;
			}
			if (!/(^|\n)@with\s+results?(\r|\n|$)/i.test(text)) {
				return;
			}
			refs = {};
			_ref = text.split(/\n|\r/);
			for (_i = 0, _len = _ref.length; _i < _len; _i++) {
				line = _ref[_i];
				line = line.trim();
				if (switchy.specialLineStart.indexOf(line[0]) < 0) {
					iSpace = line.lastIndexOf(" +");
					if (iSpace < 0) {
						profile = defaultProfileName || "direct";
					} else {
						profile = line.substr(iSpace + 2).trim();
					}
					refs["+" + profile] = profile;
				}
			}
			return refs;
		},
		compose: function (_arg, _arg1) {
			var defaultProfileName, eol, line, rule, ruleList, rules, specialLineStart, useExclusive, withResult, _i, _len, _ref;
			rules = _arg.rules, defaultProfileName = _arg.defaultProfileName;
			_ref = _arg1 != null ? _arg1 : {}, withResult = _ref.withResult, useExclusive = _ref.useExclusive;
			eol = "\r\n";
			ruleList = "[SwitchyOmega Conditions]" + eol;
			if (useExclusive == null) {
				useExclusive = !withResult;
			}
			if (withResult) {
				ruleList += "@with result" + eol + eol;
			} else {
				ruleList += eol;
			}
			specialLineStart = externalAppRuleParser["Switchy"].specialLineStart + "+";
			for (_i = 0, _len = rules.length; _i < _len; _i++) {
				rule = rules[_i];
				line = externalAppRuleParser.module.str(rule.condition);
				if (useExclusive && rule.profileName === defaultProfileName) {
					line = "!" + line;
				} else {
					if (specialLineStart.indexOf(line[0]) >= 0) {
						line = ": " + line;
					}
					if (withResult) {
						line += " +" + rule.profileName;
					}
				}
				ruleList += line + eol;
			}
			if (withResult) {
				ruleList += eol + "* +" + defaultProfileName + eol;
			}
			return ruleList;
		},
		getParser: function (text) {
			var parser, switchy;
			switchy = externalAppRuleParser["Switchy"];
			parser = "parseOmega";
			if (!utils.strStartsWith(text, switchy.omegaPrefix)) {
				if (text[0] === "#" || text.indexOf("\n#") >= 0) {
					parser = "parseLegacy";
				}
			}
			return parser;
		},
		conditionFromLegacyWildcard: function (pattern) {
			var host;
			if (pattern[0] === "@") {
				pattern = pattern.substring(1);
			} else {
				if (pattern.indexOf("://") <= 0 && pattern[0] !== "*") {
					pattern = "*" + pattern;
				}
				if (pattern[pattern.length - 1] !== "*") {
					pattern += "*";
				}
			}
			host = externalAppRuleParser.module.urlWildcard2HostWildcard(pattern);
			if (host) {
				return {
					conditionType: "HostWildcardCondition",
					pattern: host
				};
			} else {
				return {
					conditionType: "UrlWildcardCondition",
					pattern: pattern
				};
			}
		},
		parseLegacy: function (text, matchProfileName, defaultProfileName) {
			var begin, cond, exclusive_rules, line, list, normal_rules, profile, section, source, _i, _len, _ref;
			normal_rules = [];
			exclusive_rules = [];
			begin = false;
			section = "WILDCARD";
			_ref = text.split(/\n|\r/);
			for (_i = 0, _len = _ref.length; _i < _len; _i++) {
				line = _ref[_i];
				line = line.trim();
				if (line.length === 0 || line[0] === ";") {
					continue;
				}
				if (!begin) {
					if (line.toUpperCase() === "#BEGIN") {
						begin = true;
					}
					continue;
				}
				if (line.toUpperCase() === "#END") {
					break;
				}
				if (line[0] === "[" && line[line.length - 1] === "]") {
					section = line.substring(1, line.length - 1).toUpperCase();
					continue;
				}
				source = line;
				profile = matchProfileName;
				list = normal_rules;
				if (line[0] === "!") {
					profile = defaultProfileName;
					list = exclusive_rules;
					line = line.substring(1);
				}
				cond = (function () {
					switch (section) {
						case "WILDCARD":
							return externalAppRuleParser["Switchy"].conditionFromLegacyWildcard(line);
						case "REGEXP":
							return {
								conditionType: "UrlRegexCondition",
								pattern: line
							};
						default:
							return null;
					}
				})();
				if (cond != null) {
					list.push({
						condition: cond,
						profileName: profile,
						source: source
					});
				}
			}
			return exclusive_rules.concat(normal_rules);
		},
		parseOmega: function (text, matchProfileName, defaultProfileName, args) {
			var cond, directive, error, exclusiveProfile, feature, iSpace, includeSource, line, lno, profile, rule, rules, rulesWithDefaultProfile, source, strict, withResult, _i, _j, _len, _len1, _ref, _ref1;
			if (args == null) {
				args = {};
			}
			strict = args.strict;
			if (strict) {
				error = function (fields) {
					var err, key, value;
					err = new Error(fields.message);
					for (key in fields) {
						if (!__hasProp.call(fields, key)) continue;
						value = fields[key];
						err[key] = value;
					}
					throw err;
				};
			}
			includeSource = (_ref = args.source) != null ? _ref : true;
			rules = [];
			rulesWithDefaultProfile = [];
			withResult = false;
			exclusiveProfile = null;
			lno = 0;
			_ref1 = text.split(/\n|\r/);
			for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
				line = _ref1[_i];
				lno++;
				line = line.trim();
				if (line.length === 0) {
					continue;
				}
				switch (line[0]) {
					case "[":
						continue;
					case ";":
						continue;
					case "@":
						iSpace = line.indexOf(" ");
						if (iSpace < 0) {
							iSpace = line.length;
						}
						directive = line.substr(1, iSpace - 1);
						line = line.substr(iSpace + 1).trim();
						switch (directive.toUpperCase()) {
							case "WITH":
								feature = line.toUpperCase();
								if (feature === "RESULT" || feature === "RESULTS") {
									withResult = true;
								}
						}
						continue;
				}
				source = null;
				if (strict) {
					exclusiveProfile = null;
				}
				if (line[0] === "!") {
					profile = withResult ? null : defaultProfileName;
					source = line;
					line = line.substr(1);
				} else if (withResult) {
					iSpace = line.lastIndexOf(" +");
					if (iSpace < 0) {
						if (typeof error === "function") {
							error({
								message: "Missing result profile name: " + line,
								reason: "missingResultProfile",
								source: line,
								sourceLineNo: lno
							});
						}
						continue;
					}
					profile = line.substr(iSpace + 2).trim();
					line = line.substr(0, iSpace).trim();
					if (line === "*") {
						exclusiveProfile = profile;
					}
				} else {
					profile = matchProfileName;
				}
				cond = externalAppRuleParser.module.fromStr(line);
				if (!cond) {
					if (typeof error === "function") {
						error({
							message: "Invalid rule: " + line,
							reason: "invalidRule",
							source: source != null ? source : line,
							sourceLineNo: lno
						});
					}
					continue;
				}
				rule = {
					condition: cond,
					profileName: profile,
					source: includeSource ? source != null ? source : line : void 0
				};
				rules.push(rule);
				if (!profile) {
					rulesWithDefaultProfile.push(rule);
				}
			}
			if (withResult) {
				if (!exclusiveProfile) {
					if (strict) {
						if (typeof error === "function") {
							error({
								message: "Missing default rule with catch-all '*' condition",
								reason: "noDefaultRule"
							});
						}
					}
					exclusiveProfile = defaultProfileName || "direct";
				}
				for (_j = 0, _len1 = rulesWithDefaultProfile.length; _j < _len1; _j++) {
					rule = rulesWithDefaultProfile[_j];
					rule.profileName = exclusiveProfile;
				}
			}
			return rules;
		}
	}
};

// -----------------------------------------------
// -----------------------------------------------
// -----------------------------------------------