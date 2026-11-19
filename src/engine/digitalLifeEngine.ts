import {
  creatorEquipment,
  dataPackages,
  digitalApps,
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
    deviceModel.creatorQuality * 0.55
      + character.stats.intelligence * 0.25
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
  const historyText = `Mengunggah "${title}" ke ${platform.name}; ${views} tayangan, ${newFollowers} audiens baru${revenue > 0 ? `, pendapatan ${revenue}` : ''}.`;
  const nextDigitalLife: DigitalLifeRecord = {
    ...current.digitalLife,
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

  return { character: nextCharacter, historyText };
}

export function getDigitalCreatorLevel(character: Character): string {
  const totalAudience = character.digitalLife.accounts.reduce((total, account) => (
    total + account.followers + account.subscribers
  ), 0);
  if (totalAudience >= 1_000_000) return 'Internet Legend';
  if (totalAudience >= 250_000) return 'Celebrity';
  if (totalAudience >= 100_000) return 'Top Influencer';
  if (totalAudience >= 50_000) return 'Influencer';
  if (totalAudience >= 10_000) return 'Rising Star';
  if (totalAudience >= 1_000) return 'Emerging Creator';
  return 'Pemula';
}

export function processDigitalLifeMonth(character: Character): {
  character: Character;
  historyEntries: string[];
} {
  const current = normalizeDigitalLifeRecord(character);
  const smartphone = current.digitalLife.smartphone;
  if (!smartphone) return { character: current, historyEntries: [] };
  const currentIndex = monthIndex(character.currentYear, character.currentMonth);
  const expiredPlan = smartphone.dataPlan
    && smartphone.dataPlan.expiresAtMonthIndex <= currentIndex;
  const dataPlan = expiredPlan ? null : smartphone.dataPlan;
  const updatedPhone: SmartphoneRecord = {
    ...smartphone,
    condition: Math.max(0, smartphone.condition - 0.1),
    dataPlan,
    installedApps: initialInstalledApps(character.currentYear),
  };
  const historyEntries = expiredPlan
    ? [`${character.currentYear}-${String(character.currentMonth).padStart(2, '0')}: Paket data ponsel telah berakhir.`]
    : [];
  return {
    character: {
      ...current,
      digitalLife: { ...current.digitalLife, smartphone: updatedPhone },
    },
    historyEntries,
  };
}

export { smartphoneModels };
