import { describe, expect, it } from 'vitest';
import { createCharacter, initialCharacterDraft } from './characterCreation';
import {
  acceptJobOffer,
  applyForOccupation,
  canReceivePromotion,
  createCareerRecordFromLegacy,
  processAnnualCareer,
} from './careerEngine';
import { createEducationRecordFromLegacy } from './educationEngine';

function makeQualifiedCharacter() {
  const character = createCharacter({
    ...initialCharacterDraft,
    firstName: 'Nara',
    lastName: 'Putri',
    gender: 'female',
    birthDate: '2000-05-21',
    familyBackground: 'modest',
    parentCondition: 'both_alive',
    personalityTraits: ['ambitious'],
  }, {
    today: new Date('2026-11-18T12:00:00'),
    idFactory: () => 'career-character',
  });
  return {
    ...character,
    age: 20,
    currentYear: 2020,
    educationRecord: createEducationRecordFromLegacy('Lulus Sekolah Menengah Atas', 2020),
    stats: {
      health: 100,
      happiness: 100,
      intelligence: 100,
      looks: 80,
      energy: 100,
      reputation: 100,
      wealth: 50,
    },
  };
}

describe('career engine', () => {
  it('records a qualified job application, prevents duplicates, and accepts an offer', () => {
    const character = makeQualifiedCharacter();
    const application = applyForOccupation(character, 'entry-worker');

    expect(application?.character.careerRecord.applications).toHaveLength(1);
    expect(application?.character.careerRecord.applications[0].status).toBe('offered');
    expect(applyForOccupation(application!.character, 'entry-worker')).toBeNull();

    const hired = acceptJobOffer(application!.character, application!.character.careerRecord.applications[0].id);
    expect(hired?.character.careerRecord.status).toBe('employed');
    expect(hired?.character.careerRecord.currentOccupationId).toBe('entry-worker');
    expect(hired?.character.careerRecord.monthlySalary).toBeGreaterThan(0);
  });

  it('processes real annual income and promotion eligibility from career progression', () => {
    const character = makeQualifiedCharacter();
    const hired = applyForOccupation(character, 'entry-worker')!;
    let active = acceptJobOffer(hired.character, hired.character.careerRecord.applications[0].id)!.character;

    expect(canReceivePromotion(active)).toBe(false);
    for (let year = 1; year <= 2; year += 1) {
      active = { ...active, currentYear: active.currentYear + 1 };
      active = processAnnualCareer(active).character;
    }

    expect(active.lastYearIncome).toBeGreaterThan(0);
    expect(active.lastYearExpenses).toBeGreaterThan(0);
    expect(active.careerRecord.experienceYears).toBe(2);
    expect(canReceivePromotion(active)).toBe(true);
  });

  it('preserves legacy employment during a migration', () => {
    const record = createCareerRecordFromLegacy('Pekerja pemula', 2020);
    expect(record.status).toBe('employed');
    expect(record.currentOccupationId).toBe('entry-worker');
    expect(record.monthlySalary).toBeGreaterThan(0);
  });
});
