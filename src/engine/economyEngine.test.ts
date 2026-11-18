import { describe, expect, it } from 'vitest';
import { createCharacter, initialCharacterDraft } from './characterCreation';
import {
  buyProperty,
  createInitialEconomyRecord,
  invest,
  processEconomyYear,
  propertyCatalog,
  repayLoan,
  sellProperty,
  setMonthlyBudget,
  startBusiness,
  takeLoan,
} from './economyEngine';
import { processAnnualCareer } from './careerEngine';

function makeCharacter() {
  const character = createCharacter({
    ...initialCharacterDraft,
    firstName: 'Nara',
    lastName: 'Putri',
    gender: 'female',
    birthDate: '1980-05-21',
    familyBackground: 'middle',
    parentCondition: 'both_alive',
    personalityTraits: ['disciplined'],
  }, {
    today: new Date('2026-11-18T12:00:00'),
    idFactory: () => 'economy-character',
  });
  const cash = 500_000_000;
  return {
    ...character,
    age: 30,
    currentYear: 2026,
    cash,
    netWorth: cash + character.startingAssets.nonCashValue,
    economyRecord: createInitialEconomyRecord(),
  };
}

describe('economy engine', () => {
  it('saves monthly budgets and applies them as annual household expenses', () => {
    const character = makeCharacter();
    const budget = {
      housing: 1_000_000,
      food: 2_000_000,
      transport: 500_000,
      health: 250_000,
      education: 0,
      leisure: 250_000,
    };
    const configured = setMonthlyBudget(character, budget)!;
    const annual = processAnnualCareer(configured.character);

    expect(configured.character.economyRecord.monthlyBudget).toEqual(budget);
    expect(configured.character.economyRecord.budgetConfigured).toBe(true);
    expect(annual.expenses).toBe(48_000_000);
    expect(annual.character.cash).toBe(character.cash - 48_000_000);
    expect(setMonthlyBudget(character, { ...budget, food: -1 })).toBeNull();
  });

  it('buys and sells properties with net-worth-consistent cash flow', () => {
    const character = makeCharacter();
    const initialNetWorth = character.netWorth;
    const bought = buyProperty(character, 'rental-home')!;
    expect(bought.character.assets[0]).toMatchObject({
      category: 'home',
      propertyType: 'rental',
      annualRent: 11_000_000,
    });
    expect(bought.character.netWorth).toBe(initialNetWorth);

    const annual = processEconomyYear(bought.character, () => 0.5);
    expect(annual.income).toBeGreaterThan(0);
    expect(annual.character.cash).toBeGreaterThan(bought.character.cash);

    const sold = sellProperty(bought.character, bought.character.assets[0].id)!;
    expect(sold.character.assets).toHaveLength(0);
    expect(sold.character.cash).toBeGreaterThan(bought.character.cash);
    expect(sold.character.cash).toBeLessThan(bought.character.cash + bought.character.assets[0].value);
    expect(propertyCatalog.length).toBeGreaterThanOrEqual(3);
  });

  it('keeps investment returns inside the investment asset, not duplicated as cash', () => {
    const character = makeCharacter();
    const invested = invest(character, 20_000_000, 'deposit')!;
    const annual = processEconomyYear(invested.character, () => 0.5);

    expect(annual.character.cash).toBe(invested.character.cash);
    expect(annual.character.assets[0].value).toBe(20_900_000);
    expect(annual.character.netWorth).toBe(invested.character.netWorth + 900_000);
  });

  it('runs a small business and records annual revenue and operating costs', () => {
    const character = makeCharacter();
    const opened = startBusiness(character, 'food_stall', 'Warung Nara')!;
    const cashBeforeYear = opened.character.cash;
    const annual = processEconomyYear(opened.character, () => 0.5);

    expect(annual.character.cash).toBeGreaterThan(cashBeforeYear);
    expect(annual.character.economyRecord.businesses[0].history).toHaveLength(2);
    expect(annual.historyEntries.some((entry) => entry.includes('hasil bersih'))).toBe(true);
  });

  it('creates a repayment schedule and reduces both loan balance and aggregate debt', () => {
    const character = makeCharacter();
    const borrowed = takeLoan(character, 20_000_000, 'personal')!;
    const loan = borrowed.character.economyRecord.loans[0];
    expect(borrowed.character.debt).toBe(20_000_000);
    expect(borrowed.character.cash).toBe(character.cash + 19_600_000);

    const annual = processEconomyYear(borrowed.character, () => 0.5);
    const updatedLoan = annual.character.economyRecord.loans[0];
    expect(updatedLoan.balance).toBeLessThan(loan.balance);
    expect(annual.character.debt).toBe(updatedLoan.balance);
    expect(annual.character.cash).toBeLessThan(borrowed.character.cash);

    const repaid = repayLoan(annual.character, loan.id, 1_000_000)!;
    expect(repaid.character.debt).toBe(annual.character.debt - 1_000_000);
    expect(repaid.character.cash).toBe(annual.character.cash - 1_000_000);
  });

  it('rejects unaffordable purchases and investments', () => {
    const character = { ...makeCharacter(), cash: 0 };
    expect(buyProperty(character, 'starter-home')).toBeNull();
    expect(invest(character, 100_000, 'deposit')).toBeNull();
  });
});
