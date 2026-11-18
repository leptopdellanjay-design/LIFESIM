import { getFamilyBackground } from '../data/familyBackgrounds';
import { getCountry, isSupportedLocation } from '../data/locations';
import type {
  AvatarId,
  BirthEvent,
  Character,
  CharacterDraft,
  CharacterStats,
  Family,
  FamilyBackgroundTier,
  FamilyMember,
  FamilyMemberRole,
  FamilyMemberStatus,
  ParentCondition,
  PersonalityTrait,
} from '../types/game';
import { createInitialCareerRecord } from './careerEngine';
import { createInitialEducationRecord } from './educationEngine';
import { getNominalPriceFactor } from './worldEra';
import { createInitialEconomyRecord } from './economyEngine';

export type DraftField = keyof CharacterDraft;
export type DraftErrors = Partial<Record<DraftField, string>>;

const supportedGenders = new Set(['male', 'female', 'other']);
const supportedAvatars = new Set<AvatarId>(['leaf', 'sunrise', 'ocean', 'earth']);
const supportedBackgrounds = new Set<FamilyBackgroundTier>([
  'very_poor', 'poor', 'modest', 'middle', 'affluent', 'wealthy',
]);
const supportedParentConditions = new Set<ParentCondition>([
  'both_alive', 'father_only', 'mother_only', 'both_deceased', 'guardian',
]);
const supportedTraits = new Set<PersonalityTrait>([
  'brave', 'shy', 'intelligent', 'ambitious', 'friendly', 'short_tempered',
  'disciplined', 'lazy', 'creative', 'lucky',
]);

export const initialCharacterDraft: CharacterDraft = {
  firstName: '',
  lastName: '',
  gender: '',
  birthDate: '',
  avatarId: 'leaf',
  countryCode: 'ID',
  province: 'Sumatera Barat',
  city: 'Padang',
  familyBackground: '',
  parentCondition: '',
  siblingCount: 0,
  personalityTraits: [],
};

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateCharacterDraft(
  draft: CharacterDraft,
  today = new Date(),
): DraftErrors {
  const errors: DraftErrors = {};
  const currentDate = localDateString(today);
  const birthYear = Number(draft.birthDate.slice(0, 4));

  if (!draft.firstName.trim()) errors.firstName = 'Nama depan wajib diisi.';
  if (!draft.lastName.trim()) errors.lastName = 'Nama belakang wajib diisi.';
  if (!supportedGenders.has(draft.gender)) errors.gender = 'Pilih jenis kelamin.';
  if (!supportedAvatars.has(draft.avatarId)) errors.avatarId = 'Pilih avatar karakter.';

  if (!isRealDate(draft.birthDate)) {
    errors.birthDate = 'Masukkan tanggal lahir yang valid.';
  } else if (birthYear < 1900) {
    errors.birthDate = 'Tahun lahir harus 1900 atau lebih baru.';
  } else if (draft.birthDate > currentDate) {
    errors.birthDate = 'Tanggal lahir tidak boleh berada di masa depan.';
  } else if (birthYear > today.getFullYear()) {
    errors.birthDate = `Tahun lahir harus antara 1900 dan ${today.getFullYear()}.`;
  }

  if (!isSupportedLocation(draft.countryCode, draft.province, draft.city)) {
    errors.city = 'Pilih kota yang tersedia di provinsi tersebut.';
  }
  if (!draft.province) errors.province = 'Pilih provinsi.';
  if (!supportedBackgrounds.has(draft.familyBackground as FamilyBackgroundTier)) {
    errors.familyBackground = 'Pilih latar belakang keluarga.';
  }
  if (!supportedParentConditions.has(draft.parentCondition as ParentCondition)) {
    errors.parentCondition = 'Pilih kondisi orang tua.';
  }
  if (!Number.isInteger(draft.siblingCount) || draft.siblingCount < 0 || draft.siblingCount > 4) {
    errors.siblingCount = 'Jumlah saudara harus antara 0 dan 4.';
  }
  if (draft.personalityTraits.length < 1 || draft.personalityTraits.length > 3) {
    errors.personalityTraits = 'Pilih satu sampai tiga sifat.';
  } else if (new Set(draft.personalityTraits).size !== draft.personalityTraits.length
    || draft.personalityTraits.some((trait) => !supportedTraits.has(trait))) {
    errors.personalityTraits = 'Pilihan sifat tidak valid.';
  }

  return errors;
}

function clampStat(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function createFamily(
  condition: ParentCondition,
  siblingCount: number,
  backgroundLabel: string,
  birthYear: number,
  parentEstateCash: number,
): Family {
  const parentStatus: Record<ParentCondition, { father: FamilyMemberStatus; mother: FamilyMemberStatus }> = {
    both_alive: { father: 'alive', mother: 'alive' },
    father_only: { father: 'alive', mother: 'deceased' },
    mother_only: { father: 'deceased', mother: 'alive' },
    both_deceased: { father: 'deceased', mother: 'deceased' },
    guardian: { father: 'unknown', mother: 'unknown' },
  };
  const statuses = parentStatus[condition];
  const members: FamilyMember[] = [
    {
      id: 'father',
      role: 'father',
      name: 'Ayah',
      status: statuses.father,
      relationship: statuses.father === 'alive' ? 65 : 0,
      trust: statuses.father === 'alive' ? 65 : 0,
      loyalty: statuses.father === 'alive' ? 65 : 0,
      birthYear: birthYear - 30,
      gender: 'male',
      health: 75,
      estateCash: parentEstateCash,
      generation: -1,
      history: [],
    },
    {
      id: 'mother',
      role: 'mother',
      name: 'Ibu',
      status: statuses.mother,
      relationship: statuses.mother === 'alive' ? 65 : 0,
      trust: statuses.mother === 'alive' ? 65 : 0,
      loyalty: statuses.mother === 'alive' ? 65 : 0,
      birthYear: birthYear - 28,
      gender: 'female',
      health: 78,
      estateCash: parentEstateCash,
      generation: -1,
      history: [],
    },
  ];

  for (let index = 0; index < siblingCount; index += 1) {
    members.push({
      id: `sibling-${index + 1}`,
      role: 'sibling',
      name: `Saudara ${index + 1}`,
      status: 'alive',
      relationship: 60,
      trust: 60,
      loyalty: 60,
      birthYear: birthYear - index - 2,
      gender: index % 2 === 0 ? 'female' : 'male',
      health: 80,
      generation: 0,
      parentIds: ['father', 'mother'],
      history: [],
    });
  }

  const hasGuardian = condition === 'guardian' || condition === 'both_deceased';
  if (hasGuardian) {
    members.push({
      id: 'guardian',
      role: 'guardian',
      name: 'Wali keluarga',
      status: 'alive',
      relationship: 65,
      trust: 65,
      loyalty: 65,
      birthYear: birthYear - 45,
      gender: 'other',
      health: 72,
      generation: -1,
      history: [],
    });
  }

  const grandparents: FamilyMember[] = [
    { id: 'grandfather-father', role: 'grandparent', name: 'Kakek dari ayah', kinshipLabel: 'Kakek dari ayah', status: 'unknown', relationship: 0, trust: 0, loyalty: 0, birthYear: null, gender: 'male', health: 70, generation: -2, parentIds: ['father'], history: [] },
    { id: 'grandmother-father', role: 'grandparent', name: 'Nenek dari ayah', kinshipLabel: 'Nenek dari ayah', status: 'unknown', relationship: 0, trust: 0, loyalty: 0, birthYear: null, gender: 'female', health: 70, generation: -2, parentIds: ['father'], history: [] },
    { id: 'grandfather-mother', role: 'grandparent', name: 'Kakek dari ibu', kinshipLabel: 'Kakek dari ibu', status: 'unknown', relationship: 0, trust: 0, loyalty: 0, birthYear: null, gender: 'male', health: 70, generation: -2, parentIds: ['mother'], history: [] },
    { id: 'grandmother-mother', role: 'grandparent', name: 'Nenek dari ibu', kinshipLabel: 'Nenek dari ibu', status: 'unknown', relationship: 0, trust: 0, loyalty: 0, birthYear: null, gender: 'female', health: 70, generation: -2, parentIds: ['mother'], history: [] },
  ];
  members.push(...grandparents);

  const livingArrangement = hasGuardian
    ? 'with_guardian'
    : condition === 'both_alive'
      ? 'with_parents'
      : 'with_parent';
  const completeMembers = members.map((member) => ({
    ...member,
    netWorth: member.netWorth ?? member.estateCash ?? 0,
    educationLevel: member.educationLevel ?? 'none',
    occupationId: member.occupationId ?? null,
    personality: member.personality ?? { traits: [] },
  }));

  return {
    parentCondition: condition,
    members: completeMembers,
    livingArrangement,
    history: [`Lahir dalam keluarga ${backgroundLabel.toLowerCase()}.`],
  };
}

const baseStats: Record<FamilyBackgroundTier, CharacterStats> = {
  very_poor: { health: 62, happiness: 58, intelligence: 54, looks: 55, energy: 63, reputation: 22, wealth: 8 },
  poor: { health: 66, happiness: 61, intelligence: 57, looks: 56, energy: 65, reputation: 24, wealth: 15 },
  modest: { health: 70, happiness: 65, intelligence: 61, looks: 59, energy: 68, reputation: 28, wealth: 26 },
  middle: { health: 73, happiness: 67, intelligence: 65, looks: 62, energy: 70, reputation: 31, wealth: 39 },
  affluent: { health: 76, happiness: 69, intelligence: 68, looks: 65, energy: 72, reputation: 35, wealth: 56 },
  wealthy: { health: 77, happiness: 69, intelligence: 70, looks: 67, energy: 73, reputation: 38, wealth: 68 },
};

const traitStatEffects: Partial<Record<PersonalityTrait, Partial<CharacterStats>>> = {
  brave: { reputation: 2 },
  shy: { happiness: 1, reputation: -2 },
  intelligent: { intelligence: 4 },
  ambitious: { intelligence: 2, energy: -1 },
  friendly: { happiness: 3, reputation: 3 },
  short_tempered: { happiness: -3 },
  disciplined: { energy: 3, intelligence: 1 },
  lazy: { energy: -3 },
  creative: { intelligence: 2, happiness: 1 },
  lucky: { happiness: 2 },
};

function createInitialStats(
  background: FamilyBackgroundTier,
  traits: PersonalityTrait[],
): CharacterStats {
  const result = { ...baseStats[background] };
  for (const trait of traits) {
    const effects = traitStatEffects[trait];
    if (!effects) continue;
    for (const [key, value] of Object.entries(effects) as [keyof CharacterStats, number][]) {
      result[key] = clampStat(result[key] + value);
    }
  }
  return result;
}

export class CharacterDraftError extends Error {
  constructor(public readonly errors: DraftErrors) {
    super('Data karakter belum lengkap atau tidak valid.');
    this.name = 'CharacterDraftError';
  }
}

export interface CreateCharacterOptions {
  today?: Date;
  idFactory?: () => string;
}

export function createCharacter(
  draft: CharacterDraft,
  options: CreateCharacterOptions = {},
): Character {
  const today = options.today ?? new Date();
  const errors = validateCharacterDraft(draft, today);
  if (Object.keys(errors).length > 0) throw new CharacterDraftError(errors);

  const background = getFamilyBackground(draft.familyBackground as FamilyBackgroundTier);
  const country = getCountry(draft.countryCode);
  if (!country) throw new Error(`Negara belum didukung: ${draft.countryCode}`);

  const birthYear = Number(draft.birthDate.slice(0, 4));
  const nominalFactor = getNominalPriceFactor(birthYear);
  const cash = Math.max(1, Math.round(background.cashBase * nominalFactor));
  const nonCashValue = Math.round(background.nonCashBase * nominalFactor);
  const family = createFamily(
    draft.parentCondition as ParentCondition,
    draft.siblingCount,
    background.label,
    birthYear,
    Math.round(cash * 0.1),
  );
  const id = options.idFactory?.()
    ?? globalThis.crypto?.randomUUID?.()
    ?? `character-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const birthEvent: BirthEvent = {
    id: 'birth-recorded',
    title: 'Hari kelahiran',
    description: `Lahir di ${draft.city}, ${draft.province}; ini menjadi catatan awal perjalanan.`,
    statChanges: { happiness: 1 },
  };
  const stats = createInitialStats(
    draft.familyBackground as FamilyBackgroundTier,
    draft.personalityTraits,
  );
  stats.happiness = clampStat(stats.happiness + (birthEvent.statChanges.happiness ?? 0));

  return {
    id,
    identity: {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      gender: draft.gender as Character['identity']['gender'],
      avatarId: draft.avatarId,
    },
    birthInformation: {
      date: draft.birthDate,
      location: {
        countryCode: country.code,
        province: draft.province,
        city: draft.city,
        currencyCode: country.currencyCode,
      },
    },
    birthEvent,
    currentYear: birthYear,
    age: 0,
    deathRecord: null,
    lastYearIncome: 0,
    lastYearExpenses: 0,
    debt: 0,
    assets: [],
    economyRecord: createInitialEconomyRecord(),
    relationships: [],
    children: [],
    maritalStatus: 'single',
    spouseName: null,
    legalStatus: 'clear',
    organizations: [],
    familyBackground: { tier: draft.familyBackground as FamilyBackgroundTier },
    family,
    personality: { traits: [...draft.personalityTraits] },
    startingAssets: {
      housingCondition: background.housingCondition,
      nonCashValue,
      facilities: [...background.facilities],
      opportunityLevel: background.opportunityLevel,
    },
    cash,
    netWorth: cash + nonCashValue,
    educationRecord: createInitialEducationRecord(),
    careerRecord: createInitialCareerRecord(),
    status: 'alive',
    stats,
  };
}

export function getCharacterName(character: Character): string {
  return `${character.identity.firstName} ${character.identity.lastName}`.trim();
}

export function getFamilyMember(
  family: Family,
  role: FamilyMemberRole,
): FamilyMember | undefined {
  return family.members.find((member) => member.role === role);
}
