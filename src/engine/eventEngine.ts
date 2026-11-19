import { lifeEventLibrary } from '../data/events';
import { applyConsequence } from './consequenceEngine';
import { getEducationRequirementKeys } from './educationEngine';
import { canReceivePromotion } from './careerEngine';
import { adjustEventWeightForPersonality } from './worldEra';
import type {
  Character,
  EventChoice,
  EventProgress,
  LifeEvent,
  ScheduledConsequence,
} from '../types/game';

const affinityCategories: Record<string, string> = {
  family: 'relationship',
  romance: 'relationship',
  friendship: 'social',
  social: 'social',
  education: 'education',
  career: 'career',
  finance: 'chance',
  health: 'challenge',
  crime: 'conflict',
  underworld: 'conflict',
  historical: 'culture',
  random_life: 'chance',
  death: 'challenge',
};

export function createEmptyEventProgress(): EventProgress {
  return {
    completedEventIds: [],
    lastEventYears: {},
    lastEventMonths: {},
    history: [],
    pendingEventIds: [],
    pendingConsequences: [],
    processedConsequenceIds: [],
  };
}

function isEligible(
  event: LifeEvent,
  character: Character,
  progress: EventProgress,
): boolean {
  const { age, currentYear, currentMonth, birthInformation, stats, family } = character;
  const location = birthInformation.location;
  const educationRecord = character.educationRecord;
  const digitalAccounts = character.digitalLife?.accounts ?? [];
  if (age < event.minAge || age > event.maxAge) return false;
  if (event.minYear !== undefined && currentYear < event.minYear) return false;
  if (event.maxYear !== undefined && currentYear > event.maxYear) return false;
  if (event.calendarMonth !== undefined && event.calendarMonth !== currentMonth) return false;
  if (event.countryCode && event.countryCode !== location.countryCode) return false;
  if (event.province && event.province !== location.province) return false;
  if (event.city && event.city !== location.city) return false;
  if (event.familyConditions
    && !event.familyConditions.includes(family.parentCondition)) return false;
  if (event.occupationRequirement === 'employed' && character.careerRecord.status !== 'employed') return false;
  if (event.occupationRequirement === 'unemployed' && character.careerRecord.status === 'employed') return false;
  if (event.requiredOccupation && (
    !character.careerRecord.currentOccupationId
    || !event.requiredOccupation.includes(character.careerRecord.currentOccupationId)
  )) return false;
  if (event.educationRequirement && !event.educationRequirement.some(
    (requirement) => getEducationRequirementKeys(character.educationRecord).includes(requirement),
  )) return false;
  if (event.educationStatusRequirements
    && !event.educationStatusRequirements.includes(educationRecord.status)) return false;
  if (event.academicStandingRequirements) {
    const latestStanding = educationRecord.semesters[educationRecord.semesters.length - 1]?.standing;
    if (!latestStanding || !event.academicStandingRequirements.includes(latestStanding)) return false;
  }
  if (event.careerRequirements) {
    const career = character.careerRecord;
    if (event.careerRequirements.minExperienceYears !== undefined
      && career.experienceYears < event.careerRequirements.minExperienceYears) return false;
    if (event.careerRequirements.minSatisfaction !== undefined
      && career.satisfaction < event.careerRequirements.minSatisfaction) return false;
    if (event.careerRequirements.minProfessionalReputation !== undefined
      && career.professionalReputation < event.careerRequirements.minProfessionalReputation) return false;
    if (event.careerRequirements.maxPositionIndex !== undefined
      && career.positionIndex > event.careerRequirements.maxPositionIndex) return false;
    if (event.careerRequirements.requiresAvailablePromotion && !canReceivePromotion(character)) return false;
  }
  if (event.requiredDigitalPlatform
    && !digitalAccounts.some((account) => account.platform === event.requiredDigitalPlatform)) return false;
  if (event.requiresMonetizedDigitalAccount
    && !digitalAccounts.some((account) => account.monetized
      && (!event.requiredDigitalPlatform || account.platform === event.requiredDigitalPlatform))) return false;
  if (event.minDigitalAudience !== undefined
    && digitalAccounts.reduce((total, account) => total + account.followers + account.subscribers, 0)
      < event.minDigitalAudience) return false;
  if (event.minCash !== undefined && character.cash < event.minCash) return false;
  if (event.maxCash !== undefined && character.cash > event.maxCash) return false;
  if (event.minDebt !== undefined && character.debt < event.minDebt) return false;
  if (event.maxDebt !== undefined && character.debt > event.maxDebt) return false;
  const assetValue = character.startingAssets.nonCashValue
    + character.assets.reduce((total, asset) => total + asset.value, 0);
  if (event.minAssetValue !== undefined && assetValue < event.minAssetValue) return false;
  if (event.maxAssetValue !== undefined && assetValue > event.maxAssetValue) return false;
  if (event.maritalStatuses && !event.maritalStatuses.includes(character.maritalStatus)) return false;
  if (event.legalStatuses && !event.legalStatuses.includes(character.legalStatus)) return false;
  if (event.requiredOrganizationIds?.some(
    (id) => !character.organizations.some((member) => member.id === id && member.status === 'active'),
  )) return false;
  if (event.once && progress.completedEventIds.includes(event.id)) return false;
  if (event.followUpOnly && !progress.pendingEventIds.includes(event.id)) return false;
  if (event.requiresCompletedEventIds?.some(
    (id) => !progress.completedEventIds.includes(id),
  )) return false;
  if (event.excludesCompletedEventIds?.some(
    (id) => progress.completedEventIds.includes(id),
  )) return false;

  const lastYear = progress.lastEventYears[event.id];
  if (lastYear !== undefined
    && currentYear - lastYear < (event.cooldownYears ?? 0)) return false;
  if (event.cooldownMonths !== undefined) {
    const currentMonthIndex = currentYear * 12 + currentMonth;
    const lastMonthIndex = progress.lastEventMonths?.[event.id] ?? (
      lastYear === undefined ? undefined : lastYear * 12
    );
    if (lastMonthIndex !== undefined
      && currentMonthIndex - lastMonthIndex < event.cooldownMonths) return false;
  }

  if (event.statRequirements && Object.entries(event.statRequirements).some(([key, range]) => {
    const value = stats[key as keyof typeof stats];
    return (range.min !== undefined && value < range.min)
      || (range.max !== undefined && value > range.max);
  })) return false;

  if (event.relationshipRequirements?.some((requirement) => {
    const member = family.members.find((item) => item.role === requirement.role);
    if (!member || member.status !== 'alive') return true;
    return (requirement.min !== undefined && member.relationship < requirement.min)
      || (requirement.max !== undefined && member.relationship > requirement.max);
  })) return false;

  if (event.socialRelationshipRequirements?.some((requirement) => (
    !character.relationships.some((relationship) => (
      relationship.status === (requirement.status ?? 'active')
      && (!requirement.kind || relationship.kind === requirement.kind)
      && (requirement.minScore === undefined || relationship.score >= requirement.minScore)
      && (requirement.minTrust === undefined || relationship.trust >= requirement.minTrust)
      && (requirement.minLoyalty === undefined || relationship.loyalty >= requirement.minLoyalty)
    ))
  ))) return false;

  return true;
}

function randomUnit(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0.5;
}

function getEventWeight(event: LifeEvent, character: Character): number {
  const category = affinityCategories[event.category] ?? event.category;
  return adjustEventWeightForPersonality(1, category, character.personality);
}

export function selectLifeEvent(
  character: Character,
  progress: EventProgress,
  random: () => number = Math.random,
  events: LifeEvent[] = lifeEventLibrary,
): LifeEvent | null {
  const eligible = events.filter((event) => isEligible(event, character, progress));
  const queued = eligible.filter((event) => progress.pendingEventIds.includes(event.id));
  const scheduled = eligible.filter((event) => (
    event.calendarMonth === character.currentMonth && event.calendarMomentType
  ));
  const pool = queued.length > 0
    ? queued
    : scheduled.length > 0
      ? scheduled
      : eligible.filter((event) => !event.followUpOnly);
  if (pool.length === 0) return null;

  if (queued.length === 0 && scheduled.length === 0) {
    const annualProbability = Math.min(1, Math.max(...pool.map((event) => (
      Math.max(0, Math.min(1, event.probability ?? 0.25))
        * getEventWeight(event, character)
    ))));
    const monthlyProbability = 1 - ((1 - annualProbability) ** (1 / 12));
    if (randomUnit(random) >= monthlyProbability) return null;
  }

  const weighted = pool.map((event) => ({
    event,
    weight: getEventWeight(event, character)
      * Math.max(0.01, Math.min(1, event.probability ?? 0.25)),
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return null;

  let choice = randomUnit(random) * totalWeight;
  for (const item of weighted) {
    choice -= item.weight;
    if (choice < 0) return item.event;
  }
  return weighted[weighted.length - 1].event;
}

export function getChoiceUnavailableReason(
  character: Character,
  choice: EventChoice,
): string | null {
  const requirements = choice.requirements;
  const minimumCash = Math.max(choice.minimumCash ?? 0, requirements?.minCash ?? 0);
  if (character.cash < minimumCash) return 'Saldo belum mencukupi untuk pilihan ini.';
  if (requirements?.maxDebt !== undefined && character.debt > requirements.maxDebt) {
    return 'Jumlah utang belum memenuhi syarat pilihan ini.';
  }
  const assetValue = character.startingAssets.nonCashValue
    + character.assets.reduce((total, asset) => total + asset.value, 0);
  if (requirements?.minAssetValue !== undefined && assetValue < requirements.minAssetValue) {
    return 'Aset karakter belum memenuhi syarat pilihan ini.';
  }
  if (requirements?.minStats && Object.entries(requirements.minStats).some(([key, value]) => (
    character.stats[key as keyof Character['stats']] < value
  ))) return 'Statistik karakter belum memenuhi syarat pilihan ini.';
  if (requirements?.requiredEducation
    && !requirements.requiredEducation.some(
      (requirement) => getEducationRequirementKeys(character.educationRecord).includes(requirement),
    )) {
    return 'Pendidikan karakter belum memenuhi syarat pilihan ini.';
  }
  if (requirements?.requiredOccupation
    && (!character.careerRecord.currentOccupationId
      || !requirements.requiredOccupation.includes(character.careerRecord.currentOccupationId))) {
    return 'Pekerjaan karakter belum memenuhi syarat pilihan ini.';
  }
  if (requirements?.requiredMaritalStatuses
    && !requirements.requiredMaritalStatuses.includes(character.maritalStatus)) {
    return 'Status hubungan karakter belum memenuhi syarat pilihan ini.';
  }
  if (requirements?.requiredLegalStatuses
    && !requirements.requiredLegalStatuses.includes(character.legalStatus)) {
    return 'Status hukum karakter belum memenuhi syarat pilihan ini.';
  }
  if (requirements?.requiredOrganizationIds?.some(
    (id) => !character.organizations.some((member) => member.id === id && member.status === 'active'),
  )) return 'Keanggotaan organisasi belum memenuhi syarat pilihan ini.';
  const digitalAccounts = character.digitalLife?.accounts ?? [];
  if (requirements?.requiredDigitalPlatform
    && !digitalAccounts.some((account) => account.platform === requirements.requiredDigitalPlatform)) {
    return 'Akun platform digital yang dibutuhkan belum tersedia.';
  }
  if (requirements?.requiresMonetizedDigitalAccount
    && !digitalAccounts.some((account) => account.monetized
      && (!requirements.requiredDigitalPlatform || account.platform === requirements.requiredDigitalPlatform))) {
    return 'Pilihan ini membutuhkan akun digital yang sudah dimonetisasi.';
  }
  if (requirements?.minDigitalAudience !== undefined
    && digitalAccounts.reduce((total, account) => total + account.followers + account.subscribers, 0)
      < requirements.minDigitalAudience) return 'Jumlah audiens digital belum memenuhi syarat pilihan ini.';
  return null;
}

export function recordEventChoice(
  progress: EventProgress,
  event: LifeEvent,
  choiceId: string,
  year: number,
  age: number,
  month = 1,
): EventProgress {
  const choice = event.choices.find((item) => item.id === choiceId);
  if (!choice) return progress;

  const pendingConsequences = [...progress.pendingConsequences];
  for (const delayed of choice.consequence.delayedConsequences ?? []) {
    const id = `${year}-${month}:${event.id}:${choice.id}:${delayed.id}`;
    if (progress.processedConsequenceIds.includes(id)
      || pendingConsequences.some((item) => item.id === id)) continue;
    pendingConsequences.push({
      ...delayed,
      id,
      sourceEventId: event.id,
      sourceChoiceId: choice.id,
      dueYear: year + Math.max(1, delayed.delayYears),
      expiresYear: delayed.expiresAfterYears === undefined
        ? undefined
        : year + Math.max(1, delayed.delayYears) + delayed.expiresAfterYears,
    });
  }

  return {
    ...progress,
    completedEventIds: event.once
      ? [...new Set([...progress.completedEventIds, event.id])]
      : progress.completedEventIds,
    lastEventYears: { ...progress.lastEventYears, [event.id]: year },
    lastEventMonths: {
      ...progress.lastEventMonths,
      [event.id]: year * 12 + month,
    },
    history: [
      ...progress.history,
      {
        eventId: event.id,
        title: event.title,
        category: event.category,
        year,
        month,
        age,
        choiceId,
        choiceLabel: choice.label,
        outcomeText: choice.consequence.historyText,
      },
    ],
    pendingEventIds: [...new Set([
      ...progress.pendingEventIds,
      ...(choice.consequence.followUpEventIds ?? []),
    ])],
    pendingConsequences,
  };
}

function isDelayedTriggerMet(
  scheduled: ScheduledConsequence,
  character: Character,
  progress: EventProgress,
): boolean {
  const trigger = scheduled.trigger;
  if (!trigger) return true;
  if (trigger.minAge !== undefined && character.age < trigger.minAge) return false;
  if (trigger.maxAge !== undefined && character.age > trigger.maxAge) return false;
  if (trigger.minCash !== undefined && character.cash < trigger.minCash) return false;
  if (trigger.minStats && Object.entries(trigger.minStats).some(([key, value]) => (
    character.stats[key as keyof Character['stats']] < value
  ))) return false;
  if (trigger.requiresCompletedEventIds?.some(
    (id) => !progress.completedEventIds.includes(id),
  )) return false;
  if (trigger.requiredOrganizationIds?.some(
    (id) => !character.organizations.some(
      (organization) => organization.id === id && organization.status === 'active',
    ),
  )) return false;
  return true;
}

export function processPendingConsequences(
  character: Character,
  progress: EventProgress,
): {
  character: Character;
  eventProgress: EventProgress;
  historyEntries: string[];
} {
  let nextCharacter = character;
  const historyEntries: string[] = [];
  const pendingEventIds = [...(progress.pendingEventIds ?? [])];
  const processedConsequenceIds = [...(progress.processedConsequenceIds ?? [])];
  const remaining: ScheduledConsequence[] = [];

  for (const scheduled of progress.pendingConsequences ?? []) {
    if (processedConsequenceIds.includes(scheduled.id)) continue;
    if (nextCharacter.currentYear < scheduled.dueYear) {
      remaining.push(scheduled);
      continue;
    }
    if (scheduled.expiresYear !== undefined && nextCharacter.currentYear > scheduled.expiresYear) {
      processedConsequenceIds.push(scheduled.id);
      historyEntries.push(
        `${nextCharacter.currentYear}: Kesempatan lanjutan dari event ${scheduled.sourceEventId} berakhir.`,
      );
      continue;
    }
    if (!isDelayedTriggerMet(scheduled, nextCharacter, progress)) {
      remaining.push(scheduled);
      continue;
    }

    nextCharacter = applyConsequence(nextCharacter, scheduled.consequence);
    pendingEventIds.push(...(scheduled.followUpEventIds ?? []));
    processedConsequenceIds.push(scheduled.id);
    historyEntries.push(`${nextCharacter.currentYear}: ${scheduled.historyText}`);
  }

  return {
    character: nextCharacter,
    eventProgress: {
      ...progress,
      pendingEventIds: [...new Set(pendingEventIds)],
      pendingConsequences: remaining,
      processedConsequenceIds: [...new Set(processedConsequenceIds)],
    },
    historyEntries,
  };
}

export function consumePendingEvent(progress: EventProgress, eventId: string): EventProgress {
  return {
    ...progress,
    pendingEventIds: progress.pendingEventIds.filter((id) => id !== eventId),
  };
}
