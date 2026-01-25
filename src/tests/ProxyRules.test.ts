import { ProxyRules } from '../core/ProxyRules';
import { ProxyRule, ProxyRuleType, CompiledProxyRuleType, SmartProfileBase } from '../core/definitions';

describe('ProxyRules.compileRules', () => {
  // Create minimal mock profile for testing
  const createMockProfile = (): SmartProfileBase => ({
    profileProxyServerId: null
  } as SmartProfileBase);

  it('should compile IP address with port rule', () => {
    const rule = new ProxyRule();
    rule.enabled = true;
    rule.ruleType = ProxyRuleType.DomainSubdomain;
    rule.ruleSearch = '10.19.29.157:9080';
    rule.hostName = '10.19.29.157:9080';
    rule.proxy = null;

    const result = ProxyRules.compileRules(createMockProfile(), [rule]);

    expect(result.compiledList).toHaveLength(1);
    expect(result.compiledList[0].search).toBe('10.19.29.157:9080');
    expect(result.compiledList[0].compiledRuleType).toBe(CompiledProxyRuleType.SearchDomainSubdomain);
  });

  it('should compile domain with subdomain rule', () => {
    const rule = new ProxyRule();
    rule.enabled = true;
    rule.ruleType = ProxyRuleType.DomainSubdomain;
    rule.ruleSearch = 'example.com';
    rule.hostName = 'example.com';
    rule.proxy = null;

    const result = ProxyRules.compileRules(createMockProfile(), [rule]);

    expect(result.compiledList).toHaveLength(1);
    expect(result.compiledList[0].search).toBe('example.com');
    expect(result.compiledList[0].compiledRuleType).toBe(CompiledProxyRuleType.SearchDomainSubdomain);
  });

  it('should compile exact match rule', () => {
    const rule = new ProxyRule();
    rule.enabled = true;
    rule.ruleType = ProxyRuleType.Exact;
    rule.ruleExact = 'http://example.com/path';
    rule.proxy = null;

    const result = ProxyRules.compileRules(createMockProfile(), [rule]);

    expect(result.compiledList).toHaveLength(1);
    expect(result.compiledList[0].search).toBe('http://example.com/path');
    expect(result.compiledList[0].compiledRuleType).toBe(CompiledProxyRuleType.Exact);
  });

  it('should skip disabled rules', () => {
    const rule = new ProxyRule();
    rule.enabled = false;
    rule.ruleType = ProxyRuleType.DomainSubdomain;
    rule.ruleSearch = 'example.com';

    const result = ProxyRules.compileRules(createMockProfile(), [rule]);

    expect(result.compiledList).toHaveLength(0);
  });

  it('should separate whitelist and blacklist rules', () => {
    const blacklistRule = new ProxyRule();
    blacklistRule.enabled = true;
    blacklistRule.ruleType = ProxyRuleType.DomainSubdomain;
    blacklistRule.ruleSearch = 'blocked.com';
    blacklistRule.whiteList = false;

    const whitelistRule = new ProxyRule();
    whitelistRule.enabled = true;
    whitelistRule.ruleType = ProxyRuleType.DomainSubdomain;
    whitelistRule.ruleSearch = 'allowed.com';
    whitelistRule.whiteList = true;

    const result = ProxyRules.compileRules(createMockProfile(), [blacklistRule, whitelistRule]);

    expect(result.compiledList).toHaveLength(1);
    expect(result.compiledList[0].search).toBe('blocked.com');
    expect(result.compiledWhiteList).toHaveLength(1);
    expect(result.compiledWhiteList[0].search).toBe('allowed.com');
  });
});
