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

/** Used for diagnostics only */
export var DiagDebug: Diagnostics = null;

export class Debug {
	private static enabled: boolean = true;
	public static enable() {
		this.enabled = true;
	}
	public static enableDiagnostics() {
		this.enabled = true;
		if (DiagDebug == null)
			DiagDebug = new Diagnostics();
		DiagDebug.register();
	}
	public static disable() {
		this.enabled = false;
	}
	public static disableDiagnostics() {
		DiagDebug?.unregister();
		DiagDebug = null;
	}
	public static disableAll() {
		this.disable();
		this.disableDiagnostics();
	}
	public static isEnabled() {
		return this.enabled;
	}

	public static log(msg: string, ...args: any) {
		if (!this.enabled) return;
		console.log.apply(null, arguments);
		if (DiagDebug)
			DiagDebug.log.apply(DiagDebug, arguments);
	}

	public static error(msg: string, ...args: any) {
		if (!this.enabled) return;
		console.error.apply(null, arguments);
		if (DiagDebug)
			DiagDebug.error.apply(DiagDebug, arguments);
	}

	public static info(msg: string, ...args: any) {
		if (!this.enabled) return;
		console.info.apply(null, arguments);
		if (DiagDebug)
			DiagDebug.info.apply(DiagDebug, arguments);
	}

	public static warn(msg: string, ...args: any) {
		if (!this.enabled) return;
		console.warn.apply(null, arguments);
		if (DiagDebug)
			DiagDebug.warn.apply(DiagDebug, arguments);
	}

	public static trace(msg: string, ...args: any) {
		if (!this.enabled) return;
		console.trace.apply(null, arguments);
		if (DiagDebug)
			DiagDebug.trace.apply(DiagDebug, arguments);
	}
}

class Diagnostics {
	private enabled: boolean = true;
	private logs: string[] = [];

	public clear() {
		this.logs = [];
	}

	public getDiagLogs() {
		return JSON.stringify(this.logs, null, " ");
	}

	public register() {
		globalThis.SmartProxyGetDiagLogs = () => this.getDiagLogs();
		globalThis.DiagDebug = this;
	}

	public unregister() {
		globalThis.SmartProxyGetDiagLogs = undefined;
	}

	public log(msg: string, ...args: any) {
		if (!this.enabled) return;
		this.addToLog('log', msg, arguments);
	}

	public error(msg: string, ...args: any) {
		if (!this.enabled) return;
		this.addToLog('error', msg, arguments);
	}

	public info(msg: string, ...args: any) {
		if (!this.enabled) return;
		this.addToLog('info', msg, arguments);
	}

	public warn(msg: string, ...args: any) {
		if (!this.enabled) return;
		this.addToLog('warn', msg, arguments);
	}

	public trace(msg: string, ...args: any) {
		if (!this.enabled) return;
		this.addToLog('trace', msg, arguments);
	}

	private addToLog(level: string, msg: string, args: any) {
		let text = `${formatTime(new Date())} [${level}] ` + msg;

		for (let index = 1; index < args.length; index++) {
			const arg = args[index];
			if (arg == null) {
				text += ' NULL';
			}
			else if (typeof (arg) === "object") {
				text += ' ' + JSON.stringify(arg);
			}
			else {
				text += ' ' + arg.toString();
			}
		}

		this.logs.push(text);
	}
}

const zeroPad = (num, places) => String(num).padStart(places, '0');
const formatTime = (t: Date) => `${t.getHours()}:${zeroPad(t.getMinutes(), 2)}:${zeroPad(t.getSeconds(), 2)}.${zeroPad(t.getMilliseconds(), 3)}`;