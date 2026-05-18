import { ProxyRules } from '../core/ProxyRules';
import { GeneralOptions, ProxyRule, ProxyRuleType, CompiledProxyRuleType, SmartProfileBase, SettingsConfig, SmartProfile, SmartProfileType, getSmartProfileTypeConfig } from '../core/definitions';
import { ProfileRules } from '../core/ProfileRules';
import { Settings } from '../core/Settings';

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

describe('ProfileRules.toggleRule', () => {
  const originalSettingsState = {
    current: Settings.current,
    active: Settings.active
  };

  let previousSettingsState = originalSettingsState;

  const restoreSettingsState = (state: typeof previousSettingsState) => {
    Settings.current = state.current;
    Settings.active = state.active;
  };

  beforeEach(() => {
    previousSettingsState = {
      current: Settings.current,
      active: Settings.active
    };
  });

  afterEach(() => {
    restoreSettingsState(previousSettingsState);
  });

  afterAll(() => {
    restoreSettingsState(originalSettingsState);
  });

  const createSettings = (deleteRuleWhenDisabledFromPopup = false): { settings: SettingsConfig; profile: SmartProfile } => {
    const profile = new SmartProfile();
    profile.profileId = 'profile-1';
    profile.profileName = 'Smart Rules';
    profile.profileType = SmartProfileType.SmartRules;
    profile.profileTypeConfig = getSmartProfileTypeConfig(SmartProfileType.SmartRules);
    profile.enabled = true;
    profile.proxyRules = [];
    profile.rulesSubscriptions = [];

    const settings = new SettingsConfig();
    settings.options = new GeneralOptions();
    settings.options.deleteRuleWhenDisabledFromPopup = deleteRuleWhenDisabledFromPopup;
    settings.proxyProfiles = [profile];
    settings.activeProfileId = profile.profileId;

    return { settings, profile };
  };

  const createRule = (hostName: string): ProxyRule => {
    const rule = new ProxyRule();
    rule.ruleType = ProxyRuleType.DomainSubdomain;
    rule.ruleSearch = hostName;
    rule.hostName = hostName;
    rule.enabled = true;
    return rule;
  };

  it('should disable an existing popup rule instead of deleting it by default', () => {
    const { settings, profile } = createSettings(false);
    const rule = createRule('example.com');
    profile.proxyRules.push(rule);
    Settings.current = settings;

    ProfileRules.toggleRule('example.com', rule.ruleId);

    expect(profile.proxyRules).toHaveLength(1);
    expect(profile.proxyRules[0].enabled).toBe(false);
  });

  it('should re-enable a disabled popup rule instead of creating a duplicate', () => {
    const { settings, profile } = createSettings(false);
    const rule = createRule('example.com');
    rule.enabled = false;
    profile.proxyRules.push(rule);
    Settings.current = settings;

    ProfileRules.toggleRule('example.com');

    expect(profile.proxyRules).toHaveLength(1);
    expect(profile.proxyRules[0]).toBe(rule);
    expect(profile.proxyRules[0].enabled).toBe(true);
  });

  it('should delete the rule when deleteRuleWhenDisabledFromPopup is enabled', () => {
    const { settings, profile } = createSettings(true);
    const rule = createRule('example.com');
    profile.proxyRules.push(rule);
    Settings.current = settings;

    ProfileRules.toggleRule('example.com', rule.ruleId);

    expect(profile.proxyRules).toHaveLength(0);
  });

  it('should re-enable a disabled existing rule when enabling by hostname', () => {
    const { settings, profile } = createSettings(false);
    const rule = createRule('example.com');
    rule.enabled = false;
    profile.proxyRules.push(rule);
    Settings.current = settings;

    const result = ProfileRules.enableByHostname('example.com');

    expect(result.success).toBe(true);
    expect(result.rule).toBe(rule);
    expect(profile.proxyRules).toHaveLength(1);
    expect(profile.proxyRules[0].enabled).toBe(true);
  });
});
