import { Utils } from '../lib/Utils';

describe('Utils', () => {
  describe('isValidUrl', () => {
    it('should validate correct URLs', () => {
      expect(Utils.isValidUrl('https://example.com')).toBe(true);
      expect(Utils.isValidUrl('http://example.com')).toBe(true);
      expect(Utils.isValidUrl('https://example.com/path')).toBe(true);
      expect(Utils.isValidUrl('ftp://example.com')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(Utils.isValidUrl('not a url')).toBe(false);
      expect(Utils.isValidUrl('')).toBe(false);
      expect(Utils.isValidUrl('example.com')).toBe(false);
    });
  });

  describe('extractHostFromUrl', () => {
    it('should extract hostname from URL', () => {
      expect(Utils.extractHostFromUrl('https://example.com/path')).toBe('example.com');
      expect(Utils.extractHostFromUrl('http://sub.example.com:8080/path')).toBe('sub.example.com:8080');
    });

    it('should handle invalid URLs', () => {
      expect(Utils.extractHostFromUrl('not a url')).toBeNull();
      expect(Utils.extractHostFromUrl('')).toBeNull();
    });
  });
});
