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

	static async initialize() {
		if (isInitialized) {
			return;
		}

		try {
			const csvUrl = api.runtime.getURL('assets/IPCountryDB/IP2LOCATION-LITE-DB1.CSV');
			const response = await fetch(csvUrl);
			const csvText = await response.text();

			// Parse CSV (simple parser for quoted CSV format)
			const lines = csvText.split('\n');
			ipDatabase = [];

			for (const line of lines) {
				if (!line.trim()) continue;

				// Parse CSV line: "ipFrom","ipTo","code","name"
				const matches = line.match(/"([^"]*)","([^"]*)","([^"]*)","([^"]*)"/);
				if (matches) {
					const [, ipFrom, ipTo, countryCode, countryName] = matches;
					if (countryCode !== '-') { // Skip unknown entries
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

	static unload() {
		ipDatabase = [];
		isInitialized = false;
	}

	static ipToNumber(ip: string): number {
		const parts = ip.split('.');
		return (
			(parseInt(parts[0], 10) << 24) +
			(parseInt(parts[1], 10) << 16) +
			(parseInt(parts[2], 10) << 8) +
			parseInt(parts[3], 10)
		) >>> 0; // Convert to unsigned 32-bit integer
	}

	static getRecords(ips: string[]) {
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

	static getRecord(ip: string) {
		try {
			if (!isInitialized || ipDatabase.length === 0) {
				//console.warn('IP2Location database not initialized');
				return null;
			}

			// Only handle IPv4 for now
			if (!ip.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
				return null;
			}

			const ipNum = CountryCode.ipToNumber(ip);

			// Binary search for efficiency
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

	static getCountryFlagEmoji(countryCode: string): string {
		if (!countryCode) return '';

		if (countryCode === 'LOCAL') {
			return '🏠'; // House emoji for local/private IPs
		}

		// Convert country code to flag emoji
		// Regional Indicator Symbol Letter A starts at 0x1F1E6 (127462)
		// Country codes are uppercase letters, so 'A' = 65
		const codePoints = countryCode
			.toUpperCase()
			.split('')
			.map(char => 127397 + char.charCodeAt(0));

		return String.fromCodePoint(...codePoints);
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
}
