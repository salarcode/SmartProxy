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

// export var pako: any = window["pako"];
// export var bootstrap: any = window["bootstrap"];
// export var jQuery: any = window["jQuery"];
// export var messageBox: any = window["messageBox"];

export var pako: any;
export var bootstrap: any;
export var jQuery: any;
export var messageBox: any;

if (typeof (window) != 'undefined') {
	pako = window["pako"];
	bootstrap = window["bootstrap"];
	jQuery = window["jQuery"];
	messageBox = window["messageBox"];
}
else {
	pako = {};
	bootstrap = {};
	jQuery = {};
	messageBox = {};
}