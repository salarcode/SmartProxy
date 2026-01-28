import { Utils } from '../lib/Utils';

describe('Utils.ipCidrNotationToRegExp', () => {
  test('IPv4 /24 matches inside network and rejects outside', () => {
    const r = Utils.ipCidrNotationToRegExp('192.168.1.0', '24');
    expect(r).not.toBeNull();
    expect(r.test('192.168.1.5')).toBe(true);
    expect(r.test('192.168.2.1')).toBe(false);
  });

  test('IPv4 /32 matches only exact address', () => {
    const r = Utils.ipCidrNotationToRegExp('10.0.0.1', '32');
    expect(r).not.toBeNull();
    expect(r.test('10.0.0.1')).toBe(true);
    expect(r.test('10.0.0.2')).toBe(false);
  });

  test('IPv4 /0 matches any IPv4', () => {
    const r = Utils.ipCidrNotationToRegExp('0.0.0.0', '0');
    expect(r).not.toBeNull();
    expect(r.test('8.8.8.8')).toBe(true);
    expect(r.test('255.255.255.255')).toBe(true);
  });

  test('IPv4 invalid prefix returns null', () => {
    expect(Utils.ipCidrNotationToRegExp('192.168.1.0', '33')).toBeNull();
  });

  test('IPv4 partial range (/23) behavior', () => {
    const r = Utils.ipCidrNotationToRegExp('192.168.0.0', '23');
    expect(r).not.toBeNull();
    expect(r.test('192.168.1.5')).toBe(true);
    expect(r.test('192.168.2.1')).toBe(false);
  });

  test('IPv6 /32 matches expanded form (use expandIPv6ToGroups)', () => {
    const cidr = Utils.ipCidrNotationToRegExp('2001:db8::', '32');
    expect(cidr).not.toBeNull();

    const expanded = Utils.expandIPv6ToGroups('2001:db8::1');
    expect(expanded).not.toBeNull();
    const expandedStr = expanded.join(':');

    expect(cidr.test(expandedStr)).toBe(true);

    const other = Utils.expandIPv6ToGroups('2001:0db9::1').join(':');
    expect(cidr.test(other)).toBe(false);
  });

  test('IPv6 /128 (loopback) matches only exact expanded form', () => {
    const r = Utils.ipCidrNotationToRegExp('::1', '128');
    expect(r).not.toBeNull();
    const expanded = Utils.expandIPv6ToGroups('::1').join(':');
    expect(r.test(expanded)).toBe(true);
    // compressed form should not match the generated expanded-only regex
    expect(r.test('::1')).toBe(false);
  });

  test('IPv6 invalid prefix returns null', () => {
    expect(Utils.ipCidrNotationToRegExp('::1', '129')).toBeNull();
  });

  test('IPv4-mapped IPv6 delegates to IPv4 regex when prefix >= 96', () => {
    // ::ffff:192.0.2.0/120 -> IPv4 prefix = 24
    const r = Utils.ipCidrNotationToRegExp('::ffff:192.0.2.0', '120');
    expect(r).not.toBeNull();
    expect(r.test('192.0.2.5')).toBe(true);
    expect(r.test('192.0.3.1')).toBe(false);
  });

  test('IPv4-mapped IPv6 with too-small prefix returns null', () => {
    // prefix 95 -> ipv4Prefix = -1 -> invalid
    expect(Utils.ipCidrNotationToRegExp('::ffff:192.0.2.0', '95')).toBeNull();
  });

  test('Bracketed addresses are accepted (stripped) for IPv6', () => {
    const r = Utils.ipCidrNotationToRegExp('[::1]', '128');
    expect(r).not.toBeNull();
    const expanded = Utils.expandIPv6ToGroups('::1').join(':');
    expect(r.test(expanded)).toBe(true);
  });

  test('Non-IP input returns null', () => {
    expect(Utils.ipCidrNotationToRegExp('not-an-ip', '24')).toBeNull();
  });
});

// --- Additional edge-case tests ---
describe('Utils.ipCidrNotationToRegExp edge cases', () => {
  test('Mixed-case hex IPv6 is handled and normalized', () => {
    const r = Utils.ipCidrNotationToRegExp('2001:db8::', '32');
    expect(r).not.toBeNull();

    const mixed = '2001:DB8::1';
    const normalized = Utils.normalizeIpForMatching(mixed);
    expect(normalized).not.toBeNull();
    expect(r.test(normalized)).toBe(true);
  });

  test('IPv6 with zone index is accepted and matches normalized address', () => {
    // The implementation tolerates a zone suffix; ensure regex is produced
    const r = Utils.ipCidrNotationToRegExp('fe80::1%eth0', '128');
    expect(r).not.toBeNull();

    const normalized = Utils.normalizeIpForMatching('fe80::1%eth0');
    // debug
    // eslint-disable-next-line no-console
    console.log('ZONE-DEBUG regex=', r ? r.toString() : null, 'normalized=', normalized, 'match=', r ? r.test(normalized) : null);
    expect(normalized).not.toBeNull();
    
    // strip zone index (e.g. %eth0) before expanding/matching
    const noZone = normalized.replace(/%.*$/, '');
    if (noZone.indexOf(':') >= 0) {
      const expanded = Utils.expandIPv6ToGroups(noZone);
      expect(expanded).not.toBeNull();
      expect(r.test(expanded.join(':'))).toBe(true);
    } else {
      // fallback: test the raw normalized value
      expect(r.test(noZone)).toBe(true);
    }
  });

  test('Compressed vs expanded matching: compressed does not match regex directly', () => {
    const r = Utils.ipCidrNotationToRegExp('2001:db8::', '32');
    expect(r).not.toBeNull();

    // compressed candidate won't match the expanded-only regex
    expect(r.test('2001:db8::1')).toBe(false);

    // but normalizing the candidate to expanded form should match
    const normalized = Utils.normalizeIpForMatching('2001:db8::1');
    expect(normalized).not.toBeNull();
    expect(r.test(normalized)).toBe(true);
  });
});

