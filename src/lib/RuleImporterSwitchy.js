const strStartsWith = function (str, prefix) {
	return str.substr(0, prefix.length) === prefix;
};
const hasProp = {}.hasOwnProperty;

const shExpUtils = {
	regExpMetaChars: (function () {
		let chars, i, j, ref, set;
		chars = '\\[\\^$.|?*+(){}/';
		set = {};
		for (i = j = 0, ref = chars.length; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
			set[chars.charCodeAt(i)] = true;
		}
		return set;
	})(),
	escapeSlash: function (pattern) {
		let charCodeBackSlash, charCodeSlash, code, escaped, i, j, ref, result, start;
		charCodeSlash = 47;
		charCodeBackSlash = 92;
		escaped = false;
		start = 0;
		result = '';
		for (i = j = 0, ref = pattern.length; 0 <= ref ? j < ref : j > ref; i = 0 <= ref ? ++j : --j) {
			code = pattern.charCodeAt(i);
			if (code === charCodeSlash && !escaped) {
				result += pattern.substring(start, i);
				result += '\\';
				start = i;
			}
			escaped = code === charCodeBackSlash && !escaped;
		}
		return result += pattern.substr(start);
	},
	shExp2RegExp: function (pattern, options) {
		let charCodeAsterisk, charCodeQuestion, code, end, i, j, ref, ref1, regex, start, trimAsterisk;
		trimAsterisk = (options != null ? options.trimAsterisk : void 0) || false;
		start = 0;
		end = pattern.length;
		charCodeAsterisk = 42;
		charCodeQuestion = 63;
		if (trimAsterisk) {
			while (start < end && pattern.charCodeAt(start) === charCodeAsterisk) {
				start++;
			}
			while (start < end && pattern.charCodeAt(end - 1) === charCodeAsterisk) {
				end--;
			}
			if (end - start === 1 && pattern.charCodeAt(start) === charCodeAsterisk) {
				return '';
			}
		}
		regex = '';
		if (start === 0) {
			regex += '^';
		}
		for (i = j = ref = start, ref1 = end; ref <= ref1 ? j < ref1 : j > ref1; i = ref <= ref1 ? ++j : --j) {
			code = pattern.charCodeAt(i);
			switch (code) {
				case charCodeAsterisk:
					regex += '.*';
					break;
				case charCodeQuestion:
					regex += '.';
					break;
				default:
					if (shExpUtils.regExpMetaChars[code] >= 0) {
						regex += '\\';
					}
					regex += pattern[i];
			}
		}
		if (end === pattern.length) {
			regex += '$';
		}
		return regex;
	}
};

let AttachedCache = (function () {
	function AttachedCache(opt_prop, tag1) {
		this.tag = tag1;
		this.prop = opt_prop;
		if (typeof this.tag === 'undefined') {
			this.tag = opt_prop;
			this.prop = '_cache';
		}
	}

	AttachedCache.prototype.get = function (obj, otherwise) {
		let cache, tag, value;
		tag = this.tag(obj);
		cache = this._getCache(obj);
		if ((cache != null) && cache.tag === tag) {
			return cache.value;
		}
		value = typeof otherwise === 'function' ? otherwise() : otherwise;
		this._setCache(obj, {
			tag: tag,
			value: value
		});
		return value;
	};

	AttachedCache.prototype.drop = function (obj) {
		if (obj[this.prop] != null) {
			return obj[this.prop] = void 0;
		}
	};

	AttachedCache.prototype._getCache = function (obj) {
		return obj[this.prop];
	};

	AttachedCache.prototype._setCache = function (obj, value) {
		if (!Object.prototype.hasOwnProperty.call(obj, this.prop)) {
			Object.defineProperty(obj, this.prop, {
				writable: true
			});
		}
		return obj[this.prop] = value;
	};

	return AttachedCache;

})();

let v4 = {};
/*
 * Instantiates an IPv4 address
 */
v4.Address = function (address) {
	this.valid = false;
	this.address = address;
	this.groups = v4.GROUPS;

	this.v4 = true;

	this.subnet = '/32';
	this.subnetMask = 32;

	let subnet = v4.RE_SUBNET_STRING.exec(address);

	if (subnet) {
		this.parsedSubnet = subnet[0].replace('/', '');
		this.subnetMask = parseInt(this.parsedSubnet, 10);
		this.subnet = '/' + this.subnetMask;

		if (this.subnetMask < 0 || this.subnetMask > v4.BITS) {
			this.valid = false;
			this.error = 'Invalid subnet mask.';

			return;
		}

		address = address.replace(v4.RE_SUBNET_STRING, '');
	}

	this.addressMinusSuffix = address;

	this.parsedAddress = this.parse(address);
};

/*
 * Parses a v4 address
 */
v4.Address.prototype.parse = function (address) {
	let groups = address.split('.');

	if (address.match(v4.RE_ADDRESS)) {
		this.valid = true;
	} else {
		this.error = 'Invalid IPv4 address.';
	}

	return groups;
};

/*
 * Returns true if the address is valid
 */
v4.Address.prototype.isValid = function () {
	return this.valid;
};

/*
 * Returns the correct form of an address
 */
v4.Address.prototype.correctForm = function () {
	return this.parsedAddress.map(function (part) {
		return parseInt(part, 10);
	}).join('.');
};


const Conditions = {
	urlWildcard2HostWildcard: function (pattern) {
		let result;
		result = pattern.match(/^\*:\/\/((?:\w|[?*._\-])+)\/\*$/);
		return result != null ? result[1] : void 0;
	},
	tag: function (condition) {
		return Conditions._condCache.tag(condition);
	},
	analyze: function (condition) {
		return Conditions._condCache.get(condition, function () {
			return {
				analyzed: Conditions._handler(condition.conditionType).analyze.call(Conditions, condition)
			};
		});
	},
	match: function (condition, request) {
		let cache;
		cache = Conditions.analyze(condition);
		return Conditions._handler(condition.conditionType).match.call(Conditions, condition, request, cache);
	},
	compile: function (condition) {
		let cache, handler;
		cache = Conditions.analyze(condition);
		if (cache.compiled) {
			return cache.compiled;
		}
		handler = Conditions._handler(condition.conditionType);
		return cache.compiled = handler.compile.call(Conditions, condition, cache);
	},
	str: function (condition, arg) {
		let abbr, endCode, handler, part, result, str, typeStr;
		abbr = (arg != null ? arg : {
			abbr: -1
		}).abbr;
		handler = Conditions._handler(condition.conditionType);
		if (handler.abbrs[0].length === 0) {
			endCode = condition.pattern.charCodeAt(condition.pattern.length - 1);
			if (endCode !== Conditions.colonCharCode && condition.pattern.indexOf(' ') < 0) {
				return condition.pattern;
			}
		}
		str = handler.str;
		typeStr = typeof abbr === 'number' ? handler.abbrs[(handler.abbrs.length + abbr) % handler.abbrs.length] : condition.conditionType;
		result = typeStr + ':';
		part = str ? str.call(Conditions, condition) : condition.pattern;
		if (part) {
			result += ' ' + part;
		}
		return result;
	},
	colonCharCode: ':'.charCodeAt(0),
	fromStr: function (str) {
		let condition, conditionType, fromStr, i;
		str = str.trim();
		i = str.indexOf(' ');
		if (i < 0) {
			i = str.length;
		}
		if (str.charCodeAt(i - 1) === Conditions.colonCharCode) {
			conditionType = str.substr(0, i - 1);
			str = str.substr(i + 1).trim();
		} else {
			conditionType = '';
		}
		conditionType = Conditions.typeFromAbbr(conditionType);
		if (!conditionType) {
			return null;
		}
		condition = {
			conditionType: conditionType
		};
		fromStr = Conditions._handler(condition.conditionType).fromStr;
		if (fromStr) {
			return fromStr.call(Conditions, str, condition);
		} else {
			condition.pattern = str;
			return condition;
		}
	},
	_abbrs: null,
	typeFromAbbr: function (abbr) {
		let ab, abbrs, j, len, ref1, type;
		if (!Conditions._abbrs) {
			Conditions._abbrs = {};
			ref1 = Conditions._conditionTypes;
			for (type in ref1) {
				if (!hasProp.call(ref1, type)) continue;
				abbrs = ref1[type].abbrs;
				Conditions._abbrs[type.toUpperCase()] = type;
				for (j = 0, len = abbrs.length; j < len; j++) {
					ab = abbrs[j];
					Conditions._abbrs[ab.toUpperCase()] = type;
				}
			}
		}
		return Conditions._abbrs[abbr.toUpperCase()];
	},
	comment: function (comment, node) {
		let base;
		if (!comment) {
			return node;
		}
		if (node.start == null) {
			node.start = {};
		}
		Object.defineProperty(node.start, '_comments_dumped', {
			get: function () {
				return false;
			},
			set: function () {
				return false;
			}
		});
		if ((base = node.start).comments_before == null) {
			base.comments_before = [];
		}
		node.start.comments_before.push({
			type: 'comment2',
			value: comment
		});
		return node;
	},
	safeRegex: function (expr) {
		let _;
		try {
			return new RegExp(expr);
		} catch (error) {
			_ = error;
			return /(?!)/;
		}
	},
	regTest: function (expr, regexp) {
		if (typeof regexp === 'string') {
			regexp = regexSafe(shExpUtils.escapeSlash(regexp));
		}
		return {
			args: [expr],
			expression: regexp
		};
	},
	isInt: function (num) {
		return typeof num === 'number' && !isNaN(num) && parseFloat(num) === parseInt(num, 10);
	},
	between: function (val, min, max, comment) {
		let pos, str, tmpl;
		if (min === max) {
			if (typeof min === 'number') {
				min = min.toString();
			}
			return Conditions.comment(comment, {
				left: val,
				operator: '===',
				right: min
			});
		}
		if (min > max) {
			return Conditions.comment(comment, new U2.AST_False);
		}
		if (Conditions.isInt(min) && Conditions.isInt(max) && max - min < 32) {
			comment || (comment = min + " <= value && value <= " + max);
			tmpl = "0123456789abcdefghijklmnopqrstuvwxyz";
			str = max < tmpl.length ? tmpl.substr(min, max - min + 1) : tmpl.substr(0, max - min + 1);
			pos = min === 0 ? val : {
				left: val,
				operator: '-',
				right: min
			};
			return Conditions.comment(comment, {
				left: {
					expression: {
						expression: str,
						property: 'charCodeAt'
					},
					args: [pos]
				},
				operator: '>',
				right: 0
			});
		}
		if (typeof min === 'number') {
			min = min.toString();
		}
		if (typeof max === 'number') {
			max = max.toString();
		}
		return Conditions.comment(comment, {
			args: [val, min, max],
			expression: {
				argnames: ['value', 'min', 'max'],
				body: [
					new U2.AST_Return({
						value: new U2.AST_Binary({
							left: new U2.AST_Binary({
								left: new U2.AST_SymbolRef({
									name: 'min'
								}),
								operator: '<=',
								right: new U2.AST_SymbolRef({
									name: 'value'
								})
							}),
							operator: '&&',
							right: new U2.AST_Binary({
								left: new U2.AST_SymbolRef({
									name: 'value'
								}),
								operator: '<=',
								right: new U2.AST_SymbolRef({
									name: 'max'
								})
							})
						})
					})
				]
			}
		});
	},
	parseIp: function (ip) {
		let addr;
		if (ip.charCodeAt(0) === '['.charCodeAt(0)) {
			ip = ip.substr(1, ip.length - 2);
		}
		addr = new IP.v4.Address(ip);
		if (!addr.isValid()) {
			addr = new IP.v6.Address(ip);
			if (!addr.isValid()) {
				return null;
			}
		}
		return addr;
	},
	normalizeIp: function (addr) {
		let ref1;
		return ((ref1 = addr.correctForm) != null ? ref1 : addr.canonicalForm).call(addr);
	},
	//ipv6Max: new IP.v6.Address('::/0').endAddress().canonicalForm(),
	localHosts: ["127.0.0.1", "[::1]", "localhost"],
	getWeekdayList: function (condition) {
		let i, j, k, results, results1;
		if (condition.days) {
			results = [];
			for (i = j = 0; j < 7; i = ++j) {
				results.push(condition.days.charCodeAt(i) > 64);
			}
			return results;
		} else {
			results1 = [];
			for (i = k = 0; k < 7; i = ++k) {
				results1.push((condition.startDay <= i && i <= condition.endDay));
			}
			return results1;
		}
	},
	_condCache: new AttachedCache(function (condition) {
		let result, tag;
		tag = Conditions._handler(condition.conditionType).tag;
		result = tag ? tag.apply(Conditions, arguments) : Conditions.str(condition);
		return condition.conditionType + '$' + result;
	}),
	_setProp: function (obj, prop, value) {
		if (!Object.prototype.hasOwnProperty.call(obj, prop)) {
			Object.defineProperty(obj, prop, {
				writable: true
			});
		}
		return obj[prop] = value;
	},
	_handler: function (conditionType) {
		let handler;
		if (typeof conditionType !== 'string') {
			conditionType = conditionType.conditionType;
		}
		handler = Conditions._conditionTypes[conditionType];
		if (handler == null) {
			throw new Error("Unknown condition type: " + conditionType);
		}
		return handler;
	},
	_conditionTypes: {
		'TrueCondition': {
			abbrs: ['True'],
			analyze: function (condition) {
				return null;
			},
			match: function () {
				return true;
			},
			compile: function (condition) {
				return new U2.AST_True;
			},
			str: function (condition) {
				return '';
			},
			fromStr: function (str, condition) {
				return condition;
			}
		},
		'FalseCondition': {
			abbrs: ['False', 'Disabled'],
			analyze: function (condition) {
				return null;
			},
			match: function () {
				return false;
			},
			compile: function (condition) {
				return new U2.AST_False;
			},
			fromStr: function (str, condition) {
				if (str.length > 0) {
					condition.pattern = str;
				}
				return condition;
			}
		},
		'UrlRegexCondition': {
			abbrs: ['UR', 'URegex', 'UrlR', 'UrlRegex'],
			analyze: function (condition) {
				return this.safeRegex(shExpUtils.escapeSlash(condition.pattern));
			},
			match: function (condition, request, cache) {
				return cache.analyzed.test(request.url);
			},
			compile: function (condition, cache) {
				return this.regTest('url', cache.analyzed);
			}
		},
		'UrlWildcardCondition': {
			abbrs: ['U', 'UW', 'Url', 'UrlW', 'UWild', 'UWildcard', 'UrlWild', 'UrlWildcard'],
			analyze: function (condition) {
				let parts, pattern;
				parts = (function () {
					let j, len, ref1, results;
					ref1 = condition.pattern.split('|');
					results = [];
					for (j = 0, len = ref1.length; j < len; j++) {
						pattern = ref1[j];
						if (pattern) {
							results.push(shExpUtils.shExp2RegExp(pattern, {
								trimAsterisk: true
							}));
						}
					}
					return results;
				})();
				return this.safeRegex(parts.join('|'));
			},
			match: function (condition, request, cache) {
				return cache.analyzed.test(request.url);
			},
			compile: function (condition, cache) {
				return this.regTest('url', cache.analyzed);
			}
		},
		'HostRegexCondition': {
			abbrs: ['R', 'HR', 'Regex', 'HostR', 'HRegex', 'HostRegex'],
			analyze: function (condition) {
				return this.safeRegex(shExpUtils.escapeSlash(condition.pattern));
			},
			match: function (condition, request, cache) {
				return cache.analyzed.test(request.host);
			},
			compile: function (condition, cache) {
				return this.regTest('host', cache.analyzed);
			}
		},
		'HostWildcardCondition': {
			abbrs: ['', 'H', 'W', 'HW', 'Wild', 'Wildcard', 'Host', 'HostW', 'HWild', 'HWildcard', 'HostWild', 'HostWildcard'],
			analyze: function (condition) {
				let parts, pattern;
				parts = (function () {
					let j, len, ref1, results;
					ref1 = condition.pattern.split('|');
					results = [];
					for (j = 0, len = ref1.length; j < len; j++) {
						pattern = ref1[j];
						if (!(pattern)) {
							continue;
						}
						if (pattern.charCodeAt(0) === '.'.charCodeAt(0)) {
							pattern = '*' + pattern;
						}
						if (pattern.indexOf('**.') === 0) {
							results.push(shExpUtils.shExp2RegExp(pattern.substring(1), {
								trimAsterisk: true
							}));
						} else if (pattern.indexOf('*.') === 0) {
							results.push(shExpUtils.shExp2RegExp(pattern.substring(2), {
								trimAsterisk: false
							}).replace(/./, '(?:^|\\.)').replace(/\.\*\$$/, ''));
						} else {
							results.push(shExpUtils.shExp2RegExp(pattern, {
								trimAsterisk: true
							}));
						}
					}
					return results;
				})();
				return this.safeRegex(parts.join('|'));
			},
			match: function (condition, request, cache) {
				return cache.analyzed.test(request.host);
			},
			compile: function (condition, cache) {
				return this.regTest('host', cache.analyzed);
			}
		},
		'BypassCondition': {
			abbrs: ['B', 'Bypass'],
			analyze: function (condition) {
				let addr, cache, matchPort, parts, pos, prefixLen, ref1, scheme, server, serverIp, serverRegex;
				cache = {
					host: null,
					ip: null,
					scheme: null,
					url: null,
					normalizedPattern: ''
				};
				server = condition.pattern;
				if (server === '<local>') {
					cache.host = server;
					return cache;
				}
				parts = server.split('://');
				if (parts.length > 1) {
					cache.scheme = parts[0];
					cache.normalizedPattern = cache.scheme + '://';
					server = parts[1];
				}
				parts = server.split('/');
				if (parts.length > 1) {
					addr = this.parseIp(parts[0]);
					prefixLen = parseInt(parts[1]);
					if (addr && !isNaN(prefixLen)) {
						cache.ip = {
							conditionType: 'IpCondition',
							ip: this.normalizeIp(addr),
							prefixLength: prefixLen
						};
						cache.normalizedPattern += cache.ip.ip + '/' + cache.ip.prefixLength;
						return cache;
					}
				}
				serverIp = this.parseIp(server);
				if (serverIp == null) {
					pos = server.lastIndexOf(':');
					if (pos >= 0) {
						matchPort = server.substring(pos + 1);
						server = server.substring(0, pos);
					}
					serverIp = this.parseIp(server);
				}
				if (serverIp != null) {
					server = this.normalizeIp(serverIp);
					if (serverIp.v4) {
						cache.normalizedPattern += server;
					} else {
						cache.normalizedPattern += '[' + server + ']';
					}
				} else {
					if (server.charCodeAt(0) === '.'.charCodeAt(0)) {
						server = '*' + server;
					}
					cache.normalizedPattern = server;
				}
				if (matchPort) {
					cache.port = matchPort;
					cache.normalizedPattern += ':' + cache.port;
					if ((serverIp != null) && !serverIp.v4) {
						server = '[' + server + ']';
					}
					serverRegex = shExpUtils.shExp2RegExp(server);
					serverRegex = serverRegex.substring(1, serverRegex.length - 1);
					scheme = (ref1 = cache.scheme) != null ? ref1 : '[^:]+';
					cache.url = this.safeRegex('^' + scheme + ':\\/\\/' + serverRegex + ':' + matchPort + '\\/');
				} else if (server !== '*') {
					serverRegex = shExpUtils.shExp2RegExp(server, {
						trimAsterisk: true
					});
					cache.host = this.safeRegex(serverRegex);
				}
				return cache;
			},
			match: function (condition, request, cache) {
				cache = cache.analyzed;
				if ((cache.scheme != null) && cache.scheme !== request.scheme) {
					return false;
				}
				if ((cache.ip != null) && !this.match(cache.ip, request)) {
					return false;
				}
				if (cache.host != null) {
					if (cache.host === '<local>') {
						return request.host === '127.0.0.1' || request.host === '::1' || request.host.indexOf('.') < 0;
					} else {
						if (!cache.host.test(request.host)) {
							return false;
						}
					}
				}
				if ((cache.url != null) && !cache.url.test(request.url)) {
					return false;
				}
				return true;
			},
			str: function (condition) {
				let analyze, cache;
				analyze = this._handler(condition).analyze;
				cache = analyze.call(Conditions, condition);
				if (cache.normalizedPattern) {
					return cache.normalizedPattern;
				} else {
					return condition.pattern;
				}
			},
			compile: function (condition, cache) {
				let conditions, hostEquals;
				cache = cache.analyzed;
				if (cache.url != null) {
					return this.regTest('url', cache.url);
				}
				conditions = [];
				if (cache.host === '<local>') {
					hostEquals = function (host) {
						return new U2.AST_Binary({
							left: new U2.AST_SymbolRef({
								name: 'host'
							}),
							operator: '===',
							right: new U2.AST_String({
								value: host
							})
						});
					};
					return new U2.AST_Binary({
						left: new U2.AST_Binary({
							left: hostEquals('127.0.0.1'),
							operator: '||',
							right: hostEquals('::1')
						}),
						operator: '||',
						right: new U2.AST_Binary({
							left: new U2.AST_Call({
								expression: new U2.AST_Dot({
									expression: new U2.AST_SymbolRef({
										name: 'host'
									}),
									property: 'indexOf'
								}),
								args: [
									new U2.AST_String({
										value: '.'
									})
								]
							}),
							operator: '<',
							right: new U2.AST_Number({
								value: 0
							})
						})
					});
				}
				if (cache.scheme != null) {
					conditions.push(new U2.AST_Binary({
						left: new U2.AST_SymbolRef({
							name: 'scheme'
						}),
						operator: '===',
						right: new U2.AST_String({
							value: cache.scheme
						})
					}));
				}
				if (cache.host != null) {
					conditions.push(this.regTest('host', cache.host));
				} else if (cache.ip != null) {
					conditions.push(this.compile(cache.ip));
				}
				switch (conditions.length) {
					case 0:
						return new U2.AST_True;
					case 1:
						return conditions[0];
					case 2:
						return new U2.AST_Binary({
							left: conditions[0],
							operator: '&&',
							right: conditions[1]
						});
				}
			}
		},
		'KeywordCondition': {
			abbrs: ['K', 'KW', 'Keyword'],
			analyze: function (condition) {
				return null;
			},
			match: function (condition, request) {
				return request.scheme === 'http' && request.url.indexOf(condition.pattern) >= 0;
			},
			compile: function (condition) {
				return new U2.AST_Binary({
					left: new U2.AST_Binary({
						left: new U2.AST_SymbolRef({
							name: 'scheme'
						}),
						operator: '===',
						right: new U2.AST_String({
							value: 'http'
						})
					}),
					operator: '&&',
					right: new U2.AST_Binary({
						left: new U2.AST_Call({
							expression: new U2.AST_Dot({
								expression: new U2.AST_SymbolRef({
									name: 'url'
								}),
								property: 'indexOf'
							}),
							args: [
								new U2.AST_String({
									value: condition.pattern
								})
							]
						}),
						operator: '>=',
						right: new U2.AST_Number({
							value: 0
						})
					})
				});
			}
		},
		'IpCondition': {
			abbrs: ['Ip'],
			analyze: function (condition) {
				let addr, cache, ip, mask;
				cache = {
					addr: null,
					normalized: null
				};
				ip = condition.ip;
				if (ip.charCodeAt(0) === '['.charCodeAt(0)) {
					ip = ip.substr(1, ip.length - 2);
				}
				addr = ip + '/' + condition.prefixLength;
				cache.addr = this.parseIp(addr);
				if (cache.addr == null) {
					throw new Error("Invalid IP address " + addr);
				}
				cache.normalized = this.normalizeIp(cache.addr);
				mask = cache.addr.v4 ? new IP.v4.Address('255.255.255.255/' + cache.addr.subnetMask) : new IP.v6.Address(this.ipv6Max + '/' + cache.addr.subnetMask);
				cache.mask = this.normalizeIp(mask.startAddress());
				return cache;
			},
			match: function (condition, request, cache) {
				let addr;
				addr = this.parseIp(request.host);
				if (addr == null) {
					return false;
				}
				cache = cache.analyzed;
				if (addr.v4 !== cache.addr.v4) {
					return false;
				}
				return addr.isInSubnet(cache.addr);
			},
			compile: function (condition, cache) {
				let hostIsInNet, hostIsInNetEx, hostLooksLikeIp;
				cache = cache.analyzed;
				hostLooksLikeIp = cache.addr.v4 ? new U2.AST_Binary({
					left: new U2.AST_Sub({
						expression: new U2.AST_SymbolRef({
							name: 'host'
						}),
						property: new U2.AST_Binary({
							left: new U2.AST_Dot({
								expression: new U2.AST_SymbolRef({
									name: 'host'
								}),
								property: 'length'
							}),
							operator: '-',
							right: new U2.AST_Number({
								value: 1
							})
						})
					}),
					operator: '>=',
					right: new U2.AST_Number({
						value: 0
					})
				}) : new U2.AST_Binary({
					left: new U2.AST_Call({
						expression: new U2.AST_Dot({
							expression: new U2.AST_SymbolRef({
								name: 'host'
							}),
							property: 'indexOf'
						}),
						args: [
							new U2.AST_String({
								value: ':'
							})
						]
					}),
					operator: '>=',
					right: new U2.AST_Number({
						value: 0
					})
				});
				if (cache.addr.subnetMask === 0) {
					return hostLooksLikeIp;
				}
				hostIsInNet = new U2.AST_Call({
					expression: new U2.AST_SymbolRef({
						name: 'isInNet'
					}),
					args: [
						new U2.AST_SymbolRef({
							name: 'host'
						}), new U2.AST_String({
							value: cache.normalized
						}), new U2.AST_String({
							value: cache.mask
						})
					]
				});
				if (!cache.addr.v4) {
					hostIsInNetEx = new U2.AST_Call({
						expression: new U2.AST_SymbolRef({
							name: 'isInNetEx'
						}),
						args: [
							new U2.AST_SymbolRef({
								name: 'host'
							}), new U2.AST_String({
								value: cache.normalized + cache.addr.subnet
							})
						]
					});
					hostIsInNet = new U2.AST_Conditional({
						condition: new U2.AST_Binary({
							left: new U2.AST_UnaryPrefix({
								operator: 'typeof',
								expression: new U2.AST_SymbolRef({
									name: 'isInNetEx'
								})
							}),
							operator: '===',
							right: new U2.AST_String({
								value: 'function'
							})
						}),
						consequent: hostIsInNetEx,
						alternative: hostIsInNet
					});
				}
				return new U2.AST_Binary({
					left: hostLooksLikeIp,
					operator: '&&',
					right: hostIsInNet
				});
			},
			str: function (condition) {
				return condition.ip + '/' + condition.prefixLength;
			},
			fromStr: function (str, condition) {
				let addr;
				addr = this.parseIp(str);
				if (addr != null) {
					condition.ip = addr.addressMinusSuffix;
					condition.prefixLength = addr.subnetMask;
				} else {
					condition.ip = '0.0.0.0';
					condition.prefixLength = 0;
				}
				return condition;
			}
		},
		'HostLevelsCondition': {
			abbrs: ['Lv', 'Level', 'Levels', 'HL', 'HLv', 'HLevel', 'HLevels', 'HostL', 'HostLv', 'HostLevel', 'HostLevels'],
			analyze: function (condition) {
				return '.'.charCodeAt(0);
			},
			match: function (condition, request, cache) {
				let dotCharCode, dotCount, i, j, ref1;
				dotCharCode = cache.analyzed;
				dotCount = 0;
				for (i = j = 0, ref1 = request.host.length; 0 <= ref1 ? j < ref1 : j > ref1; i = 0 <= ref1 ? ++j : --j) {
					if (request.host.charCodeAt(i) === dotCharCode) {
						dotCount++;
						if (dotCount > condition.maxValue) {
							return false;
						}
					}
				}
				return dotCount >= condition.minValue;
			},
			compile: function (condition) {
				let val;
				val = {
					property: 'length',
					expression: {
						args: [
							'.'
						],
						expression: {
							expression: 'host',
							property: 'split'
						}
					}
				};
				return this.between(val, condition.minValue + 1, condition.maxValue + 1, condition.minValue + " <= hostLevels <= " + condition.maxValue);
			},
			str: function (condition) {
				return condition.minValue + '~' + condition.maxValue;
			},
			fromStr: function (str, condition) {
				let maxValue, minValue, ref1;
				ref1 = str.split('~'), minValue = ref1[0], maxValue = ref1[1];
				condition.minValue = parseInt(minValue, 10);
				condition.maxValue = parseInt(maxValue, 10);
				if (!(condition.minValue > 0)) {
					condition.minValue = 1;
				}
				if (!(condition.maxValue > 0)) {
					condition.maxValue = 1;
				}
				return condition;
			}
		},
		'WeekdayCondition': {
			abbrs: ['WD', 'Week', 'Day', 'Weekday'],
			analyze: function (condition) {
				return null;
			},
			match: function (condition, request) {
				let day;
				day = new Date().getDay();
				if (condition.days) {
					return condition.days.charCodeAt(day) > 64;
				}
				return condition.startDay <= day && day <= condition.endDay;
			},
			compile: function (condition) {
				let getDay;
				getDay = new U2.AST_Call({
					args: [],
					expression: new U2.AST_Dot({
						property: 'getDay',
						expression: new U2.AST_New({
							args: [],
							expression: new U2.AST_SymbolRef({
								name: 'Date'
							})
						})
					})
				});
				if (condition.days) {
					return new U2.AST_Binary({
						left: new U2.AST_Call({
							expression: new U2.AST_Dot({
								expression: new U2.AST_String({
									value: condition.days
								}),
								property: 'charCodeAt'
							}),
							args: [getDay]
						}),
						operator: '>',
						right: new U2.AST_Number({
							value: 64
						})
					});
				} else {
					return this.between(getDay, condition.startDay, condition.endDay);
				}
			},
			str: function (condition) {
				if (condition.days) {
					return condition.days;
				} else {
					return condition.startDay + '~' + condition.endDay;
				}
			},
			fromStr: function (str, condition) {
				let endDay, ref1, ref2, ref3, startDay;
				if (str.indexOf('~') < 0 && str.length === 7) {
					condition.days = str;
				} else {
					ref1 = str.split('~'), startDay = ref1[0], endDay = ref1[1];
					condition.startDay = parseInt(startDay, 10);
					condition.endDay = parseInt(endDay, 10);
					if (!((0 <= (ref2 = condition.startDay) && ref2 <= 6))) {
						condition.startDay = 0;
					}
					if (!((0 <= (ref3 = condition.endDay) && ref3 <= 6))) {
						condition.endDay = 0;
					}
				}
				return condition;
			}
		},
		'TimeCondition': {
			abbrs: ['T', 'Time', 'Hour'],
			analyze: function (condition) {
				return null;
			},
			match: function (condition, request) {
				let hour;
				hour = new Date().getHours();
				return condition.startHour <= hour && hour <= condition.endHour;
			},
			compile: function (condition) {
				let val;
				val = new U2.AST_Call({
					args: [],
					expression: new U2.AST_Dot({
						property: 'getHours',
						expression: new U2.AST_New({
							args: [],
							expression: new U2.AST_SymbolRef({
								name: 'Date'
							})
						})
					})
				});
				return this.between(val, condition.startHour, condition.endHour);
			},
			str: function (condition) {
				return condition.startHour + '~' + condition.endHour;
			},
			fromStr: function (str, condition) {
				let endHour, ref1, ref2, ref3, startHour;
				ref1 = str.split('~'), startHour = ref1[0], endHour = ref1[1];
				condition.startHour = parseInt(startHour, 10);
				condition.endHour = parseInt(endHour, 10);
				if (!((0 <= (ref2 = condition.startHour) && ref2 < 24))) {
					condition.startHour = 0;
				}
				if (!((0 <= (ref3 = condition.endHour) && ref3 < 24))) {
					condition.endHour = 0;
				}
				return condition;
			}
		}
	}
};


const Switchy = {
	omegaPrefix: '[SwitchyOmega Conditions',
	specialLineStart: "[;#@!",
	detect: function (text) {
		if (strStartsWith(text, Switchy.omegaPrefix)) {
			return true;
		}
	},
	parse: function (text, matchProfileName, defaultProfileName) {
		let parser, switchy = Switchy;
		//switchy = Switchy;
		parser = switchy.getParser(text);
		return switchy[parser](text, matchProfileName, defaultProfileName);
	},
	directReferenceSet: function (arg) {
		let defaultProfileName, i, iSpace, len, line, matchProfileName, parser, profile, ref, refs, ruleList, switchy, text;
		ruleList = arg.ruleList, matchProfileName = arg.matchProfileName, defaultProfileName = arg.defaultProfileName;
		text = ruleList.trim();
		switchy = Switchy;
		parser = switchy.getParser(text);
		if (parser !== 'parseOmega') {
			return;
		}
		if (!/(^|\n)@with\s+results?(\r|\n|$)/i.test(text)) {
			return;
		}
		refs = {};
		ref = text.split(/\n|\r/);
		for (i = 0, len = ref.length; i < len; i++) {
			line = ref[i];
			line = line.trim();
			if (switchy.specialLineStart.indexOf(line[0]) < 0) {
				iSpace = line.lastIndexOf(' +');
				if (iSpace < 0) {
					profile = defaultProfileName || 'direct';
				} else {
					profile = line.substr(iSpace + 2).trim();
				}
				refs['+' + profile] = profile;
			}
		}
		return refs;
	},
	compose: function (arg, arg1) {
		let defaultProfileName, eol, i, len, line, ref, rule, ruleList, rules, specialLineStart, useExclusive, withResult;
		rules = arg.rules, defaultProfileName = arg.defaultProfileName;
		ref = arg1 != null ? arg1 : {}, withResult = ref.withResult, useExclusive = ref.useExclusive;
		eol = '\r\n';
		ruleList = '[SwitchyOmega Conditions]' + eol;
		if (useExclusive == null) {
			useExclusive = !withResult;
		}
		if (withResult) {
			ruleList += '@with result' + eol + eol;
		} else {
			ruleList += eol;
		}
		specialLineStart = Switchy.specialLineStart + '+';
		for (i = 0, len = rules.length; i < len; i++) {
			rule = rules[i];
			if (rule.note) {
				ruleList += '@note ' + rule.note + eol;
			}
			line = Conditions.str(rule.condition);
			if (useExclusive && rule.profileName === defaultProfileName) {
				line = '!' + line;
			} else {
				if (specialLineStart.indexOf(line[0]) >= 0) {
					line = ': ' + line;
				}
				if (withResult) {
					line += ' +' + rule.profileName;
				}
			}
			ruleList += line + eol;
		}
		if (withResult) {
			ruleList += eol + '* +' + defaultProfileName + eol;
		}
		return ruleList;
	},
	getParser: function (text) {
		let parser, switchy;
		switchy = Switchy;
		parser = 'parseOmega';
		if (!strStartsWith(text, switchy.omegaPrefix)) {
			if (text[0] === '#' || text.indexOf('\n#') >= 0) {
				parser = 'parseLegacy';
			}
		}
		return parser;
	},
	conditionFromLegacyWildcard: function (pattern) {
		let host;
		if (pattern[0] === '@') {
			pattern = pattern.substring(1);
		} else {
			if (pattern.indexOf('://') <= 0 && pattern[0] !== '*') {
				pattern = '*' + pattern;
			}
			if (pattern[pattern.length - 1] !== '*') {
				pattern += '*';
			}
		}
		host = Conditions.urlWildcard2HostWildcard(pattern);
		if (host) {
			return {
				conditionType: 'HostWildcardCondition',
				pattern: host
			};
		} else {
			return {
				conditionType: 'UrlWildcardCondition',
				pattern: pattern
			};
		}
	},
	parseLegacy: function (text, matchProfileName, defaultProfileName) {
		let begin, cond, exclusive_rules, i, len, line, list, normal_rules, profile, ref, section, source;
		normal_rules = [];
		exclusive_rules = [];
		begin = false;
		section = 'WILDCARD';
		ref = text.split(/\n|\r/);
		for (i = 0, len = ref.length; i < len; i++) {
			line = ref[i];
			line = line.trim();
			if (line.length === 0 || line[0] === ';') {
				continue;
			}
			if (!begin) {
				if (line.toUpperCase() === '#BEGIN') {
					begin = true;
				}
				continue;
			}
			if (line.toUpperCase() === '#END') {
				break;
			}
			if (line[0] === '[' && line[line.length - 1] === ']') {
				section = line.substring(1, line.length - 1).toUpperCase();
				continue;
			}
			source = line;
			profile = matchProfileName;
			list = normal_rules;
			if (line[0] === '!') {
				profile = defaultProfileName;
				list = exclusive_rules;
				line = line.substring(1);
			}
			cond = (function () {
				switch (section) {
					case 'WILDCARD':
						return Switchy.conditionFromLegacyWildcard(line);
					case 'REGEXP':
						return {
							conditionType: 'UrlRegexCondition',
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
		//debugger;
		let cond, directive, error, exclusiveProfile, feature, i, iSpace, includeSource, j, len, len1, line, lno, noteForNextRule, profile, ref, ref1, rule, rules, rulesWithDefaultProfile, source, strict, withResult;
		if (args == null) {
			args = {};
		}
		strict = args.strict;
		if (strict) {
			error = function (fields) {
				let err, key, value;
				err = new Error(fields.message);
				for (key in fields) {
					if (!hasProp.call(fields, key)) continue;
					value = fields[key];
					err[key] = value;
				}
				throw err;
			};
		}
		includeSource = (ref = args.source) != null ? ref : true;
		rules = [];
		rulesWithDefaultProfile = [];
		withResult = false;
		exclusiveProfile = null;
		noteForNextRule = null;
		lno = 0;
		ref1 = text.split(/\n|\r/);
		for (i = 0, len = ref1.length; i < len; i++) {
			line = ref1[i];
			lno++;
			line = line.trim();
			if (line.length === 0) {
				continue;
			}
			switch (line[0]) {
				case '[':
					continue;
				case ';':
					continue;
				case '@':
					iSpace = line.indexOf(' ');
					if (iSpace < 0) {
						iSpace = line.length;
					}
					directive = line.substr(1, iSpace - 1);
					line = line.substr(iSpace + 1).trim();
					switch (directive.toUpperCase()) {
						case 'WITH':
							feature = line.toUpperCase();
							if (feature === 'RESULT' || feature === 'RESULTS') {
								withResult = true;
							}
							break;
						case 'NOTE':
							noteForNextRule = line;
					}
					continue;
			}
			source = null;
			if (strict) {
				exclusiveProfile = null;
			}
			if (line[0] === '!') {
				profile = withResult ? null : defaultProfileName;
				source = line;
				line = line.substr(1);
			} else if (withResult) {
				iSpace = line.lastIndexOf(' +');
				if (iSpace < 0) {
					if (typeof error === "function") {
						error({
							message: "Missing result profile name: " + line,
							reason: 'missingResultProfile',
							source: line,
							sourceLineNo: lno
						});
					}
					continue;
				}
				profile = line.substr(iSpace + 2).trim();
				line = line.substr(0, iSpace).trim();
				if (line === '*') {
					exclusiveProfile = profile;
				}
			} else {
				profile = matchProfileName;
			}
			cond = Conditions.fromStr(line);
			if (!cond) {
				if (typeof error === "function") {
					error({
						message: "Invalid rule: " + line,
						reason: 'invalidRule',
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
			if (noteForNextRule != null) {
				rule.note = noteForNextRule;
				noteForNextRule = null;
			}
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
							reason: 'noDefaultRule'
						});
					}
				}
				exclusiveProfile = defaultProfileName || 'direct';
			}
			for (j = 0, len1 = rulesWithDefaultProfile.length; j < len1; j++) {
				rule = rulesWithDefaultProfile[j];
				rule.profileName = exclusiveProfile;
			}
		}
		return rules;
	}
}


let SwitchyCompiler = {
	builtinProfiles: {
		'+direct': {
			name: 'direct',
			profileType: 'DirectProfile',
			color: '#aaaaaa',
			builtin: true
		},
		'+system': {
			name: 'system',
			profileType: 'SystemProfile',
			color: '#000000',
			builtin: true
		}
	},
	schemes: [
		{
			scheme: 'http',
			prop: 'proxyForHttp'
		}, {
			scheme: 'https',
			prop: 'proxyForHttps'
		}, {
			scheme: 'ftp',
			prop: 'proxyForFtp'
		}, {
			scheme: '',
			prop: 'fallbackProxy'
		}
	],
	pacProtocols: {
		'http': 'PROXY',
		'https': 'HTTPS',
		'socks4': 'SOCKS',
		'socks5': 'SOCKS5'
	},
	formatByType: {
		'SwitchyRuleListProfile': 'Switchy',
		'AutoProxyRuleListProfile': 'AutoProxy'
	},
	ruleListFormats: ['Switchy', 'AutoProxy'],
	parseHostPort: function (str, scheme) {
		let host, port, sep;
		sep = str.lastIndexOf(':');
		if (sep < 0) {
			return;
		}
		port = parseInt(str.substr(sep + 1)) || 80;
		host = str.substr(0, sep);
		if (!host) {
			return;
		}
		return {
			scheme: scheme,
			host: host,
			port: port
		};
	},
	pacResult: function (proxy) {
		if (proxy) {
			if (proxy.scheme === 'socks5') {
				return "SOCKS5 " + proxy.host + ":" + proxy.port + "; SOCKS " + proxy.host + ":" + proxy.port;
			} else {
				return SwitchyCompiler.pacProtocols[proxy.scheme] + " " + proxy.host + ":" + proxy.port;
			}
		} else {
			return 'DIRECT';
		}
	},
	isFileUrl: function (url) {
		return !!((url != null ? url.substr(0, 5).toUpperCase() : void 0) === 'FILE:');
	},
	nameAsKey: function (profileName) {
		if (typeof profileName !== 'string') {
			profileName = profileName.name;
		}
		return '+' + profileName;
	},
	byName: function (profileName, options) {
		let key, ref2;
		if (typeof profileName === 'string') {
			key = SwitchyCompiler.nameAsKey(profileName);
			profileName = (ref2 = SwitchyCompiler.builtinProfiles[key]) != null ? ref2 : options[key];
		}
		return profileName;
	},
	byKey: function (key, options) {
		let ref2;
		if (typeof key === 'string') {
			key = (ref2 = SwitchyCompiler.builtinProfiles[key]) != null ? ref2 : options[key];
		}
		return key;
	},
	each: function (options, callback) {
		let charCodePlus, key, profile, ref2, results;
		charCodePlus = '+'.charCodeAt(0);
		for (key in options) {
			profile = options[key];
			if (key.charCodeAt(0) === charCodePlus) {
				callback(key, profile);
			}
		}
		ref2 = SwitchyCompiler.builtinProfiles;
		results = [];
		for (key in ref2) {
			profile = ref2[key];
			if (key.charCodeAt(0) === charCodePlus) {
				results.push(callback(key, profile));
			} else {
				results.push(void 0);
			}
		}
		return results;
	},
	profileResult: function (profileName) {
		let key;
		key = SwitchyCompiler.nameAsKey(profileName);
		if (key === '+direct') {
			key = SwitchyCompiler.pacResult();
		}
		return key;
	},
	isIncludable: function (profile) {
		let includable;
		includable = SwitchyCompiler._handler(profile).includable;
		if (typeof includable === 'function') {
			includable = includable.call(SwitchyCompiler, profile);
		}
		return !!includable;
	},
	isInclusive: function (profile) {
		return !!SwitchyCompiler._handler(profile).inclusive;
	},
	updateUrl: function (profile) {
		let ref2;
		return (ref2 = SwitchyCompiler._handler(profile).updateUrl) != null ? ref2.call(SwitchyCompiler, profile) : void 0;
	},
	updateContentTypeHints: function (profile) {
		let ref2;
		return (ref2 = SwitchyCompiler._handler(profile).updateContentTypeHints) != null ? ref2.call(SwitchyCompiler, profile) : void 0;
	},
	update: function (profile, data) {
		return SwitchyCompiler._handler(profile).update.call(SwitchyCompiler, profile, data);
	},
	tag: function (profile) {
		return SwitchyCompiler._profileCache.tag(profile);
	},
	create: function (profile, opt_profileType) {
		let create;
		if (typeof profile === 'string') {
			profile = {
				name: profile,
				profileType: opt_profileType
			};
		} else if (opt_profileType) {
			profile.profileType = opt_profileType;
		}
		create = SwitchyCompiler._handler(profile).create;
		if (!create) {
			return profile;
		}
		create.call(SwitchyCompiler, profile);
		return profile;
	},
	updateRevision: function (profile, revision) {
		if (revision == null) {
			revision = Revision.fromTime();
		}
		return profile.revision = revision;
	},
	replaceRef: function (profile, fromName, toName) {
		let handler;
		if (!SwitchyCompiler.isInclusive(profile)) {
			return false;
		}
		handler = SwitchyCompiler._handler(profile);
		return handler.replaceRef.call(SwitchyCompiler, profile, fromName, toName);
	},
	analyze: function (profile) {
		let analyze, cache, result;
		cache = SwitchyCompiler._profileCache.get(profile, {});
		if (!Object.prototype.hasOwnProperty.call(cache, 'analyzed')) {
			analyze = SwitchyCompiler._handler(profile).analyze;
			result = analyze != null ? analyze.call(SwitchyCompiler, profile) : void 0;
			cache.analyzed = result;
		}
		return cache;
	},
	// dropCache: function (profile) {
	// 	return SwitchyCompiler._profileCache.drop(profile);
	// },
	directReferenceSet: function (profile) {
		let cache, handler;
		if (!SwitchyCompiler.isInclusive(profile)) {
			return {};
		}
		cache = SwitchyCompiler._profileCache.get(profile, {});
		if (cache.directReferenceSet) {
			return cache.directReferenceSet;
		}
		handler = SwitchyCompiler._handler(profile);
		return cache.directReferenceSet = handler.directReferenceSet.call(SwitchyCompiler, profile);
	},
	profileNotFound: function (name, action) {
		if (action == null) {
			throw new Error("Profile " + name + " does not exist!");
		}
		if (typeof action === 'function') {
			action = action(name);
		}
		if (typeof action === 'object' && action.profileType) {
			return action;
		}
		switch (action) {
			case 'ignore':
				return null;
			case 'dumb':
				return SwitchyCompiler.create({
					name: name,
					profileType: 'VirtualProfile',
					defaultProfileName: 'direct'
				});
		}
		throw action;
	},
	allReferenceSet: function (profile, options, opt_args) {
		let has_out, key, name, o_profile, ref2, result;
		o_profile = profile;
		profile = SwitchyCompiler.byName(profile, options);
		if (profile == null) {
			profile = typeof SwitchyCompiler.profileNotFound === "function" ? SwitchyCompiler.profileNotFound(o_profile, opt_args.profileNotFound) : void 0;
		}
		if (opt_args == null) {
			opt_args = {};
		}
		has_out = opt_args.out != null;
		result = opt_args.out != null ? opt_args.out : opt_args.out = {};
		if (profile) {
			result[SwitchyCompiler.nameAsKey(profile.name)] = profile.name;
			ref2 = SwitchyCompiler.directReferenceSet(profile);
			for (key in ref2) {
				name = ref2[key];
				SwitchyCompiler.allReferenceSet(name, options, opt_args);
			}
		}
		if (!has_out) {
			delete opt_args.out;
		}
		return result;
	},
	referencedBySet: function (profile, options, opt_args) {
		let has_out, profileKey, result;
		profileKey = SwitchyCompiler.nameAsKey(profile);
		if (opt_args == null) {
			opt_args = {};
		}
		has_out = opt_args.out != null;
		result = opt_args.out != null ? opt_args.out : opt_args.out = {};
		SwitchyCompiler.each(options, function (key, prof) {
			if (SwitchyCompiler.directReferenceSet(prof)[profileKey]) {
				result[key] = prof.name;
				return SwitchyCompiler.referencedBySet(prof, options, opt_args);
			}
		});
		if (!has_out) {
			delete opt_args.out;
		}
		return result;
	},
	validResultProfilesFor: function (profile, options) {
		let profileKey, ref, result;
		profile = SwitchyCompiler.byName(profile, options);
		if (!SwitchyCompiler.isInclusive(profile)) {
			return [];
		}
		profileKey = SwitchyCompiler.nameAsKey(profile);
		ref = SwitchyCompiler.referencedBySet(profile, options);
		ref[profileKey] = profileKey;
		result = [];
		SwitchyCompiler.each(options, function (key, prof) {
			if (!ref[key] && SwitchyCompiler.isIncludable(prof)) {
				return result.push(prof);
			}
		});
		return result;
	},
	match: function (profile, request, opt_profileType) {
		let cache, match;
		if (opt_profileType == null) {
			opt_profileType = profile.profileType;
		}
		cache = SwitchyCompiler.analyze(profile);
		match = SwitchyCompiler._handler(opt_profileType).match;
		return match != null ? match.call(SwitchyCompiler, profile, request, cache) : void 0;
	},
	compile: function (profile, opt_profileType) {
		let cache, handler;
		if (opt_profileType == null) {
			opt_profileType = profile.profileType;
		}
		cache = SwitchyCompiler.analyze(profile);
		if (cache.compiled) {
			return cache.compiled;
		}
		handler = SwitchyCompiler._handler(opt_profileType);
		return cache.compiled = handler.compile.call(SwitchyCompiler, profile, cache);
	},
	_profileCache: new AttachedCache(function (profile) {
		return profile.revision;
	}),
	_handler: function (profileType) {
		let handler;
		if (typeof profileType !== 'string') {
			profileType = profileType.profileType;
		}
		handler = profileType;
		while (typeof handler === 'string') {
			handler = SwitchyCompiler._profileTypes[handler];
		}
		if (handler == null) {
			throw new Error("Unknown profile type: " + profileType);
		}
		return handler;
	},
	_profileTypes: {
		'SwitchProfile': {
			includable: true,
			inclusive: true,
			create: function (profile) {
				if (profile.defaultProfileName == null) {
					profile.defaultProfileName = 'direct';
				}
				return profile.rules != null ? profile.rules : profile.rules = [];
			},
			directReferenceSet: function (profile) {
				let i, len, ref2, refs, rule;
				refs = {};
				refs[SwitchyCompiler.nameAsKey(profile.defaultProfileName)] = profile.defaultProfileName;
				ref2 = profile.rules;
				for (i = 0, len = ref2.length; i < len; i++) {
					rule = ref2[i];
					refs[SwitchyCompiler.nameAsKey(rule.profileName)] = rule.profileName;
				}
				return refs;
			},
			analyze: function (profile) {
				return profile.rules;
			},
			replaceRef: function (profile, fromName, toName) {
				let changed, i, len, ref2, rule;
				changed = false;
				if (profile.defaultProfileName === fromName) {
					profile.defaultProfileName = toName;
					changed = true;
				}
				ref2 = profile.rules;
				for (i = 0, len = ref2.length; i < len; i++) {
					rule = ref2[i];
					if (rule.profileName === fromName) {
						rule.profileName = toName;
						changed = true;
					}
				}
				return changed;
			},
			match: function (profile, request, cache) {
				let i, len, ref2, rule;
				ref2 = cache.analyzed;
				for (i = 0, len = ref2.length; i < len; i++) {
					rule = ref2[i];
					if (Conditions.match(rule.condition, request)) {
						return rule;
					}
				}
				return [SwitchyCompiler.nameAsKey(profile.defaultProfileName), null];
			},
			compile: function (profile, cache) {
				let  i, len, rule, rules;
				rules = cache.analyzed;
				if (rules.length === 0) {
					return this.profileResult(profile.defaultProfileName);
				}
				let compiled = [];
				for (i = 0, len = rules.length; i < len; i++) {
					rule = rules[i];
					let c = Conditions.compile(rule.condition);
					c.source = rule.source;
					compiled.push(c);
				}
				return {
					compiled: compiled,
					argnames: [
						{
							name: 'url'
						}, {
							name: 'host'
						}, {
							name: 'scheme'
						}
					]
				};
			}
		}
	}
};

if (typeof (exports) == 'undefined')
	exports = {};

// final export
exports.RuleImporterSwitchy = {
	switchy: Switchy,
	compiler: SwitchyCompiler,
}