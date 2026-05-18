import { GeneralOptions } from '../core/definitions';

describe('GeneralOptions', () => {
  it('should copy deleteRuleWhenDisabledFromPopup from source', () => {
    const options = new GeneralOptions();

    options.CopyFrom({
      deleteRuleWhenDisabledFromPopup: true
    });

    expect(options.deleteRuleWhenDisabledFromPopup).toBe(true);
  });

  it('should compare deleteRuleWhenDisabledFromPopup in Equals', () => {
    const left = new GeneralOptions();
    const right = new GeneralOptions();

    right.deleteRuleWhenDisabledFromPopup = true;

    expect(left.Equals(right)).toBe(false);

    left.deleteRuleWhenDisabledFromPopup = true;

    expect(left.Equals(right)).toBe(true);
  });
});
