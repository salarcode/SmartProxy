var messageBox = {
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
	alert: function (title, timeout, onClose) {
		new Noty({
			type: "alert",
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