import {
  creatorEquipment,
  creatorTitleCatalog,
  dataPackages,
  digitalApps,
  digitalBanks,
  digitalPlatforms,
  getDigitalPlatform,
  getSmartphoneModel,
  socialAccountEligibilityAge,
  smartphoneModels,
} from '../data/digitalCatalog';
import type {
  Character,
  DigitalAppId,
  DigitalContentCategory,
  DigitalContentPerformance,
  DigitalBankAccount,
  DigitalCreatorTitle,
  DigitalLifeRecord,
  DigitalPlatformId,
  DigitalSocialAccount,
  DigitalTransaction,
  SmartphoneRecord,
} from '../types/game';
import { getNominalPriceFactor } from './worldEra';

export interface DigitalActionResult {
  character: Character;
  historyText: string;
}

type PhoneCondition = 'new' | 'used';

const clamp = (value: number, min: number, max: number) => (
  Math.max(min, Math.min(max, Math.round(value)))
);

const finiteAmount = (value: number) => (
  Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
);

function monthIndex(year: number, month: number): number {
  return year * 12 + month - 1;
}

function initialInstalledApps(year: number): DigitalAppId[] {
  return digitalApps.filter((app) => app.releaseYear <= year).map((app) => app.id);
}

export function createInitialDigitalLifeRecord(): DigitalLifeRecord {
  return {
    smartphone: null,
    accounts: [],
    content: [],
    transactions: [],
    creatorSkill: 0,
    creatorTitles: [],
    bankAccounts: [],
  };
}

export function normalizeDigitalLifeRecord(character: Character): Character {
  const record = character.digitalLife ?? createInitialDigitalLifeRecord();
  const smartphone = record.smartphone
    ? {
      ...record.smartphone,
      installedApps: Array.isArray(record.smartphone.installedApps)
        ? record.smartphone.installedApps.filter((app): app is DigitalAppId => (
          digitalApps.some((item) => item.id === app)
        ))
        : initialInstalledApps(character.currentYear),
      dataPlan: record.smartphone.dataPlan ?? null,
    }
    : null;

  return {
    ...character,
    digitalLife: {
      ...createInitialDigitalLifeRecord(),
      ...record,
      smartphone,
      accounts: Array.isArray(record.accounts) ? record.accounts : [],
      content: Array.isArray(record.content) ? record.content : [],
      transactions: Array.isArray(record.transactions) ? record.transactions : [],
      creatorSkill: Number.isFinite(record.creatorSkill)
        ? clamp(record.creatorSkill, 0, 100)
        : 0,
      creatorTitles: Array.isArray(record.creatorTitles)
        ? record.creatorTitles.filter((title): title is DigitalCreatorTitle => (
          typeof title?.id === 'string'
          && typeof title.label === 'string'
          && Number.isFinite(title.unlockedYear)
          && Number.isFinite(title.unlockedMonth)
        ))
        : [],
      bankAccounts: Array.isArray(record.bankAccounts)
        ? record.bankAccounts.filter((account): account is DigitalBankAccount => (
          typeof account?.id === 'string'
          && typeof account.bankId === 'string'
          && typeof account.accountNumber === 'string'
          && Number.isFinite(account.balance)
          && account.balance >= 0
          && Number.isFinite(account.openedYear)
        ))
        : [],
    },
  };
}

function addDigitalTransaction(
  character: Character,
  type: DigitalTransaction['type'],
  description: string,
  amount: number,
): Character {
  const current = normalizeDigitalLifeRecord(character);
  const transaction: DigitalTransaction = {
    id: `${character.id}:digital:${character.currentYear}-${character.currentMonth}:${current.digitalLife.transactions.length + 1}`,
    year: character.currentYear,
    month: character.currentMonth,
    type,
    description,
    amount: finiteAmount(amount),
  };
  const entry = `${character.currentYear}-${String(character.currentMonth).padStart(2, '0')}: ${description} (${transaction.amount}).`;

  return {
    ...current,
    digitalLife: {
      ...current.digitalLife,
      transactions: [...current.digitalLife.transactions, transaction].slice(-500),
    },
    economyRecord: {
      ...current.economyRecord,
      history: [...(current.economyRecord?.history ?? []), entry].slice(-2_000),
    },
  };
}

export const recordDigitalTransaction = addDigitalTransaction;

function calculateNetWorth(character: Character, cash: number, assets: Character['assets']): number {
  return Math.max(
    0,
    cash + character.startingAssets.nonCashValue
      + assets.reduce((total, asset) => total + asset.value, 0)
      - character.debt,
  );
}

function makePhoneNumber(characterId: string): string {
  const hash = [...characterId].reduce((value, character) => (
    (value * 31 + character.charCodeAt(0)) % 10_000_000
  ), 7_346_281);
  return `0812${String(hash).padStart(7, '0')}`;
}

function getBankAssetId(accountId: string): string {
  return `bank-deposit-${accountId}`;
}

function makeBankAccountNumber(characterId: string, bankId: string): string {
  const hash = [...`${characterId}:${bankId}`].reduce((value, character) => (
    (value * 31 + character.charCodeAt(0)) % 10_000_000_000
  ), 7_346_281);
  return String(hash).padStart(10, '0');
}

export function openBankAccount(character: Character, bankId: string): DigitalActionResult | null {
  const current = normalizeDigitalLifeRecord(character);
  const bank = digitalBanks.find((item) => item.id === bankId);
  if (!bank || character.status !== 'alive' || character.age < 18
    || character.currentYear < bank.foundedYear
    || character.cash < bank.openingFee
    || current.digitalLife.bankAccounts.some((account) => account.bankId === bankId)) return null;

  const account: DigitalBankAccount = {
    id: `${character.id}:bank:${bank.id}`,
    bankId: bank.id,
    accountNumber: makeBankAccountNumber(character.id, bank.id),
    balance: 0,
    openedYear: character.currentYear,
  };
  const assets = [...character.assets, {
    id: getBankAssetId(account.id),
    name: `Simpanan ${bank.name}`,
    category: 'bank_deposit' as const,
    value: 0,
    acquiredYear: character.currentYear,
  }];
  const nextCharacter = {
    ...current,
    cash: character.cash - bank.openingFee,
    assets,
    netWorth: calculateNetWorth(character, character.cash - bank.openingFee, assets),
    lastYearExpenses: finiteAmount(character.lastYearExpenses + bank.openingFee),
    digitalLife: {
      ...current.digitalLife,
      bankAccounts: [...current.digitalLife.bankAccounts, account],
    },
  };
  return {
    character: addDigitalTransaction(nextCharacter, 'bank_open', `Biaya pembukaan rekening ${bank.name}`, bank.openingFee),
    historyText: `Membuka rekening di ${bank.name}.`,
  };
}

export function depositToBank(
  character: Character,
  accountId: string,
  amount: number,
): DigitalActionResult | null {
  const current = normalizeDigitalLifeRecord(character);
  const account = current.digitalLife.bankAccounts.find((item) => item.id === accountId);
  const asset = current.assets.find((item) => item.id === getBankAssetId(accountId));
  const deposit = finiteAmount(amount);
  if (!account || !asset || character.status !== 'alive'
    || !Number.isSafeInteger(amount) || deposit <= 0
    || character.cash < deposit || asset.value !== account.balance) return null;

  const nextBalance = account.balance + deposit;
  const assets = current.assets.map((item) => item.id === asset.id ? { ...item, value: nextBalance } : item);
  const nextCharacter = {
    ...current,
    cash: character.cash - deposit,
    assets,
    netWorth: calculateNetWorth(character, character.cash - deposit, assets),
    digitalLife: {
      ...current.digitalLife,
      bankAccounts: current.digitalLife.bankAccounts.map((item) => (
        item.id === accountId ? { ...item, balance: nextBalance } : item
      )),
    },
  };
  return {
    character: addDigitalTransaction(nextCharacter, 'bank_deposit', `Setoran ke rekening ${account.accountNumber}`, deposit),
    historyText: `Menyetor ${deposit} ke rekening bank.`,
  };
}

export function withdrawFromBank(
  character: Character,
  accountId: string,
  amount: number,
): DigitalActionResult | null {
  const current = normalizeDigitalLifeRecord(character);
  const account = current.digitalLife.bankAccounts.find((item) => item.id === accountId);
  const asset = current.assets.find((item) => item.id === getBankAssetId(accountId));
  const withdrawal = finiteAmount(amount);
  if (!account || !asset || character.status !== 'alive'
    || !Number.isSafeInteger(amount) || withdrawal <= 0
    || account.balance < withdrawal || asset.value !== account.balance) return null;

  const nextBalance = account.balance - withdrawal;
  const assets = current.assets.map((item) => item.id === asset.id ? { ...item, value: nextBalance } : item);
  const nextCharacter = {
    ...current,
    cash: character.cash + withdrawal,
    assets,
    netWorth: calculateNetWorth(character, character.cash + withdrawal, assets),
    digitalLife: {
      ...current.digitalLife,
      bankAccounts: current.digitalLife.bankAccounts.map((item) => (
        item.id === accountId ? { ...item, balance: nextBalance } : item
      )),
    },
  };
  return {
    character: addDigitalTransaction(nextCharacter, 'bank_withdrawal', `Penarikan dari rekening ${account.accountNumber}`, withdrawal),
    historyText: `Menarik ${withdrawal} dari rekening bank.`,
  };
}

export function transferBetweenBankAccounts(
  character: Character,
  sourceAccountId: string,
  destinationAccountId: string,
  amount: number,
): DigitalActionResult | null {
  const current = normalizeDigitalLifeRecord(character);
  const source = current.digitalLife.bankAccounts.find((item) => item.id === sourceAccountId);
  const destination = current.digitalLife.bankAccounts.find((item) => item.id === destinationAccountId);
  const sourceAsset = current.assets.find((item) => item.id === getBankAssetId(sourceAccountId));
  const destinationAsset = current.assets.find((item) => item.id === getBankAssetId(destinationAccountId));
  const transferAmount = finiteAmount(amount);
  const sourceBank = source ? digitalBanks.find((item) => item.id === source.bankId) : null;
  const fee = sourceBank?.transferFee ?? 0;
  if (!source || !destination || !sourceAsset || !destinationAsset || !sourceBank
    || sourceAccountId === destinationAccountId || character.status !== 'alive'
    || !Number.isSafeInteger(amount) || transferAmount <= 0
    || source.balance < transferAmount + fee
    || sourceAsset.value !== source.balance || destinationAsset.value !== destination.balance) return null;

  const sourceBalance = source.balance - transferAmount - fee;
  const destinationBalance = destination.balance + transferAmount;
  const assets = current.assets.map((item) => (
    item.id === sourceAsset.id ? { ...item, value: sourceBalance }
      : item.id === destinationAsset.id ? { ...item, value: destinationBalance }
        : item
  ));
  const nextCharacter = {
    ...current,
    assets,
    netWorth: calculateNetWorth(character, character.cash, assets),
    lastYearExpenses: finiteAmount(character.lastYearExpenses + fee),
    digitalLife: {
      ...current.digitalLife,
      bankAccounts: current.digitalLife.bankAccounts.map((item) => (
        item.id === sourceAccountId ? { ...item, balance: sourceBalance }
          : item.id === destinationAccountId ? { ...item, balance: destinationBalance }
            : item
      )),
    },
  };
  return {
    character: addDigitalTransaction(
      nextCharacter,
      'bank_transfer',
      `Transfer ${transferAmount} ke rekening ${destination.accountNumber}; biaya ${fee}`,
      transferAmount + fee,
    ),
    historyText: `Mentransfer ${transferAmount} antar rekening dengan biaya ${fee}.`,
  };
}

export function buySmartphone(
  character: Character,
  modelId: string,
  condition: PhoneCondition = 'new',
): DigitalActionResult | null {
  const current = normalizeDigitalLifeRecord(character);
  const model = getSmartphoneModel(modelId);
  if (!model || character.status !== 'alive' || character.age < 13
    || model.releaseYear > character.currentYear
    || !['new', 'used'].includes(condition)) return null;

  const previousPhone = current.digitalLife.smartphone;
  const previousModel = previousPhone ? getSmartphoneModel(previousPhone.modelId) : null;
  if (previousPhone && (!previousModel || model.creatorQuality <= previousModel.creatorQuality)) return null;

  const factor = getNominalPriceFactor(character.currentYear);
  const basePrice = Math.round(model.price * factor * (condition === 'used' ? 0.62 : 1));
  const oldAsset = previousPhone
    ? current.assets.find((asset) => asset.id === previousPhone.assetId)
    : undefined;
  const tradeIn = oldAsset ? Math.round(oldAsset.value * 0.55) : 0;
  const cash = finiteAmount(character.cash + tradeIn - basePrice);
  if (character.cash + tradeIn < basePrice) return null;

  const assetId = `phone-${character.id}-${character.currentYear}-${character.currentMonth}-${current.digitalLife.transactions.length + 1}`;
  const asset = {
    id: assetId,
    name: model.name,
    category: 'device' as const,
    value: basePrice,
    purchasePrice: basePrice,
    acquiredYear: character.currentYear,
    deviceModelId: model.id,
  };
  const assets = [
    ...current.assets.filter((item) => item.id !== oldAsset?.id),
    asset,
  ];
  const smartphone: SmartphoneRecord = {
    assetId,
    modelId: model.id,
    condition: condition === 'new' ? 100 : 65,
    phoneNumber: makePhoneNumber(character.id),
    installedApps: initialInstalledApps(character.currentYear),
    dataPlan: null,
  };
  let nextCharacter: Character = {
    ...current,
    cash,
    netWorth: calculateNetWorth(current, cash, assets),
    lastYearIncome: finiteAmount(current.lastYearIncome + tradeIn),
    lastYearExpenses: finiteAmount(current.lastYearExpenses + basePrice),
    assets,
    digitalLife: { ...current.digitalLife, smartphone },
  };
  nextCharacter = addDigitalTransaction(
    nextCharacter,
    'phone_purchase',
    `${previousPhone ? 'Menukar' : 'Membeli'} ${condition === 'used' ? 'ponsel bekas ' : ''}${model.name}`,
    basePrice,
  );
  if (tradeIn > 0) {
    nextCharacter = addDigitalTransaction(
      nextCharacter,
      'phone_sale',
      'Nilai tukar tambah ponsel lama',
      tradeIn,
    );
  }

  return {
    character: nextCharacter,
    historyText: `${previousPhone ? 'Meng-upgrade' : 'Membeli'} ponsel ${model.name}${condition === 'used' ? ' bekas' : ''}.`,
  };
}

export function sellSmartphone(character: Character): DigitalActionResult | null {
  const current = normalizeDigitalLifeRecord(character);
  const smartphone = current.digitalLife.smartphone;
  const asset = smartphone
    ? current.assets.find((item) => item.id === smartphone.assetId)
    : undefined;
  if (!smartphone || !asset || character.status !== 'alive') return null;

  const proceeds = Math.round(asset.value * 0.5);
  const assets = current.assets.filter((item) => item.id !== asset.id);
  const cash = finiteAmount(character.cash + proceeds);
  let nextCharacter: Character = {
    ...current,
    cash,
    netWorth: calculateNetWorth(current, cash, assets),
    lastYearIncome: finiteAmount(current.lastYearIncome + proceeds),
    assets,
    digitalLife: { ...current.digitalLife, smartphone: null },
  };
  nextCharacter = addDigitalTransaction(
    nextCharacter,
    'phone_sale',
    `Menjual ${asset.name}`,
    proceeds,
  );
  return {
    character: nextCharacter,
    historyText: `Menjual ponsel ${asset.name} seharga ${proceeds}.`,
  };
}

export function buyMobileDataPackage(
  character: Character,
  packageId: string,
): DigitalActionResult | null {
  const current = normalizeDigitalLifeRecord(character);
  const smartphone = current.digitalLife.smartphone;
  const dataPackage = dataPackages.find((item) => item.id === packageId);
  if (!smartphone || !dataPackage || character.status !== 'alive') return null;
  const currentIndex = monthIndex(character.currentYear, character.currentMonth);
  const activePlan = smartphone.dataPlan
    && smartphone.dataPlan.expiresAtMonthIndex > currentIndex
    && smartphone.dataPlan.remainingMb > 0;
  if (activePlan) return null;

  const price = finiteAmount(dataPackage.price * getNominalPriceFactor(character.currentYear));
  if (character.cash < price) return null;

  const nextSmartphone: SmartphoneRecord = {
    ...smartphone,
    dataPlan: {
      packageId: dataPackage.id,
      remainingMb: dataPackage.dataMb,
      expiresAtMonthIndex: currentIndex + dataPackage.durationMonths,
    },
  };
  let nextCharacter: Character = {
    ...current,
    cash: character.cash - price,
    netWorth: Math.max(0, character.netWorth - price),
    lastYearExpenses: finiteAmount(character.lastYearExpenses + price),
    digitalLife: { ...current.digitalLife, smartphone: nextSmartphone },
  };
  nextCharacter = addDigitalTransaction(
    nextCharacter,
    'data_package',
    `Membeli ${dataPackage.name}`,
    price,
  );
  return {
    character: nextCharacter,
    historyText: `Membeli ${dataPackage.name} untuk ponsel.`,
  };
}

export function buyCreatorEquipment(
  character: Character,
  equipmentId: string,
): DigitalActionResult | null {
  const current = normalizeDigitalLifeRecord(character);
  const equipment = creatorEquipment.find((item) => item.id === equipmentId);
  if (!equipment || character.status !== 'alive' || character.age < 13
    || equipment.releaseYear > character.currentYear
    || current.assets.some((asset) => asset.id === `gear-${character.id}-${equipmentId}`)) return null;

  const price = finiteAmount(equipment.price * getNominalPriceFactor(character.currentYear));
  if (character.cash < price) return null;
  const asset = {
    id: `gear-${character.id}-${equipmentId}`,
    name: equipment.name,
    category: 'creator_gear' as const,
    value: price,
    purchasePrice: price,
    acquiredYear: character.currentYear,
    equipmentQuality: equipment.quality,
  };
  const assets = [...current.assets, asset];
  let nextCharacter: Character = {
    ...current,
    cash: character.cash - price,
    netWorth: calculateNetWorth(current, character.cash - price, assets),
    lastYearExpenses: finiteAmount(character.lastYearExpenses + price),
    assets,
  };
  nextCharacter = addDigitalTransaction(
    nextCharacter,
    'creator_gear',
    `Membeli ${equipment.name}`,
    price,
  );
  return {
    character: nextCharacter,
    historyText: `Membeli peralatan kreator ${equipment.name}.`,
  };
}

export function createSocialAccount(
  character: Character,
  platformId: DigitalPlatformId,
  username: string,
): DigitalActionResult | null {
  const current = normalizeDigitalLifeRecord(character);
  const platform = digitalPlatforms.find((item) => item.id === platformId);
  const normalizedUsername = username.trim().toLowerCase();
  if (!platform || !current.digitalLife.smartphone
    || character.status !== 'alive'
    || character.age < socialAccountEligibilityAge
    || platform.releaseYear > character.currentYear
    || current.digitalLife.accounts.some((account) => account.platform === platformId)
    || !/^[a-z0-9._]{3,20}$/.test(normalizedUsername)) return null;

  const account: DigitalSocialAccount = {
    id: `social-${character.id}-${platformId}`,
    platform: platformId,
    username: normalizedUsername,
    followers: 0,
    subscribers: 0,
    totalViews: 0,
    monetized: false,
    createdYear: character.currentYear,
    createdMonth: character.currentMonth,
  };
  return {
    character: {
      ...current,
      digitalLife: {
        ...current.digitalLife,
        accounts: [...current.digitalLife.accounts, account],
      },
    },
    historyText: `Membuat akun ${platform.name} dengan nama @${normalizedUsername}.`,
  };
}

export function canMonetizeAccount(account: DigitalSocialAccount): boolean {
  const platform = getDigitalPlatform(account.platform);
  const audience = account.platform === 'indotube' ? account.subscribers : account.followers;
  return audience >= platform.monetizationAudienceThreshold
    && account.totalViews >= platform.monetizationViewThreshold;
}

export function activateAccountMonetization(
  character: Character,
  accountId: string,
): DigitalActionResult | null {
  const current = normalizeDigitalLifeRecord(character);
  const account = current.digitalLife.accounts.find((item) => item.id === accountId);
  if (!account || account.monetized || !canMonetizeAccount(account)
    || character.status !== 'alive') return null;
  const platform = getDigitalPlatform(account.platform);
  return {
    character: {
      ...current,
      digitalLife: {
        ...current.digitalLife,
        accounts: current.digitalLife.accounts.map((item) => (
          item.id === accountId ? { ...item, monetized: true } : item
        )),
      },
    },
    historyText: `Mengaktifkan monetisasi ${platform.name} untuk akun @${account.username}.`,
  };
}

function performanceFromRoll(roll: number, quality: number): DigitalContentPerformance {
  if (roll >= 0.99 && quality >= 50) return 'viral';
  if (roll >= 0.92) return 'trending';
  if (roll >= 0.72) return 'popular';
  if (roll >= 0.18) return 'normal';
  return 'quiet';
}

function viewMultiplier(performance: DigitalContentPerformance, roll: number): number {
  if (performance === 'viral') return 12 + roll * 6;
  if (performance === 'trending') return 4 + roll * 2;
  if (performance === 'popular') return 1.8 + roll;
  if (performance === 'normal') return 0.7 + roll * 0.7;
  return 0.25 + roll * 0.4;
}

function accountAudience(account: DigitalSocialAccount): number {
  return account.platform === 'indotube' ? account.subscribers : account.followers;
}

function getCreatorQuality(character: Character, smartphone: SmartphoneRecord): number | null {
  const deviceModel = getSmartphoneModel(smartphone.modelId);
  if (!deviceModel) return null;
  const equipmentQuality = Math.min(30, character.assets.reduce((total, asset) => (
    total + (asset.category === 'creator_gear' ? asset.equipmentQuality ?? 0 : 0)
  ), 0));
  return clamp(
    deviceModel.creatorQuality * 0.45
      + character.stats.intelligence * 0.25
      + (character.digitalLife?.creatorSkill ?? 0) * 0.2
      + equipmentQuality,
    0,
    100,
  );
}

export function getDigitalProductionCost(character: Character): number | null {
  const smartphone = normalizeDigitalLifeRecord(character).digitalLife.smartphone;
  if (!smartphone) return null;
  const quality = getCreatorQuality(character, smartphone);
  return quality === null
    ? null
    : finiteAmount((5_000 + Math.round(quality * 100))
      * getNominalPriceFactor(character.currentYear));
}

export function publishDigitalContent(
  character: Character,
  input: {
    accountId: string;
    category: DigitalContentCategory;
    title: string;
    description: string;
  },
  random: () => number = Math.random,
): DigitalActionResult | null {
  const current = normalizeDigitalLifeRecord(character);
  const smartphone = current.digitalLife.smartphone;
  const account = current.digitalLife.accounts.find((item) => item.id === input.accountId);
  const platform = account ? getDigitalPlatform(account.platform) : null;
  const title = input.title.trim();
  const description = input.description.trim();
  const dataPlan = smartphone?.dataPlan;
  const currentIndex = monthIndex(character.currentYear, character.currentMonth);
  if (!smartphone || !account || !platform || character.status !== 'alive'
    || character.age < socialAccountEligibilityAge
    || title.length < 3 || title.length > 100 || description.length > 300
    || platform.releaseYear > character.currentYear
    || smartphone.condition < 10
    || !dataPlan
    || dataPlan.expiresAtMonthIndex <= currentIndex
    || dataPlan.remainingMb < platform.uploadDataMb) return null;

  const quality = getCreatorQuality(current, smartphone);
  if (quality === null) return null;
  const rawRoll = random();
  const roll = Number.isFinite(rawRoll) ? Math.max(0, Math.min(0.999999, rawRoll)) : 0.5;
  const performance = performanceFromRoll(roll, quality);
  const baseReach = 100
    + accountAudience(account) * 0.72
    + quality * 8
    + character.stats.reputation * 1.2;
  const views = finiteAmount(baseReach * viewMultiplier(performance, roll));
  const engagementRate = Math.max(0.01, Math.min(0.2, 0.025 + quality / 1_000 + roll * 0.025));
  const likes = Math.floor(views * engagementRate);
  const comments = Math.floor(likes * 0.05);
  const shares = Math.floor(likes * 0.08);
  const newFollowers = Math.floor(likes * platform.followerConversionRate);
  const audienceGain = account.platform === 'indotube'
    ? { followers: 0, subscribers: newFollowers }
    : { followers: newFollowers, subscribers: 0 };
  const updatedAccount: DigitalSocialAccount = {
    ...account,
    ...audienceGain,
    totalViews: account.totalViews + views,
  };
  const provisionalAccount = {
    ...updatedAccount,
    followers: account.followers + audienceGain.followers,
    subscribers: account.subscribers + audienceGain.subscribers,
  };
  const revenue = account.monetized
    ? finiteAmount((views / 1_000) * platform.revenuePerThousandViews
      * getNominalPriceFactor(character.currentYear))
    : 0;
  const productionCost = getDigitalProductionCost(current);
  if (productionCost === null) return null;
  if (character.cash + revenue < productionCost) return null;

  const content = {
    id: `content-${character.id}-${character.currentYear}-${character.currentMonth}-${current.digitalLife.content.length + 1}`,
    accountId: account.id,
    platform: account.platform,
    category: input.category,
    title,
    description,
    year: character.currentYear,
    month: character.currentMonth,
    views,
    likes,
    comments,
    shares,
    engagementRate,
    newFollowers,
    revenue,
    performance,
  };
  const stats = { ...character.stats };
  stats.energy = Math.max(0, stats.energy - 1);
  if (performance === 'popular' || performance === 'trending' || performance === 'viral') {
    stats.happiness = Math.min(100, stats.happiness + 1);
  }
  if (performance === 'trending' || performance === 'viral') {
    stats.reputation = Math.min(100, stats.reputation + 1);
  }
  const careerReputationGain = performance === 'viral' ? 2 : performance === 'trending' ? 1 : 0;
  const careerRecord = careerReputationGain > 0
    ? {
      ...character.careerRecord,
      professionalReputation: Math.min(
        100,
        character.careerRecord.professionalReputation + careerReputationGain,
      ),
      history: [
        ...character.careerRecord.history.slice(-499),
        {
          id: `digital-creator:${content.id}`,
          year: character.currentYear,
          type: 'experience' as const,
          occupationId: character.careerRecord.currentOccupationId ?? 'digital-creator',
          title: 'Reputasi kreator digital meningkat',
          details: `Konten "${title}" mencapai ${performance}; reputasi profesional bertambah ${careerReputationGain}.`,
        },
      ],
    }
    : character.careerRecord;
  let historyText = `Mengunggah "${title}" ke ${platform.name}; ${views} tayangan, ${newFollowers} audiens baru${revenue > 0 ? `, pendapatan ${revenue}` : ''}.`;
  const nextDigitalLife: DigitalLifeRecord = {
    ...current.digitalLife,
    creatorSkill: clamp(
      current.digitalLife.creatorSkill + (performance === 'viral' ? 3 : performance === 'trending' ? 2 : 1),
      0,
      100,
    ),
    smartphone: {
      ...smartphone,
      dataPlan: { ...dataPlan, remainingMb: dataPlan.remainingMb - platform.uploadDataMb },
    },
    accounts: current.digitalLife.accounts.map((item) => (
      item.id === account.id ? provisionalAccount : item
    )),
    content: [...current.digitalLife.content, content].slice(-500),
  };
  let nextCharacter: Character = {
    ...current,
    cash: finiteAmount(character.cash - productionCost + revenue),
    netWorth: Math.max(0, character.netWorth - productionCost + revenue),
    lastYearIncome: finiteAmount(character.lastYearIncome + revenue),
    lastYearExpenses: finiteAmount(character.lastYearExpenses + productionCost),
    stats,
    careerRecord,
    digitalLife: nextDigitalLife,
  };
  if (productionCost > 0) {
    nextCharacter = addDigitalTransaction(
      nextCharacter,
      'content_production',
      `Biaya produksi konten "${title}"`,
      productionCost,
    );
  }
  if (revenue > 0) {
    nextCharacter = addDigitalTransaction(
      nextCharacter,
      'creator_income',
      `Pendapatan iklan konten "${title}"`,
      revenue,
    );
  }
  const progression = unlockDigitalCreatorTitles(nextCharacter);
  nextCharacter = progression.character;
  if (progression.newlyUnlocked.length > 0) {
    historyText += ` Gelar baru terbuka: ${progression.newlyUnlocked.map((item) => item.label).join(', ')}.`;
  }

  return { character: nextCharacter, historyText };
}

function getEligibleCreatorTitles(character: Character) {
  const digitalLife = normalizeDigitalLifeRecord(character).digitalLife;
  const totalAudience = digitalLife.accounts.reduce((total, account) => (
    total + account.followers + account.subscribers
  ), 0);
  const totalViews = digitalLife.accounts.reduce((total, account) => total + account.totalViews, 0);
  const creatorIncome = digitalLife.transactions.reduce((total, transaction) => (
    transaction.type === 'creator_income' || transaction.type === 'sponsor_income'
      ? total + transaction.amount
      : total
  ), 0);
  const averageEngagement = digitalLife.content.length > 0
    ? digitalLife.content.reduce((total, item) => total + item.engagementRate, 0) / digitalLife.content.length
    : 0;

  return creatorTitleCatalog.filter((title) => (
    totalAudience >= title.minimumAudience
    && totalViews >= title.minimumViews
    && creatorIncome >= title.minimumIncome
    && digitalLife.content.length >= title.minimumContent
    && averageEngagement >= title.minimumEngagement
  ));
}

export function unlockDigitalCreatorTitles(character: Character): {
  character: Character;
  newlyUnlocked: DigitalCreatorTitle[];
} {
  const current = normalizeDigitalLifeRecord(character);
  const earnedTitleIds = new Set(current.digitalLife.creatorTitles.map((item) => item.id));
  const newlyUnlocked = getEligibleCreatorTitles(current)
    .filter((title) => !earnedTitleIds.has(title.id))
    .map((title): DigitalCreatorTitle => ({
      id: title.id,
      label: title.label,
      unlockedYear: character.currentYear,
      unlockedMonth: character.currentMonth,
    }));
  if (newlyUnlocked.length === 0) return { character: current, newlyUnlocked };

  return {
    character: {
      ...current,
      digitalLife: {
        ...current.digitalLife,
        creatorTitles: [...current.digitalLife.creatorTitles, ...newlyUnlocked],
      },
    },
    newlyUnlocked,
  };
}

export function getDigitalCreatorLevel(character: Character): string {
  const titles = normalizeDigitalLifeRecord(character).digitalLife.creatorTitles;
  return titles[titles.length - 1]?.label ?? 'Belum ada gelar';
}

export function processDigitalLifeMonth(character: Character): {
  character: Character;
  historyEntries: string[];
} {
  const current = normalizeDigitalLifeRecord(character);
  const smartphone = current.digitalLife.smartphone;
  const historyEntries: string[] = [];
  let nextCharacter = current;
  if (smartphone) {
    const currentIndex = monthIndex(character.currentYear, character.currentMonth);
    const expiredPlan = smartphone.dataPlan
      && smartphone.dataPlan.expiresAtMonthIndex <= currentIndex;
    const updatedPhone: SmartphoneRecord = {
      ...smartphone,
      condition: Math.max(0, smartphone.condition - 0.1),
      dataPlan: expiredPlan ? null : smartphone.dataPlan,
      installedApps: initialInstalledApps(character.currentYear),
    };
    nextCharacter = {
      ...current,
      digitalLife: { ...current.digitalLife, smartphone: updatedPhone },
    };
    if (expiredPlan) {
      historyEntries.push(`${character.currentYear}-${String(character.currentMonth).padStart(2, '0')}: Paket data ponsel telah berakhir.`);
    }
  }

  const accruedInterest: Array<{ account: DigitalBankAccount; amount: number }> = [];
  let bankAccounts = nextCharacter.digitalLife.bankAccounts;
  let assets = nextCharacter.assets;
  for (const account of bankAccounts) {
    const bank = digitalBanks.find((item) => item.id === account.bankId);
    const asset = assets.find((item) => item.id === getBankAssetId(account.id));
    if (!bank || !asset || asset.value !== account.balance || account.balance <= 0) continue;

    const interest = finiteAmount(account.balance * (Math.pow(1 + bank.annualInterestRate, 1 / 12) - 1));
    if (interest <= 0) continue;
    const newBalance = account.balance + interest;
    bankAccounts = bankAccounts.map((item) => (
      item.id === account.id ? { ...item, balance: newBalance } : item
    ));
    assets = assets.map((item) => item.id === asset.id ? { ...item, value: newBalance } : item);
    accruedInterest.push({ account, amount: interest });
    historyEntries.push(`${character.currentYear}-${String(character.currentMonth).padStart(2, '0')}: Bunga tabungan ${bank.name} bertambah ${interest}.`);
  }

  if (accruedInterest.length > 0) {
    const totalInterest = accruedInterest.reduce((total, item) => total + item.amount, 0);
    nextCharacter = {
      ...nextCharacter,
      assets,
      netWorth: calculateNetWorth(nextCharacter, nextCharacter.cash, assets),
      lastYearIncome: finiteAmount(nextCharacter.lastYearIncome + totalInterest),
      digitalLife: {
        ...nextCharacter.digitalLife,
        bankAccounts,
      },
    };
    for (const { account, amount } of accruedInterest) {
      nextCharacter = addDigitalTransaction(
        nextCharacter,
        'bank_interest',
        `Bunga tabungan rekening ${account.accountNumber}`,
        amount,
      );
    }
  }

  return {
    character: nextCharacter,
    historyEntries,
  };
}

export { smartphoneModels };
