import type {
  Character,
  FamilyMember,
  RelationshipHistoryEntry,
  RomanticRelationshipStage,
  SocialRelationship,
} from '../types/game';
import { getNominalPriceFactor } from './worldEra';

export type RelationshipInteraction =
  | 'talk'
  | 'visit'
  | 'gift'
  | 'help'
  | 'ask_help'
  | 'apologize'
  | 'argue'
  | 'end';

export type FamilyInteraction = 'talk' | 'visit' | 'help' | 'apologize' | 'argue';
export type ChildInteraction = 'talk' | 'play' | 'study' | 'discipline';

export interface CharacterActionResult {
  character: Character;
  historyText: string;
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const nonNegative = (value: number) => Math.max(0, Math.round(value));

function getCashAndNetWorth(character: Character, cash: number) {
  const safeCash = nonNegative(cash);
  return {
    cash: safeCash,
    netWorth: Math.max(
      0,
      safeCash + character.startingAssets.nonCashValue
        + character.assets.reduce((total, asset) => total + asset.value, 0)
        - character.debt,
    ),
  };
}

function makeHistory(
  id: string,
  year: number,
  action: string,
  details: string,
): RelationshipHistoryEntry {
  return { id, year, action, details };
}

function updateRelationship(
  relationship: SocialRelationship,
  year: number,
  action: string,
  details: string,
  changes: { score?: number; trust?: number; loyalty?: number; status?: SocialRelationship['status']; stage?: RomanticRelationshipStage },
): SocialRelationship {
  return {
    ...relationship,
    score: clamp(relationship.score + (changes.score ?? 0)),
    trust: clamp(relationship.trust + (changes.trust ?? 0)),
    loyalty: clamp(relationship.loyalty + (changes.loyalty ?? 0)),
    status: changes.status ?? relationship.status,
    stage: changes.stage ?? relationship.stage,
    history: [
      ...(relationship.history ?? []),
      makeHistory(
        `${relationship.id}:${year}:${(relationship.history?.length ?? 0) + 1}`,
        year,
        action,
        details,
      ),
    ],
  };
}

function personalityModifier(character: Character, trait: 'friendly' | 'shy' | 'short_tempered'): number {
  return character.personality.traits.includes(trait) ? 0.05 : 0;
}

function eligibleSocialCharacter(character: Character): boolean {
  return character.status === 'alive' && character.age >= 6;
}

export function meetNewPerson(
  character: Character,
  random: () => number = Math.random,
): CharacterActionResult | null {
  if (!eligibleSocialCharacter(character)) return null;

  const roll = () => {
    const value = random();
    return Number.isFinite(value) ? Math.min(0.999999, Math.max(0, value)) : 0.5;
  };
  const genderRoll = roll();
  const gender = genderRoll < 0.48 ? 'female' : genderRoll < 0.96 ? 'male' : 'other';
  const names = gender === 'female'
    ? ['Ayu', 'Sari', 'Nadia', 'Intan', 'Maya', 'Dewi']
    : gender === 'male'
      ? ['Bima', 'Raka', 'Dimas', 'Arif', 'Bayu', 'Rizky']
      : ['Ari', 'Dara', 'Nara', 'Sasha'];
  const traits = ['friendly', 'disciplined', 'creative', 'ambitious', 'shy', 'brave'] as const;
  const id = `acquaintance-${character.id}-${character.currentYear}-${character.relationships.length + 1}`;
  const name = names[Math.floor(roll() * names.length)];
  const ageOffset = Math.floor(roll() * 7) - 3;
  const age = Math.max(6, character.age + ageOffset);
  const priceFactor = getNominalPriceFactor(character.currentYear);
  const relationship: SocialRelationship = {
    id,
    name,
    kind: 'friend',
    score: 35,
    trust: 30,
    loyalty: 25,
    status: 'active',
    startedYear: character.currentYear,
    stage: 'friend',
    profile: {
      age,
      gender,
      personality: { traits: [traits[Math.floor(roll() * traits.length)]] },
      occupationId: null,
      educationLevel: age < 3 ? 'none' : age < 4 ? 'paud' : age < 6 ? 'tk' : age < 13 ? 'sd' : age < 16 ? 'smp' : age < 19 ? 'sma' : 'none',
      netWorth: Math.round((200_000 + roll() * 1_300_000) * priceFactor),
      health: 75 + Math.floor(roll() * 21),
      lifeStatus: 'alive',
    },
    history: [makeHistory(`${id}:first-meeting`, character.currentYear, 'berkenalan', 'Pertemuan pertama tercatat.')],
  };
  return {
    character: { ...character, relationships: [...character.relationships, relationship] },
    historyText: `Berkenalan dengan ${name}.`,
  };
}

export function interactWithRelationship(
  character: Character,
  relationshipId: string,
  action: RelationshipInteraction,
): CharacterActionResult | null {
  const relationship = character.relationships.find((item) => item.id === relationshipId);
  if (!relationship || relationship.status === 'ended'
    || relationship.profile?.lifeStatus === 'deceased'
    || !eligibleSocialCharacter(character)) return null;
  if (action === 'end' && relationship.stage === 'married') return null;
  if (action === 'apologize' && relationship.status !== 'strained') return null;

  const priceFactor = getNominalPriceFactor(character.currentYear);
  const costs: Partial<Record<RelationshipInteraction, number>> = {
    visit: Math.round(25_000 * priceFactor),
    gift: Math.round(150_000 * priceFactor),
    help: Math.round(300_000 * priceFactor),
  };
  const cost = costs[action] ?? 0;
  if (character.cash < cost) return null;
  if (action === 'ask_help'
    && (relationship.trust < 55 || (relationship.profile?.netWorth ?? 0) < 100_000 * priceFactor)) return null;

  const outcomes: Record<RelationshipInteraction, {
    label: string;
    details: string;
    score: number;
    trust: number;
    loyalty: number;
    happiness: number;
    status?: SocialRelationship['status'];
    stage?: RomanticRelationshipStage;
  }> = {
    talk: { label: 'berbicara', details: 'Meluangkan waktu untuk berbincang.', score: 3, trust: 2, loyalty: 1, happiness: 1 },
    visit: { label: 'berkunjung', details: 'Mengunjungi dan mempererat hubungan.', score: 5, trust: 3, loyalty: 2, happiness: 1 },
    gift: { label: 'memberi hadiah', details: 'Memberikan hadiah sederhana.', score: 7, trust: 4, loyalty: 3, happiness: 1 },
    help: { label: 'memberi bantuan', details: 'Memberi bantuan nyata saat dibutuhkan.', score: 5, trust: 6, loyalty: 6, happiness: 1 },
    ask_help: { label: 'meminta bantuan', details: 'Meminta dukungan dan menyepakati bantuan.', score: 2, trust: 1, loyalty: 2, happiness: 1 },
    apologize: { label: 'meminta maaf', details: 'Mengakui dampak tindakan dan berusaha memperbaiki keadaan.', score: 8, trust: 10, loyalty: 5, happiness: 2, status: 'active' },
    argue: { label: 'berselisih', details: 'Perbedaan pendapat memicu ketegangan.', score: -10, trust: -12, loyalty: -8, happiness: -2, status: 'strained' },
    end: { label: 'mengakhiri hubungan', details: 'Memilih untuk mengakhiri hubungan ini.', score: -5, trust: -5, loyalty: -10, happiness: -1, status: 'ended', stage: 'ended' },
  };
  const outcome = outcomes[action];
  const updated = updateRelationship(
    relationship,
    character.currentYear,
    outcome.label,
    outcome.details,
    outcome,
  );
  const relationships = character.relationships.map((item) => item.id === relationshipId ? updated : item);
  const cashDelta = action === 'ask_help'
    ? Math.min(Math.round(250_000 * priceFactor), relationship.profile?.netWorth ?? 0)
    : -cost;
  const profile = action === 'ask_help' && updated.profile
    ? { ...updated.profile, netWorth: nonNegative(updated.profile.netWorth - cashDelta) }
    : updated.profile;
  const nextRelationships = relationships.map((item) => (
    item.id === relationshipId ? { ...item, profile } : item
  ));
  const maritalStatus = action === 'end' && ['dating', 'engaged'].includes(relationship.stage ?? '')
    ? 'single'
    : character.maritalStatus;
  const cashAndWorth = getCashAndNetWorth(character, character.cash + cashDelta);
  return {
    character: {
      ...character,
      relationships: nextRelationships,
      maritalStatus,
      spouseName: maritalStatus === 'single' ? null : character.spouseName,
      cash: cashAndWorth.cash,
      netWorth: cashAndWorth.netWorth,
      stats: { ...character.stats, happiness: clamp(character.stats.happiness + outcome.happiness) },
      lastYearExpenses: nonNegative(character.lastYearExpenses + cost),
      lastYearIncome: nonNegative(character.lastYearIncome + Math.max(0, cashDelta)),
    },
    historyText: `${outcome.label} dengan ${relationship.name}.`,
  };
}

export function interactWithFamilyMember(
  character: Character,
  memberId: string,
  action: FamilyInteraction,
): CharacterActionResult | null {
  const member = character.family.members.find((item) => item.id === memberId);
  if (!member || member.status !== 'alive' || character.status !== 'alive') return null;
  if (action === 'apologize' && member.relationship >= 50) return null;

  const priceFactor = getNominalPriceFactor(character.currentYear);
  const cost = action === 'visit' ? Math.round(20_000 * priceFactor)
    : action === 'help' ? Math.round(200_000 * priceFactor) : 0;
  if (character.cash < cost) return null;
  const changes = {
    talk: { relationship: 3, trust: 2, loyalty: 1, happiness: 1, text: 'berbicara dengan' },
    visit: { relationship: 5, trust: 3, loyalty: 2, happiness: 1, text: 'mengunjungi' },
    help: { relationship: 4, trust: 5, loyalty: 5, happiness: 1, text: 'membantu' },
    apologize: { relationship: 7, trust: 8, loyalty: 4, happiness: 1, text: 'meminta maaf kepada' },
    argue: { relationship: -9, trust: -10, loyalty: -7, happiness: -2, text: 'berselisih dengan' },
  }[action];
  const updatedMember: FamilyMember = {
    ...member,
    relationship: clamp(member.relationship + changes.relationship),
    trust: clamp(member.trust + changes.trust),
    loyalty: clamp(member.loyalty + changes.loyalty),
    history: [
      ...(member.history ?? []),
      `${character.currentYear}: ${changes.text} ${member.name}.`,
    ],
  };
  const cashAndWorth = getCashAndNetWorth(character, character.cash - cost);
  return {
    character: {
      ...character,
      family: {
        ...character.family,
        members: character.family.members.map((item) => item.id === memberId ? updatedMember : item),
      },
      cash: cashAndWorth.cash,
      netWorth: cashAndWorth.netWorth,
      stats: { ...character.stats, happiness: clamp(character.stats.happiness + changes.happiness) },
      lastYearExpenses: nonNegative(character.lastYearExpenses + cost),
    },
    historyText: `${changes.text} ${member.name}.`,
  };
}

export function interactWithChild(
  character: Character,
  childId: string,
  action: ChildInteraction,
): CharacterActionResult | null {
  const child = character.children.find((item) => item.id === childId);
  const childAge = child ? character.currentYear - child.birthYear : -1;
  if (!child || child.lifeStatus === 'deceased' || childAge < 0 || childAge > 17
    || character.status !== 'alive') return null;
  if (action === 'study' && childAge < 5) return null;
  const effects = {
    talk: { relationship: 3, trust: 2, loyalty: 1, happiness: 1, intelligence: 0, cost: 0, text: 'berbicara dengan' },
    play: { relationship: 4, trust: 2, loyalty: 2, happiness: 3, intelligence: 0, cost: 0, text: 'bermain bersama' },
    study: { relationship: 2, trust: 1, loyalty: 1, happiness: 1, intelligence: 2, cost: 0, text: 'belajar bersama' },
    discipline: { relationship: -2, trust: -2, loyalty: 1, happiness: -1, intelligence: 0, cost: 0, text: 'menetapkan batas dengan' },
  }[action];
  const updatedChild = {
    ...child,
    relationship: clamp(child.relationship + effects.relationship),
    trust: clamp((child.trust ?? child.relationship) + effects.trust),
    loyalty: clamp((child.loyalty ?? child.relationship) + effects.loyalty),
    happiness: clamp((child.happiness ?? 60) + effects.happiness),
    intelligence: clamp((child.intelligence ?? 50) + effects.intelligence),
    history: [...(child.history ?? []), `${character.currentYear}: ${effects.text} ${child.name}.`],
  };
  return {
    character: {
      ...character,
      children: character.children.map((item) => item.id === childId ? updatedChild : item),
      stats: { ...character.stats, happiness: clamp(character.stats.happiness + effects.happiness) },
    },
    historyText: `${effects.text} ${child.name}.`,
  };
}

function withRomanceHistory(
  character: Character,
  relationship: SocialRelationship,
  stage: RomanticRelationshipStage,
  kind: SocialRelationship['kind'],
  action: string,
  details: string,
  scoreChange = 0,
  trustChange = 0,
): SocialRelationship {
  return {
    ...updateRelationship(relationship, character.currentYear, action, details, {
    score: scoreChange,
    trust: trustChange,
    stage,
    status: stage === 'ended' ? 'ended' : stage === 'separated' ? 'strained' : relationship.status,
    }),
    kind,
    generation: stage === 'married' ? relationship.generation ?? 0 : relationship.generation,
  };
}

export function askToDate(
  character: Character,
  relationshipId: string,
  random: () => number = Math.random,
): CharacterActionResult | null {
  const partner = character.relationships.find((item) => item.id === relationshipId);
  if (!partner || partner.status !== 'active' || partner.stage !== 'friend'
    || character.age < 16 || (partner.profile?.age ?? character.age) < 16
    || ['partnered', 'engaged', 'married'].includes(character.maritalStatus)) return null;
  const chance = Math.max(0.2, Math.min(
    0.9,
    0.2 + ((partner.score + partner.trust) / 200)
      + personalityModifier(character, 'friendly')
      - personalityModifier(character, 'shy'),
  ));
  const rawRoll = random();
  const roll = Number.isFinite(rawRoll) ? Math.min(0.999999, Math.max(0, rawRoll)) : 0.5;
  const success = roll < chance;
  const updated = success
    ? { ...withRomanceHistory(character, partner, 'dating', 'romantic_partner', 'mulai berpacaran', 'Keduanya sepakat mencoba hubungan romantis.', 5, 5), kind: 'romantic_partner' as const }
    : updateRelationship(partner, character.currentYear, 'mengajak berpacaran', 'Ajakan belum diterima; pertemanan masih berlanjut.', { score: -5, trust: -2 });
  return {
    character: {
      ...character,
      relationships: character.relationships.map((item) => item.id === relationshipId ? updated : item),
      maritalStatus: success ? 'partnered' : character.maritalStatus,
      stats: { ...character.stats, happiness: clamp(character.stats.happiness + (success ? 4 : -1)) },
    },
    historyText: success
      ? `Memulai hubungan dengan ${partner.name}.`
      : `Ajakan berpacaran kepada ${partner.name} belum diterima.`,
  };
}

export function proposeEngagement(
  character: Character,
  relationshipId: string,
  random: () => number = Math.random,
): CharacterActionResult | null {
  const partner = character.relationships.find((item) => item.id === relationshipId);
  if (!partner || partner.status !== 'active' || partner.stage !== 'dating'
    || character.age < 18 || (partner.profile?.age ?? character.age) < 18
    || partner.score < 45 || partner.trust < 45) return null;
  const chance = Math.max(0.5, Math.min(0.95, (partner.score + partner.trust) / 200));
  const rawRoll = random();
  const roll = Number.isFinite(rawRoll) ? Math.min(0.999999, Math.max(0, rawRoll)) : 0.5;
  const success = roll < chance;
  const updated = success
    ? withRomanceHistory(character, partner, 'engaged', 'romantic_partner', 'bertunangan', 'Lamaran diterima dan pasangan mulai merencanakan pernikahan.', 5, 5)
    : updateRelationship(partner, character.currentYear, 'melamar', 'Lamaran belum diterima; pasangan perlu membicarakan rencana bersama.', { score: -7, trust: -8 });
  return {
    character: {
      ...character,
      relationships: character.relationships.map((item) => item.id === relationshipId ? updated : item),
      maritalStatus: success ? 'engaged' : character.maritalStatus,
      stats: { ...character.stats, happiness: clamp(character.stats.happiness + (success ? 5 : -2)) },
    },
    historyText: success ? `Bertunangan dengan ${partner.name}.` : `Lamaran kepada ${partner.name} belum diterima.`,
  };
}

export function marryPartner(
  character: Character,
  relationshipId: string,
  wedding: 'simple' | 'celebration',
): CharacterActionResult | null {
  const partner = character.relationships.find((item) => item.id === relationshipId);
  if (!partner || partner.status !== 'active' || partner.stage !== 'engaged'
    || character.age < 18 || (partner.profile?.age ?? character.age) < 18
    || character.maritalStatus !== 'engaged') return null;
  const factor = getNominalPriceFactor(character.currentYear);
  const cost = Math.round((wedding === 'simple' ? 500_000 : 5_000_000) * factor);
  if (character.cash < cost) return null;
  const updated = withRomanceHistory(
    character,
    partner,
    'married',
    'spouse',
    'menikah',
    wedding === 'simple' ? 'Menikah dalam acara sederhana yang sesuai kemampuan.' : 'Menikah dalam perayaan keluarga.',
    8,
    8,
  );
  const cashAndWorth = getCashAndNetWorth(character, character.cash - cost);
  return {
    character: {
      ...character,
      relationships: character.relationships.map((item) => item.id === relationshipId ? updated : item),
      maritalStatus: 'married',
      spouseName: partner.name,
      cash: cashAndWorth.cash,
      netWorth: cashAndWorth.netWorth,
      lastYearExpenses: nonNegative(character.lastYearExpenses + cost),
      stats: { ...character.stats, happiness: clamp(character.stats.happiness + 6) },
      family: {
        ...character.family,
        history: [...character.family.history, `${character.currentYear}: ${character.identity.firstName} menikah dengan ${partner.name}.`],
      },
    },
    historyText: `Menikah dengan ${partner.name}.`,
  };
}

export function divorcePartner(character: Character): CharacterActionResult | null {
  const partner = character.relationships.find((item) => item.stage === 'married' && item.status === 'active');
  if (!partner || character.maritalStatus !== 'married') return null;
  const factor = getNominalPriceFactor(character.currentYear);
  const fee = Math.round(250_000 * factor);
  if (character.cash < fee) return null;
  const settlement = Math.round(Math.max(0, character.cash - fee) * 0.1);
  const updated = withRomanceHistory(
    character,
    partner,
    'separated',
    'romantic_partner',
    'bercerai',
    'Pernikahan berakhir melalui kesepakatan perceraian.',
    -15,
    -20,
  );
  const cashAndWorth = getCashAndNetWorth(character, character.cash - fee - settlement);
  const relationships = character.relationships.map((item) => (
    item.id === partner.id
      ? { ...updated, profile: updated.profile
        ? { ...updated.profile, netWorth: nonNegative(updated.profile.netWorth + settlement) }
        : updated.profile }
      : item
  ));
  return {
    character: {
      ...character,
      relationships,
      maritalStatus: 'separated',
      spouseName: null,
      cash: cashAndWorth.cash,
      netWorth: cashAndWorth.netWorth,
      lastYearExpenses: nonNegative(character.lastYearExpenses + fee + settlement),
      stats: { ...character.stats, happiness: clamp(character.stats.happiness - 8) },
      family: {
        ...character.family,
        history: [...character.family.history, `${character.currentYear}: Pernikahan dengan ${partner.name} berakhir.`],
      },
    },
    historyText: `Bercerai dari ${partner.name}; penyelesaian aset dicatat.`,
  };
}

export function endRelationship(character: Character, relationshipId: string): CharacterActionResult | null {
  const partner = character.relationships.find((item) => item.id === relationshipId);
  if (!partner || partner.stage !== 'dating' || character.maritalStatus !== 'partnered') return null;
  const updated = withRomanceHistory(character, partner, 'ended', 'romantic_partner', 'mengakhiri hubungan', 'Hubungan romantis berakhir.', -12, -15);
  return {
    character: {
      ...character,
      relationships: character.relationships.map((item) => item.id === relationshipId ? { ...updated, status: 'ended' } : item),
      maritalStatus: 'single',
      stats: { ...character.stats, happiness: clamp(character.stats.happiness - 5) },
    },
    historyText: `Mengakhiri hubungan dengan ${partner.name}.`,
  };
}

export function getCurrentSpouse(character: Character): SocialRelationship | undefined {
  return character.relationships.find((item) => (
    item.stage === 'married'
    && item.status !== 'ended'
    && item.profile?.lifeStatus !== 'deceased'
  ));
}

export function getVisibleRelationships(character: Character): SocialRelationship[] {
  const spouse = getCurrentSpouse(character);
  return character.relationships
    .filter((item) => item.kind !== 'child'
      && item.status !== 'ended'
      && item.stage !== 'ended'
      && item.stage !== 'separated')
    .sort((first, second) => (
      Number(second.id === spouse?.id) - Number(first.id === spouse?.id)
    ));
}
