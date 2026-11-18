import { describe, expect, it } from 'vitest';
import { getWorldYearContext } from './worldEra';

describe('year-aware world context', () => {
  it('does not make smartphones available before their simulated introduction', () => {
    expect(getWorldYearContext(1950).smartphoneAvailable).toBe(false);
    expect(getWorldYearContext(1990).smartphoneAvailable).toBe(false);
    expect(getWorldYearContext(2006).smartphoneAvailable).toBe(false);
    expect(getWorldYearContext(2007).smartphoneAvailable).toBe(true);
    expect(getWorldYearContext(2026).smartphoneAvailable).toBe(true);
  });

  it('labels future technology context as fictional rather than historical fact', () => {
    const context = getWorldYearContext(2030);

    expect(context.decadeLabel).toContain('Masa depan');
    expect(context.technologySummary).toContain('fiksi simulasi');
  });
});
