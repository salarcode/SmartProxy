import { GeoIP2 } from './jgeoip.js';

export class CountryCode {

    private static geoIP2;

    static initialize() {
        CountryCode.geoIP2 = new GeoIP2('./assets/GeoLite2-Country.db', CountryCode.loadingCompleted);
    }

    static unload() {
        CountryCode.geoIP2 = null;
    }

    static getRecords(ips: string[], preferredLanguageCode: string = 'en') {
        const geoip = CountryCode.geoIP2;
        if (!geoip) {
            console.warn('GeoIP2 is not initalized!');
            return null;
        }

        try {
            let result = [];
            for (const ip of ips) {
                var record = geoip.getRecord(ip);
                if (record == null)
                    continue;

                result.push({
                    ip: ip,
                    isoCode: record.country.iso_code,
                    name: record.country.names[preferredLanguageCode] || record.country.names.en
                });
            }

            return result;
        } catch (error) {
            console.warn(`Failed to get country info for ips`, ips, error);
            return null;
        }
    }

    static getRecord(ip: string, preferredLanguageCode: string = 'en') {
        const geoip = CountryCode.geoIP2;
        if (!geoip) {
            console.warn('GeoIP2 is not initalized!');
            return null;
        }

        try {
            var record = geoip.getRecord(ip);
            if (record == null)
                return null;

            return {
                isoCode: record.country.iso_code,
                name: record.country.names[preferredLanguageCode] || record.country.names.en
            }
        } catch (error) {
            console.warn(`Failed to get country info for ` + ip, error);
            return null;
        }
    }

    private static loadingCompleted() {
        const geoip = CountryCode.geoIP2;
        if (geoip == null) {
            console.warn("CountryCode.geoIP2 is NULL ");
        }
    }

    static testItDelayed() {
        setTimeout(CountryCode.testIt, 2000);
    }
    static testIt(ip: string = "151.101.65.69") {
        try {
            var record = CountryCode.getRecord(ip, 'ru');

            console.log(`Record for ${ip} is`, record);

            return record.toString();
        } catch (error) {
            console.error(`Failed to get data for ${ip}`, error);
        }
    }
}