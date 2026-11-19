import type {
  BudgetCategory,
  BusinessKind,
  BusinessRecord,
  Character,
  CharacterAsset,
  EconomyRecord,
  LoanRecord,
} from '../types/game';
import { getNominalPriceFactor } from './worldEra';

export interface EconomyActionResult {
  character: Character;
  historyText: string;
}

export interface EconomyYearResult {
  character: Character;
  income: number;
  expenses: number;
  historyEntries: string[];
}

export type MonthlyBudget = Record<BudgetCategory, number>;

export const budgetCategories: Array<{ id: BudgetCategory; label: string }> = [
  { id: 'housing', label: 'Tempat tinggal' },
  { id: 'food', label: 'Makanan' },
  { id: 'transport', label: 'Transportasi' },
  { id: 'health', label: 'Kesehatan' },
  { id: 'education', label: 'Pendidikan' },
  { id: 'leisure', label: 'Hiburan' },
];

export interface BusinessDefinition {
  id: BusinessKind;
  name: string;
  startupCost: number;
  annualRevenue: number;
  annualOperatingCosts: number;
  description: string;
}

export const businessCatalog: BusinessDefinition[] = [
  {
    id: 'food_stall',
    name: 'Warung makan kecil',
    startupCost: 15_000_000,
    annualRevenue: 22_000_000,
    annualOperatingCosts: 17_000_000,
    description: 'Usaha makanan sederhana dengan biaya operasional dan hasil yang dapat berubah.',
  },
  {
    id: 'grocery',
    name: 'Toko kebutuhan harian',
    startupCost: 28_000_000,
    annualRevenue: 42_000_000,
    annualOperatingCosts: 34_000_000,
    description: 'Toko lingkungan yang memerlukan stok dan pengelolaan rutin.',
  },
  {
    id: 'craft_shop',
    name: 'Studio kerajinan',
    startupCost: 12_000_000,
    annualRevenue: 18_000_000,
    annualOperatingCosts: 12_000_000,
    description: 'Usaha kecil berbasis produk kreatif dan pesanan lokal.',
  },
];

export interface PropertyDefinition {
  id: string;
  name: string;
  type: NonNullable<CharacterAsset['propertyType']>;
  price: number;
  annualRent: number;
  annualMaintenanceCost: number;
  description: string;
}

export const propertyCatalog: PropertyDefinition[] = [
  {
    id: 'starter-home',
    name: 'Rumah sederhana',
    type: 'primary',
    price: 180_000_000,
    annualRent: 0,
    annualMaintenanceCost: 1_800_000,
    description: 'Rumah untuk ditempati; memerlukan biaya perawatan tahunan.',
  },
  {
    id: 'rental-home',
    name: 'Rumah kontrakan',
    type: 'rental',
    price: 135_000_000,
    annualRent: 11_000_000,
    annualMaintenanceCost: 2_500_000,
    description: 'Properti sewa dengan pemasukan dan biaya perawatan tahunan.',
  },
  {
    id: 'land-lot',
    name: 'Sebidang tanah',
    type: 'land',
    price: 75_000_000,
    annualRent: 0,
    annualMaintenanceCost: 600_000,
    description: 'Aset tanah tanpa pendapatan sewa otomatis.',
  },
];

const emptyBudget = (): MonthlyBudget => ({
  housing: 0,
  food: 0,
  transport: 0,
  health: 0,
  education: 0,
  leisure: 0,
});

export function createInitialEconomyRecord(): EconomyRecord {
  return {
    businesses: [],
    loans: [],
    monthlyBudget: emptyBudget(),
    monthlyBudgetYear: 2026,
    budgetConfigured: false,
    history: [],
  };
}

export function normalizeEconomyRecord(character: Character): Character {
  const record = character.economyRecord ?? createInitialEconomyRecord();
  return {
    ...character,
    economyRecord: {
      ...createInitialEconomyRecord(),
      ...record,
      businesses: record.businesses ?? [],
      loans: record.loans ?? [],
      monthlyBudget: {
        ...emptyBudget(),
        ...(record.monthlyBudget ?? {}),
      },
      monthlyBudgetYear: record.monthlyBudgetYear ?? 2026,
      budgetConfigured: record.budgetConfigured ?? false,
      history: record.history ?? [],
    },
  };
}

const finiteNonNegative = (value: number): number => (
  Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
);
const clamp = (value: number, min: number, max: number) => (
  Math.max(min, Math.min(max, Math.round(value)))
);

function calculateNetWorth(
  character: Character,
  cash: number,
  debt: number,
  assets: CharacterAsset[],
): number {
  return Math.max(
    0,
    cash + character.startingAssets.nonCashValue
      + assets.reduce((total, asset) => total + asset.value, 0)
      - debt,
  );
}

function withBalances(
  character: Character,
  values: { cash?: number; debt?: number; assets?: CharacterAsset[] },
): Character {
  const cash = finiteNonNegative(values.cash ?? character.cash);
  const debt = finiteNonNegative(values.debt ?? character.debt);
  const assets = values.assets ?? character.assets;
  return {
    ...character,
    cash,
    debt,
    assets,
    netWorth: calculateNetWorth(character, cash, debt, assets),
  };
}

function makeHistory(record: EconomyRecord, year: number, entry: string): EconomyRecord {
  return {
    ...record,
    history: [...record.history, `${year}: ${entry}`],
  };
}

export function setMonthlyBudget(
  character: Character,
  budget: MonthlyBudget,
): EconomyActionResult | null {
  const categories = budgetCategories.map((category) => category.id);
  if (categories.some((category) => !Number.isFinite(budget[category])
    || !Number.isInteger(budget[category])
    || budget[category] < 0
    || budget[category] > 100_000_000)) return null;
  const sum = categories.reduce((total, category) => total + budget[category], 0);
  if (!Number.isSafeInteger(sum)) return null;
  const characterWithEconomy = normalizeEconomyRecord(character);
  const economyRecord = makeHistory({
    ...characterWithEconomy.economyRecord,
    monthlyBudget: { ...budget },
    monthlyBudgetYear: character.currentYear,
    budgetConfigured: true,
  }, character.currentYear, `Anggaran bulanan ditetapkan sebesar ${sum}.`);
  return {
    character: { ...characterWithEconomy, economyRecord },
    historyText: `Menetapkan anggaran bulanan sebesar ${sum}.`,
  };
}

export function buyProperty(
  character: Character,
  propertyId: string,
): EconomyActionResult | null {
  const property = propertyCatalog.find((item) => item.id === propertyId);
  if (!property || character.status !== 'alive' || character.age < 18) return null;
  const existingHomes = character.assets.filter((asset) => asset.category === 'home');
  if (existingHomes.length >= 5
    || (property.type === 'primary' && existingHomes.some((asset) => asset.propertyType === 'primary'))) {
    return null;
  }
  const factor = getNominalPriceFactor(character.currentYear);
  const price = finiteNonNegative(Math.round(property.price * factor));
  if (price <= 0 || character.cash < price) return null;
  const assetId = `property-${property.id}-${character.currentYear}-${existingHomes.length + 1}`;
  const asset: CharacterAsset = {
    id: assetId,
    name: property.name,
    category: 'home',
    value: price,
    purchasePrice: price,
    acquiredYear: character.currentYear,
    propertyType: property.type,
    annualRent: finiteNonNegative(Math.round(property.annualRent * factor)),
    annualMaintenanceCost: finiteNonNegative(Math.round(property.annualMaintenanceCost * factor)),
  };
  const assets = [...character.assets, asset];
  const cash = character.cash - price;
  const characterWithEconomy = normalizeEconomyRecord(character);
  const economyRecord = makeHistory(characterWithEconomy.economyRecord, character.currentYear, `Membeli ${property.name} seharga ${price}.`);
  return {
    character: {
      ...withBalances(character, { cash, assets }),
      economyRecord,
    },
    historyText: `Membeli ${property.name}.`,
  };
}

export function sellProperty(
  character: Character,
  assetId: string,
): EconomyActionResult | null {
  const asset = character.assets.find((item) => item.id === assetId && item.category === 'home');
  if (!asset || character.status !== 'alive' || character.age < 18) return null;
  const salePrice = finiteNonNegative(Math.round(asset.value * 0.95));
  const assets = character.assets.filter((item) => item.id !== asset.id);
  const characterWithEconomy = normalizeEconomyRecord(character);
  const economyRecord = makeHistory(characterWithEconomy.economyRecord, character.currentYear, `Menjual ${asset.name} seharga ${salePrice} setelah biaya transaksi.`);
  const result = withBalances(character, { cash: character.cash + salePrice, assets });
  return {
    character: {
      ...result,
      lastYearIncome: finiteNonNegative(character.lastYearIncome + salePrice),
      economyRecord,
    },
    historyText: `Menjual ${asset.name} setelah biaya transaksi.`,
  };
}

export function invest(
  character: Character,
  amount: number,
  kind: NonNullable<CharacterAsset['investmentKind']>,
): EconomyActionResult | null {
  const investment = finiteNonNegative(amount);
  if (!Number.isSafeInteger(amount) || investment < 100_000
    || character.cash < investment || character.status !== 'alive' || character.age < 18
    || !['deposit', 'balanced_fund'].includes(kind)) return null;
  const factor = getNominalPriceFactor(character.currentYear);
  const asset: CharacterAsset = {
    id: `investment-${character.currentYear}-${character.assets.filter((item) => item.category === 'investment').length + 1}`,
    name: kind === 'deposit' ? 'Deposito berjangka' : 'Reksa dana campuran',
    category: 'investment',
    value: investment,
    purchasePrice: investment,
    acquiredYear: character.currentYear,
    investmentKind: kind,
    annualYieldRate: kind === 'deposit' ? 0.045 : 0.065,
  };
  const assets = [...character.assets, asset];
  const characterWithEconomy = normalizeEconomyRecord(character);
  const economyRecord = makeHistory(characterWithEconomy.economyRecord, character.currentYear, `Menempatkan ${investment} pada ${asset.name}.`);
  return {
    character: {
      ...withBalances(character, { cash: character.cash - investment, assets }),
      economyRecord,
    },
    historyText: `Menempatkan dana pada ${asset.name}.`,
  };
}

export function sellInvestment(
  character: Character,
  assetId: string,
): EconomyActionResult | null {
  const asset = character.assets.find((item) => item.id === assetId && item.category === 'investment');
  if (!asset || character.status !== 'alive') return null;
  const amount = finiteNonNegative(Math.round(asset.value * 0.99));
  const assets = character.assets.filter((item) => item.id !== asset.id);
  const characterWithEconomy = normalizeEconomyRecord(character);
  const economyRecord = makeHistory(characterWithEconomy.economyRecord, character.currentYear, `Mencairkan ${asset.name} sebesar ${amount} setelah biaya pencairan.`);
  return {
    character: {
      ...withBalances(character, { cash: character.cash + amount, assets }),
      lastYearExpenses: finiteNonNegative(character.lastYearExpenses + (asset.value - amount)),
      economyRecord,
    },
    historyText: `Mencairkan ${asset.name}.`,
  };
}

export function getLoanLimit(character: Character): number {
  if (character.age < 18 || character.status !== 'alive'
    || character.economyRecord?.loans.filter((loan) => loan.status === 'active').length >= 3) return 0;
  const annualSalary = character.careerRecord.status === 'employed'
    ? character.careerRecord.monthlySalary * 12
    : 0;
  const supportable = annualSalary * 1.5 + Math.max(0, character.netWorth) * 0.1;
  return finiteNonNegative(Math.min(250_000_000, supportable));
}

export function takeLoan(
  character: Character,
  amount: number,
  purpose: LoanRecord['purpose'],
): EconomyActionResult | null {
  const principal = finiteNonNegative(amount);
  const current = normalizeEconomyRecord(character);
  if (!Number.isSafeInteger(amount) || principal < 1_000_000
    || principal > getLoanLimit(current)
    || !['personal', 'business', 'property'].includes(purpose)) return null;
  const originationFee = Math.round(principal * 0.02);
  const termYears = 5;
  const annualInterestRate = 0.09;
  const annualPayment = Math.ceil((principal * (1 + annualInterestRate * termYears)) / termYears);
  const loan: LoanRecord = {
    id: `loan-${character.currentYear}-${current.economyRecord.loans.length + 1}`,
    name: purpose === 'personal' ? 'Pinjaman pribadi' : purpose === 'business' ? 'Pinjaman usaha' : 'Pinjaman properti',
    purpose,
    principal,
    balance: principal,
    annualInterestRate,
    annualPayment,
    termYears,
    startedYear: character.currentYear,
    status: 'active',
    history: [`${character.currentYear}: Pinjaman disetujui; biaya administrasi ${originationFee}.`],
  };
  const economyRecord = makeHistory({
    ...current.economyRecord,
    loans: [...current.economyRecord.loans, loan],
  }, character.currentYear, `Menerima pinjaman ${principal} dengan biaya administrasi ${originationFee}.`);
  return {
    character: {
      ...withBalances(current, {
        cash: character.cash + principal - originationFee,
        debt: character.debt + principal,
      }),
      lastYearExpenses: finiteNonNegative(character.lastYearExpenses + originationFee),
      economyRecord,
    },
    historyText: `Mengambil pinjaman ${loan.name.toLowerCase()} sebesar ${principal}.`,
  };
}

export function repayLoan(
  character: Character,
  loanId: string,
  requestedAmount: number,
): EconomyActionResult | null {
  const amount = finiteNonNegative(requestedAmount);
  const current = normalizeEconomyRecord(character);
  const loan = current.economyRecord.loans.find((item) => item.id === loanId && item.status === 'active');
  if (!loan || !Number.isSafeInteger(requestedAmount) || amount <= 0
    || amount > character.cash || amount > loan.balance) return null;
  const balance = loan.balance - amount;
  const updatedLoan: LoanRecord = {
    ...loan,
    balance,
    status: balance === 0 ? 'paid' : 'active',
    history: [...loan.history, `${character.currentYear}: Membayar ${amount}; sisa ${balance}.`],
  };
  const economyRecord = makeHistory({
    ...current.economyRecord,
    loans: current.economyRecord.loans.map((item) => item.id === loanId ? updatedLoan : item),
  }, character.currentYear, `Membayar ${amount} untuk ${loan.name}.`);
  return {
    character: {
      ...withBalances(current, { cash: character.cash - amount, debt: Math.max(0, character.debt - amount) }),
      lastYearExpenses: finiteNonNegative(character.lastYearExpenses + amount),
      economyRecord,
    },
    historyText: `Membayar pinjaman ${loan.name} sebesar ${amount}.`,
  };
}

export function startBusiness(
  character: Character,
  kind: BusinessKind,
  name: string,
): EconomyActionResult | null {
  const definition = businessCatalog.find((item) => item.id === kind);
  const cleanName = name.trim();
  if (!definition || cleanName.length < 2 || cleanName.length > 40
    || character.status !== 'alive' || character.age < 18) return null;
  const current = normalizeEconomyRecord(character);
  if (current.economyRecord.businesses.filter((business) => business.status === 'active').length >= 3) return null;
  const factor = getNominalPriceFactor(character.currentYear);
  const investment = finiteNonNegative(Math.round(definition.startupCost * factor));
  if (character.cash < investment) return null;
  const id = `business-${character.currentYear}-${current.economyRecord.businesses.length + 1}`;
  const assetId = `business-asset-${id}`;
  const asset: CharacterAsset = {
    id: assetId,
    name: cleanName,
    category: 'business',
    value: investment,
    purchasePrice: investment,
    acquiredYear: character.currentYear,
  };
  const business: BusinessRecord = {
    id,
    name: cleanName,
    kind,
    assetId,
    startedYear: character.currentYear,
    initialInvestment: investment,
    annualRevenue: definition.annualRevenue,
    annualOperatingCosts: definition.annualOperatingCosts,
    stability: 50 + Math.round(character.stats.intelligence * 0.2 + character.stats.reputation * 0.1),
    status: 'active',
    history: [`${character.currentYear}: Usaha dibuka dengan modal ${investment}.`],
  };
  const economyRecord = makeHistory({
    ...current.economyRecord,
    businesses: [...current.economyRecord.businesses, business],
  }, character.currentYear, `Membuka ${cleanName}.`);
  const assets = [...character.assets, asset];
  return {
    character: {
      ...withBalances(current, { cash: character.cash - investment, assets }),
      lastYearExpenses: finiteNonNegative(character.lastYearExpenses + investment),
      economyRecord,
    },
    historyText: `Membuka usaha ${cleanName}.`,
  };
}

export function closeBusiness(
  character: Character,
  businessId: string,
): EconomyActionResult | null {
  const current = normalizeEconomyRecord(character);
  const business = current.economyRecord.businesses.find((item) => item.id === businessId && item.status === 'active');
  if (!business || character.status !== 'alive') return null;
  const asset = character.assets.find((item) => item.id === business.assetId);
  const recoveredValue = finiteNonNegative(Math.round((asset?.value ?? 0) * 0.6));
  const businesses = current.economyRecord.businesses.map((item) => item.id === businessId
    ? { ...item, status: 'closed' as const, history: [...item.history, `${character.currentYear}: Usaha ditutup; nilai aset yang dipulihkan ${recoveredValue}.`] }
    : item);
  const assets = asset
    ? character.assets.map((item) => item.id === asset.id ? { ...item, value: recoveredValue } : item)
    : character.assets;
  const characterWithEconomy = normalizeEconomyRecord(character);
  const economyRecord = makeHistory({ ...characterWithEconomy.economyRecord, businesses }, character.currentYear, `Menutup usaha ${business.name}.`);
  const result = withBalances(character, { cash: character.cash + recoveredValue, assets: assets.filter((item) => item.id !== business.assetId) });
  return {
    character: { ...result, economyRecord },
    historyText: `Menutup usaha ${business.name} dan memulihkan sebagian nilai aset.`,
  };
}

function processEconomyPeriod(
  source: Character,
  random: () => number = Math.random,
  periodMonths = 12,
  month = 12,
): EconomyYearResult {
  const character = normalizeEconomyRecord(source);
  const periodFraction = periodMonths / 12;
  const periodLabel = periodMonths === 12
    ? `${character.currentYear}`
    : `${character.currentYear}-${String(month).padStart(2, '0')}`;
  const record = character.economyRecord;
  const assets = character.assets.map((asset) => ({ ...asset }));
  const businesses = record.businesses.map((business) => ({ ...business, history: [...business.history] }));
  const loans = record.loans.map((loan) => ({ ...loan, history: [...loan.history] }));
  const historyEntries: string[] = [];
  let income = 0;
  let expenses = 0;

  for (const asset of assets) {
    if (asset.category === 'home') {
      const inflation = asset.acquiredYear
        ? getNominalPriceFactor(character.currentYear) / getNominalPriceFactor(asset.acquiredYear)
        : 1;
      const rent = finiteNonNegative(Math.round((asset.annualRent ?? 0) * inflation * periodFraction));
      const maintenance = finiteNonNegative(Math.round((asset.annualMaintenanceCost ?? 0) * inflation * periodFraction));
      income += rent;
      expenses += maintenance;
      if (rent > 0) historyEntries.push(`${periodLabel}: Properti ${asset.name} menghasilkan sewa ${rent}.`);
      if (maintenance > 0) historyEntries.push(`${periodLabel}: Perawatan ${asset.name} menelan biaya ${maintenance}.`);
      const appreciation = asset.propertyType === 'land' ? 0.035 : 0.025;
      asset.value = finiteNonNegative(Math.round(asset.value * ((1 + appreciation) ** periodFraction)));
    }
    if (asset.category === 'investment') {
      const yieldRate = asset.annualYieldRate ?? 0;
      const rawRoll = random();
      const roll = Number.isFinite(rawRoll) ? clamp(rawRoll * 10000, 0, 9999) / 10000 : 0.5;
      const expectedRate = (1 + yieldRate) ** periodFraction - 1;
      const volatility = 0.18 * Math.sqrt(periodFraction);
      const rate = asset.investmentKind === 'balanced_fund'
        ? clamp(Math.round((expectedRate + (roll - 0.5) * volatility) * 10000), -3000, 2000) / 10000
        : expectedRate;
      const change = Math.round(asset.value * rate);
      asset.value = finiteNonNegative(asset.value + change);
      historyEntries.push(`${periodLabel}: Nilai ${asset.name} ${change >= 0 ? 'bertambah' : 'berkurang'} ${Math.abs(change)}.`);
    }
    if (asset.category === 'device' || asset.category === 'creator_gear') {
      const annualDepreciation = asset.category === 'device' ? 0.18 : 0.1;
      asset.value = finiteNonNegative(Math.round(
        asset.value * ((1 - annualDepreciation) ** periodFraction),
      ));
    }
  }

  for (const business of businesses) {
    if (business.status !== 'active') continue;
    const rawRoll = random();
    const roll = Number.isFinite(rawRoll) ? Math.max(0, Math.min(0.999999, rawRoll)) : 0.5;
    const marketFactor = 0.8 + roll * 0.4;
    const inflation = getNominalPriceFactor(character.currentYear)
      / getNominalPriceFactor(business.startedYear);
    const revenue = finiteNonNegative(Math.round(business.annualRevenue * inflation * marketFactor * periodFraction));
    const operatingCosts = finiteNonNegative(Math.round(business.annualOperatingCosts * inflation * periodFraction));
    const profit = revenue - operatingCosts;
    income += revenue;
    expenses += operatingCosts;
    if (periodMonths === 12 || month === 12) {
      business.stability = clamp(business.stability + (profit >= 0 ? 1 : -2), 0, 100);
    }
    business.history.push(`${periodLabel}: Pemasukan ${revenue}, biaya operasional ${operatingCosts}, hasil bersih ${profit}.`);
    const businessAsset = assets.find((asset) => asset.id === business.assetId);
    if (businessAsset) {
      businessAsset.value = finiteNonNegative(Math.round(businessAsset.value * 0.97));
    }
    historyEntries.push(`${periodLabel}: ${business.name} mencatat hasil bersih ${profit}.`);
  }

  let debt = character.debt;
  let availableForLoanPayments = Math.max(0, character.cash + income - expenses);
  for (const loan of loans) {
    if (loan.status !== 'active') continue;
    const interestRate = (1 + loan.annualInterestRate) ** periodFraction - 1;
    const interest = Math.ceil(loan.balance * interestRate);
    const due = Math.min(loan.balance + interest, Math.ceil(loan.annualPayment * periodFraction));
    const payment = Math.min(due, availableForLoanPayments);
    availableForLoanPayments -= payment;
    loan.balance = Math.max(0, loan.balance + interest - payment);
    debt = Math.max(0, debt + interest - payment);
    expenses += payment;
    if (payment > 0) {
      loan.history.push(`${periodLabel}: Pembayaran ${payment}; bunga ${interest}; sisa ${loan.balance}.`);
    }
    if (loan.balance === 0) {
      loan.status = 'paid';
      historyEntries.push(`${periodLabel}: Pinjaman ${loan.name} lunas.`);
    } else {
      historyEntries.push(`${periodLabel}: Pembayaran pinjaman ${loan.name} sebesar ${payment}; bunga ${interest}.`);
    }
  }

  const cash = finiteNonNegative(character.cash + income - expenses);
  const economyRecord = {
    ...record,
    businesses,
    loans,
    history: [...record.history, ...historyEntries],
  };
  const nextCharacter = withBalances(character, { cash, debt, assets });
  return {
    character: {
      ...nextCharacter,
      economyRecord,
      lastYearIncome: finiteNonNegative(character.lastYearIncome + income),
      lastYearExpenses: finiteNonNegative(character.lastYearExpenses + expenses),
    },
    income,
    expenses,
    historyEntries,
  };
}

export function processEconomyYear(
  character: Character,
  random: () => number = Math.random,
): EconomyYearResult {
  return processEconomyPeriod(character, random);
}

export function processEconomyMonth(
  character: Character,
  month: number,
  random: () => number = Math.random,
): EconomyYearResult {
  return processEconomyPeriod(character, random, 1, month);
}
