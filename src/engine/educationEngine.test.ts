import { describe, expect, it } from 'vitest';
import { createCharacter, initialCharacterDraft } from './characterCreation';
import {
  createEducationRecordFromLegacy,
  applyForScholarship,
  enrollInProgram,
  getEligiblePrograms,
  simulateEducationYear,
} from './educationEngine';

function makeCharacter() {
  return createCharacter({
    ...initialCharacterDraft,
    firstName: 'Nara',
    lastName: 'Putri',
    gender: 'female',
    birthDate: '2000-05-21',
    familyBackground: 'modest',
    parentCondition: 'both_alive',
    personalityTraits: ['disciplined'],
  }, {
    today: new Date('2026-11-18T12:00:00'),
    idFactory: () => 'education-character',
  });
}

function graduateFromHighSchool() {
  const character = makeCharacter();
  return {
    ...character,
    age: 20,
    currentYear: 2020,
    cash: 100_000_000,
    netWorth: 100_000_000,
    educationRecord: createEducationRecordFromLegacy('Lulus Sekolah Menengah Atas', 2020),
    stats: {
      health: 90,
      happiness: 90,
      intelligence: 90,
      looks: 70,
      energy: 90,
      reputation: 70,
      wealth: 50,
    },
  };
}

describe('education engine', () => {
  it('only offers tertiary programs when the completed entry level is present', () => {
    const character = makeCharacter();
    expect(getEligiblePrograms(character)).toEqual([]);
    expect(getEligiblePrograms(graduateFromHighSchool()).some((program) => program.level === 's1')).toBe(true);
  });

  it('enrolls in a compatible fictional university and advances grades and credits by semester', () => {
    const character = graduateFromHighSchool();
    const enrolled = enrollInProgram(character, 'd1-akuntansi', 'universitas-nusantara-maju');

    expect(enrolled?.character.educationRecord.status).toBe('enrolled');
    expect(enrollInProgram(enrolled!.character, 'd1-akuntansi', 'institut-teknologi-pusaka')).toBeNull();

    const year = simulateEducationYear(enrolled!.character, () => 0.99);
    expect(year.character.educationRecord.semester).toBe(2);
    expect(year.character.educationRecord.semesters).toHaveLength(2);
    expect(year.character.educationRecord.totalCredits).toBeGreaterThan(0);
    expect(year.character.educationRecord.cumulativeGpa).toBeGreaterThanOrEqual(0);
    expect(year.character.educationRecord.cumulativeGpa).toBeLessThanOrEqual(4);
    expect(year.character.educationRecord.status).toBe('completed');
    expect(year.character.educationRecord.degrees[0].abbreviation).toBe('A.P.Ak.');
  });

  it('suspends a semester when available funds cannot cover the remaining tuition', () => {
    const character = {
      ...graduateFromHighSchool(),
      cash: 0,
      netWorth: 0,
    };
    const enrolled = enrollInProgram(character, 'd1-akuntansi', 'universitas-nusantara-maju');
    const year = simulateEducationYear(enrolled!.character, () => 0.99);

    expect(year.character.educationRecord.status).toBe('on_leave');
    expect(year.character.educationRecord.history.some((entry) => entry.text.includes('dana semester'))).toBe(true);
    expect(year.character.educationRecord.semesters).toHaveLength(0);
  });

  it('reviews a scholarship during annual study and applies its tuition support once', () => {
    const enrolled = enrollInProgram(
      graduateFromHighSchool(),
      'd1-akuntansi',
      'universitas-nusantara-maju',
    )!;
    const application = applyForScholarship(enrolled.character, 'bantuan-ekonomi');

    expect(application?.character.educationRecord.scholarships[0].status).toBe('applied');
    expect(applyForScholarship(application!.character, 'bantuan-ekonomi')).toBeNull();
    const progressed = simulateEducationYear(application!.character, () => 0.99);

    expect(progressed.character.educationRecord.scholarships[0].status).toBe('active');
    expect(progressed.character.educationRecord.scholarships[0].remainingSemesters).toBe(6);
  });
});
