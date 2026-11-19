import type {
  CareerChange,
  CareerHistoryEntry,
  CareerRecord,
  Character,
  JobApplication,
  Occupation,
} from '../types/game';
import { getOccupation, occupations } from '../data/careerCatalog';
import { educationCountries } from '../data/educationCatalog';
import { getNominalPriceFactor } from './worldEra';

export interface CareerActionResult {
  character: Character;
  historyText: string;
}

export interface AnnualCareerResult {
  character: Character;
  income: number;
  expenses: number;
  historyEntries: string[];
}

export interface MonthlyCareerResult {
  character: Character;
  income: number;
  expenses: number;
  historyEntries: string[];
}

function appendCareerHistory(
  record: CareerRecord,
  entry: CareerHistoryEntry,
): CareerRecord {
  if (record.history.some((item) => item.id === entry.id)) return record;
  return { ...record, history: [...record.history, entry] };
}

export function createInitialCareerRecord(): CareerRecord {
  return {
    status: 'unemployed',
    currentOccupationId: null,
    employerId: null,
    positionIndex: 0,
    experienceYears: 0,
    monthlySalary: 0,
    satisfaction: 50,
    professionalReputation: 0,
    promotionCooldownUntil: 0,
    applications: [],
    history: [],
  };
}

export function createCareerRecordFromLegacy(
  legacyOccupation?: string | null,
  currentYear = 2026,
): CareerRecord {
  const record = createInitialCareerRecord();
  if (!legacyOccupation) return record;
  if (legacyOccupation === 'Pensiun') return { ...record, status: 'retired' };
  const occupationId = legacyOccupation === 'Pekerja pemula'
    ? 'entry-worker'
    : legacyOccupation === 'Pemilik usaha kecil'
      ? 'entrepreneur'
      : occupations.find((occupation) => occupation.name === legacyOccupation)?.id;
  const occupation = getOccupation(occupationId ?? null);
  if (!occupation) return record;
  return {
    ...record,
    status: 'employed',
    currentOccupationId: occupation.id,
    employerId: `${occupation.id}-employer-0`,
    monthlySalary: Math.round(occupation.monthlySalary * getNominalPriceFactor(currentYear)),
    satisfaction: 60,
    professionalReputation: 10,
    history: [{
      id: `${currentYear}:legacy-employment`,
      year: currentYear,
      type: 'application',
      occupationId: occupation.id,
      title: occupation.titles[0],
      details: 'Pekerjaan lama dipertahankan saat migrasi data.',
    }],
  };
}

function hasQualifications(character: Character, occupation: Occupation): boolean {
  const record = character.educationRecord;
  const hasLevel = occupation.requiredLevels.length === 0
    || occupation.requiredLevels.some((level) => record.completedLevels.includes(level));
  const hasProgram = !occupation.requiredProgramIds
    || occupation.requiredProgramIds.some((id) => (
      record.degrees.some((degree) => degree.programId === id)
    ));
  return character.age >= occupation.minimumAge
    && character.birthInformation.location.countryCode === occupation.countryCode
    && hasLevel
    && hasProgram
    && character.careerRecord.experienceYears >= occupation.minimumExperienceYears
    && Math.max(character.stats.reputation, character.careerRecord.professionalReputation)
      >= occupation.minimumReputation;
}

export function getEligibleOccupations(character: Character): Occupation[] {
  if (character.careerRecord.status === 'employed' || character.careerRecord.status === 'retired') return [];
  return occupations.filter((occupation) => hasQualifications(character, occupation));
}

function deterministicScore(character: Character, occupation: Occupation): number {
  const stats = character.stats;
  const educationBonus = character.educationRecord.completedLevels.length * 2;
  const score = stats.intelligence * 0.2
    + stats.health * 0.12
    + stats.energy * 0.13
    + stats.happiness * 0.1
    + stats.reputation * 0.15
    + Math.min(20, character.careerRecord.experienceYears * 2)
    + educationBonus;
  const seed = `${character.id}:${occupation.id}:${character.currentYear}`;
  const hash = Array.from(seed).reduce((value, char) => (
    (value * 31 + char.charCodeAt(0)) % 997
  ), 7);
  const variation = (hash % 13) - 6;
  return Math.max(0, Math.min(100, Math.round(score + variation)));
}

function getEmployerId(occupation: Occupation, character: Character): string {
  const index = Array.from(character.id).reduce((value, char) => value + char.charCodeAt(0), 0)
    % occupation.fictionalEmployerNames.length;
  return `${occupation.id}-employer-${index}`;
}

export function applyForOccupation(
  character: Character,
  occupationId: string,
): CareerActionResult | null {
  const occupation = getOccupation(occupationId);
  if (!occupation || !getEligibleOccupations(character).some((item) => item.id === occupationId)) return null;
  const existing = character.careerRecord.applications.some((application) => (
    application.occupationId === occupationId
    && application.year === character.currentYear
  ));
  if (existing) return null;

  const score = deterministicScore(character, occupation);
  const application: JobApplication = {
    id: `${occupation.id}:${character.currentYear}`,
    occupationId: occupation.id,
    year: character.currentYear,
    status: score >= 55 ? 'offered' : 'rejected',
    score,
    offeredMonthlySalary: Math.round(
      occupation.monthlySalary * getNominalPriceFactor(character.currentYear),
    ),
    employerId: getEmployerId(occupation, character),
  };
  const applications = [...character.careerRecord.applications, application];
  const historyText = application.status === 'offered'
    ? `Mendapat tawaran sebagai ${occupation.name}.`
    : `Lamaran untuk ${occupation.name} belum berhasil.`;
  const historyEntry: CareerHistoryEntry = {
    id: `application:${application.id}`,
    year: character.currentYear,
    type: 'hired',
    occupationId: occupation.id,
    title: occupation.name,
    details: application.status === 'offered' ? 'Tawaran menunggu keputusan.' : 'Seleksi belum berhasil.',
  };
  return {
    character: {
      ...character,
      careerRecord: appendCareerHistory({
        ...character.careerRecord,
        applications,
      }, historyEntry),
    },
    historyText,
  };
}

export function acceptJobOffer(
  character: Character,
  applicationId: string,
): CareerActionResult | null {
  const application = character.careerRecord.applications.find((item) => item.id === applicationId);
  const occupation = application ? getOccupation(application.occupationId) : null;
  if (!application || !occupation || application.status !== 'offered'
    || character.careerRecord.status === 'employed'
    || character.careerRecord.status === 'retired') return null;
  const year = character.currentYear;
  const historyEntry: CareerHistoryEntry = {
    id: `hired:${application.id}`,
    year,
    type: 'hired',
    occupationId: occupation.id,
    title: occupation.titles[0],
    details: `Mulai bekerja sebagai ${occupation.name}.`,
    monthlySalary: application.offeredMonthlySalary,
  };
  const careerRecord = appendCareerHistory({
    ...character.careerRecord,
    status: 'employed',
    currentOccupationId: occupation.id,
    employerId: application.employerId,
    positionIndex: 0,
    monthlySalary: application.offeredMonthlySalary,
    satisfaction: 70,
    professionalReputation: Math.max(10, character.stats.reputation),
    applications: character.careerRecord.applications.map((item) => (
      item.id === application.id ? { ...item, status: 'accepted' } : item
    )),
  }, historyEntry);
  return {
    character: { ...character, careerRecord },
    historyText: `Menerima pekerjaan ${occupation.name}.`,
  };
}

export function declineJobOffer(
  character: Character,
  applicationId: string,
): CareerActionResult | null {
  const application = character.careerRecord.applications.find((item) => item.id === applicationId);
  if (!application || application.status !== 'offered') return null;
  const occupation = getOccupation(application.occupationId);
  return {
    character: {
      ...character,
      careerRecord: {
        ...character.careerRecord,
        applications: character.careerRecord.applications.map((item) => (
          item.id === applicationId ? { ...item, status: 'declined' } : item
        )),
      },
    },
    historyText: `Menolak tawaran pekerjaan ${occupation?.name ?? ''}.`.trim(),
  };
}

export function applyCareerChange(
  character: Character,
  change: CareerChange,
): Character {
  const current = character.careerRecord;
  const year = character.currentYear;
  if (change.type === 'hire') {
    const occupation = getOccupation(change.occupationId);
    if (!occupation || current.status === 'employed' || current.status === 'retired'
      || !hasQualifications(character, occupation)) return character;
    const nominalSalary = Math.round(occupation.monthlySalary * getNominalPriceFactor(year));
    const monthlySalary = Number.isFinite(change.monthlySalary)
      ? Math.max(0, Math.round(change.monthlySalary!))
      : nominalSalary;
    const careerRecord = appendCareerHistory({
      ...current,
      status: 'employed',
      currentOccupationId: occupation.id,
      employerId: change.employerId ?? `${occupation.id}-employer-0`,
      positionIndex: 0,
      monthlySalary,
      satisfaction: Math.max(current.satisfaction, 60),
    }, {
      id: `hire:${occupation.id}:${year}`,
      year,
      type: 'hired',
      occupationId: occupation.id,
      title: occupation.titles[0],
      details: `Mulai bekerja sebagai ${occupation.name}.`,
      monthlySalary,
    });
    return { ...character, careerRecord };
  }
  if (change.type === 'bonus') {
    if (current.status !== 'employed' || !current.currentOccupationId) return character;
    const occupation = getOccupation(current.currentOccupationId);
    if (!occupation) return character;
    const amount = Number.isFinite(change.amount) ? Math.max(0, Math.round(change.amount)) : 0;
    const careerRecord = appendCareerHistory(current, {
      id: `bonus:${occupation.id}:${year}:${amount}`,
      year,
      type: 'bonus',
      occupationId: occupation.id,
      title: occupation.titles[current.positionIndex],
      details: 'Menerima bonus kerja simulasi.',
    });
    return {
      ...character,
      cash: character.cash + amount,
      netWorth: character.netWorth + amount,
      lastYearIncome: character.lastYearIncome + amount,
      careerRecord,
    };
  }
  if (change.type === 'raise') {
    if (current.status !== 'employed' || !current.currentOccupationId) return character;
    const occupation = getOccupation(current.currentOccupationId);
    if (!occupation) return character;
    const percent = Number.isFinite(change.percent) ? Math.max(0, Math.min(0.5, change.percent)) : 0;
    const monthlySalary = Math.round(current.monthlySalary * (1 + percent));
    return {
      ...character,
      careerRecord: appendCareerHistory({
        ...current,
        monthlySalary,
        satisfaction: Math.min(100, current.satisfaction + 3),
      }, {
        id: `raise:${occupation.id}:${year}:${monthlySalary}`,
        year,
        type: 'salary_change',
        occupationId: occupation.id,
        title: occupation.titles[current.positionIndex],
        details: 'Mendapat kenaikan gaji.',
        monthlySalary,
      }),
    };
  }
  if (!current.currentOccupationId) return character;
  const occupation = getOccupation(current.currentOccupationId);
  if (!occupation) return character;
  if (change.type === 'promote') {
    if (current.status !== 'employed') return character;
    const nextPosition = Math.min(current.positionIndex + 1, occupation.titles.length - 1);
    if (nextPosition === current.positionIndex) return character;
    const monthlySalary = change.monthlySalary ?? Math.round(current.monthlySalary * 1.15);
    return {
      ...character,
      careerRecord: appendCareerHistory({
        ...current,
        positionIndex: nextPosition,
        monthlySalary,
        satisfaction: Math.min(100, current.satisfaction + 5),
        professionalReputation: Math.min(100, current.professionalReputation + 3),
        promotionCooldownUntil: year + occupation.promotionAfterYears,
      }, {
        id: `promotion:${occupation.id}:${year}:${nextPosition}`,
        year,
        type: 'promotion',
        occupationId: occupation.id,
        title: occupation.titles[nextPosition],
        details: `Naik jabatan menjadi ${occupation.titles[nextPosition]}.`,
        monthlySalary,
      }),
    };
  }
  if (change.type === 'salary_change') {
    if (current.status !== 'employed') return character;
    const monthlySalary = Math.max(0, Math.round(change.monthlySalary));
    return {
      ...character,
      careerRecord: appendCareerHistory({
        ...current,
        monthlySalary,
        satisfaction: Math.min(100, current.satisfaction + 2),
      }, {
        id: `salary:${occupation.id}:${year}:${monthlySalary}`,
        year,
        type: 'salary_change',
        occupationId: occupation.id,
        title: occupation.titles[current.positionIndex],
        details: 'Perubahan gaji tercatat.',
        monthlySalary,
      }),
    };
  }

  const status = change.type === 'layoff'
    ? 'laid_off'
    : change.type === 'retire'
      ? 'retired'
      : 'unemployed';
  const type: CareerHistoryEntry['type'] = change.type === 'retire'
    ? 'retirement'
    : change.type === 'resign'
      ? 'resignation'
      : 'layoff';
  const actionText = change.type === 'layoff'
    ? 'Mengalami PHK.'
    : change.type === 'retire'
      ? 'Memulai masa pensiun.'
      : 'Mengundurkan diri dari pekerjaan.';
  return {
    ...character,
    careerRecord: appendCareerHistory({
      ...current,
      status,
      currentOccupationId: change.type === 'retire' ? current.currentOccupationId : null,
      employerId: null,
      monthlySalary: 0,
      satisfaction: change.type === 'layoff' ? Math.max(0, current.satisfaction - 10) : current.satisfaction,
    }, {
      id: `${change.type}:${occupation.id}:${year}`,
      year,
      type,
      occupationId: occupation.id,
      title: occupation.titles[current.positionIndex],
      details: actionText,
    }),
  };
}

export function canReceivePromotion(character: Character): boolean {
  const record = character.careerRecord;
  const occupation = getOccupation(record.currentOccupationId);
  return record.status === 'employed'
    && !!occupation
    && record.positionIndex < occupation.titles.length - 1
    && record.experienceYears >= occupation.promotionAfterYears
    && character.currentYear >= record.promotionCooldownUntil;
}

export function processAnnualCareer(character: Character): AnnualCareerResult {
  const record = character.careerRecord;
  const occupation = getOccupation(record.currentOccupationId);
  const economyRecord = character.economyRecord;
  const monthlyBudget = Object.values(economyRecord?.monthlyBudget ?? {})
    .reduce((total, amount) => total + (Number.isFinite(amount) ? Math.max(0, amount) : 0), 0);
  const plannedAnnualBudget = economyRecord?.budgetConfigured
    ? Math.round(monthlyBudget * 12 * (
      getNominalPriceFactor(character.currentYear)
      / getNominalPriceFactor(economyRecord.monthlyBudgetYear ?? character.currentYear)
    ))
    : null;
  if (record.status !== 'employed' || !occupation || record.monthlySalary <= 0) {
    const expenses = plannedAnnualBudget ?? 0;
    const cash = Math.max(0, character.cash - expenses);
    const netChange = cash - character.cash;
    return {
      character: {
        ...character,
        cash,
        netWorth: Math.max(0, character.netWorth + netChange),
        lastYearIncome: 0,
        lastYearExpenses: expenses,
        stats: {
          ...character.stats,
          wealth: Math.max(0, Math.min(100, character.stats.wealth + (expenses > 0 ? -1 : 0))),
        },
      },
      income: 0,
      expenses,
      historyEntries: expenses > 0
        ? [`${character.currentYear}: Anggaran rumah tangga menghabiskan ${expenses}.`]
        : [],
    };
  }

  const income = Math.max(0, Math.round(record.monthlySalary * 12));
  const country = educationCountries[character.birthInformation.location.countryCode];
  const tax = Math.round(income * (country?.taxRate ?? 0));
  const livingExpenses = plannedAnnualBudget ?? Math.round(income * 0.48);
  const expenses = tax + livingExpenses;
  const netChange = income - expenses;
  const nextSalary = Math.round(record.monthlySalary * 1.045);
  const satisfactionShift = (
    character.stats.happiness - 50
    + character.stats.energy - 50
    + character.stats.health - 50
  ) / 60;
  const careerRecord: CareerRecord = appendCareerHistory({
    ...record,
    experienceYears: record.experienceYears + 1,
    monthlySalary: nextSalary,
    satisfaction: Math.max(0, Math.min(100, Math.round(record.satisfaction + satisfactionShift))),
    professionalReputation: Math.max(0, Math.min(100, record.professionalReputation + (
      character.stats.reputation >= 60 ? 1 : 0
    ))),
  }, {
    id: `annual-experience:${occupation.id}:${character.currentYear}`,
    year: character.currentYear,
    type: 'experience',
    occupationId: occupation.id,
    title: occupation.titles[record.positionIndex],
    details: 'Pengalaman kerja bertambah satu tahun.',
    monthlySalary: nextSalary,
  });
  const characterResult: Character = {
    ...character,
    cash: Math.max(0, character.cash + netChange),
    netWorth: Math.max(0, character.netWorth + netChange),
    lastYearIncome: income,
    lastYearExpenses: expenses,
    stats: {
      ...character.stats,
      wealth: Math.max(0, Math.min(100, character.stats.wealth + (netChange >= 0 ? 1 : -1))),
    },
    careerRecord,
  };
  return {
    character: characterResult,
    income,
    expenses,
    historyEntries: [`${character.currentYear}: Bekerja sebagai ${occupation.name}; pengalaman kerja bertambah.`],
  };
}

export function processMonthlyCareer(
  character: Character,
  month: number,
): MonthlyCareerResult {
  const record = character.careerRecord;
  const occupation = getOccupation(record.currentOccupationId);
  const economyRecord = character.economyRecord;
  const configuredBudget = economyRecord?.budgetConfigured
    ? Object.values(economyRecord.monthlyBudget ?? {}).reduce(
      (total, amount) => total + (Number.isFinite(amount) ? Math.max(0, amount) : 0),
      0,
    ) * (
      getNominalPriceFactor(character.currentYear)
      / getNominalPriceFactor(economyRecord.monthlyBudgetYear ?? character.currentYear)
    )
    : null;
  const budgetScale = economyRecord?.budgetConfigured
    ? getNominalPriceFactor(character.currentYear)
      / getNominalPriceFactor(economyRecord.monthlyBudgetYear ?? character.currentYear)
    : 1;
  const income = record.status === 'employed' && occupation
    ? Math.max(0, Math.round(record.monthlySalary))
    : 0;
  const country = educationCountries[character.birthInformation.location.countryCode];
  const tax = Math.round(income * (country?.taxRate ?? 0));
  const livingExpenses = Math.round(configuredBudget ?? income * 0.48);
  const expenses = tax + livingExpenses;
  const netChange = income - expenses;
  const historyEntries: string[] = [];
  let careerRecord = record;
  const stats = { ...character.stats };

  if (month % 3 === 0 && occupation && record.status === 'employed') {
    if (occupation.workHoursPerWeek > 40) stats.energy = Math.max(0, stats.energy - 1);
    if (record.satisfaction >= 75) stats.happiness = Math.min(100, stats.happiness + 1);
    if (record.satisfaction <= 30) stats.happiness = Math.max(0, stats.happiness - 1);
  }
  if (month % 3 === 0 && economyRecord?.budgetConfigured
    && character.cash + income >= expenses) {
    const budget = economyRecord.monthlyBudget;
    if (budget.food + budget.health >= 250_000 * budgetScale) {
      stats.health = Math.min(100, stats.health + 1);
    }
    if (budget.education >= 100_000 * budgetScale) {
      stats.intelligence = Math.min(100, stats.intelligence + 1);
    }
    if (budget.leisure >= 100_000 * budgetScale) {
      stats.happiness = Math.min(100, stats.happiness + 1);
    }
  }
  if (month === 12) {
    if (record.status === 'employed' && occupation) {
      const nextSalary = Math.round(record.monthlySalary * 1.045);
      careerRecord = appendCareerHistory({
        ...record,
        experienceYears: record.experienceYears + 1,
        monthlySalary: nextSalary,
        satisfaction: Math.max(0, Math.min(100, Math.round(record.satisfaction + (
          character.stats.happiness - 50
          + character.stats.energy - 50
          + character.stats.health - 50
        ) / 60))),
        professionalReputation: Math.max(0, Math.min(100, record.professionalReputation + (
          character.stats.reputation >= 60 ? 1 : 0
        ))),
      }, {
        id: `annual-experience:${occupation.id}:${character.currentYear}`,
        year: character.currentYear,
        type: 'experience',
        occupationId: occupation.id,
        title: occupation.titles[record.positionIndex],
        details: 'Pengalaman kerja bertambah satu tahun.',
        monthlySalary: nextSalary,
      });
      historyEntries.push(`${character.currentYear}: Pengalaman kerja bertambah satu tahun.`);
    }
  }

  const nextCharacter: Character = {
    ...character,
    cash: Math.max(0, character.cash + netChange),
    netWorth: Math.max(0, character.netWorth + netChange),
    lastYearIncome: Math.max(0, character.lastYearIncome + income),
    lastYearExpenses: Math.max(0, character.lastYearExpenses + expenses),
    careerRecord,
    stats,
  };
  const date = `${character.currentYear}-${String(month).padStart(2, '0')}`;
  if (income > 0) historyEntries.push(`${date}: Gaji ${income}, pajak dan pengeluaran ${expenses}.`);
  else if (expenses > 0) historyEntries.push(`${date}: Pengeluaran rumah tangga ${expenses}.`);

  return { character: nextCharacter, income, expenses, historyEntries };
}
