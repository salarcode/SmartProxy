export class Debug {
	static enabled: boolean = true;
	public static enable() {
		this.enabled = true;
	}
	public static disable() {
		this.enabled = true;
	}

	public static log(msg: string, ...args) {
		if (!this.enabled) return;
		window.console.log.apply(null, arguments);
	}

	public static error(msg: string, ...args) {
		if (!this.enabled) return;
		window.console.error.apply(null, arguments);
	}

	public static info(msg: string, ...args) {
		if (!this.enabled) return;
		window.console.info.apply(null, arguments);
	}

	public static warn(msg: string, ...args) {
		if (!this.enabled) return;
		window.console.warn.apply(null, arguments);
	}
}