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
interface ILiteEvent<T> {
	on(handler: { (data?: T): void }): void;
	off(handler: { (data?: T): void }): void;
}

export class LiteEvent<T> implements ILiteEvent<T> {
	private handlers: { (data?: T): void; }[] = [];

	public on(handler: { (data?: T): void }): void {
		this.handlers.push(handler);
	}

	public off(handler: { (data?: T): void }): void {
		this.handlers = this.handlers.filter(h => h !== handler);
	}

	public trigger(data?: T) {
		this.handlers.slice(0).forEach(h => h(data));
	}

	public expose(): ILiteEvent<T> {
		return this;
	}
}