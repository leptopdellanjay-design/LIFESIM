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
  depositToBank,
  getDigitalCreatorLevel,
  normalizeDigitalLifeRecord,
  openBankAccount,
  publishDigitalContent,
  processDigitalLifeMonth,
  transferBetweenBankAccounts,
  withdrawFromBank,
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
    expect(uploaded.character.digitalLife.creatorSkill).toBe(3);
    expect(uploaded.character.digitalLife.creatorTitles).toEqual([
      expect.objectContaining({ id: 'creator-starter', label: 'Kreator Pemula' }),
    ]);
    expect(getDigitalCreatorLevel(uploaded.character)).toBe('Kreator Pemula');
    expect(uploaded.historyText).toContain('Gelar baru terbuka: Kreator Pemula');
  });

  it('unlocks creator titles once all progression thresholds are met and normalizes older saves', () => {
    const character = makeCharacter();
    const phone = buySmartphone(character, 'garuda-ultra')!.character;
    const data = buyMobileDataPackage(phone, 'paket-5gb')!.character;
    const accountResult = createSocialAccount(data, 'indotube', 'Nara.Creates')!;
    const account: DigitalSocialAccount = {
      ...accountResult.character.digitalLife.accounts[0],
      subscribers: 1_000_000,
      totalViews: 50_000_000,
      monetized: true,
    };
    let creator = {
      ...accountResult.character,
      digitalLife: {
        ...accountResult.character.digitalLife,
        accounts: [account],
      },
    };
    for (let upload = 0; upload < 5; upload += 1) {
      creator = publishDigitalContent(creator, {
        accountId: account.id,
        category: 'education',
        title: `Pelajaran ${upload + 1}`,
        description: 'Catatan dari proses belajar.',
      }, () => 0.995)!.character;
    }

    expect(creator.digitalLife.creatorTitles.map((title) => title.id)).toEqual([
      'creator-starter',
      'creator-rising',
    ]);
    expect(getDigitalCreatorLevel(creator)).toBe('Kreator Berkembang');

    const legacy = { ...creator, digitalLife: { ...creator.digitalLife } };
    Reflect.deleteProperty(legacy.digitalLife, 'creatorSkill');
    Reflect.deleteProperty(legacy.digitalLife, 'creatorTitles');
    Reflect.deleteProperty(legacy.digitalLife, 'bankAccounts');
    const normalized = normalizeDigitalLifeRecord(legacy);
    expect(normalized.digitalLife.creatorSkill).toBe(0);
    expect(normalized.digitalLife.creatorTitles).toEqual([]);
    expect(normalized.digitalLife.bankAccounts).toEqual([]);
  });

  it('moves deposits between cash and bank assets without duplicating net worth', () => {
    const character = makeCharacter();
    const opened = openBankAccount(character, 'bank-nusantara')!;
    const startingNetWorth = opened.character.netWorth;
    const accountId = opened.character.digitalLife.bankAccounts[0].id;
    const deposited = depositToBank(opened.character, accountId, 100_000)!;

    expect(deposited.character.cash).toBe(opened.character.cash - 100_000);
    expect(deposited.character.digitalLife.bankAccounts[0].balance).toBe(100_000);
    expect(deposited.character.assets.find((asset) => asset.category === 'bank_deposit')?.value).toBe(100_000);
    expect(deposited.character.netWorth).toBe(startingNetWorth);

    const withdrawn = withdrawFromBank(deposited.character, accountId, 40_000)!;
    expect(withdrawn.character.cash).toBe(deposited.character.cash + 40_000);
    expect(withdrawn.character.digitalLife.bankAccounts[0].balance).toBe(60_000);
    expect(withdrawn.character.netWorth).toBe(startingNetWorth);
    expect(depositToBank(character, accountId, 100_000)).toBeNull();
  });

  it('charges only the transfer fee and posts monthly interest as income', () => {
    const character = makeCharacter();
    const firstAccount = openBankAccount(character, 'bank-nusantara')!.character;
    const secondAccount = openBankAccount(firstAccount, 'bank-merdeka')!.character;
    const [source, destination] = secondAccount.digitalLife.bankAccounts;
    const deposited = depositToBank(secondAccount, source.id, 100_000)!.character;
    const transfer = transferBetweenBankAccounts(deposited, source.id, destination.id, 20_000)!;
    const transferFee = 2_500;

    expect(transfer.character.digitalLife.bankAccounts.map((account) => account.balance)).toEqual([
      77_500,
      20_000,
    ]);
    expect(transfer.character.netWorth).toBe(deposited.netWorth - transferFee);

    const beforeInterest = transfer.character;
    const interest = processDigitalLifeMonth(beforeInterest);
    const totalInterest = interest.character.digitalLife.bankAccounts.reduce(
      (total, account) => total + account.balance,
      0,
    ) - beforeInterest.digitalLife.bankAccounts.reduce((total, account) => total + account.balance, 0);
    expect(totalInterest).toBeGreaterThan(0);
    expect(interest.character.netWorth).toBe(beforeInterest.netWorth + totalInterest);
    expect(interest.character.lastYearIncome).toBe(beforeInterest.lastYearIncome + totalInterest);
    expect(interest.character.digitalLife.transactions.map((transaction) => transaction.type))
      .toContain('bank_interest');
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
