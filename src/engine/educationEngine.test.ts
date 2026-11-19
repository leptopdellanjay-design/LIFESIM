import { describe, expect, it } from 'vitest';
import { createCharacter, initialCharacterDraft } from './characterCreation';
import {
  createEducationRecordFromLegacy,
  applyForScholarship,
  enrollInProgram,
  getEligiblePrograms,
  simulateEducationMonth,
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

  it('unlocks master and doctoral study after the required prior degrees', () => {
    const graduate = graduateFromHighSchool();
    const bachelorDegree = {
      id: 'degree:s1-informatika:universitas-nusantara-maju',
      level: 's1' as const,
      title: 'Sarjana Komputer',
      abbreviation: 'S.Kom.',
      programId: 's1-informatika',
      institutionId: 'universitas-nusantara-maju',
      year: 2018,
      gpa: 3.4,
    };
    const withBachelor = {
      ...graduate,
      educationRecord: {
        ...graduate.educationRecord,
        currentLevel: 's1' as const,
        status: 'completed' as const,
        completedLevels: [...graduate.educationRecord.completedLevels, 's1' as const],
        degrees: [bachelorDegree],
        cumulativeGpa: 3.4,
      },
    };
    expect(getEligiblePrograms(withBachelor).some((program) => program.level === 's2')).toBe(true);

    const withMaster = {
      ...withBachelor,
      educationRecord: {
        ...withBachelor.educationRecord,
        currentLevel: 's2' as const,
        completedLevels: [...withBachelor.educationRecord.completedLevels, 's2' as const],
        degrees: [
          bachelorDegree,
          {
            ...bachelorDegree,
            id: 'degree:s2-manajemen:universitas-nusantara-maju',
            level: 's2' as const,
            title: 'Magister Manajemen',
            abbreviation: 'M.M.',
            programId: 's2-manajemen',
          },
        ],
      },
    };
    expect(getEligiblePrograms(withMaster).some((program) => program.level === 's3')).toBe(true);
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

  it('processes one semester on its calendar month and connects study to character stats', () => {
    const enrolled = enrollInProgram(
      { ...graduateFromHighSchool(), currentMonth: 5 },
      'd1-akuntansi',
      'universitas-nusantara-maju',
    )!;
    const nextMonth = { ...enrolled.character, currentMonth: 6 };
    const result = simulateEducationMonth(nextMonth, 6, false, () => 0.99);
    const skippedMonth = simulateEducationMonth(result.character, 7, false, () => 0.99);

    expect(result.character.educationRecord.semester).toBe(1);
    expect(result.character.educationRecord.semesters[0].month).toBe(6);
    expect(result.character.cash).toBeLessThan(nextMonth.cash);
    expect(result.character.lastYearExpenses).toBeGreaterThan(nextMonth.lastYearExpenses);
    expect(result.character.stats.intelligence).toBeGreaterThan(nextMonth.stats.intelligence);
    expect(result.character.stats.energy).toBeLessThan(nextMonth.stats.energy);
    expect(skippedMonth.character.educationRecord.semester).toBe(1);
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
