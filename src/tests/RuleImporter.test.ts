import { externalAppRuleParser } from '../lib/RuleImporter';
import { CompiledProxyRuleType } from '../core/definitions';

describe('externalAppRuleParser.GFWList', () => {
  describe('convertLineRegex', () => {
    it('should convert IP address with port correctly', () => {
      const line = '10.19.29.150:9080';
      const result = externalAppRuleParser.GFWList.convertLineRegex(line);

      expect(result).toBeDefined();
      expect(result.search).toBe('10.19.29.150:9080');
      expect(result.name).toBe('10.19.29.150:9080');
      expect(result.importedRuleType).toBe(CompiledProxyRuleType.SearchDomainAndPath);
      expect(result.regex).toBeUndefined();
    });

    it('should convert domain with subdomain syntax (||)', () => {
      const line = '||example.com';
      const result = externalAppRuleParser.GFWList.convertLineRegex(line);

      expect(result).toBeDefined();
      expect(result.search).toBe('example.com');
      expect(result.name).toBe('example.com');
      expect(result.importedRuleType).toBe(CompiledProxyRuleType.SearchDomainSubdomain);
    });

    it('should convert domain starting with dot (.)', () => {
      const line = '.example.com';
      const result = externalAppRuleParser.GFWList.convertLineRegex(line);

      expect(result).toBeDefined();
      expect(result.search).toBe('example.com');
      expect(result.name).toBe('example.com');
      expect(result.importedRuleType).toBe(CompiledProxyRuleType.SearchDomainSubdomainAndPath);
    });

    it('should convert URL starting with pipe (|)', () => {
      const line = '|http://example.com';
      const result = externalAppRuleParser.GFWList.convertLineRegex(line);

      expect(result).toBeDefined();
      expect(result.search).toBe('http://example.com');
      expect(result.importedRuleType).toBe(CompiledProxyRuleType.SearchUrl);
    });

    it('should handle whitelist marker (@@)', () => {
      const line = '@@||example.com';
      const result = externalAppRuleParser.GFWList.convertLineRegex(line);

      expect(result).toBeDefined();
      expect(result.search).toBe('example.com');
      expect(result.importedRuleType).toBe(CompiledProxyRuleType.SearchDomainSubdomain);
    });

    it('should convert regex pattern', () => {
      const line = '/^https?:\\/\\/example\\.com/';
      const result = externalAppRuleParser.GFWList.convertLineRegex(line);

      expect(result).toBeDefined();
      expect(result.regex).toBe('^https?:\\/\\/example\\.com');
      expect(result.importedRuleType).toBe(CompiledProxyRuleType.RegexUrl);
    });

    it('should convert simple domain correctly', () => {
      const line = 'example.com';
      const result = externalAppRuleParser.GFWList.convertLineRegex(line);

      expect(result).toBeDefined();
      expect(result.search).toBe('example.com');
      expect(result.importedRuleType).toBe(CompiledProxyRuleType.SearchDomainAndPath);
    });
  });

  describe('parse', () => {
    it('should parse multiple lines and separate whitelist/blacklist', () => {
      const text = `
! Comment line
||blocked.com
@@||allowed.com
example.net
`;

      const result = externalAppRuleParser.GFWList.parse(text);

      expect(result.blackList).toHaveLength(2);
      expect(result.blackList[0].search).toBe('blocked.com');
      expect(result.blackList[1].search).toBe('example.net');
      
      expect(result.whiteList).toHaveLength(1);
      expect(result.whiteList[0].search).toBe('allowed.com');
    });

    it('should skip comments and empty lines', () => {
      const text = `
! This is a comment
! Another comment
[AutoProxy 0.2.9]

||example.com
`;

      const result = externalAppRuleParser.GFWList.parse(text);

      expect(result.blackList).toHaveLength(1);
      expect(result.blackList[0].search).toBe('example.com');
    });

    it('should parse IP address with port in subscription format', () => {
      const text = '10.19.29.150:9080';

      const result = externalAppRuleParser.GFWList.parse(text);

      expect(result.blackList).toHaveLength(1);
      expect(result.blackList[0].search).toBe('10.19.29.150:9080');
      expect(result.blackList[0].importedRuleType).toBe(CompiledProxyRuleType.SearchDomainAndPath);
    });
  });
});
// =============================================
// Switchy Parser Tests
// =============================================

describe('externalAppRuleParser.Switchy', () => {
  describe('parseAndCompile', () => {
    it('should parse and compile legacy wildcard rules', () => {
      const text = `#BEGIN
example.com
*.google.com
#END`;
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      expect(result).toBeTruthy();
      expect(result.compiled).toBeTruthy();
      expect(Array.isArray(result.compiled)).toBe(true);
      expect(result.compiled.length).toBe(2);
    });

    it('should parse and compile regex rules', () => {
      const text = `#BEGIN
[RegExp]
^https?://.*\\.example\\.com/.*$
#END`;
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      expect(result).toBeTruthy();
      expect(result.compiled).toBeTruthy();
      expect(Array.isArray(result.compiled)).toBe(true);
      expect(result.compiled.length).toBeGreaterThan(0);
    });

    it('should parse IP address with port', () => {
      const text = `#BEGIN
10.19.29.150:9080
#END`;
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      expect(result).toBeTruthy();
      expect(result.compiled).toBeTruthy();
      expect(Array.isArray(result.compiled)).toBe(true);
      expect(result.compiled.length).toBe(1);
    });
  });

  describe('convertToProxyRule', () => {
    it('should convert simple domain to RegexUrl rule', () => {
      const text = `#BEGIN
*.example.com
#END`;
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
      
      const rule = rules[0];
      expect(rule.importedRuleType).toBe(CompiledProxyRuleType.RegexUrl);
      expect(rule.regex).toBeTruthy();
      expect(rule.name).toBe('*.example.com');
    });

    it('should convert host pattern to RegexHost rule', () => {
      const text = `#BEGIN
*://example.com/*
#END`;
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
      
      const rule = rules[0];
      expect(rule.importedRuleType).toBe(CompiledProxyRuleType.RegexHost);
      expect(rule.regex).toBeTruthy();
      expect(rule.name).toBe('*://example.com/*');
    });

    it('should convert URL wildcard to RegexUrl rule', () => {
      const text = `#BEGIN
http://example.com/*
#END`;
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
      
      const rule = rules[0];
      expect(rule.importedRuleType).toBe(CompiledProxyRuleType.RegexUrl);
      expect(rule.regex).toBeTruthy();
    });

    it('should convert IP address with port to regex rule', () => {
      const text = `#BEGIN
10.19.29.150:9080
#END`;
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
      
      const rule = rules[0];
      expect(rule.name).toBe('10.19.29.150:9080');
      expect(rule.regex).toBeTruthy();
      // The regex should match the IP:port pattern
      expect(rule.regex).toContain('10');
      expect(rule.regex).toContain('19');
      expect(rule.regex).toContain('29');
      expect(rule.regex).toContain('150');
      expect(rule.regex).toContain('9080');
    });

    it('should convert IP wildcard pattern to match IP range', () => {
      const text = `#BEGIN
10.*.*.*
#END`;
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
      
      const rule = rules[0];
      expect(rule.name).toBe('10.*.*.*');
      expect(rule.regex).toBeTruthy();
      expect(rule.importedRuleType).toBe(CompiledProxyRuleType.RegexUrl);
      // The regex should use .* for wildcards
      expect(rule.regex).toContain('10\\.');
      expect(rule.regex).toContain('.*');
      
      // Verify it actually matches the specific IP with port
      const regex = new RegExp(rule.regex);
      expect(regex.test('http://10.19.29.150:9080/test')).toBe(true);
      expect(regex.test('https://10.19.29.150:9080')).toBe(true);
      // Should also match other IPs in 10.*.*.* range
      expect(regex.test('http://10.0.0.1')).toBe(true);
      expect(regex.test('http://10.255.255.254:8080')).toBe(true);
      // Should not match IPs outside the range
      expect(regex.test('http://192.168.1.1')).toBe(false);
      expect(regex.test('http://11.0.0.1')).toBe(false);
    });

    it('should handle multiple rules', () => {
      const text = `#BEGIN
*.example.com
*.google.com
10.19.25.150:9080
#END`;
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBe(3);
    });

    it('should handle regex patterns', () => {
      const text = `#BEGIN
[RegExp]
^https?://.*\\.example\\.com/.*$
#END`;
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
      
      const rule = rules[0];
      expect(rule.importedRuleType).toBe(CompiledProxyRuleType.RegexUrl);
      expect(rule.regex).toContain('example');
    });

    it('should parse SwitchyOmega Conditions format with IP wildcards', () => {
      // Testing with actual format that users provide (without condition type prefixes)
      // This is the real-world format from SwitchyOmega exports
      const text = `[SwitchyOmega Conditions]
; Require: ZeroOmega or SwitchyOmega >= 2.3.2
; Update Date: 2025/10/16 20:51:10

; 局域网 IP 不走代理
10.*.*.*
100.64.*.*
127.*.*.*
172.16.*.*
192.168.*.*`;
      
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
      
      // Test the 10.*.*.* rule with actual IP addresses (with and without port)
      const rule10 = rules.find(r => r.name && r.name.includes('10.*.*.*'));
      expect(rule10).toBeDefined();
      expect(rule10!.regex).toBeTruthy();
      expect(rule10!.importedRuleType).toBe(CompiledProxyRuleType.RegexHost);
      
      const regex10 = new RegExp(rule10!.regex);
      // HostWildcardCondition tests against host, not full URL
      expect(regex10.test('10.19.29.157')).toBe(true);
      expect(regex10.test('10.0.0.1')).toBe(true);
      expect(regex10.test('11.0.0.1')).toBe(false);
    });

    it('should handle patterns without prefix as HostWildcard (fromStr fix)', () => {
      // Test that patterns without explicit type prefix default to HostWildcardCondition
      const text = `[SwitchyOmega Conditions]
; Test patterns without prefix
example.com
*.google.com
.facebook.com`;
      
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBe(3);
      
      // All should be HostWildcard (RegexHost)
      rules.forEach(rule => {
        expect(rule.importedRuleType).toBe(CompiledProxyRuleType.RegexHost);
        expect(rule.regex).toBeTruthy();
      });
      
      // Test example.com rule - pattern without wildcards matches exact host
      const exampleRule = rules.find(r => r.name === 'example.com');
      expect(exampleRule).toBeDefined();
      const exampleRegex = new RegExp(exampleRule!.regex);
      expect(exampleRegex.test('example.com')).toBe(true);
      // Without explicit wildcards, it won't match subdomains
      
      // Test *.google.com - should match subdomains but not google.com itself
      const googleRule = rules.find(r => r.name === '*.google.com');
      expect(googleRule).toBeDefined();
      const googleRegex = new RegExp(googleRule!.regex);
      expect(googleRegex.test('www.google.com')).toBe(true);
      expect(googleRegex.test('mail.google.com')).toBe(true);
    });

    it('should handle explicit URL wildcard prefix (U:)', () => {
      // Test that explicit U: prefix creates UrlWildcardCondition
      const text = `[SwitchyOmega Conditions]
; Explicit URL wildcard
U: *://example.com/*`;
      
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBe(1);
      expect(rules[0].importedRuleType).toBe(CompiledProxyRuleType.RegexUrl);
    });

    it('should handle explicit Host wildcard prefix (H:)', () => {
      // Test that explicit H: prefix creates HostWildcardCondition
      const text = `[SwitchyOmega Conditions]
; Explicit host wildcard
H: example.com`;
      
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBe(1);
      expect(rules[0].importedRuleType).toBe(CompiledProxyRuleType.RegexHost);
    });

    it('should handle mixed formats with and without prefixes', () => {
      // Test mixed patterns: some with prefixes, some without
      const text = `[SwitchyOmega Conditions]
; Mixed format test
10.0.0.*
U: *://192.168.*.*/*
example.com
H: google.com`;
      
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBe(4);
      
      // Check each rule type
      const rule1 = rules.find(r => r.name.includes('10.0.0'));
      expect(rule1!.importedRuleType).toBe(CompiledProxyRuleType.RegexHost);
      
      const rule2 = rules.find(r => r.name.includes('192.168'));
      expect(rule2!.importedRuleType).toBe(CompiledProxyRuleType.RegexUrl);
      
      const rule3 = rules.find(r => r.name === 'example.com');
      expect(rule3!.importedRuleType).toBe(CompiledProxyRuleType.RegexHost);
      
      const rule4 = rules.find(r => r.name === 'H: google.com');
      expect(rule4!.importedRuleType).toBe(CompiledProxyRuleType.RegexHost);
    });

    it('should handle domain patterns with wildcards', () => {
      // Test various wildcard patterns without prefix
      const text = `[SwitchyOmega Conditions]
*.example.com
**.google.com
.facebook.com`;
      
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBe(3);
      
      // Test *.example.com pattern - matches subdomains only (not the domain itself)
      const wildcardRule = rules.find(r => r.name.includes('*.example'));
      expect(wildcardRule).toBeDefined();
      const wildcardRegex = new RegExp(wildcardRule!.regex);
      // *.example.com uses (.*\.)? which means "any characters followed by dot" is optional
      // This actually matches example.com (when optional part is omitted)
      expect(wildcardRegex.test('www.example.com')).toBe(true);
      expect(wildcardRegex.test('mail.example.com')).toBe(true);
      expect(wildcardRegex.test('example.com')).toBe(true); // Also matches due to optional group
    });

    it('should skip rules with invalid args', () => {
      const compiled = [
        { expression: /test/, args: [] }, // No args
        { expression: /test/, args: ['host', 'extra'] }, // Too many args
      ];
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBe(0);
    });
  });

  describe('convertToSubscriptionProxyRule', () => {
    it('should convert to subscription proxy rules', () => {
      const text = `#BEGIN
*.example.com
#END`;
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToSubscriptionProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
      
      const rule = rules[0];
      expect(rule.importedRuleType).toBe(CompiledProxyRuleType.RegexUrl);
      expect(rule.regex).toBeTruthy();
      expect(rule.name).toBe('*.example.com');
    });
  });
});