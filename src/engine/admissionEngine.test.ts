import { describe, expect, it } from 'vitest';
import { createCharacter, initialCharacterDraft } from './characterCreation';
import { enrollInProgram } from './educationEngine';
import {
  beginCollegeAdmission,
  choosePostGraduationPath,
  prepareForAdmission,
  selectAdmissionProgram,
  takeAdmissionTest,
} from './admissionEngine';

function makeGraduate() {
  return createCharacter({
    ...initialCharacterDraft,
    firstName: 'Nara',
    lastName: 'Putri',
    gender: 'female',
    birthDate: '2000-05-21',
    familyBackground: 'wealthy',
    parentCondition: 'both_alive',
    personalityTraits: ['disciplined'],
  }, {
    today: new Date('2026-11-18T12:00:00'),
    startAge: 18,
    random: () => 0.5,
    idFactory: () => 'graduate-character',
  });
}

describe('post-graduation and admissions', () => {
  it('starts new-game characters at 18 with high school completed and blocks the clock until a path is chosen', () => {
    const graduate = makeGraduate();
    expect(graduate.age).toBe(18);
    expect(graduate.currentYear).toBe(2018);
    expect(graduate.educationRecord.status).toBe('completed');
    expect(graduate.educationRecord.completedLevels).toContain('sma');
    expect(graduate.postGraduationPath).toBe('undecided');
    expect(choosePostGraduationPath(graduate, 'gap_year')?.character.postGraduationPath).toBe('gap_year');
  });

  it('requires an admission pass before direct S1 enrollment, then enrolls after a prepared test', () => {
    const graduate = makeGraduate();
    const selectedPath = choosePostGraduationPath(graduate, 'college')?.character;
    expect(selectedPath).toBeDefined();
    expect(enrollInProgram(selectedPath!, 's1-ilmu-komputer', 'universitas-indonesia')).toBeNull();

    const selectedProgram = selectAdmissionProgram(
      selectedPath!,
      'universitas-indonesia',
      's1-ilmu-komputer',
    )?.character;
    expect(selectedProgram).toBeDefined();
    const readyForStudy = {
      ...selectedProgram!,
      cash: 100_000_000,
      stats: { ...selectedProgram!.stats, intelligence: 90, reputation: 80 },
    };
    const studied = prepareForAdmission(readyForStudy, 'self_study');
    expect(studied?.character.admissionRecord?.preparation).toBe(10);
    expect(studied?.character.stats.intelligence).toBe(91);
    expect(studied?.character.stats.energy).toBeLessThan(readyForStudy.stats.energy);

    const prepared = prepareForAdmission(studied!.character, 'tutoring');
    expect(prepared?.character.cash).toBeLessThan(100_000_000);
    expect(prepared?.character.admissionRecord?.preparation).toBe(28);
    expect(prepared?.character.admissionRecord?.tutoringSessions).toBe(1);

    const result = takeAdmissionTest(prepared!.character, () => 0.999);
    expect(result?.character.educationRecord.status).toBe('enrolled');
    expect(result?.character.educationRecord.institutionId).toBe('universitas-indonesia');
    expect(result?.character.admissionRecord?.status).toBe('admitted');
  });

  it('limits a failed test to one attempt per year and allows returning from work to college preparation', () => {
    const graduate = makeGraduate();
    const working = choosePostGraduationPath(graduate, 'work')?.character;
    const college = beginCollegeAdmission(working!)?.character;
    const selected = selectAdmissionProgram(college!, 'ipb-university', 's1-agronomi')?.character;
    const failed = takeAdmissionTest({
      ...selected!,
      stats: { ...selected!.stats, intelligence: 0, reputation: 0 },
    }, () => 0);

    expect(failed?.character.admissionRecord?.status).toBe('failed');
    expect(takeAdmissionTest(failed!.character, () => 0.5)).toBeNull();
    expect(takeAdmissionTest({
      ...failed!.character,
      currentYear: failed!.character.currentYear + 1,
    }, () => 0.5)).not.toBeNull();
  });
});
