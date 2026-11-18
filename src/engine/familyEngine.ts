import type {
  Character,
  ChildRecord,
  EducationLevel,
  FamilyMember,
  LifeStatus,
  SocialRelationship,
} from '../types/game';
import type { CharacterActionResult } from './relationshipEngine';
import { getNominalPriceFactor } from './worldEra';

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const nonNegative = (value: number) => Math.max(0, Math.round(value));

function randomValue(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.min(0.999999, Math.max(0, value)) : 0.5;
}

function calculateNetWorth(character: Character, cash: number, debt = character.debt): number {
  return Math.max(
    0,
    cash + character.startingAssets.nonCashValue
      + character.assets.reduce((total, asset) => total + asset.value, 0)
      - debt,
  );
}

function childEducation(age: number): EducationLevel {
  if (age >= 16) return 'sma';
  if (age >= 13) return 'smp';
  if (age >= 6) return 'sd';
  if (age >= 4) return 'tk';
  if (age >= 3) return 'paud';
  return 'none';
}

const educationLabels: Partial<Record<EducationLevel, string>> = {
  paud: 'PAUD',
  tk: 'taman kanak-kanak',
  sd: 'sekolah dasar',
  smp: 'sekolah menengah pertama',
  sma: 'sekolah menengah atas',
};

function getFamilyMemberDeathRisk(member: FamilyMember, age: number): number {
  const ageRisk = age < 45 ? 0.0002
    : age < 60 ? 0.001
      : age < 75 ? 0.006
        : age < 85 ? 0.025
          : 0.06;
  const healthRisk = ((100 - (member.health ?? 75)) / 100) * (age >= 60 ? 0.04 : 0.002);
  return Math.min(0.5, ageRisk + healthRisk);
}

function getRelationshipDeathRisk(relationship: SocialRelationship): number {
  const age = relationship.profile?.age ?? 30;
  const health = relationship.profile?.health ?? 75;
  const ageRisk = age < 45 ? 0.0002
    : age < 60 ? 0.001
      : age < 75 ? 0.006
        : age < 85 ? 0.025
          : 0.06;
  return Math.min(0.5, ageRisk + ((100 - health) / 100) * (age >= 60 ? 0.04 : 0.002));
}

function getChildDeathRisk(child: ChildRecord, age: number): number {
  const health = child.health ?? 75;
  const ageRisk = age < 1 ? 0.001 : age < 5 ? 0.0003 : age < 18 ? 0.0001 : 0;
  return Math.min(0.2, ageRisk + ((100 - health) / 100) * 0.001);
}

function updateFamilyMember(
  member: FamilyMember,
  currentYear: number,
  character: Character,
  random: () => number,
): { member: FamilyMember; history: string[]; inheritance: number } {
  if (member.status !== 'alive' || member.birthYear === null || member.birthYear === undefined) {
    return { member, history: [], inheritance: 0 };
  }
  const age = currentYear - member.birthYear;
  const health = Math.max(0, (member.health ?? 75) - (age >= 70 && age % 3 === 0 ? 1 : 0));
  const nextMember = { ...member, health };
  const history: string[] = [];
  if (randomValue(random) >= getFamilyMemberDeathRisk(nextMember, age)) {
    return { member: nextMember, history, inheritance: 0 };
  }

  const deceased: FamilyMember = {
    ...nextMember,
    status: 'deceased',
    relationship: 0,
    trust: 0,
    loyalty: 0,
    history: [...(nextMember.history ?? []), `${currentYear}: Meninggal dunia pada usia sekitar ${age} tahun.`],
  };
  const siblingCount = character.family.members.filter((item) => item.role === 'sibling').length;
  const inheritance = member.role === 'father' || member.role === 'mother'
    ? Math.floor(nonNegative(member.estateCash ?? 0) / (siblingCount + 1))
    : 0;
  history.push(`${currentYear}: ${member.name} meninggal dunia pada usia sekitar ${age} tahun.`);
  if (inheritance > 0) {
    history.push(`${currentYear}: Menerima bagian warisan keluarga sebesar ${inheritance}.`);
  }
  return { member: deceased, history, inheritance };
}

function updateChild(
  child: ChildRecord,
  currentYear: number,
  random: () => number,
): { child: ChildRecord; history: string[]; happinessChange: number } {
  if (child.lifeStatus === 'deceased') {
    return { child, history: [], happinessChange: 0 };
  }
  const age = Math.max(0, currentYear - child.birthYear);
  const style = child.parentingStyle ?? 'balanced';
  const development = style === 'supportive'
    ? { relationship: 2, trust: 2, happiness: 2, intelligence: 1 }
    : style === 'strict'
      ? { relationship: 0, trust: 0, happiness: 0, intelligence: 1 }
      : { relationship: 1, trust: 1, happiness: 1, intelligence: 1 };
  const previousLevel = child.educationLevel ?? 'none';
  const level = childEducation(age);
  const history = [...(child.history ?? [])];
  const newEntries: string[] = [];
  if (age > 0 && level !== previousLevel && educationLabels[level]) {
    const milestone = `${currentYear}: Mulai ${educationLabels[level]}.`;
    history.push(milestone);
    newEntries.push(`${currentYear}: ${child.name} mulai ${educationLabels[level]}.`);
  }
  const updated: ChildRecord = {
    ...child,
    relationship: clamp(child.relationship + development.relationship),
    trust: clamp((child.trust ?? child.relationship) + development.trust),
    loyalty: clamp((child.loyalty ?? child.relationship) + (style === 'supportive' ? 1 : 0)),
    health: clamp((child.health ?? 75) + (age < 12 ? 1 : 0)),
    happiness: clamp((child.happiness ?? 60) + development.happiness),
    intelligence: clamp((child.intelligence ?? 50) + development.intelligence),
    educationLevel: level,
    parentingStyle: style,
    lifeStatus: 'alive',
    history,
  };
  const risk = getChildDeathRisk(updated, age);
  if (randomValue(random) < risk) {
    const deceased = {
      ...updated,
      lifeStatus: 'deceased' as LifeStatus,
      deathYear: currentYear,
      health: 0,
      history: [...history, `${currentYear}: Meninggal dunia pada usia ${age} tahun.`],
    };
    newEntries.push(`${currentYear}: ${child.name} meninggal dunia pada usia ${age} tahun.`);
    return {
      child: deceased,
      history: newEntries,
      happinessChange: -20,
    };
  }
  return { child: updated, history: newEntries, happinessChange: 0 };
}

export function createChild(
  character: Character,
  name: string,
  adopted = false,
): CharacterActionResult | null {
  const cleanName = name.trim();
  const spouse = character.relationships.find((item) => item.stage === 'married' && item.status === 'active');
  if (!cleanName || cleanName.length > 40 || character.status !== 'alive' || character.age < (adopted ? 25 : 18)
    || character.maritalStatus !== 'married' || !spouse
    || character.children.filter((child) => child.lifeStatus !== 'deceased').length >= 8
    || (!adopted && character.age > 50)) return null;

  const fee = adopted ? Math.round(2_000_000 * getNominalPriceFactor(character.currentYear)) : 0;
  if (character.cash < fee) return null;
  const childId = `child-${character.id}-${character.currentYear}-${character.children.length + 1}`;
  const child: ChildRecord = {
    id: childId,
    name: cleanName,
    birthYear: character.currentYear,
    relationship: 65,
    trust: 65,
    loyalty: 60,
    health: 80,
    happiness: 65,
    intelligence: clamp(35 + character.stats.intelligence * 0.35),
    educationLevel: 'none',
    personality: { traits: [] },
    parentingStyle: 'balanced',
    lifeStatus: 'alive',
    deathYear: null,
    adopted,
    parentIds: [character.id, spouse.id],
    generation: 1,
    history: [adopted
      ? `${character.currentYear}: Bergabung dengan keluarga melalui proses adopsi.`
      : `${character.currentYear}: Lahir dan menjadi bagian keluarga.`],
  };
  const cash = nonNegative(character.cash - fee);
  const historyText = adopted
    ? `Mengadopsi ${cleanName} melalui proses keluarga.`
    : `Menyambut kelahiran ${cleanName}.`;
  return {
    character: {
      ...character,
      children: [...character.children, child],
      cash,
      netWorth: calculateNetWorth(character, cash),
      lastYearExpenses: nonNegative(character.lastYearExpenses + fee),
      stats: { ...character.stats, happiness: clamp(character.stats.happiness + 6) },
      family: {
        ...character.family,
        history: [...character.family.history, `${character.currentYear}: ${historyText}`],
      },
    },
    historyText,
  };
}

export function setChildParentingStyle(
  character: Character,
  childId: string,
  style: NonNullable<ChildRecord['parentingStyle']>,
): CharacterActionResult | null {
  const child = character.children.find((item) => item.id === childId);
  if (!child || child.lifeStatus === 'deceased'
    || !['supportive', 'balanced', 'strict'].includes(style)) return null;
  return {
    character: {
      ...character,
      children: character.children.map((item) => item.id === childId
        ? { ...item, parentingStyle: style }
        : item),
    },
    historyText: `Menetapkan pola asuh ${style === 'supportive' ? 'suportif' : style === 'strict' ? 'tegas' : 'seimbang'} untuk ${child.name}.`,
  };
}

export interface FamilyYearResult {
  character: Character;
  historyEntries: string[];
}

export function processFamilyYear(
  character: Character,
  random: () => number = Math.random,
): FamilyYearResult {
  const year = character.currentYear;
  const historyEntries: string[] = [];
  const familyHistoryEntries: string[] = [];
  let inheritance = 0;
  const familyResults = character.family.members.map((member) => {
    const result = updateFamilyMember(member, year, character, random);
    historyEntries.push(...result.history);
    if (member.status === 'alive' && result.member.status === 'deceased') {
      familyHistoryEntries.push(`${year}: ${member.name} meninggal dunia.`);
      if (result.inheritance > 0) {
        familyHistoryEntries.push(`${year}: Warisan dari ${member.name} dibagikan sesuai jumlah saudara.`);
      }
    }
    inheritance += result.inheritance;
    return result.member;
  });
  let happinessChange = 0;
  const children = character.children.map((child) => {
    const result = updateChild(child, year, random);
    historyEntries.push(...result.history);
    if (child.lifeStatus !== 'deceased' && result.child.lifeStatus === 'deceased') {
      familyHistoryEntries.push(`${year}: ${child.name} meninggal dunia.`);
    }
    happinessChange += result.happinessChange;
    return result.child;
  });
  let relationships = character.relationships.map((relationship) => {
    const profile = relationship.profile;
    if (!profile || profile.lifeStatus === 'deceased') return relationship;
    const age = profile.age + 1;
    const health = Math.max(0, profile.health - (age >= 70 && age % 3 === 0 ? 1 : 0));
    const updatedProfile = { ...profile, age, health };
    if (randomValue(random) >= getRelationshipDeathRisk({ ...relationship, profile: updatedProfile })) {
      return { ...relationship, profile: updatedProfile };
    }

    const deceased = {
      ...relationship,
      status: 'ended' as const,
      profile: { ...updatedProfile, lifeStatus: 'deceased' as const, health: 0 },
      history: [
        ...(relationship.history ?? []),
        {
          id: `${relationship.id}:${year}:death`,
          year,
          action: 'meninggal dunia',
          details: `${relationship.name} meninggal dunia pada usia sekitar ${age} tahun.`,
        },
      ],
    };
    if (relationship.stage === 'married' && character.maritalStatus === 'married') {
      historyEntries.push(`${year}: Pasangan ${relationship.name} meninggal dunia; status keluarga menjadi duda/janda.`);
      familyHistoryEntries.push(`${year}: Pasangan ${relationship.name} meninggal dunia.`);
    } else {
      historyEntries.push(`${year}: ${relationship.name} meninggal dunia pada usia sekitar ${age} tahun.`);
    }
    return deceased;
  });
  let maritalStatus = character.maritalStatus;
  const spouse = relationships.find((item) => item.stage === 'married');
  if (spouse?.profile?.lifeStatus === 'deceased' && maritalStatus === 'married') {
    maritalStatus = 'widowed';
    happinessChange -= 12;
  }

  const childExpenses = children.reduce((total, child) => (
    child.lifeStatus === 'deceased' || year - child.birthYear >= 18
      ? total
      : total + Math.round((500_000 + Math.max(0, year - child.birthYear) * 120_000) * getNominalPriceFactor(year))
  ), 0);
  const cashBeforeCosts = nonNegative(character.cash + inheritance);
  const cashPaid = Math.min(cashBeforeCosts, childExpenses);
  const unpaidExpenses = childExpenses - cashPaid;
  const cash = cashBeforeCosts - cashPaid;
  const debt = nonNegative(character.debt + unpaidExpenses);
  const stats = {
    ...character.stats,
    happiness: clamp(character.stats.happiness + happinessChange),
  };
  if (childExpenses > 0) historyEntries.push(`${year}: Biaya pengasuhan anak tercatat sebesar ${childExpenses}.`);

  return {
    character: {
      ...character,
      family: {
        ...character.family,
        members: familyResults,
        history: [...character.family.history, ...familyHistoryEntries],
      },
      children,
      relationships,
      maritalStatus,
      cash,
      debt,
      netWorth: calculateNetWorth(character, cash, debt),
      lastYearExpenses: nonNegative(character.lastYearExpenses + childExpenses),
      stats,
    },
    historyEntries,
  };
}

export function normalizeFamilyRecords(character: Character): Character {
  const birthYear = Number(character.birthInformation.date.slice(0, 4));
  const members = (character.family?.members ?? []).map((member) => ({
    ...member,
    trust: member.trust ?? member.relationship,
    loyalty: member.loyalty ?? member.relationship,
    birthYear: member.birthYear === undefined
      ? member.role === 'father' ? birthYear - 30
        : member.role === 'mother' ? birthYear - 28
          : null
      : member.birthYear,
    health: member.health ?? 75,
    estateCash: member.estateCash ?? 0,
    netWorth: member.netWorth ?? member.estateCash ?? 0,
    educationLevel: member.educationLevel ?? 'none',
    occupationId: member.occupationId ?? null,
    personality: member.personality ?? { traits: [] },
    history: member.history ?? [],
  }));
  const familyTree: FamilyMember[] = [...members];
  const unknownGrandparents: FamilyMember[] = [
    { id: 'grandfather-father', role: 'grandparent', name: 'Kakek dari ayah', kinshipLabel: 'Kakek dari ayah', status: 'unknown', relationship: 0, trust: 0, loyalty: 0, birthYear: null, gender: 'male', health: 70, generation: -2, parentIds: ['father'], history: [] },
    { id: 'grandmother-father', role: 'grandparent', name: 'Nenek dari ayah', kinshipLabel: 'Nenek dari ayah', status: 'unknown', relationship: 0, trust: 0, loyalty: 0, birthYear: null, gender: 'female', health: 70, generation: -2, parentIds: ['father'], history: [] },
    { id: 'grandfather-mother', role: 'grandparent', name: 'Kakek dari ibu', kinshipLabel: 'Kakek dari ibu', status: 'unknown', relationship: 0, trust: 0, loyalty: 0, birthYear: null, gender: 'male', health: 70, generation: -2, parentIds: ['mother'], history: [] },
    { id: 'grandmother-mother', role: 'grandparent', name: 'Nenek dari ibu', kinshipLabel: 'Nenek dari ibu', status: 'unknown', relationship: 0, trust: 0, loyalty: 0, birthYear: null, gender: 'female', health: 70, generation: -2, parentIds: ['mother'], history: [] },
  ];
  for (const grandparent of unknownGrandparents) {
    if (!familyTree.some((member) => member.id === grandparent.id)) familyTree.push(grandparent);
  }
  const relationships = (character.relationships ?? []).map((relationship) => {
    const romanticStage = relationship.stage
      ?? (relationship.kind === 'spouse'
        || (['married', 'widowed'].includes(character.maritalStatus) && relationship.id === 'partner')
        ? 'married'
        : character.maritalStatus === 'engaged' && relationship.id === 'partner'
          ? 'engaged'
          : relationship.kind === 'romantic_partner' ? 'dating' : 'friend');
    return {
      ...relationship,
      stage: romanticStage,
      profile: relationship.profile ?? {
        age: character.age,
        gender: 'other' as const,
        personality: { traits: [] },
        occupationId: null,
        educationLevel: 'none' as const,
        netWorth: 0,
        health: 75,
        lifeStatus: 'alive' as const,
      },
      history: relationship.history ?? [],
      startedYear: relationship.startedYear || character.currentYear || birthYear,
    };
  });
  const children = (character.children ?? []).map((child) => ({
    ...child,
    trust: child.trust ?? child.relationship,
    loyalty: child.loyalty ?? child.relationship,
    health: child.health ?? 75,
    happiness: child.happiness ?? 60,
    intelligence: child.intelligence ?? 50,
    educationLevel: child.educationLevel ?? 'none',
    personality: child.personality ?? { traits: [] },
    parentingStyle: child.parentingStyle ?? 'balanced',
    lifeStatus: child.lifeStatus ?? 'alive',
    deathYear: child.deathYear ?? null,
    adopted: child.adopted ?? false,
    history: child.history ?? [],
    parentIds: child.parentIds ?? [character.id],
    generation: child.generation ?? 1,
  }));
  return {
    ...character,
    family: { ...character.family, members: familyTree },
    relationships,
    children,
  };
}
