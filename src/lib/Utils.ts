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
import { environment } from "./environment";
import { SettingsConfig } from "../core/definitions";
import * as pako from "pako";
export class Utils {
	private static readonly invalidHostSchemas = ["moz-extension:", "chrome-extension:", "about:", "data:", "chrome:", "opera:", "edge:"];

	public static getNewUniqueIdNumber(): number {
		return +Math.random()
			.toString(10)
			.substr(2 + Math.random() * 10);
	}

	public static getNewUniqueIdString() {
		return (Math.random().toString(36).substr(2, 5) + Date.now().toString(36)).toLowerCase();
	}

	public static encodeSyncData(inputObject: SettingsConfig) {
		let settingStr = JSON.stringify(inputObject);

		// encode string to utf8
		let enc = new TextEncoder();
		let settingArray = enc.encode(settingStr);

		// compress
		let compressResultStr = pako.deflateRaw(settingArray, {}) as unknown as string;
		compressResultStr = Utils.b64EncodeUnicode(compressResultStr as string);

		let saveObject = {};

		// some browsers have limitation on data size per item
		// so we have split the data into chunks saved in a object
		splitIntoChunks(compressResultStr, saveObject);

		function splitIntoChunks(str: any, outputObject: any) {
			let length = environment.storageQuota.syncQuotaBytesPerItem();
			if (length > 0) {

				let chunks = Utils.chunkString(str, length);
				outputObject.chunkLength = chunks.length;

				for (let index = 0; index < chunks.length; index++) {
					outputObject["c" + index] = chunks[index];
				}

			} else {
				outputObject.c0 = str;
				outputObject.chunkLength = 1;
			}
		}

		return saveObject;
	}

	public static decodeSyncData(inputObject: any): SettingsConfig {
		if (!inputObject || !inputObject.chunkLength)
			return null;

		// joining the chunks
		let chunks = [];
		for (let index = 0; index < inputObject.chunkLength; index++) {
			chunks.push(inputObject["c" + index]);
		}
		let compressResultStr = chunks.join("");

		// convert from base64 string
		let compressResult = Utils.b64DecodeUnicodeArray(compressResultStr);
		let settingArray = pako.inflateRaw(compressResult);

		// decode array to string
		let dec = new TextDecoder();
		let settingStr = dec.decode(settingArray);

		// parse the JSON
		return JSON.parse(settingStr);
	}

	public static removeDuplicates(originalArray: any[], prop: any) {
		//<reference path="https://stackoverflow.com/a/36744732/322446"/>
		return originalArray.filter(
			(thing, index, self) => self.findIndex((t) => {
				return t[prop] === thing[prop];
			}) === index);
	}

	public static removeDuplicatesFunc(originalArray: any[], areEqualFunc: Function) {
		//<reference path="https://stackoverflow.com/a/36744732/322446"/>
		return originalArray.filter(
			(thing, index, self) => self.findIndex((t) => {
				return areEqualFunc(t, thing);
			}) === index);
	}

	public static reverseString(str: string): string {
		return str.split('').reverse().join('');
	}

	public static strStartsWith(str: string, prefix: string) {
		return str.substr(0, prefix.length) === prefix;
	}

	public static chunkString(str: string, length: number) {
		let index = 0;
		let endIndex = length;
		if (endIndex > str.length)
			endIndex = str.length;

		let result = new Array<string>();
		for (; ;) {
			result.push(str.slice(index, endIndex));

			if (endIndex >= str.length)
				break;

			index += length;
			endIndex += length;

			if (endIndex > str.length)
				endIndex = str.length;
		}

		return result;
	}

	public static b64EncodeUnicode(str: string): string {
		// first we use encodeURIComponent to get percent-encoded UTF-8,
		// then we convert the percent encodings into raw bytes which
		// can be fed into btoa.
		return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
			(match, p1: number) => String.fromCharCode(+('0x' + p1))));
	}

	public static b64DecodeUnicode(str: string): string {
		// Going backwards: from byte-stream, to percent-encoding, to original string.
		return decodeURIComponent(atob(str)
			.split("")
			.map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
			.join(""));
	}

	public static b64DecodeUnicodeArray(str: string): any {
		// Going backwards: from byte-stream, to percent-encoding, to original string.
		let result = Utils.b64DecodeUnicode(str);
		if (typeof (result) === 'string') {
			return new Uint16Array(result.split(',') as unknown as number[])
		}
		return result;
	}

	public static isValidHost(host: string): boolean {
		if (host) {
			if (Utils.invalidHostSchemas.indexOf(host) >= 0)
				return false;

			return true;
		}
		return false;
	}

	public static isValidUrl(url: string): boolean {
		try {
			const u = new URL(url);
			if (Utils.invalidHostSchemas.indexOf(u.protocol) >= 0)
				return false;

			return true;
		}
		catch (e) { return false; }
	}

	public static isUrlHttps(url: string): boolean {
		try {
			const u = new URL(url);
			if (u.protocol.toLowerCase().startsWith("https"))
				return true;
			return false;
		}
		catch (e) { return false; }
	}
	public static isUrlLocal(url: string): boolean {
		try {
			const u = new URL(url);
			if (Utils.invalidHostSchemas.indexOf(u.protocol) >= 0)
				return true;

			return false;
		}
		catch (e) { return false; }
	}

	public static urlHasSchema(url: string): boolean {
		// note: this will accept like http:/example.org/ in Chrome and Firefox
		if (!url)
			return false;
		if (url.includes(":/"))
			return true;
		return false;
	}


	public static extractHostFromInvalidUrl(url: string): string | null {
		try {
			if (url.includes(":/")) {
				try {
					new URL(url);
					// url is valid
					return Utils.extractHostFromUrl(url);
				} catch { }
			}

			let urlFixed = 'http://' + url;
			return Utils.extractHostFromUrl(urlFixed);
		}
		catch (e) { return null; }
	}

	public static extractHostNameFromInvalidUrl(url: string): string | null {
		try {
			if (url.includes(":/")) {
				try {
					new URL(url);
					// url is valid
					return Utils.extractHostNameFromUrl(url);
				} catch { }
			}

			let urlFixed = 'http://' + url;
			return Utils.extractHostNameFromUrl(urlFixed);
		}
		catch (e) { return null; }
	}
	public static extractHostFromUrl(url: string): string | null {
		/** 
		 * For `http://sub.git.com/test` returns `sub.git.com`
		 * For `http://sub.git.com:6675/test` returns `sub.git.com:6675`
		  */
		try {
			const u = new URL(url);
			if (Utils.invalidHostSchemas.indexOf(u.protocol) >= 0)
				return null;
			let host = u.host;

			return host;
		}
		catch (e) { return null; }
	}

	public static extractHostNameFromUrl(url: string): string | null {
		/** 
		 * For `http://sub.git.com/test` returns `sub.git.com`
		 * For `http://sub.git.com:6675/test` returns `sub.git.com`
		  */
		try {
			const u = new URL(url);
			if (Utils.invalidHostSchemas.indexOf(u.protocol) >= 0)
				return null;
			let host = u.hostname;

			return host;
		}
		catch (e) { return null; }
	}

	public static extractSubdomainListFromUrl(url: string): string[] {
		let host = Utils.extractHostFromUrl(url);
		if (host === null)
			return [];

		return Utils.extractSubdomainListFromHost(host);
	}

	public static extractSubdomainListFromHost(host: string): string[] {
		if (!host)
			return null;

		let parts = host.split(".");
		if (parts.length <= 2)
			return [host];

		if (parts.length == 4) {
			// check if it is ip
			let lastPart = +parts[3].split(':')[0];
			if (lastPart >= 0) {
				// it is an IP
				return [host];
			}
		}

		let result = new Array<string>();
		for (let i = 0; i < parts.length; i++) {
			if (i == parts.length - 1)
				break;

			let sliced = parts.slice(i, parts.length);
			//if (sliced.length > 0)
			result.push(sliced.join("."));
		}

		result.reverse();

		// removing top level extension if it is to be ignored, like .com.au
		let topLevelDomainExtension = result[0];
		if (topLevelDomainExtension) {

			if (Utils.IgnoreDomainExtensions.indexOf(topLevelDomainExtension) != -1) {
				result.splice(0, 1);
			}
		}
		return result;
	}

	public static hostToMatchPattern(host: string, completeUrl: boolean = true): string {

		// only convert to match pattern if it is just host address like 'google.com'
		if (host.indexOf(":") > -1)
			return host;

		if (completeUrl)
			return `*://*.${host}/*`;
		return `*.${host}/*`;
	}

	/** Removes Https:// and ftp:// and other protocols from url */
	public static removeSchemaFromUrl(url: string): string {
		if (url == null)
			return url;
		let u = new URL(url);
		let schemaLength = (u.protocol + '//').length;

		return url.substring(schemaLength, url.length);
	}

	public static matchPatternToRegExp(pattern: string, completeUrl = true, ignoreCase = false): RegExp | null {
		// Source: https://developer.mozilla.org/en-US/Add-ons/WebExtensions/Match_patterns
		// Modified by Salar Khalilzadeh
		/**
		 * Transforms a valid match pattern into a regular expression
		 * which matches all URLs included by that pattern.
		 *
		 * @param  {string}  pattern  The pattern to transform.
		 * @return {RegExp}           The pattern's equivalent as a RegExp.
		 * @throws {TypeError}        If the pattern is not a valid MatchPattern
		 */

		// matches all valid match patterns (except '<all_urls>')
		// and extracts [ , scheme, host, path, ]
		let matchPattern: RegExp;
		matchPattern = (/^(?:(\*|https?|file|ftp|app|wss?):\/\/([^/:]+)(?:\:(\d+))?\/?(.*))$/i);

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
		const [, scheme, host, port, path,] = match;

		if (completeUrl) {
			return new RegExp("^(?:"
				+ (scheme === "*" ? "(?:https?|ftp|wss?)" : escape(scheme)) + ":\\/\\/"
				+ (host === "*" ? "[^\\/]*" : escape(host).replace(/^\*\./g, "(?:(?:[^\\/]+)\\.|(?:[^\\/]+){0})"))
				+ (port ? "\\:" + escape(port) : "")
				+ (path ? (path == "*" ? "(?:\\/.*)?" : ("\\/" + escape(path).replace(/\*/g, ".*"))) : "\\/?")
				+ ")$", ignoreCase ? "i" : undefined);
		}
		else {
			return new RegExp("^(?:"
				+ (host === "*" ? "[^\\/]*" : escape(host).replace(/^\*\./g, "(?:(?:[^\\/]+)\\.|(?:[^\\/]+){0})"))
				+ (port ? "\\:" + escape(port) : "")
				+ (path ? (path == "*" ? "(?:\\/.*)?" : ("\\/" + escape(path).replace(/\*/g, ".*"))) : "\\/?")
				+ ")$", ignoreCase ? "i" : undefined);
		}
	}

	public static deepClone<T>(array: T[]): T[] {
		return JSON.parse(JSON.stringify(array));
	}

	public static deepCloneObject<T>(obj: T): T {
		return JSON.parse(JSON.stringify(obj));
	}

	/** Does a shallow copy on properties without modifying prototype/
	 * Should be same as `object.assign` without `Object.setPrototypeOf(dest, Object.getPrototypeOf(src));`
	 */
	public static shallowCopyProperties(target: any, source: any) {
		Object.getOwnPropertyNames(source).forEach(name => {
			const descriptor = Object.getOwnPropertyDescriptor(source, name);
			Object.defineProperty(target, name, descriptor);
		});
	}

	private static readonly IgnoreDomainExtensions: string[] = [
		"000.nl", "999.nl", "aa.no", "ab.ca", "ab.se", "abo.pa", "ac.ae", "ac.at", "ac.be", "ac.be", "ac.cn", "ac.com", "ac.cr", "ac.cy", "ac.fj", "ac.fk", "ac.gn", "ac.id", "ac.il", "ac.im.in", "ac.in", "ac.ir", "ac.jp", "ac.mw", "ac.nz", "ac.pa", "ac.ru", "ac.rw", "ac.se", "ac.th", "ac.tj", "ac.tz", "ac.ug", "ac.uk", "ac.vn", "ac.yu", "ac.zm", "ac.zw", "act.au", "ad.jp", "adm.br", "adult.ht", "adv.br", "aero.mv", "agr.br", "ah.cn", "ah.no", "ak.us", "al.us", "alt.za", "am.br", "ar.us", "army.mil", "arq.br", "art.br", "art.do", "art.dz", "art.ht", "art.pl", "asn.au", "asn.au", "asn.lv", "asso.dz", "asso.fr", "asso.ht", "asso.mc", "ato.br", "av.tr", "az.us", "bbs.tr", "bc.ca", "bd.se", "bel.tr", "bio.br", "biz.az", "biz.cy", "biz.et", "biz.fj", "biz.mv", "biz.nr", "biz.om", "biz.pk", "biz.pl", "biz.pr", "biz.tj", "biz.tr", "biz.tt", "biz.vn", "bj.cn", "bl.uk", "bmd.br", "bu.no", "c.se", "ca.us", "cim.br", "city.za", "ck.ua", "club.tw", "cn.ua", "cng.br", "cnt.br", "co.ag", "co.ao", "co.at", "co.bw", "co.cc.cd", "co.ck", "co.cr", "co.fk", "co.gg", "co.hu", "co.id", "co.il", "co.im", "co.in", "co.ir", "co.je", "co.jp", "co.kr", "co.ls", "co.ma", "co.mu", "co.mw", "co.nz", "co.om", "co.rw", "co.th", "co.tj", "co.tt", "co.ug", "co.uk", "co.us", "co.ve", "co.yu", "co.za", "co.zm", "co.zw", "com.ac", "com.af", "com.ag", "com.ai", "com.al", "com.an", "com.ar", "com.au", "com.aw", "com.ax", "com.az", "com.bb", "com.bd", "com.bm", "com.bn", "com.bo", "com.br", "com.bs", "com.bt", "com.cd", "com.ch", "com.cn", "com.co", "com.cu", "com.cy", "com.dm", "com.do", "com.dz", "com.ec", "com.ee", "com.eg", "com.es", "com.et", "com.fj", "com.fr", "com.ge", "com.gh", "com.gi", "com.gn", "com.gp", "com.gr", "com.hk", "com.hn", "com.hr", "com.ht", "com.jm", "com.jo", "com.kh", "com.kw", "com.ky", "com.kz", "com.lb", "com.lc", "com.li", "com.lk", "com.lr", "com.lv", "com.ly", "com.mg", "com.mk", "com.mo", "com.mt", "com.mu", "com.mv", "com.mw", "com.mx", "com.my", "com.ng", "com.ni", "com.np", "com.nr", "com.om", "com.pa", "com.pe", "com.pf", "com.pg", "com.ph", "com.pk", "com.pl", "com.pr", "com.ps", "com.pt", "com.py", "com.ro", "com.ru", "com.rw", "com.sa", "com.sb", "com.sc", "com.sd", "com.sg", "com.sv", "com.sy", "com.tj", "com.tn", "com.tr", "com.tt", "com.tw", "com.ua", "com.uy", "com.ve", "com.vi", "com.vn", "com.ye", "conf.au", "conf.lv", "coop.br", "coop.ht", "coop.mv", "coop.mw", "cpa.pro", "cq.cn", "cri.nz", "csiro.au", "ct.us", "cv.ua", "d.se", "dc.us", "de.us", "dn.ua", "dni.us", "dp.ua", "dpn.br", "dr.tr", "e.se", "ebiz.tw", "ecn.br", "ed.ao", "ed.cr", "ed.jp", "edu.ac", "edu.af", "edu.al", "edu.an", "edu.au", "edu.az", "edu.bb", "edu.bd", "edu.bm", "edu.bn", "edu.bo", "edu.br", "edu.bt", "edu.cn", "edu.co", "edu.cu", "edu.dm", "edu.do", "edu.dz", "edu.ec", "edu.eg", "edu.es", "edu.et", "edu.ge", "edu.gh", "edu.gi", "edu.gp", "edu.gr", "edu.hk", "edu.hn", "edu.ht", "edu.in", "edu.jm", "edu.jo", "edu.kh", "edu.kw", "edu.ky", "edu.kz", "edu.lb", "edu.lc", "edu.lk", "edu.lr", "edu.lv", "edu.ly", "edu.mg", "edu.mo", "edu.mt", "edu.mv", "edu.mw", "edu.mx", "edu.my", "edu.ng", "edu.ni", "edu.np", "edu.nr", "edu.om", "edu.pa", "edu.pe", "edu.pf", "edu.pk", "edu.pl", "edu.pr", "edu.ps", "edu.pt", "edu.py", "edu.rw", "edu.sa", "edu.sb", "edu.sc", "edu.sd", "edu.sg", "edu.sv", "edu.tj", "edu.tr", "edu.tt", "edu.tw", "edu.ua", "edu.vi", "edu.vn", "edu.za", "eng.br", "ens.tn", "esp.br", "etc.br", "eti.br", "eun.eg", "f.se", "fam.pk", "far.br", "fed.us", "fh.se", "fhs.no", "fhsk.se", "fhv.se", "fi.cr", "fie.ee", "fin.ec", "fin.tn", "firm.ht", "firm.in", "fj.cn", "fl.us", "fm.br", "fm.no", "fnd.br", "fot.br", "from.hr", "fst.br", "g.se", "g12.br", "ga.us", "game.tw", "gd.cn", "geek.nz", "gen.in", "gen.nz", "gen.tr", "ggf.br", "go.cr", "go.id", "go.jp", "go.th", "go.tj", "go.tz", "go.ug", "gob.bo", "gob.do", "gob.es", "gob.hn", "gob.mx", "gob.ni", "gob.pa", "gob.pe", "gob.pk", "gob.sv", "gok.pk", "gon.pk", "gop.pk", "gos.pk", "gouv.fr", "gouv.ht", "gouv.rw", "gov.ac", "gov.ae", "gov.af", "gov.al", "gov.ar", "gov.au", "gov.az", "gov.bb", "gov.bd", "gov.bf", "gov.bm", "gov.bo", "gov.br", "gov.bt", "gov.by", "gov.ch", "gov.cn", "gov.co", "gov.cu", "gov.cx", "gov.dm", "gov.do", "gov.dz", "gov.ec", "gov.eg", "gov.et", "gov.fj", "gov.fk", "gov.ge", "gov.gh", "gov.gi", "gov.gn", "gov.gr", "gov.hk", "gov.ie", "gov.il", "gov.im", "gov.in", "gov.ir", "gov.it", "gov.jm", "gov.jo", "gov.kh", "gov.kw", "gov.ky", "gov.kz", "gov.lb", "gov.lc", "gov.li", "gov.lk", "gov.lr", "gov.lt", "gov.lu", "gov.lv", "gov.ly", "gov.ma", "gov.mg", "gov.mo", "gov.mt", "gov.mv", "gov.mw", "gov.my", "gov.ng", "gov.np", "gov.nr", "gov.om", "gov.ph", "gov.pk", "gov.pl", "gov.pr", "gov.ps", "gov.pt", "gov.py", "gov.rw", "gov.sa", "gov.sb", "gov.sc", "gov.sd", "gov.sg", "gov.sy", "gov.tj", "gov.tn", "gov.to", "gov.tp", "gov.tr", "gov.tt.tv", "gov.tv", "gov.tw", "gov.ua", "gov.uk", "gov.vi", "gov.vn", "gov.za", "gov.zm", "gov.zw", "govt.nz", "gr.jp", "gs.cn", "gub.uy", "gv.ao", "gv.at", "gx.cn", "gz.cn", "h.se", "ha.cn", "hb.cn", "he.cn", "hi.cn", "hi.us", "hl.cn", "hl.no", "hm.no", "hn.cn", "i.se", "ia.us", "id.au", "id.lv", "id.ly", "id.us", "idf.il", "idn.sg", "idv.hk", "idv.tw", "if.ua", "il.us", "imb.br", "in.th", "in.us", "ind.br", "ind.in", "ind.tn", "inf.br", "inf.cu", "info.au", "info.az", "info.cy", "info.ec", "info.et", "info.fj", "info.ht", "info.hu", "info.mv", "info.nr", "info.pl", "info.pr", "info.ro", "info.sd", "info.tn", "info.tr", "info.tt", "info.ve", "info.vn", "ing.pa", "inima.al", "int.ar", "int.az", "int.bo", "int.lk", "int.mv", "int.mw", "int.pt", "int.ru", "int.rw", "int.tj", "int.vn", "intl.tn", "ip6.ar", "ip6.pa", "iris.ar", "iris.pa", "isa.us", "isla.pr", "it.ao", "iwi.nz", "iz.hr", "jet.uk", "jl.cn", "jor.br", "js.cn", "jx.cn", "k.se", "k12.il", "k12.tr", "kh.ua", "kiev.ua", "km.ua", "kr.ua", "ks.ua", "ks.us", "kv.ua", "ky.us", "la.us", "law.pro", "law.za", "lel.br", "lg.jp", "lg.ua", "ln.cn", "ltd.co.im", "ltd.cy", "ltd.gi", "ltd.lk", "ltd.uk", "lviv.ua", "m.se", "ma.us", "mat.br", "mb.ca", "md.us", "me.uk", "me.us", "med.br", "med.ec", "med.ht", "med.ly", "med.om", "med.pa", "med.pro", "med.sa", "med.sd", "mi.th", "mi.us", "mil.ac", "mil.ae", "mil.ar", "mil.az", "mil.bd", "mil.bo", "mil.br", "mil.by", "mil.co", "mil.do", "mil.ec", "mil.eg", "mil.fj", "mil.ge", "mil.gh", "mil.hn", "mil.in", "mil.jo", "mil.kh", "mil.kw", "mil.kz", "mil.lt", "mil.lu", "mil.lv", "mil.mg", "mil.mv", "mil.my", "mil.no", "mil.np", "mil.nz", "mil.om", "mil.pe", "mil.pl", "mil.rw", "mil.se", "mil.tj", "mil.tr", "mil.tw", "mil.uk", "mil.uy", "mil.za", "mk.ua", "mn.us", "mo.us", "mod.gi", "mod.uk", "mr.no", "ms.us", "msk.ru", "mt.us", "muni.il", "mus.br", "n.se", "name.ae", "name.af", "name.az", "name.cy", "name.et", "name.fj", "name.hr", "name.mv", "name.my", "name.pr", "name.ro", "name.tj", "name.tr", "name.tt", "name.vn", "nat.tn", "navy.mil", "nb.ca", "nc.us", "nd.us", "ne.jp", "ne.tz", "ne.ug", "ne.us", "nel.uk", "net.ac", "net.ae", "net.af", "net.ag", "net.ai", "net.al", "net.an", "net.ar", "net.au", "net.az", "net.bb", "net.bd", "net.bm", "net.bn", "net.bo", "net.br", "net.bs", "net.bt", "net.cd", "net.ch", "net.cn", "net.co", "net.cu", "net.cy", "net.dm", "net.do", "net.dz", "net.ec", "net.eg", "net.et", "net.fj", "net.fk", "net.ge", "net.gg", "net.gn", "net.gp", "net.gr", "net.hk", "net.hn", "net.ht", "net.il", "net.im", "net.in", "net.ir", "net.je", "net.jm", "net.jo", "net.kh", "net.kw", "net.ky", "net.kz", "net.lb", "net.li", "net.lk", "net.lr", "net.lu", "net.lv", "net.ly", "net.ma", "net.mo", "net.mt", "net.mv", "net.mw", "net.mx", "net.my", "net.ng", "net.ni", "net.np", "net.nr", "net.nz", "net.om", "net.pa", "net.pe", "net.pg", "net.pk", "net.pl", "net.pr", "net.ps", "net.pt", "net.py", "net.ru", "net.rw", "net.sa", "net.sb", "net.sc", "net.sd", "net.sg", "net.sy", "net.th", "net.tj", "net.tn", "net.tr", "net.tt", "net.tw", "net.ua", "net.uk", "net.uy", "net.ve", "net.vn", "net.ye", "net.za", "nf.ca", "ngo.lk", "ngo.pl", "ngo.za", "nh.us", "nhs.uk", "nic.im", "nic.in", "nic.uk", "nj.us", "nl.ca", "nl.no", "nls.uk", "nm.cn", "nm.us", "nom.adae", "nom.ag", "nom.ai", "nom.br", "nom.co", "nom.es", "nom.fk", "nom.fr", "nom.mg", "nom.ni", "nom.pa", "nom.pe", "nom.ro", "nom.za", "nome.pt", "not.br", "ns.ca", "nsn.us", "nsw.au", "nt.au", "nt.ca", "nt.no", "nt.ro", "ntr.br", "nu.ca", "nv.us", "nx.cn", "ny.us", "o.se", "od.ua", "odo.br", "of.no", "off.ai", "og.ao", "oh.us", "ok.us", "ol.no", "on.ca", "or.at", "or.cr", "or.id", "or.jp", "or.kr", "or.th", "or.tz", "or.ug", "or.us", "org.ac", "org.ae", "org.ag", "org.ai", "org.al", "org.an", "org.au", "org.az", "org.bb", "org.bd", "org.bm", "org.bn", "org.bo", "org.br", "org.bs", "org.bt", "org.bw", "org.cd", "org.ch", "org.cn", "org.co", "org.cu", "org.cy", "org.dm", "org.do", "org.dz", "org.ec", "org.ee", "org.eg", "org.es", "org.et", "org.fj", "org.fk", "org.ge", "org.gg", "org.gh", "org.gi", "org.gn", "org.gp", "org.gr", "org.hk", "org.hn", "org.ht", "org.hu", "org.il", "org.im", "org.in", "org.ir", "org.je", "org.jm", "org.jo", "org.kh", "org.kw", "org.ky", "org.kz", "org.lb", "org.lc", "org.li", "org.lk", "org.lr", "org.ls", "org.lu", "org.lv", "org.ly", "org.ma", "org.mg", "org.mk", "org.mo", "org.mt", "org.mv", "org.mw", "org.mx", "org.my", "org.ng", "org.ni", "org.np", "org.nr", "org.nz", "org.om", "org.pa", "org.pe", "org.pf", "org.pk", "org.pl", "org.pr", "org.ps", "org.pt", "org.py", "org.ro", "org.ru", "org.sa", "org.sc", "org.sd", "org.se", "org.sg", "org.sv", "org.tj", "org.tn", "org.tr", "org.tt", "org.tw", "org.ua", "org.uk", "org.uy", "org.ve", "org.vi", "org.vn", "org.yu", "org.za", "org.zm", "org.zw", "oz.au", "pa.us", "pb.ao", "pe.ca", "per.kh", "per.sg", "perso.ht", "pl.ua", "plc.co.im", "plc.ly", "plc.uk", "plo.ps", "pol.dz", "pol.ht", "pol.tr", "pp.az", "pp.ru", "pp.se", "ppg.br", "prd.fr", "prd.mg", "pri.ee", "priv.at", "priv.hu", "pro.ae", "pro.br", "pro.cy", "pro.ec", "pro.fj", "pro.ht", "pro.mv", "pro.om", "pro.pr", "pro.tt", "pro.vn", "psc.br", "psi.br", "pub.sa", "publ.pt", "pvt.ge", "qc.ca", "qh.cn", "qld.au", "qsl.br", "rec.br", "rec.ro", "red.sv", "rel.ht", "res.in", "ri.us", "rl.no", "rv.ua", "s.se", "sa.au", "sa.cr", "sc.cn", "sc.ug", "sc.us", "sch.ae", "sch.ir", "sch.lk", "sch.ly", "sch.om", "sch.sa", "sch.uk", "sch.zm", "sci.eg", "sd.cn", "sd.us", "sec.ps", "sf.no", "sh.cn", "shop.ht", "sk.ca", "sld.do", "sld.pa", "slg.br", "sn.cn", "soc.lk", "soros.al", "sport.hu", "srv.br", "sshn.se", "st.no", "sumy.ua", "sx.cn", "t.se", "tas.au", "te.ua", "tel.tr", "tirana.al", "tj.cn", "tm.cy", "tm.fr", "tm.hu", "tm.mc", "tm.mg", "tm.no", "tm.ro", "tm.se", "tm.za", "tmp.br", "tn.us", "tr.no", "trd.br", "tur.br", "tv.bo", "tv.br", "tv.sd", "tx.us", "u.se", "uniti.al", "upt.al", "uri.ar", "uri.pa", "us.com", "ut.us", "va.no", "va.us", "vet.br", "vf.no", "vgs.no", "vic.au", "vn.ua", "vt.us", "w.se", "wa.au", "wa.us", "waw.pl", "web.do", "web.lk", "web.pk", "web.tj", "web.tr", "web.ve", "wi.us", "wv.us", "www.ro", "x.se", "xj.cn", "xz.cn", "y.se", "yk.ca", "yn.cn", "z.se", "zj.cn", "zlg.br", "zp.ua", "zt.ua"]
}