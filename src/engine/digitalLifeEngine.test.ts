import { describe, expect, it } from 'vitest';
import type { DigitalSocialAccount } from '../types/game';
import { createCharacter, initialCharacterDraft } from './characterCreation';
import { processEconomyMonth } from './economyEngine';
import { advanceMonth } from './agingEngine';
import { createEmptyEventProgress } from './eventEngine';
import {
  activateAccountMonetization,
  buyMobileDataPackage,
  buySmartphone,
  canMonetizeAccount,
  createSocialAccount,
  publishDigitalContent,
} from './digitalLifeEngine';

function makeCharacter() {
  const character = createCharacter({
    ...initialCharacterDraft,
    firstName: 'Nara',
    lastName: 'Putri',
    gender: 'female',
    birthDate: '1980-05-21',
    familyBackground: 'middle',
    parentCondition: 'both_alive',
    personalityTraits: ['creative'],
  }, {
    today: new Date('2026-11-18T12:00:00'),
    idFactory: () => 'digital-character',
  });
  const cash = 500_000_000;
  return {
    ...character,
    age: 30,
    currentYear: 2026,
    currentMonth: 6,
    cash,
    netWorth: cash + character.startingAssets.nonCashValue,
  };
}

describe('digital life engine', () => {
  it('only allows phones released by the current world year and keeps purchases in shared assets', () => {
    const character = makeCharacter();
    expect(buySmartphone({ ...character, currentYear: 2006 }, 'layar-saku')).toBeNull();

    const bought = buySmartphone(character, 'nusa-pro')!;
    expect(bought.character.digitalLife.smartphone?.modelId).toBe('nusa-pro');
    expect(bought.character.cash).toBeLessThan(character.cash);
    expect(bought.character.assets).toContainEqual(expect.objectContaining({
      category: 'device',
      deviceModelId: 'nusa-pro',
    }));
    expect(bought.character.netWorth).toBe(character.netWorth);
  });

  it('charges shared cash for data, tracks account eligibility, and records creator income and stats', () => {
    const character = makeCharacter();
    const phone = buySmartphone(character, 'garuda-ultra')!.character;
    const data = buyMobileDataPackage(phone, 'paket-5gb')!.character;
    expect(data.cash).toBeLessThan(phone.cash);
    expect(buyMobileDataPackage(data, 'paket-1gb')).toBeNull();

    const accountResult = createSocialAccount(data, 'indotube', 'Nara.Creates')!;
    expect(accountResult.character.digitalLife.accounts[0].username).toBe('nara.creates');
    const monetizableAccount: DigitalSocialAccount = {
      ...accountResult.character.digitalLife.accounts[0],
      subscribers: 1_000_000,
      totalViews: 50_000_000,
    };
    const eligible = {
      ...accountResult.character,
      digitalLife: {
        ...accountResult.character.digitalLife,
        accounts: [monetizableAccount],
      },
    };
    expect(canMonetizeAccount(monetizableAccount)).toBe(true);

    const monetized = activateAccountMonetization(eligible, monetizableAccount.id)!.character;
    const cashBeforeUpload = monetized.cash;
    const energyBeforeUpload = monetized.stats.energy;
    const uploaded = publishDigitalContent(monetized, {
      accountId: monetizableAccount.id,
      category: 'education',
      title: 'Belajar hal baru',
      description: 'Catatan singkat dari proses belajar.',
    }, () => 0.995)!;

    expect(uploaded.character.digitalLife.content[0].performance).toBe('viral');
    expect(uploaded.character.digitalLife.content[0].revenue).toBeGreaterThan(0);
    expect(uploaded.character.cash).toBeGreaterThan(cashBeforeUpload);
    expect(uploaded.character.digitalLife.smartphone?.dataPlan?.remainingMb).toBe(4_620);
    expect(uploaded.character.stats.energy).toBe(energyBeforeUpload - 1);
    expect(uploaded.character.careerRecord.professionalReputation).toBe(2);
    expect(uploaded.character.careerRecord.history[
      uploaded.character.careerRecord.history.length - 1
    ]?.title)
      .toBe('Reputasi kreator digital meningkat');
    expect(uploaded.character.lastYearIncome).toBeGreaterThan(0);
    expect(uploaded.character.digitalLife.transactions.map((transaction) => transaction.type))
      .toContain('creator_income');
  });

  it('expires monthly data and depreciates devices through the normal economy period', () => {
    const character = makeCharacter();
    const phone = buySmartphone(character, 'rimba-creator')!.character;
    const data = buyMobileDataPackage(phone, 'paket-1gb')!.character;
    const nextMonth = advanceMonth(data, createEmptyEventProgress(), () => 0.999999);
    expect(nextMonth.character.currentMonth).toBe(7);
    expect(nextMonth.character.digitalLife.smartphone?.dataPlan).toBeNull();
    expect(nextMonth.historyEntries.some((entry) => entry.includes('Paket data ponsel telah berakhir'))).toBe(true);

    const assetValue = data.assets[0].value;
    const economyMonth = processEconomyMonth(data, 7, () => 0.5);
    expect(economyMonth.character.assets[0].value).toBeLessThan(assetValue);
  });
});
