import { api } from "./environment";

interface IPLocationRecord {
	ipFrom: number;
	ipTo: number;
	countryCode: string;
	countryName: string;
}

let ipDatabase: IPLocationRecord[] = [];
let isInitialized = false;

export class CountryCode {

	public static onInitialized: Function = null;

	public static async ensureInitialized(onInitialized: Function = null) {
		if (isInitialized) {
			if (onInitialized) {
				onInitialized();
			}
			return;
		}

		await CountryCode.initialize();

		if (onInitialized) {
			onInitialized();
		}
	}

	public static async initialize() {
		if (isInitialized) {
			return;
		}

		try {
			const csvUrl = api.runtime.getURL('assets/IPCountryDB/IP2LOCATION-LITE-DB1.CSV');
			const response = await fetch(csvUrl);
			const csvText = await response.text();

			const lines = csvText.split('\n');
			ipDatabase = [];

			for (const line of lines) {
				if (!line.trim()) continue;

				const matches = line.match(/"([^"]*)","([^"]*)","([^"]*)","([^"]*)"/);
				if (matches) {
					const [, ipFrom, ipTo, countryCode, countryName] = matches;
					if (countryCode !== '-') {
						ipDatabase.push({
							ipFrom: parseInt(ipFrom, 10),
							ipTo: parseInt(ipTo, 10),
							countryCode: countryCode,
							countryName: countryName
						});
					}
				}
			}

			isInitialized = true;
			CountryCode.loadingCompleted();
			CountryCode.onInitialized?.();

		} catch (error) {
			console.error('Failed to initialize IP2Location database:', error);
		}
	}

	public static unload() {
		ipDatabase = [];
		isInitialized = false;
	}

	public static ipToNumber(ip: string): number {
		const parts = ip.split('.');
		return (
			(parseInt(parts[0], 10) << 24) +
			(parseInt(parts[1], 10) << 16) +
			(parseInt(parts[2], 10) << 8) +
			parseInt(parts[3], 10)
		) >>> 0;
	}

	public static getRecords(ips: string[]) {
		try {
			if (!isInitialized || ipDatabase.length === 0) {
				console.warn('IP2Location database not initialized');
				return null;
			}

			let result = [];
			for (const ip of ips) {
				var record = CountryCode.getRecord(ip);
				if (record == null) {
					continue;
				}

				result.push({
					ip: ip,
					isoCode: record.isoCode,
					name: record.name
				});
			}

			return result;
		} catch (error) {
			console.warn(`Failed to get country info for ips`, ips, error);
			return null;
		}
	}

	public static getRecord(ip: string) {
		try {
			if (!isInitialized || ipDatabase.length === 0) {
				return null;
			}

			if (!ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
				return null;
			}

			const ipNum = CountryCode.ipToNumber(ip);

			let left = 0;
			let right = ipDatabase.length - 1;

			while (left <= right) {
				const mid = Math.floor((left + right) / 2);
				const record = ipDatabase[mid];

				if (ipNum >= record.ipFrom && ipNum <= record.ipTo) {
					return {
						isoCode: record.countryCode,
						name: record.countryName
					};
				} else if (ipNum < record.ipFrom) {
					right = mid - 1;
				} else {
					left = mid + 1;
				}
			}

			return null;
		} catch (error) {
			console.warn(`Failed to get country info for ` + ip, error);
			return null;
		}
	}

	public static getCountryFlagEmoji(countryCode: string): string {
		if (!countryCode) return '';
		if (countryCode === 'LOCAL') return '🏠';
		const code = countryCode.toUpperCase();
		if (code.length !== 2) return '';
		// Regional Indicator Symbol Letters: '🇦' = 127462, 'A' = 65
		const first = 127462 + (code.charCodeAt(0) - 65);
		const second = 127462 + (code.charCodeAt(1) - 65);
		if (first < 127462 || first > 127487 || second < 127462 || second > 127487) return '';
		return String.fromCodePoint(first, second);
	}

	private static loadingCompleted() {
		if (!isInitialized || ipDatabase.length === 0) {
			console.warn("IP2Location database failed to load");
		} else {
			console.log(`IP2Location database loaded successfully: ${ipDatabase.length} records`);
		}
	}

	static testItDelayed() {
		setTimeout(CountryCode.testIt, 1);
	}
	static testIt(ip: string = "151.101.65.69") {
		try {
			var record = CountryCode.getRecord(ip);
			console.log(`Record for ${ip} is`, record);
			return record ? JSON.stringify(record) : null;
		} catch (error) {
			console.error(`Failed to get data for ${ip}`, error);
		}
	}

	public static getCountryCode(ip: string): string | null {
		const record = this.getRecord(ip);
		return record ? record.isoCode.toUpperCase() : null;
	}
}