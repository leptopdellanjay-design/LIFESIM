import { getCharacterName, createCharacter, initialCharacterDraft } from './characterCreation';
import { createInitialCareerRecord } from './careerEngine';
import { createInitialEconomyRecord } from './economyEngine';
import { createEducationRecordFromLegacy } from './educationEngine';
import type {
  AncestralRecord,
  Character,
  ChildRecord,
  EstateDistributionRule,
  EstatePlan,
  EstateSettlement,
  EstateShare,
  FamilyMember,
  ParentCondition,
  SocialRelationship,
} from '../types/game';
import type { CharacterActionResult } from './relationshipEngine';

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const nonNegative = (value: number) => Math.max(0, Math.round(value));

interface Beneficiary {
  id: string;
  name: string;
  type: EstateShare['beneficiaryType'];
}

function makeShare(beneficiary: Beneficiary, amount: number): EstateShare {
  return {
    beneficiaryId: beneficiary.id,
    beneficiaryName: beneficiary.name,
    beneficiaryType: beneficiary.type,
    amount,
  };
}

function isLivingChild(child: ChildRecord): boolean {
  return child.lifeStatus !== 'deceased';
}

function getLivingSpouse(character: Character): SocialRelationship | undefined {
  return character.relationships.find((relationship) => (
    relationship.stage === 'married'
    && relationship.status === 'active'
    && relationship.profile?.lifeStatus !== 'deceased'
  ));
}

function splitShares(amount: number, beneficiaries: Beneficiary[]): EstateShare[] {
  if (amount <= 0 || beneficiaries.length === 0) return [];
  const sorted = [...beneficiaries].sort((a, b) => a.id.localeCompare(b.id));
  const baseShare = Math.floor(amount / sorted.length);
  let remainder = amount - baseShare * sorted.length;
  return sorted.map((beneficiary) => {
    const share = baseShare + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return {
      beneficiaryId: beneficiary.id,
      beneficiaryName: beneficiary.name,
      beneficiaryType: beneficiary.type,
      amount: share,
    };
  });
}

function getBeneficiaries(character: Character): Beneficiary[] {
  const spouse = getLivingSpouse(character);
  return [
    ...(spouse ? [{ id: spouse.id, name: spouse.name, type: 'spouse' as const }] : []),
    ...character.children.filter(isLivingChild).map((child) => ({
      id: child.id,
      name: child.name,
      type: 'child' as const,
    })),
  ];
}

function distributeEstate(
  character: Character,
  netValue: number,
  beneficiaries: Beneficiary[],
): EstateShare[] {
  if (beneficiaries.length === 0) return [];
  const children = beneficiaries.filter((beneficiary) => beneficiary.type === 'child');
  const spouse = beneficiaries.find((beneficiary) => beneficiary.type === 'spouse');
  const plan = character.estatePlan;

  if (plan.distribution === 'spouse_priority' && spouse) {
    if (children.length === 0) return [makeShare(spouse, netValue)];
    const spouseShare = Math.floor(netValue / 2);
    return [
      makeShare(spouse, spouseShare),
      ...splitShares(netValue - spouseShare, children),
    ];
  }

  if (plan.distribution === 'named_heir') {
    const heir = children.find((child) => child.id === plan.namedHeirId);
    if (heir) {
      const remainderBeneficiaries = beneficiaries.filter((beneficiary) => beneficiary.id !== heir.id);
      if (remainderBeneficiaries.length === 0) return [makeShare(heir, netValue)];
      const heirShare = Math.floor(netValue * 0.6);
      return [
        makeShare(heir, heirShare),
        ...splitShares(netValue - heirShare, remainderBeneficiaries),
      ];
    }
  }

  return splitShares(netValue, beneficiaries);
}

export function getEligibleSuccessors(character: Character): ChildRecord[] {
  if (character.status !== 'deceased') return [];
  return character.children.filter((child) => (
    isLivingChild(child) && character.currentYear - child.birthYear >= 18
  ));
}

export function setEstatePlan(
  character: Character,
  distribution: EstateDistributionRule,
  namedHeirId: string | null = null,
): CharacterActionResult | null {
  if (character.status !== 'alive' || character.age < 18
    || !['equal_heirs', 'spouse_priority', 'named_heir'].includes(distribution)) return null;
  const namedHeir = namedHeirId
    ? character.children.find((child) => child.id === namedHeirId && isLivingChild(child))
    : undefined;
  if (distribution === 'named_heir' && !namedHeir) return null;
  const estatePlan: EstatePlan = {
    distribution,
    namedHeirId: distribution === 'named_heir' ? namedHeir!.id : null,
    updatedYear: character.currentYear,
  };
  const ruleLabel = distribution === 'equal_heirs'
    ? 'dibagi rata kepada pasangan dan anak yang masih hidup'
    : distribution === 'spouse_priority'
      ? 'pasangan menerima separuh dan sisanya dibagi rata kepada anak'
      : `${namedHeir!.name} menerima 60% dan sisanya dibagi kepada ahli waris lain`;
  return {
    character: { ...character, estatePlan },
    historyText: `Memperbarui rencana warisan simulasi: ${ruleLabel}.`,
  };
}

export function settleEstateOnDeath(character: Character): {
  character: Character;
  historyEntries: string[];
} {
  if (character.estateSettlement) return { character, historyEntries: [] };
  const grossValue = nonNegative(
    character.cash
      + character.startingAssets.nonCashValue
      + character.assets.reduce((total, asset) => total + Math.max(0, asset.value), 0),
  );
  const debtsPaid = Math.min(grossValue, nonNegative(character.debt));
  const unpaidDebt = Math.max(0, nonNegative(character.debt) - debtsPaid);
  const netValue = grossValue - debtsPaid;
  const beneficiaries = getBeneficiaries(character);
  const namedHeirExists = character.children.some((child) => (
    child.id === character.estatePlan.namedHeirId && isLivingChild(child)
  ));
  const distribution = character.estatePlan.distribution === 'named_heir' && !namedHeirExists
    ? 'equal_heirs'
    : character.estatePlan.distribution;
  const shares = distributeEstate({
    ...character,
    estatePlan: { ...character.estatePlan, distribution },
  }, netValue, beneficiaries);
  const settlement: EstateSettlement = {
    year: character.deathRecord?.year ?? character.currentYear,
    grossValue,
    debtsPaid,
    unpaidDebt,
    netValue,
    distribution,
    shares,
  };
  const children = character.children.map((child) => {
    const share = shares.find((item) => item.beneficiaryId === child.id)?.amount ?? 0;
    return {
      ...child,
      inheritanceCash: share,
      history: share > 0
        ? [...(child.history ?? []), `${settlement.year}: Menerima warisan simulasi sebesar ${share}.`]
        : child.history,
    };
  });
  const historyEntries = [
    `${settlement.year}: Nilai harta simulasi ${grossValue}; utang yang dibayar ${debtsPaid}; sisa harta ${netValue}.`,
    ...(distribution !== character.estatePlan.distribution
      ? [`${settlement.year}: Penerus yang dipilih tidak lagi memenuhi syarat; pembagian kembali rata.`]
      : []),
    ...shares.map((share) => (
      `${settlement.year}: Bagian warisan untuk ${share.beneficiaryName} (${share.beneficiaryType}) sebesar ${share.amount}.`
    )),
    ...(unpaidDebt > 0
      ? [`${settlement.year}: Utang simulasi sebesar ${unpaidDebt} tidak tertutup oleh harta.`]
      : []),
  ];
  const familyHistory = [
    ...character.family.history,
    `${settlement.year}: Harta peninggalan simulasi diselesaikan berdasarkan rencana ${distribution}.`,
  ];
  return {
    character: {
      ...character,
      children,
      estateSettlement: settlement,
      family: { ...character.family, history: familyHistory },
    },
    historyEntries,
  };
}

function getOtherParent(
  character: Character,
  child: ChildRecord,
): SocialRelationship | undefined {
  const otherParentId = child.parentIds?.find((id) => id !== character.id);
  if (!otherParentId) return undefined;
  return character.relationships.find((relationship) => relationship.id === otherParentId);
}

function getSuccessorParentCondition(
  deceasedParentGender: Character['identity']['gender'],
  otherParent?: SocialRelationship,
): ParentCondition {
  if (!otherParent || otherParent.profile?.lifeStatus === 'deceased') return 'both_deceased';
  if (deceasedParentGender === 'male' && otherParent.profile?.gender === 'female') return 'mother_only';
  if (deceasedParentGender === 'female' && otherParent.profile?.gender === 'male') return 'father_only';
  return 'guardian';
}

function createParentMember(
  id: string,
  role: 'father' | 'mother',
  name: string,
  status: FamilyMember['status'],
  birthYear: number | null,
  generation: number,
  relationship: number,
): FamilyMember {
  return {
    id,
    role,
    name,
    status,
    relationship: status === 'alive' ? relationship : 0,
    trust: status === 'alive' ? relationship : 0,
    loyalty: status === 'alive' ? relationship : 0,
    birthYear,
    gender: role === 'father' ? 'male' : 'female',
    health: status === 'alive' ? 65 : 0,
    generation,
    history: [],
  };
}

function createSiblingMember(
  child: ChildRecord,
  generation: number,
): FamilyMember {
  return {
    id: `sibling-${child.id}`,
    role: 'sibling',
    name: child.name,
    status: child.lifeStatus === 'deceased' ? 'deceased' : 'alive',
    relationship: child.lifeStatus === 'deceased' ? 0 : 55,
    trust: child.lifeStatus === 'deceased' ? 0 : 55,
    loyalty: child.lifeStatus === 'deceased' ? 0 : 55,
    birthYear: child.birthYear,
    gender: child.gender ?? 'other',
    health: child.health ?? 75,
    generation,
    parentIds: child.parentIds,
    history: child.history ?? [],
  };
}

function createAncestorRecord(character: Character): AncestralRecord {
  return {
    id: character.id,
    name: getCharacterName(character),
    generation: character.generation,
    birthYear: Number(character.birthInformation.date.slice(0, 4)),
    deathYear: character.deathRecord?.year ?? character.currentYear,
    deathCause: character.deathRecord?.cause ?? 'Tidak tercatat',
    netWorthAtDeath: character.estateSettlement?.netValue ?? character.netWorth,
    children: character.children.map((child) => child.name),
    estateSettlement: character.estateSettlement,
  };
}

function educationLabel(level: ChildRecord['educationLevel']): string | undefined {
  const labels: Partial<Record<NonNullable<ChildRecord['educationLevel']>, string>> = {
    paud: 'PAUD',
    tk: 'Taman Kanak-kanak',
    sd: 'Sekolah Dasar',
    smp: 'Sekolah Menengah Pertama',
    sma: 'Sekolah Menengah Atas',
    smk: 'Sekolah Menengah Kejuruan',
  };
  return level ? labels[level] : undefined;
}

export function createSuccessorCharacter(
  character: Character,
  childId: string,
): CharacterActionResult | null {
  if (character.status !== 'deceased' || !character.estateSettlement) return null;
  const heir = getEligibleSuccessors(character).find((child) => child.id === childId);
  if (!heir) return null;
  const [firstName, ...lastNameParts] = heir.name.trim().split(/\s+/);
  if (!firstName) return null;

  const otherParent = getOtherParent(character, heir);
  const parentCondition = getSuccessorParentCondition(character.identity.gender, otherParent);
  const siblings = character.children.filter((child) => child.id !== heir.id);
  const traits = heir.personality?.traits.length
    ? heir.personality.traits
    : character.personality.traits.slice(0, 1);
  const generation = heir.generation ?? character.generation + 1;
  const draft = {
    ...initialCharacterDraft,
    firstName,
    lastName: lastNameParts.join(' ') || character.identity.lastName,
    gender: heir.gender ?? 'other',
    birthDate: `${heir.birthYear}-${String(character.currentMonth).padStart(2, '0')}-01`,
    avatarId: character.identity.avatarId,
    countryCode: character.birthInformation.location.countryCode,
    province: character.birthInformation.location.province,
    city: character.birthInformation.location.city,
    familyBackground: character.familyBackground.tier,
    parentCondition,
    siblingCount: Math.min(4, siblings.length),
    personalityTraits: traits,
  };
  const nextCharacter = createCharacter(draft, {
    today: new Date(`${character.currentYear}-12-31T12:00:00`),
    idFactory: () => `life-${heir.id}-generation-${generation}`,
  });
  const age = Math.max(0, character.currentYear - heir.birthYear);
  const parentName = getCharacterName(character);
  const parentMember = (role: 'father' | 'mother') => {
    const parentGender = role === 'father' ? 'male' : 'female';
    const playerIsParent = character.identity.gender === parentGender;
    const otherIsParent = otherParent?.profile?.gender === parentGender;
    const status = playerIsParent
      ? 'deceased'
      : otherIsParent
        ? otherParent.profile?.lifeStatus ?? 'unknown'
        : 'unknown';
    return createParentMember(
      `${character.id}-${role}`,
      role,
      playerIsParent ? parentName : otherIsParent ? otherParent.name : 'Belum diketahui',
      status,
      playerIsParent
        ? Number(character.birthInformation.date.slice(0, 4))
        : otherIsParent && otherParent.profile
          ? character.currentYear - otherParent.profile.age
          : null,
      character.generation,
      otherIsParent ? otherParent.score : 0,
    );
  };
  const father = parentMember('father');
  const mother = parentMember('mother');
  const grandparents = nextCharacter.family.members.filter((member) => member.role === 'grandparent');
  const parentMembers = character.identity.gender === 'other'
    ? [
      { ...father, status: 'unknown' as const, name: 'Belum diketahui' },
      { ...mother, status: 'unknown' as const, name: 'Belum diketahui' },
      {
        ...father,
        id: `${character.id}-guardian`,
        role: 'guardian' as const,
        name: parentName,
        status: 'deceased' as const,
        generation: character.generation,
        history: [`${character.currentYear}: Meninggal dunia.`],
      },
    ]
    : [father, mother];
  const familyHistory = [
    ...character.family.history,
    `${character.currentYear}: ${heir.name} meneruskan cerita keluarga sebagai generasi ${generation + 1}.`,
  ];
  const inheritance = heir.inheritanceCash ?? 0;
  const schoolRecord = createEducationRecordFromLegacy(
    educationLabel(heir.educationLevel),
    character.currentYear,
  );
  const educationRecord = age >= 18 && ['sma', 'smk'].includes(schoolRecord.currentLevel)
    ? {
      ...schoolRecord,
      status: 'completed' as const,
      completedLevels: [...new Set([...schoolRecord.completedLevels, schoolRecord.currentLevel])],
    }
    : schoolRecord;
  const characterStats = {
    ...nextCharacter.stats,
    health: clamp(heir.health ?? 75),
    happiness: clamp(heir.happiness ?? 60),
    intelligence: clamp(heir.intelligence ?? 50),
    wealth: clamp(Math.log10(Math.max(1, inheritance)) * 10),
  };
  const familyMembers = [
    ...parentMembers,
    ...siblings.map((sibling) => createSiblingMember(sibling, generation)),
    ...grandparents,
  ];
  const successor: Character = {
    ...nextCharacter,
    generation,
    ancestors: [...character.ancestors, createAncestorRecord(character)],
    estatePlan: {
      distribution: 'equal_heirs',
      namedHeirId: null,
      updatedYear: character.currentYear,
    },
    estateSettlement: null,
    birthInformation: {
      ...nextCharacter.birthInformation,
      date: `${heir.birthYear}-${String(character.currentMonth).padStart(2, '0')}-01`,
    },
    birthEvent: {
      id: `generation-${generation}-legacy`,
      title: 'Mewarisi perjalanan keluarga',
      description: `Terlahir dalam keluarga ${character.identity.lastName} dan meneruskan cerita pada generasi ${generation + 1}.`,
      statChanges: {},
    },
    currentYear: character.currentYear,
    currentMonth: character.currentMonth,
    age,
    deathRecord: null,
    status: 'alive',
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
    family: {
      ...nextCharacter.family,
      members: familyMembers,
      livingArrangement: parentCondition === 'both_deceased' ? 'with_guardian' : 'with_parent',
      history: familyHistory,
    },
    personality: { traits: [...traits] },
    startingAssets: {
      ...nextCharacter.startingAssets,
      nonCashValue: 0,
      facilities: inheritance > 0 ? ['Aset warisan telah diselesaikan'] : [],
    },
    cash: inheritance,
    netWorth: inheritance,
    educationRecord,
    careerRecord: createInitialCareerRecord(),
    stats: characterStats,
  };
  return {
    character: successor,
    historyText: `${heir.name} meneruskan perjalanan keluarga sebagai generasi ${generation + 1} dengan warisan tunai ${inheritance}.`,
  };
}
