import { create } from 'zustand';
import type {
  CareerChange,
  Character,
  CharacterIdentity,
  ChildRecord,
  EventProgress,
  LifeEvent,
  StudyEffort,
} from '../types/game';
import { ageUp } from '../engine/agingEngine';
import { applyConsequence } from '../engine/consequenceEngine';
import { getCharacterName } from '../engine/characterCreation';
import { lifeEventLibrary } from '../data/events';
import {
  applyForScholarship,
  createEducationRecordFromLegacy,
  dropOut,
  enrollInProgram,
  resumeEducation,
  setStudyEffort,
  takeAcademicLeave,
  transferUniversity,
} from '../engine/educationEngine';
import {
  applyCareerChange,
  acceptJobOffer,
  applyForOccupation as applyForCareer,
  createCareerRecordFromLegacy,
  declineJobOffer,
} from '../engine/careerEngine';
import {
  createEmptyEventProgress,
  getChoiceUnavailableReason,
  recordEventChoice,
} from '../engine/eventEngine';
import { loadActiveGame, createActiveGameIfAbsent, saveActiveGame } from '../persistence/gameSave';
import {
  askToDate,
  divorcePartner as divorce,
  endRelationship,
  interactWithChild,
  interactWithFamilyMember,
  interactWithRelationship,
  marryPartner,
  meetNewPerson,
  proposeEngagement,
  type ChildInteraction,
  type FamilyInteraction,
  type RelationshipInteraction,
} from '../engine/relationshipEngine';
import {
  createChild,
  normalizeFamilyRecords,
  setChildParentingStyle,
} from '../engine/familyEngine';
import {
  buyProperty,
  closeBusiness,
  invest,
  normalizeEconomyRecord,
  repayLoan,
  sellInvestment,
  sellProperty,
  setMonthlyBudget,
  startBusiness,
  takeLoan,
  type MonthlyBudget,
} from '../engine/economyEngine';

export type PersistenceStatus = 'loading' | 'unsaved' | 'saving' | 'saved' | 'error';

interface GameState {
  character: Character | null;
  history: string[];
  activeEvent: LifeEvent | null;
  eventProgress: EventProgress;
  isAdvancing: boolean;
  isHydrated: boolean;
  persistenceStatus: PersistenceStatus;
  persistenceError: string | null;
  hydrate: () => Promise<void>;
  startLife: (character: Character) => Promise<boolean>;
  updateCharacterIdentity: (identity: CharacterIdentity) => Promise<boolean>;
  chooseEventChoice: (choiceId: string) => Promise<boolean>;
  advanceYear: (random?: () => number) => Promise<boolean>;
  enrollInProgram: (programId: string, universityId: string) => Promise<boolean>;
  applyForScholarship: (scholarshipId: string) => Promise<boolean>;
  setStudyEffort: (effort: StudyEffort) => Promise<boolean>;
  takeAcademicLeave: () => Promise<boolean>;
  resumeEducation: () => Promise<boolean>;
  dropOut: () => Promise<boolean>;
  transferUniversity: (universityId: string) => Promise<boolean>;
  applyForOccupation: (occupationId: string) => Promise<boolean>;
  acceptJobOffer: (applicationId: string) => Promise<boolean>;
  declineJobOffer: (applicationId: string) => Promise<boolean>;
  changeCareer: (change: CareerChange) => Promise<boolean>;
  meetNewPerson: (random?: () => number) => Promise<boolean>;
  interactWithRelationship: (relationshipId: string, action: RelationshipInteraction) => Promise<boolean>;
  interactWithFamilyMember: (memberId: string, action: FamilyInteraction) => Promise<boolean>;
  interactWithChild: (childId: string, action: ChildInteraction) => Promise<boolean>;
  askToDate: (relationshipId: string, random?: () => number) => Promise<boolean>;
  proposeEngagement: (relationshipId: string, random?: () => number) => Promise<boolean>;
  marryPartner: (relationshipId: string, wedding: 'simple' | 'celebration') => Promise<boolean>;
  divorcePartner: () => Promise<boolean>;
  endRelationship: (relationshipId: string) => Promise<boolean>;
  createChild: (name: string, adopted?: boolean) => Promise<boolean>;
  setChildParentingStyle: (
    childId: string,
    style: NonNullable<ChildRecord['parentingStyle']>,
  ) => Promise<boolean>;
  setMonthlyBudget: (budget: MonthlyBudget) => Promise<boolean>;
  buyProperty: (propertyId: string) => Promise<boolean>;
  sellProperty: (assetId: string) => Promise<boolean>;
  invest: (amount: number, kind: 'deposit' | 'balanced_fund') => Promise<boolean>;
  sellInvestment: (assetId: string) => Promise<boolean>;
  takeLoan: (amount: number, purpose: 'personal' | 'business' | 'property') => Promise<boolean>;
  repayLoan: (loanId: string, amount: number) => Promise<boolean>;
  startBusiness: (kind: 'food_stall' | 'grocery' | 'craft_shop', name: string) => Promise<boolean>;
  closeBusiness: (businessId: string) => Promise<boolean>;
  saveCurrentGame: () => Promise<boolean>;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function restoreCharacter(character: Character): Character {
  const { city, province } = character.birthInformation.location;
  const legacyCharacter = character as Character & {
    education?: string;
    occupation?: string | null;
  };
  return normalizeEconomyRecord(normalizeFamilyRecords({
    ...character,
    educationRecord: character.educationRecord
      ?? createEducationRecordFromLegacy(legacyCharacter.education, character.currentYear),
    careerRecord: character.careerRecord
      ?? createCareerRecordFromLegacy(legacyCharacter.occupation, character.currentYear),
    family: {
      ...character.family,
      members: character.family.members.map((member) => ({
        ...member,
        trust: member.trust ?? member.relationship,
        loyalty: member.loyalty ?? member.relationship,
      })),
    },
    birthEvent: character.birthEvent ?? {
      id: 'birth-recorded',
      title: 'Hari kelahiran',
      description: `Lahir di ${city}, ${province}; ini menjadi catatan awal perjalanan.`,
      statChanges: {},
    },
    deathRecord: character.deathRecord ?? null,
    lastYearIncome: character.lastYearIncome ?? 0,
    lastYearExpenses: character.lastYearExpenses ?? 0,
    debt: character.debt ?? 0,
    assets: character.assets ?? [],
    relationships: character.relationships ?? [],
    children: character.children ?? [],
    maritalStatus: character.maritalStatus ?? 'single',
    spouseName: character.spouseName ?? null,
    legalStatus: character.legalStatus ?? 'clear',
    organizations: character.organizations ?? [],
  }));
}

function restoreEventProgress(progress?: Partial<EventProgress> | null): EventProgress {
  const defaults = createEmptyEventProgress();
  const history = (progress?.history ?? []).map((entry) => {
    const sourceEvent = lifeEventLibrary.find((event) => event.id === entry.eventId);
    const sourceChoice = sourceEvent?.choices.find((choice) => choice.id === entry.choiceId);
    const hasSavedChoiceLabel = entry.choiceLabel && entry.choiceLabel !== entry.choiceId;
    const hasSavedOutcome = entry.outcomeText
      && entry.outcomeText !== 'Pilihan disimpan dari versi sebelumnya.';
    return {
      ...entry,
      category: sourceEvent?.category ?? entry.category ?? 'random_life',
      choiceLabel: hasSavedChoiceLabel ? entry.choiceLabel : sourceChoice?.label ?? 'Pilihan lama',
      outcomeText: hasSavedOutcome
        ? entry.outcomeText
        : 'Rincian hasil pilihan tidak tersedia pada versi sebelumnya.',
    };
  });
  return {
    ...defaults,
    ...progress,
    completedEventIds: progress?.completedEventIds ?? defaults.completedEventIds,
    lastEventYears: progress?.lastEventYears ?? defaults.lastEventYears,
    history,
    pendingEventIds: progress?.pendingEventIds ?? defaults.pendingEventIds,
    pendingConsequences: progress?.pendingConsequences ?? defaults.pendingConsequences,
    processedConsequenceIds: progress?.processedConsequenceIds ?? defaults.processedConsequenceIds,
  };
}

export const useGameStore = create<GameState>((set, get) => {
  async function commitCharacterAction(
    result: { character: Character; historyText: string } | null,
  ): Promise<boolean> {
    const state = get();
    if (!result || !state.character || state.activeEvent || state.isAdvancing
      || state.persistenceStatus === 'saving' || state.character.status !== 'alive') return false;
    const history = [...state.history, `${state.character.currentYear}: ${result.historyText}`];
    set({ persistenceStatus: 'saving', persistenceError: null });
    try {
      await saveActiveGame({
        character: result.character,
        history,
        activeEvent: state.activeEvent,
        eventProgress: state.eventProgress,
      });
      set({
        character: result.character,
        history,
        persistenceStatus: 'saved',
        persistenceError: null,
      });
      return true;
    } catch (error) {
      set({
        persistenceStatus: 'error',
        persistenceError: `Perubahan belum tersimpan: ${getErrorMessage(error)}`,
      });
      return false;
    }
  }

  async function saveSnapshot(): Promise<boolean> {
    const state = get();
    if (!state.character) return false;
    if (state.isAdvancing || state.persistenceStatus === 'saving') return false;

    set({ persistenceStatus: 'saving', persistenceError: null });
    try {
      await saveActiveGame({
        character: state.character,
        history: state.history,
        activeEvent: state.activeEvent,
        eventProgress: state.eventProgress,
      });
      set({ persistenceStatus: 'saved', persistenceError: null });
      return true;
    } catch (error) {
      set({
        persistenceStatus: 'error',
        persistenceError: `Permainan belum tersimpan: ${getErrorMessage(error)}`,
      });
      return false;
    }
  }

  return {
    character: null,
    history: [],
    activeEvent: null,
    eventProgress: createEmptyEventProgress(),
    isAdvancing: false,
    isHydrated: false,
    persistenceStatus: 'loading',
    persistenceError: null,

    hydrate: async () => {
      set({ persistenceStatus: 'loading', persistenceError: null });
      try {
        const save = await loadActiveGame();
        if (save && save.version !== 3 && save.version !== 4 && save.version !== 5 && save.version !== 6) {
          throw new Error(`Versi data simpanan ${save.version} belum didukung.`);
        }
        set(save
          ? {
            character: restoreCharacter(save.character),
            history: save.history,
            activeEvent: save.activeEvent,
            eventProgress: restoreEventProgress(save.eventProgress),
            isAdvancing: false,
            isHydrated: true,
            persistenceStatus: 'saved',
            persistenceError: null,
          }
          : {
            character: null,
            history: [],
            activeEvent: null,
            eventProgress: createEmptyEventProgress(),
            isAdvancing: false,
            isHydrated: true,
            persistenceStatus: 'unsaved',
            persistenceError: null,
          });
      } catch (error) {
        set({
          isHydrated: true,
          persistenceStatus: 'error',
          persistenceError: `Simpanan tidak dapat dimuat: ${getErrorMessage(error)}`,
        });
      }
    },

    startLife: async (character) => {
      if (get().character || get().persistenceStatus === 'saving') return false;

      const game = {
        character,
        history: [
          `${character.currentYear}: ${character.birthEvent.description}`,
        ],
        activeEvent: null,
        eventProgress: createEmptyEventProgress(),
      };
      set({ persistenceStatus: 'saving', persistenceError: null });

      try {
        const created = await createActiveGameIfAbsent(game);
        if (!created) {
          await get().hydrate();
          return false;
        }
        set({
          ...game,
          isAdvancing: false,
          isHydrated: true,
          persistenceStatus: 'saved',
          persistenceError: null,
        });
        return true;
      } catch (error) {
        set({
          persistenceStatus: 'error',
          persistenceError: `Karakter belum dapat disimpan: ${getErrorMessage(error)}`,
        });
        return false;
      }
    },

    updateCharacterIdentity: async (identity) => {
      const state = get();
      if (!state.character
        || state.isAdvancing
        || state.persistenceStatus === 'saving'
        || !identity.firstName.trim()
        || !identity.lastName.trim()) return false;
      const currentIdentity = state.character.identity;
      if (currentIdentity.firstName === identity.firstName
        && currentIdentity.lastName === identity.lastName
        && currentIdentity.gender === identity.gender
        && currentIdentity.avatarId === identity.avatarId) {
        return saveSnapshot();
      }

      const character = { ...state.character, identity };
      const history = [
        ...state.history,
        `${character.currentYear}: Identitas ${getCharacterName(character)} diperbarui.`,
      ];
      set({ persistenceStatus: 'saving', persistenceError: null });
      try {
        await saveActiveGame({
          character,
          history,
          activeEvent: state.activeEvent,
          eventProgress: state.eventProgress,
        });
        set({
          character,
          history,
          persistenceStatus: 'saved',
          persistenceError: null,
        });
        return true;
      } catch (error) {
        set({
          persistenceStatus: 'error',
          persistenceError: `Perubahan identitas belum tersimpan: ${getErrorMessage(error)}`,
        });
        return false;
      }
    },

    chooseEventChoice: async (choiceId) => {
      const state = get();
      const character = state.character;
      const event = state.activeEvent;
      if (!character || !event || state.isAdvancing || state.persistenceStatus === 'saving') return false;
      const choice = event.choices.find((item) => item.id === choiceId);
      if (!choice || getChoiceUnavailableReason(character, choice) !== null) return false;

      const nextCharacter = applyConsequence(character, choice.consequence);
      const nextHistory = [
        ...state.history,
        `${character.currentYear}: ${event.title} — ${choice.consequence.historyText}`,
      ];
      const nextEventProgress = recordEventChoice(
        state.eventProgress,
        event,
        choiceId,
        character.currentYear,
        character.age,
      );
      set({ persistenceStatus: 'saving', persistenceError: null });
      try {
        await saveActiveGame({
          character: nextCharacter,
          history: nextHistory,
          activeEvent: null,
          eventProgress: nextEventProgress,
        });
        set({
          character: nextCharacter,
          history: nextHistory,
          activeEvent: null,
          eventProgress: nextEventProgress,
          persistenceStatus: 'saved',
          persistenceError: null,
        });
        return true;
      } catch (error) {
        set({
          persistenceStatus: 'error',
          persistenceError: `Pilihan kejadian belum tersimpan: ${getErrorMessage(error)}`,
        });
        return false;
      }
    },

    advanceYear: async (random = Math.random) => {
      const state = get();
      const character = state.character;
      if (!character
        || state.activeEvent
        || state.isAdvancing
        || state.persistenceStatus === 'saving'
        || character.status !== 'alive') return false;

      set({ isAdvancing: true, persistenceStatus: 'saving', persistenceError: null });
      try {
        const result = ageUp(character, state.eventProgress, random);
        const nextHistory = [...state.history, ...result.historyEntries];
        await saveActiveGame({
          character: result.character,
          history: nextHistory,
          activeEvent: result.activeEvent,
          eventProgress: result.eventProgress,
        });
        set({
          character: result.character,
          history: nextHistory,
          activeEvent: result.activeEvent,
          eventProgress: result.eventProgress,
          isAdvancing: false,
          persistenceStatus: 'saved',
          persistenceError: null,
        });
        return true;
      } catch (error) {
        set({
          isAdvancing: false,
          persistenceStatus: 'error',
          persistenceError: `Tahun belum dapat dijalankan: ${getErrorMessage(error)}`,
        });
        return false;
      }
    },

    enrollInProgram: async (programId, universityId) => {
      const character = get().character;
      return commitCharacterAction(character
        ? enrollInProgram(character, programId, universityId)
        : null);
    },
    applyForScholarship: async (scholarshipId) => {
      const character = get().character;
      return commitCharacterAction(character ? applyForScholarship(character, scholarshipId) : null);
    },
    setStudyEffort: async (effort) => {
      const character = get().character;
      return commitCharacterAction(character ? setStudyEffort(character, effort) : null);
    },
    takeAcademicLeave: async () => {
      const character = get().character;
      return commitCharacterAction(character ? takeAcademicLeave(character) : null);
    },
    resumeEducation: async () => {
      const character = get().character;
      return commitCharacterAction(character ? resumeEducation(character) : null);
    },
    dropOut: async () => {
      const character = get().character;
      return commitCharacterAction(character ? dropOut(character) : null);
    },
    transferUniversity: async (universityId) => {
      const character = get().character;
      return commitCharacterAction(character ? transferUniversity(character, universityId) : null);
    },
    applyForOccupation: async (occupationId) => {
      const character = get().character;
      return commitCharacterAction(character ? applyForCareer(character, occupationId) : null);
    },
    acceptJobOffer: async (applicationId) => {
      const character = get().character;
      return commitCharacterAction(character ? acceptJobOffer(character, applicationId) : null);
    },
    declineJobOffer: async (applicationId) => {
      const character = get().character;
      return commitCharacterAction(character ? declineJobOffer(character, applicationId) : null);
    },
    changeCareer: async (change) => {
      const character = get().character;
      if (!character) return false;
      const nextCharacter = applyCareerChange(character, change);
      if (nextCharacter === character) return false;
      return commitCharacterAction({
        character: nextCharacter,
        historyText: `Perubahan karier: ${change.type}.`,
      });
    },
    meetNewPerson: async (random = Math.random) => {
      const character = get().character;
      return commitCharacterAction(character ? meetNewPerson(character, random) : null);
    },
    interactWithRelationship: async (relationshipId, action) => {
      const character = get().character;
      return commitCharacterAction(
        character ? interactWithRelationship(character, relationshipId, action) : null,
      );
    },
    interactWithFamilyMember: async (memberId, action) => {
      const character = get().character;
      return commitCharacterAction(
        character ? interactWithFamilyMember(character, memberId, action) : null,
      );
    },
    interactWithChild: async (childId, action) => {
      const character = get().character;
      return commitCharacterAction(character ? interactWithChild(character, childId, action) : null);
    },
    askToDate: async (relationshipId, random = Math.random) => {
      const character = get().character;
      return commitCharacterAction(
        character ? askToDate(character, relationshipId, random) : null,
      );
    },
    proposeEngagement: async (relationshipId, random = Math.random) => {
      const character = get().character;
      return commitCharacterAction(
        character ? proposeEngagement(character, relationshipId, random) : null,
      );
    },
    marryPartner: async (relationshipId, wedding) => {
      const character = get().character;
      return commitCharacterAction(character ? marryPartner(character, relationshipId, wedding) : null);
    },
    divorcePartner: async () => {
      const character = get().character;
      return commitCharacterAction(character ? divorce(character) : null);
    },
    endRelationship: async (relationshipId) => {
      const character = get().character;
      return commitCharacterAction(
        character ? endRelationship(character, relationshipId) : null,
      );
    },
    createChild: async (name, adopted = false) => {
      const character = get().character;
      return commitCharacterAction(character ? createChild(character, name, adopted) : null);
    },
    setChildParentingStyle: async (childId, style) => {
      const character = get().character;
      return commitCharacterAction(
        character ? setChildParentingStyle(character, childId, style) : null,
      );
    },
    setMonthlyBudget: async (budget) => {
      const character = get().character;
      return commitCharacterAction(character ? setMonthlyBudget(character, budget) : null);
    },
    buyProperty: async (propertyId) => {
      const character = get().character;
      return commitCharacterAction(character ? buyProperty(character, propertyId) : null);
    },
    sellProperty: async (assetId) => {
      const character = get().character;
      return commitCharacterAction(character ? sellProperty(character, assetId) : null);
    },
    invest: async (amount, kind) => {
      const character = get().character;
      return commitCharacterAction(character ? invest(character, amount, kind) : null);
    },
    sellInvestment: async (assetId) => {
      const character = get().character;
      return commitCharacterAction(character ? sellInvestment(character, assetId) : null);
    },
    takeLoan: async (amount, purpose) => {
      const character = get().character;
      return commitCharacterAction(character ? takeLoan(character, amount, purpose) : null);
    },
    repayLoan: async (loanId, amount) => {
      const character = get().character;
      return commitCharacterAction(character ? repayLoan(character, loanId, amount) : null);
    },
    startBusiness: async (kind, name) => {
      const character = get().character;
      return commitCharacterAction(character ? startBusiness(character, kind, name) : null);
    },
    closeBusiness: async (businessId) => {
      const character = get().character;
      return commitCharacterAction(character ? closeBusiness(character, businessId) : null);
    },

    saveCurrentGame: saveSnapshot,
  };
});
