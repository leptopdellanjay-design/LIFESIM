import type {
  Character,
  ConsequencePayload,
  FamilyMember,
  MaritalStatus,
  RomanticRelationshipStage,
  SocialRelationship,
} from '../types/game';
import { applyCareerChange } from './careerEngine';
import {
  addAcademicAwards,
  addHonoraryDegrees,
  applyScholarshipChanges,
} from './educationEngine';
import { normalizeFamilyRecords } from './familyEngine';
import { normalizeEconomyRecord } from './economyEngine';

const clamp = (value: number) => (
  Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value))) : 0
);
const finite = (value: number | undefined) => (
  value !== undefined && Number.isFinite(value) ? value : 0
);
const nonNegative = (value: number) => (
  Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
);

function updateFamilyMember(
  member: FamilyMember,
  consequence: ConsequencePayload,
): FamilyMember {
  const legacyChanges = consequence.relationshipChanges ?? [];
  const effects = (consequence.relationshipEffects ?? []).filter(
    (effect) => effect.target.type === 'family'
      && (effect.target.role === 'living_family' || effect.target.role === member.role),
  );
  const scoreChange = legacyChanges
    .filter((change) => change.role === 'living_family' || change.role === member.role)
    .reduce((total, change) => total + finite(change.amount), 0)
    + effects.reduce((total, effect) => total + finite(effect.scoreChange), 0);
  const trustChange = effects.reduce((total, effect) => total + finite(effect.trustChange), 0);
  const loyaltyChange = effects.reduce((total, effect) => total + finite(effect.loyaltyChange), 0);

  if (member.status !== 'alive') return member;
  return {
    ...member,
    relationship: clamp(member.relationship + scoreChange),
    trust: clamp(member.trust + trustChange),
    loyalty: clamp(member.loyalty + loyaltyChange),
  };
}

function updateAsset(
  assets: Character['assets'],
  change: NonNullable<ConsequencePayload['assetChanges']>[number],
): Character['assets'] {
  if (change.action === 'remove') {
    return assets.filter((asset) => asset.id !== change.assetId);
  }
  const asset = { ...change.asset, value: nonNegative(change.asset.value) };
  const index = assets.findIndex((item) => item.id === asset.id);
  if (change.action === 'add' && index < 0) return [...assets, asset];
  if (index < 0) return assets;
  return assets.map((item, itemIndex) => itemIndex === index ? asset : item);
}

function resolveSocialTarget(
  targetId: string,
  relationships: SocialRelationship[],
): string {
  if (relationships.some((item) => item.id === targetId)) return targetId;
  const active = relationships.filter((item) => item.status !== 'ended');
  if (targetId === 'partner') {
    return active
      .filter((item) => ['dating', 'engaged', 'married'].includes(item.stage ?? '')
        || item.kind === 'romantic_partner'
        || item.kind === 'spouse')
      .sort((left, right) => right.startedYear - left.startedYear)[0]?.id ?? targetId;
  }
  if (targetId === 'school-friend' || targetId === 'friend') {
    return active
      .filter((item) => item.kind === 'friend' || item.stage === 'friend')
      .sort((left, right) => right.startedYear - left.startedYear)[0]?.id ?? targetId;
  }
  return targetId;
}

function resolveChildTarget(targetId: string, children: Character['children']): string {
  if (children.some((item) => item.id === targetId)) return targetId;
  if (targetId === 'youngest_child') {
    return children
      .filter((item) => item.lifeStatus !== 'deceased')
      .sort((left, right) => right.birthYear - left.birthYear)[0]?.id ?? targetId;
  }
  return targetId;
}

function syncRomanticStatus(
  relationships: SocialRelationship[],
  previousStatus: MaritalStatus,
  nextStatus: MaritalStatus,
  year: number,
): SocialRelationship[] {
  const stageByStatus = {
    partnered: 'dating',
    engaged: 'engaged',
    married: 'married',
  } as const;
  const stage = stageByStatus[nextStatus as keyof typeof stageByStatus];
  if (!stage && nextStatus !== 'separated'
    && !(nextStatus === 'single' && ['partnered', 'engaged'].includes(previousStatus))) {
    return relationships;
  }
  const target = relationships
    .filter((item) => item.kind === 'romantic_partner' || item.kind === 'spouse')
    .sort((left, right) => right.startedYear - left.startedYear)[0];
  if (!target) return relationships;
  const ended = nextStatus === 'single';
  const nextStage: RomanticRelationshipStage = stage ?? (ended ? 'ended' : 'separated');
  const nextKind = nextStage === 'married' ? 'spouse' : 'romantic_partner';
  const details = nextStage === 'married'
    ? 'Status hubungan diperbarui menjadi pernikahan.'
    : nextStage === 'engaged'
      ? 'Status hubungan diperbarui menjadi pertunangan.'
      : nextStage === 'dating'
        ? 'Status hubungan diperbarui menjadi hubungan romantis.'
        : nextStage === 'separated'
          ? 'Hubungan mengambil jarak dan berstatus merenggang.'
          : 'Hubungan romantis berakhir.';
  return relationships.map((item) => item.id === target.id ? {
    ...item,
    kind: nextKind,
    stage: nextStage,
    status: ended ? 'ended' : nextStatus === 'separated' ? 'strained' : 'active',
    history: [
      ...(item.history ?? []),
      {
        id: `${item.id}:${year}:status-${(item.history?.length ?? 0) + 1}`,
        year,
        action: nextStage,
        details,
      },
    ],
  } : item);
}

export function applyConsequence(
  character: Character,
  consequence: ConsequencePayload,
): Character {
  const stats = { ...character.stats };
  for (const [key, change] of Object.entries(consequence.statChanges ?? {}) as [
    keyof typeof stats,
    number | undefined,
  ][]) {
    stats[key] = clamp(stats[key] + finite(change));
  }

  const incomeChange = finite(consequence.incomeChange);
  const expensesChange = finite(consequence.expensesChange);
  const cash = nonNegative(
    character.cash
      + finite(consequence.cashChange)
      + incomeChange
      - expensesChange,
  );
  const debt = nonNegative(character.debt + finite(consequence.debtChange));
  const assets = (consequence.assetChanges ?? [])
    .reduce(updateAsset, character.assets);
  const netWorth = Math.max(
    0,
    cash + character.startingAssets.nonCashValue
      + assets.reduce((total, asset) => total + asset.value, 0)
      - debt,
  );
  const family = {
    ...character.family,
    members: character.family.members.map((member) => updateFamilyMember(member, consequence)),
  };
  const socialEffects = consequence.relationshipEffects?.filter(
    (effect) => effect.target.type === 'social',
  ) ?? [];
  const deduplicatedRelationships = [...character.relationships, ...(consequence.relationshipsAdded ?? [])]
    .reduce<SocialRelationship[]>((result, relationship) => {
      if (result.some((item) => item.id === relationship.id)) return result;
      result.push({
        ...relationship,
        startedYear: relationship.startedYear || character.currentYear,
        score: clamp(relationship.score),
        trust: clamp(relationship.trust),
        loyalty: clamp(relationship.loyalty),
      });
      return result;
    }, [])
  const relationshipsWithEffects = deduplicatedRelationships
    .map((relationship) => {
      const effects = socialEffects.filter(
        (effect) => effect.target.type === 'social'
          && resolveSocialTarget(effect.target.id, deduplicatedRelationships) === relationship.id,
      );
      if (effects.length === 0) return relationship;
      return effects.reduce((next, effect) => ({
        ...next,
        score: clamp(next.score + finite(effect.scoreChange)),
        trust: clamp(next.trust + finite(effect.trustChange)),
        loyalty: clamp(next.loyalty + finite(effect.loyaltyChange)),
        status: effect.status ?? next.status,
        stage: effect.stage ?? next.stage,
      }), relationship);
    });
  const maritalStatus = consequence.maritalStatus ?? character.maritalStatus;
  const relationships = syncRomanticStatus(
    relationshipsWithEffects,
    character.maritalStatus,
    maritalStatus,
    character.currentYear,
  );
  const deduplicatedChildren = [...character.children, ...(consequence.childrenAdded ?? [])]
    .reduce<Character['children']>((result, child) => {
      if (!result.some((item) => item.id === child.id)) {
        result.push({ ...child, relationship: clamp(child.relationship) });
      }
      return result;
    }, []);
  const children = deduplicatedChildren.map((child) => {
      const effects = consequence.relationshipEffects?.filter(
        (effect) => effect.target.type === 'child'
          && resolveChildTarget(effect.target.id, deduplicatedChildren) === child.id,
      ) ?? [];
      return effects.reduce((next, effect) => ({
        ...next,
        relationship: clamp(next.relationship + finite(effect.scoreChange)),
        trust: clamp((next.trust ?? next.relationship) + finite(effect.trustChange)),
        loyalty: clamp((next.loyalty ?? next.relationship) + finite(effect.loyaltyChange)),
      }), child);
    });
  const organizations = [...character.organizations, ...(consequence.organizationChanges ?? []).map(
    (organization) => {
      const currentMembership = character.organizations.find((item) => item.id === organization.id);
      return {
        ...organization,
        joinedYear: organization.joinedYear || currentMembership?.joinedYear || character.currentYear,
      };
    },
  )]
    .reduce<Character['organizations']>((result, organization) => {
      const index = result.findIndex((item) => item.id === organization.id);
      if (index < 0) result.push(organization);
      else result[index] = organization;
      return result;
    }, []);

  const educationWithScholarships = applyScholarshipChanges(
    character.educationRecord,
    consequence.scholarshipChanges ?? [],
    character.currentYear,
  );
  const educationWithHonors = addHonoraryDegrees(
    educationWithScholarships,
    consequence.honoraryDegreesAdded ?? [],
    character.currentYear,
  );
  const updatedEducation = addAcademicAwards(
    educationWithHonors,
    consequence.academicAwardsAdded ?? [],
    character.currentYear,
  );
  const educationRecord = {
    ...updatedEducation,
    studyEffort: consequence.studyEffortChange ?? updatedEducation.studyEffort,
  };
  const nextCharacter: Character = {
    ...character,
    stats,
    family,
    relationships,
    children,
    organizations,
    assets,
    debt,
    cash,
    netWorth,
    lastYearIncome: nonNegative(character.lastYearIncome + incomeChange),
    lastYearExpenses: nonNegative(character.lastYearExpenses + expensesChange),
    educationRecord,
    maritalStatus,
    spouseName: 'spouseName' in consequence
      ? consequence.spouseName ?? null
      : maritalStatus === 'single' || maritalStatus === 'separated'
        ? null
        : maritalStatus === 'married'
          ? relationships.find((item) => item.stage === 'married')?.name ?? character.spouseName
          : character.spouseName,
    legalStatus: consequence.legalStatus ?? character.legalStatus,
  };
  const withCareerChange = consequence.careerChange
    ? applyCareerChange(nextCharacter, consequence.careerChange)
    : nextCharacter;
  return normalizeEconomyRecord(normalizeFamilyRecords(withCareerChange));
}
