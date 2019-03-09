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
export class Debug {
	private static enabled: boolean = true;
	public static enable() {
		this.enabled = true;
	}
	public static disable() {
		this.enabled = false;
	}

	public static log(msg: string, ...args: any) {
		if (!this.enabled) return;
		window.console.log.apply(null, arguments);
	}

	public static error(msg: string, ...args: any) {
		if (!this.enabled) return;
		window.console.error.apply(null, arguments);
	}

	public static info(msg: string, ...args: any) {
		if (!this.enabled) return;
		window.console.info.apply(null, arguments);
	}

	public static warn(msg: string, ...args: any) {
		if (!this.enabled) return;
		window.console.warn.apply(null, arguments);
	}
}