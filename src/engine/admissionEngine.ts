import type {
  AdmissionRecord,
  Character,
  PostGraduationPath,
  StudyProgram,
  University,
} from '../types/game';
import { getEligiblePrograms, getEligibleUniversities, enrollInProgram } from './educationEngine';
import { getNominalPriceFactor } from './worldEra';
import { studyPrograms, universities } from '../data/educationCatalog';

export interface AdmissionActionResult {
  character: Character;
  historyText: string;
}

export type AdmissionPreparationActivity = 'tutoring' | 'self_study';

export function createInitialAdmissionRecord(): AdmissionRecord {
  return {
    selectedUniversityId: null,
    selectedProgramId: null,
    preparation: 0,
    selfStudySessions: 0,
    tutoringSessions: 0,
    examAttempts: 0,
    lastExamScore: null,
    lastExamYear: null,
    status: 'not_started',
  };
}

export function normalizePostGraduationRecords(character: Character): Character {
  const record = character.admissionRecord;
  const validStatus = record
    && ['not_started', 'preparing', 'failed', 'admitted'].includes(record.status);
  const normalizedRecord: AdmissionRecord = {
    ...createInitialAdmissionRecord(),
    ...(record ?? {}),
    selectedUniversityId: typeof record?.selectedUniversityId === 'string'
      ? record.selectedUniversityId
      : null,
    selectedProgramId: typeof record?.selectedProgramId === 'string'
      ? record.selectedProgramId
      : null,
    preparation: typeof record?.preparation === 'number' && Number.isFinite(record.preparation)
      ? Math.max(0, Math.min(100, Math.round(record.preparation)))
      : 0,
    selfStudySessions: typeof record?.selfStudySessions === 'number' && Number.isFinite(record.selfStudySessions)
      ? Math.max(0, Math.round(record.selfStudySessions))
      : 0,
    tutoringSessions: typeof record?.tutoringSessions === 'number' && Number.isFinite(record.tutoringSessions)
      ? Math.max(0, Math.round(record.tutoringSessions))
      : 0,
    examAttempts: typeof record?.examAttempts === 'number' && Number.isFinite(record.examAttempts)
      ? Math.max(0, Math.round(record.examAttempts))
      : 0,
    lastExamScore: typeof record?.lastExamScore === 'number'
      && Number.isFinite(record.lastExamScore)
      ? Math.max(0, Math.min(100, Math.round(record.lastExamScore)))
      : null,
    lastExamYear: typeof record?.lastExamYear === 'number'
      && Number.isFinite(record.lastExamYear)
      ? record.lastExamYear
      : null,
    status: record && validStatus ? record.status : 'not_started',
  };
  const validPath: PostGraduationPath[] = [
    'undecided',
    'college',
    'work',
    'gap_year',
    'not_applicable',
  ];

  return {
    ...character,
    postGraduationPath: character.postGraduationPath
      && validPath.includes(character.postGraduationPath)
      ? character.postGraduationPath
      : 'not_applicable',
    admissionRecord: normalizedRecord,
  };
}

function getRealUniversity(universityId: string): University | undefined {
  return universities.find((university) => (
    university.id === universityId && !university.fictional
  ));
}

function getAdmissionProgram(programId: string, universityId: string): StudyProgram | undefined {
  return studyPrograms.find((program) => (
    program.id === programId
    && program.level === 's1'
    && getEligibleUniversities(programId).some((university) => (
      university.id === universityId && !university.fictional
    ))
  ));
}

function calculateNetWorth(character: Character, cash: number): number {
  return Math.max(
    0,
    cash + character.startingAssets.nonCashValue
      + character.assets.reduce((total, asset) => total + asset.value, 0)
      - character.debt,
  );
}

export function choosePostGraduationPath(
  character: Character,
  path: Exclude<PostGraduationPath, 'undecided' | 'not_applicable'>,
): AdmissionActionResult | null {
  const current = normalizePostGraduationRecords(character);
  if (character.status !== 'alive' || character.age < 18
    || current.postGraduationPath !== 'undecided') return null;
  const admissionRecord = path === 'college'
    ? createInitialAdmissionRecord()
    : current.admissionRecord ?? createInitialAdmissionRecord();

  return {
    character: { ...current, postGraduationPath: path, admissionRecord },
    historyText: path === 'college'
      ? 'Memilih jalur kuliah setelah lulus SMA; persiapkan diri untuk tes masuk.'
      : path === 'work'
        ? 'Memilih langsung mencari pekerjaan setelah lulus SMA.'
        : 'Memilih menjalani gap year setelah lulus SMA.',
  };
}

export function beginCollegeAdmission(character: Character): AdmissionActionResult | null {
  const current = normalizePostGraduationRecords(character);
  if (character.status !== 'alive' || character.age < 18
    || !['work', 'gap_year'].includes(current.postGraduationPath ?? '')) return null;
  return {
    character: {
      ...current,
      postGraduationPath: 'college',
      admissionRecord: createInitialAdmissionRecord(),
    },
    historyText: 'Memulai persiapan untuk mengikuti tes masuk perguruan tinggi.',
  };
}

export function selectAdmissionProgram(
  character: Character,
  universityId: string,
  programId: string,
): AdmissionActionResult | null {
  const current = normalizePostGraduationRecords(character);
  const university = getRealUniversity(universityId);
  const program = getAdmissionProgram(programId, universityId);
  if (!university || !program || character.status !== 'alive' || character.age < 18
    || current.postGraduationPath !== 'college'
    || !getEligiblePrograms(character).some((item) => item.id === programId)) return null;

  const previous = current.admissionRecord ?? createInitialAdmissionRecord();
  const sameChoice = previous.selectedUniversityId === universityId
    && previous.selectedProgramId === programId;
  return {
    character: {
      ...current,
      admissionRecord: sameChoice
        ? previous
        : {
          ...createInitialAdmissionRecord(),
          selectedUniversityId: universityId,
          selectedProgramId: programId,
        },
    },
    historyText: `Memilih ${program.name} di ${university.name} sebagai tujuan seleksi.`,
  };
}

export function prepareForAdmission(
  character: Character,
  activity: AdmissionPreparationActivity,
): AdmissionActionResult | null {
  const current = normalizePostGraduationRecords(character);
  const admission = current.admissionRecord ?? createInitialAdmissionRecord();
  if (character.status !== 'alive' || character.age < 18
    || current.postGraduationPath !== 'college'
    || !admission.selectedUniversityId || !admission.selectedProgramId
    || !getAdmissionProgram(admission.selectedProgramId, admission.selectedUniversityId)
    || admission.status === 'admitted'
    || character.stats.energy < (activity === 'self_study' ? 10 : 5)) return null;

  const cost = activity === 'tutoring'
    ? Math.round(250_000 * getNominalPriceFactor(character.currentYear))
    : 0;
  if (character.cash < cost) return null;
  const preparationGain = activity === 'tutoring' ? 18 : 10;
  const energyCost = activity === 'tutoring' ? 5 : 10;
  const cash = character.cash - cost;
  const preparation = Math.min(100, admission.preparation + preparationGain);
  const nextRecord: AdmissionRecord = {
    ...admission,
    preparation,
    selfStudySessions: admission.selfStudySessions + (activity === 'self_study' ? 1 : 0),
    tutoringSessions: admission.tutoringSessions + (activity === 'tutoring' ? 1 : 0),
    status: 'preparing',
  };
  return {
    character: {
      ...current,
      cash,
      netWorth: calculateNetWorth(current, cash),
      lastYearExpenses: current.lastYearExpenses + cost,
      stats: {
        ...current.stats,
        energy: Math.max(0, current.stats.energy - energyCost),
        intelligence: activity === 'self_study'
          ? Math.min(100, current.stats.intelligence + 1)
          : current.stats.intelligence,
        happiness: activity === 'self_study'
          ? Math.max(0, current.stats.happiness - 1)
          : current.stats.happiness,
      },
      admissionRecord: nextRecord,
    },
    historyText: activity === 'tutoring'
      ? `Mengikuti bimbingan belajar untuk tes masuk; persiapan +${preparationGain}, biaya ${cost}.`
      : `Belajar mandiri untuk tes masuk; persiapan +${preparationGain}.`,
  };
}

export function takeAdmissionTest(
  character: Character,
  random: () => number = Math.random,
): AdmissionActionResult | null {
  const current = normalizePostGraduationRecords(character);
  const admission = current.admissionRecord ?? createInitialAdmissionRecord();
  const university = admission.selectedUniversityId
    ? getRealUniversity(admission.selectedUniversityId)
    : undefined;
  const program = admission.selectedUniversityId && admission.selectedProgramId
    ? getAdmissionProgram(admission.selectedProgramId, admission.selectedUniversityId)
    : undefined;
  if (!university || !program || character.status !== 'alive' || character.age < 18
    || current.postGraduationPath !== 'college'
    || admission.status === 'admitted'
    || admission.lastExamYear === character.currentYear) return null;

  const rawRoll = random();
  const roll = Number.isFinite(rawRoll) ? Math.max(0, Math.min(0.999999, rawRoll)) : 0.5;
  const score = Math.max(0, Math.min(100, Math.round(
    25
      + character.stats.intelligence * 0.35
      + admission.preparation * 0.4
      + character.stats.reputation * 0.1
      + roll * 15,
  )));
  const threshold = university.admissionDifficulty ?? 65;
  const passed = score >= threshold;
  const nextAdmission: AdmissionRecord = {
    ...admission,
    examAttempts: admission.examAttempts + 1,
    lastExamScore: score,
    lastExamYear: character.currentYear,
    status: passed ? 'admitted' : 'failed',
  };
  const testCharacter = { ...current, admissionRecord: nextAdmission };
  if (!passed) {
    return {
      character: testCharacter,
      historyText: `Mengikuti tes masuk ${program.name} di ${university.name}; skor ${score}/100 belum mencapai ambang simulasi ${threshold}.`,
    };
  }

  const enrollment = enrollInProgram(testCharacter, program.id, university.id);
  if (!enrollment) return null;
  return {
    character: enrollment.character,
    historyText: `Lolos tes masuk simulasi dengan skor ${score}/100 dan diterima di ${program.name}, ${university.name}.`,
  };
}
