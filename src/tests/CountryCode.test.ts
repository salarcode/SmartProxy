import { CountryCode } from '../lib/CountryCode';

describe('CountryCode', () => {
  describe('getCountryFlagEmoji', () => {
    it('should return correct flag emoji for country code', () => {
      const usFlag = CountryCode.getCountryFlagEmoji('US');
      expect(usFlag).toBe('🇺🇸');
      
      const gbFlag = CountryCode.getCountryFlagEmoji('GB');
      expect(gbFlag).toBe('🇬🇧');
    });

    it('should return globe emoji for LOCAL', () => {
      const localFlag = CountryCode.getCountryFlagEmoji('LOCAL');
      expect(localFlag).toBe('🏠');
    });

    it('should handle lowercase country codes', () => {
      const flag = CountryCode.getCountryFlagEmoji('us');
      expect(flag).toBe('🇺🇸');
    });

    it('should handle empty or invalid country codes', () => {
      expect(CountryCode.getCountryFlagEmoji('')).toBe('');
      expect(CountryCode.getCountryFlagEmoji(null as any)).toBe('');
      expect(CountryCode.getCountryFlagEmoji(undefined as any)).toBe('');
    });
  });

  describe('ipToNumber', () => {
    it('should convert IPv4 to number', () => {
      expect(CountryCode.ipToNumber('0.0.0.0')).toBe(0);
      expect(CountryCode.ipToNumber('127.0.0.1')).toBe(2130706433);
      expect(CountryCode.ipToNumber('192.168.1.1')).toBe(3232235777);
      expect(CountryCode.ipToNumber('255.255.255.255')).toBe(4294967295);
    });

    it('should handle invalid IPs', () => {
      expect(CountryCode.ipToNumber('not an ip')).toBe(0);
      expect(CountryCode.ipToNumber('')).toBe(0);
    });
  });
});
