import { externalAppRuleParser } from '../lib/RuleImporter';
import { CompiledProxyRuleType } from '../core/definitions';

describe('externalAppRuleParser.GFWList', () => {
  describe('convertLineRegex', () => {
    it('should convert IP address with port correctly', () => {
      const line = '10.19.29.157:9080';
      const result = externalAppRuleParser.GFWList.convertLineRegex(line);

      expect(result).toBeDefined();
      expect(result.search).toBe('10.19.29.157:9080');
      expect(result.name).toBe('10.19.29.157:9080');
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
      const text = '10.19.29.157:9080';

      const result = externalAppRuleParser.GFWList.parse(text);

      expect(result.blackList).toHaveLength(1);
      expect(result.blackList[0].search).toBe('10.19.29.157:9080');
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
10.19.29.157:9080
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
10.19.29.157:9080
#END`;
      const result = externalAppRuleParser.Switchy.parseAndCompile(text);
      const rules = externalAppRuleParser.Switchy.convertToProxyRule(result.compiled);
      
      expect(rules).toBeDefined();
      expect(rules.length).toBeGreaterThan(0);
      
      const rule = rules[0];
      expect(rule.name).toBe('10.19.29.157:9080');
      expect(rule.regex).toBeTruthy();
      // The regex should match the IP:port pattern
      expect(rule.regex).toContain('10');
      expect(rule.regex).toContain('19');
      expect(rule.regex).toContain('29');
      expect(rule.regex).toContain('157');
      expect(rule.regex).toContain('9080');
    });

    it('should handle multiple rules', () => {
      const text = `#BEGIN
*.example.com
*.google.com
10.19.29.157:9080
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