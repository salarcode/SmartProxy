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

  describe('isTransientTabUrl', () => {
    it('treats new-tab placeholders as transient', () => {
      expect(Utils.isTransientTabUrl('')).toBe(true);
      expect(Utils.isTransientTabUrl('about:blank')).toBe(true);
      expect(Utils.isTransientTabUrl('about:newtab')).toBe(true);
      expect(Utils.isTransientTabUrl('chrome://newtab/')).toBe(true);
    });

    it('does not treat real pages as transient', () => {
      expect(Utils.isTransientTabUrl('https://example.com/')).toBe(false);
    });
  });

  describe('shouldPreserveTrackedUrl', () => {
    it('keeps a real URL when tabs.query reports a loading placeholder', () => {
      expect(Utils.shouldPreserveTrackedUrl('https://example.com/', 'about:blank')).toBe(true);
    });

    it('keeps a real URL when tabs.query has no url yet', () => {
      expect(Utils.shouldPreserveTrackedUrl('https://example.com/', '')).toBe(true);
    });

    it('accepts a real tabs url even while the tab is loading', () => {
      expect(Utils.shouldPreserveTrackedUrl('https://old.example/', 'https://current.example/')).toBe(false);
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
