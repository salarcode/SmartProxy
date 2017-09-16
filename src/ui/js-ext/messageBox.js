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
let messageBox = {
	error: function (title, timeout, onClose) {
		//alert(title);
		new Noty({
			type: "error",
			layout: "topCenter",
			text: title,
			timeout: timeout == null ? 3000 : timeout,
			progressBar: true,
			callbacks: {
				onClose: function () {
					if (onClose)
						onClose();
				}
			}
		}).show();
	},
	warning: function (title, timeout, onClose) {
		new Noty({
			type: "warning",
			layout: "topCenter",
			text: title,
			timeout: timeout == null ? 3000 : timeout,
			progressBar: true,
			callbacks: {
				onClose: function () {
					if (onClose)
						onClose();
				}
			}
		}).show();
	},
	success: function (title, timeout, onClose) {
		new Noty({
			type: "success",
			layout: "topCenter",
			text: title,
			timeout: timeout == null ? 3000 : timeout,
			progressBar: true,
			callbacks: {
				onClose: function () {
					if (onClose)
						onClose();
				}
			}
		}).show();
	},
	info: function (title, timeout, onClose) {
		new Noty({
			type: "info",
			layout: "topCenter",
			text: title,
			timeout: timeout == null ? 3000 : timeout,
			progressBar: true,
			callbacks: {
				onClose: function () {
					if (onClose)
						onClose();
				}
			}
		}).show();
	},
	confirm: function (title, accept, cancel) {
		var dialog = new Noty({
			text: title,
			layout: "center",
			modal: true,
			buttons: [
				Noty.button('YES', 'btn btn-success px-4 mx-2', function () {
					if (accept)
						accept();
					dialog.close();
				}, { id: 'button1', 'data-status': 'ok' }),

				Noty.button('NO', 'btn btn-error px-3', function () {
					if (cancel)
						cancel();
					dialog.close();
				})
			]
		}).show();
	}
};