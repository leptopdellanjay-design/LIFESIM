import type {
  AcademicSemester,
  Character,
  Course,
  CourseGrade,
  EducationLevel,
  EducationRecord,
  EducationStatus,
  ScholarshipAward,
  StudyEffort,
  StudyProgram,
  University,
} from '../types/game';
import {
  educationCountries,
  educationLevelConfigurations,
  getEducationLevelLabel,
  scholarships,
  studyPrograms,
  universities,
} from '../data/educationCatalog';
import { getNominalPriceFactor } from './worldEra';

export interface EducationActionResult {
  character: Character;
  historyText: string;
}

const clampStat = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const levelRanks: Record<EducationLevel, number> = {
  none: 0,
  paud: 1,
  tk: 2,
  sd: 3,
  smp: 4,
  sma: 5,
  smk: 5,
  d1: 6,
  d2: 6,
  d3: 6,
  d4: 6,
  s1: 6,
  s2: 7,
  s3: 8,
};

const schoolLevels: EducationLevel[] = ['paud', 'tk', 'sd', 'smp', 'sma', 'smk'];

function appendHistory(
  record: EducationRecord,
  year: number,
  text: string,
): EducationRecord {
  const id = `${year}:${text}`;
  if (record.history.some((entry) => entry.id === id)) return record;
  return {
    ...record,
    history: [...record.history, { id, year, text }],
  };
}

export function createInitialEducationRecord(): EducationRecord {
  return {
    currentLevel: 'none',
    status: 'not_started',
    institutionId: null,
    programId: null,
    semester: 0,
    stageYearsCompleted: 0,
    totalCredits: 0,
    cumulativeGpa: 0,
    completedLevels: [],
    semesters: [],
    scholarships: [],
    degrees: [],
    honoraryDegrees: [],
    awards: [],
    history: [],
    studyEffort: 'balanced',
    academicWarnings: 0,
  };
}

export function createHighSchoolGraduateRecord(currentYear: number): EducationRecord {
  const record = createInitialEducationRecord();
  const completedLevels: EducationLevel[] = ['paud', 'tk', 'sd', 'smp', 'sma'];
  return {
    ...record,
    currentLevel: 'sma',
    status: 'completed',
    completedLevels,
    stageYearsCompleted: 3,
    history: [{
      id: `${currentYear}:high-school-graduation`,
      year: currentYear,
      text: 'Lulus Sekolah Menengah Atas dan memulai perjalanan dewasa.',
    }],
  };
}

export function createEducationRecordFromLegacy(
  legacyValue?: string,
  currentYear = 2026,
): EducationRecord {
  const record = createInitialEducationRecord();
  const labels: Record<string, EducationLevel> = {
    'Belum sekolah': 'none',
    PAUD: 'paud',
    'Taman Kanak-kanak': 'tk',
    'Sekolah Dasar': 'sd',
    'Sekolah Menengah Pertama': 'smp',
    'Sekolah Menengah Atas': 'sma',
    'Lulus Sekolah Menengah Atas': 'sma',
    'Sekolah Menengah Kejuruan': 'smk',
    'Lulus Sekolah Menengah Kejuruan': 'smk',
    'Calon mahasiswa': 'sma',
  };
  const level = legacyValue ? labels[legacyValue] : undefined;
  if (!level || level === 'none') return record;
  const completedLevels = schoolLevels.filter((item) => levelRanks[item] < levelRanks[level]);
  const completed = legacyValue?.startsWith('Lulus') || legacyValue === 'Calon mahasiswa';
  return {
    ...record,
    currentLevel: level,
    status: completed ? 'completed' : 'enrolled',
    completedLevels: [...completedLevels, ...(completed ? [level] : [])],
    history: [{
      id: `${currentYear}:migrated-education`,
      year: currentYear,
      text: `Status pendidikan lama dipertahankan: ${getEducationLevelLabel(level)}.`,
    }],
  };
}

export function getEducationRequirementKeys(record: EducationRecord): string[] {
  const program = studyPrograms.find((item) => item.id === record.programId);
  const degrees = record.degrees.flatMap((degree) => [degree.level, degree.title, degree.abbreviation]);
  return [...new Set([
    record.currentLevel,
    getEducationLevelLabel(record.currentLevel),
    ...(record.status === 'completed' ? [getEducationLevelLabel(record.currentLevel)] : []),
    ...record.completedLevels.flatMap((level) => [level, getEducationLevelLabel(level)]),
    ...(program ? [program.name] : []),
    ...degrees,
  ])];
}

export function getEducationDisplayLabel(record: EducationRecord): string {
  const program = studyPrograms.find((item) => item.id === record.programId);
  if (record.status === 'enrolled' && program) {
    return `${program.name} (${getEducationLevelLabel(program.level)})`;
  }
  if (record.status === 'on_leave' && program) return `Cuti akademik · ${program.name}`;
  if (record.status === 'dropped_out' && program) return `Pendidikan terhenti · ${program.name}`;
  if (record.status === 'completed' && record.degrees.length > 0) {
    return `${record.degrees[record.degrees.length - 1].title} (${record.degrees[record.degrees.length - 1].abbreviation})`;
  }
  return getEducationLevelLabel(record.currentLevel);
}

export function getEligiblePrograms(character: Character): StudyProgram[] {
  const record = character.educationRecord;
  if (record.status === 'enrolled' || record.status === 'on_leave') return [];
  return studyPrograms.filter((program) => (
    program.countryCode === character.birthInformation.location.countryCode
    && program.entryLevels.some((level) => record.completedLevels.includes(level))
    && (!program.minimumGpa
      || (record.degrees[record.degrees.length - 1]?.gpa ?? record.cumulativeGpa) >= program.minimumGpa)
    && !record.degrees.some((degree) => degree.programId === program.id)
  ));
}

export function getEligibleUniversities(programId: string): University[] {
  return universities.filter((university) => (
    university.faculties.some((faculty) => faculty.programIds.includes(programId))
  ));
}

export function enrollInProgram(
  character: Character,
  programId: string,
  universityId: string,
): EducationActionResult | null {
  const program = studyPrograms.find((item) => item.id === programId);
  const university = universities.find((item) => item.id === universityId);
  if (!program || !university
    || (program.level === 's1'
      && character.postGraduationPath
      && character.postGraduationPath !== 'not_applicable'
      && character.admissionRecord?.status !== 'admitted')
    || !getEligiblePrograms(character).some((item) => item.id === programId)
    || !getEligibleUniversities(programId).some((item) => item.id === universityId)) return null;

  const year = character.currentYear;
  const educationRecord: EducationRecord = appendHistory({
    ...character.educationRecord,
    currentLevel: program.level,
    status: 'enrolled',
    institutionId: university.id,
    programId: program.id,
    semester: 0,
    totalCredits: 0,
    cumulativeGpa: 0,
    semesters: [],
    academicWarnings: 0,
  }, year, `Memulai ${program.name} di ${university.name}.`);
  return {
    character: { ...character, educationRecord },
    historyText: `Mendaftar pada program ${program.name} di ${university.name}.`,
  };
}

export function enrollInSchool(
  character: Character,
  level: EducationLevel,
): EducationActionResult | null {
  const configuration = educationLevelConfigurations.find((item) => (
    item.level === level && item.countryCode === character.birthInformation.location.countryCode
  ));
  const record = character.educationRecord;
  if (!configuration
    || !schoolLevels.includes(level)
    || record.status === 'enrolled'
    || record.status === 'on_leave'
    || record.completedLevels.some((completed) => (
      completed === level || (level === 'sma' && completed === 'smk') || (level === 'smk' && completed === 'sma')
    ))
    || !configuration.entryLevels.some((entry) => record.completedLevels.includes(entry) || entry === 'none')
    || character.age < configuration.approximateEntryAge) return null;
  const educationRecord = appendHistory({
    ...record,
    currentLevel: level,
    status: 'enrolled',
    institutionId: null,
    programId: null,
    stageYearsCompleted: 0,
  }, character.currentYear, `Memulai ${configuration.label}.`);
  return {
    character: { ...character, educationRecord },
    historyText: `Memulai pendidikan ${configuration.label}.`,
  };
}

export function setStudyEffort(
  character: Character,
  effort: StudyEffort,
): EducationActionResult | null {
  if (character.educationRecord.status !== 'enrolled'
    || !character.educationRecord.programId) return null;
  return {
    character: {
      ...character,
      educationRecord: { ...character.educationRecord, studyEffort: effort },
    },
    historyText: `Mengatur intensitas belajar menjadi ${effort === 'focused' ? 'fokus' : effort === 'light' ? 'ringan' : 'seimbang'}.`,
  };
}

export function applyForScholarship(
  character: Character,
  scholarshipId: string,
): EducationActionResult | null {
  const definition = scholarships.find((item) => (
    item.id === scholarshipId
    && item.countryCode === character.birthInformation.location.countryCode
  ));
  const record = character.educationRecord;
  const program = studyPrograms.find((item) => item.id === record.programId);
  if (!definition || !program || !definition.eligibleLevels.includes(program.level)
    || record.scholarships.some((award) => (
      award.scholarshipId === scholarshipId
      && ['applied', 'active'].includes(award.status)
    ))) return null;
  const award: ScholarshipAward = {
    id: `${scholarshipId}:${character.currentYear}`,
    scholarshipId,
    name: definition.name,
    type: definition.type,
    status: 'applied',
    tuitionCoveragePercent: definition.tuitionCoveragePercent,
    stipendPerSemester: definition.stipendPerSemester,
    remainingSemesters: definition.durationSemesters,
    appliedYear: character.currentYear,
    minimumGpa: definition.minimumGpa,
  };
  return {
    character: {
      ...character,
      educationRecord: {
        ...record,
        scholarships: [...record.scholarships, award],
      },
    },
    historyText: `Mengajukan ${definition.name}.`,
  };
}

export function takeAcademicLeave(character: Character): EducationActionResult | null {
  const record = character.educationRecord;
  if (record.status !== 'enrolled' || !record.programId) return null;
  return {
    character: {
      ...character,
      educationRecord: appendHistory({ ...record, status: 'on_leave' }, character.currentYear, 'Mengambil cuti akademik.'),
    },
    historyText: 'Mengambil cuti akademik.',
  };
}

export function resumeEducation(character: Character): EducationActionResult | null {
  const record = character.educationRecord;
  if (record.status !== 'on_leave' || !record.programId) return null;
  return {
    character: {
      ...character,
      educationRecord: appendHistory({ ...record, status: 'enrolled' }, character.currentYear, 'Melanjutkan pendidikan setelah cuti.'),
    },
    historyText: 'Melanjutkan pendidikan setelah cuti.',
  };
}

export function dropOut(character: Character): EducationActionResult | null {
  const record = character.educationRecord;
  if (record.status !== 'enrolled' && record.status !== 'on_leave') return null;
  return {
    character: {
      ...character,
      educationRecord: appendHistory({ ...record, status: 'dropped_out' }, character.currentYear, 'Menghentikan pendidikan yang sedang ditempuh.'),
    },
    historyText: 'Menghentikan pendidikan yang sedang ditempuh.',
  };
}

export function transferUniversity(
  character: Character,
  universityId: string,
): EducationActionResult | null {
  const record = character.educationRecord;
  const target = universities.find((university) => university.id === universityId);
  const program = studyPrograms.find((item) => item.id === record.programId);
  if (!target || !program || record.status !== 'enrolled'
    || !target.faculties.some((faculty) => faculty.programIds.includes(program.id))
    || target.id === record.institutionId) return null;
  return {
    character: {
      ...character,
      educationRecord: appendHistory({
        ...record,
        institutionId: target.id,
      }, character.currentYear, `Pindah ke ${target.name} dan melanjutkan program ${program.name}.`),
    },
    historyText: `Pindah ke ${target.name}.`,
  };
}

function safeRandom(random: () => number): number {
  const value = random();
  return Number.isFinite(value) ? Math.max(0, Math.min(0.999999999, value)) : 0.5;
}

function getPotentialGpa(character: Character): number {
  const stats = character.stats;
  const effort = character.educationRecord.studyEffort === 'focused'
    ? 95
    : character.educationRecord.studyEffort === 'light'
      ? 62
      : 80;
  const score = stats.intelligence * 0.28
    + stats.health * 0.16
    + stats.energy * 0.16
    + stats.happiness * 0.15
    + stats.reputation * 0.05
    + effort * 0.2;
  return Math.max(0, Math.min(4, score / 25));
}

function evaluateScholarships(
  character: Character,
  record: EducationRecord,
  program: StudyProgram,
): EducationRecord {
  let nextRecord = record;
  const potentialGpa = record.cumulativeGpa > 0 ? record.cumulativeGpa : getPotentialGpa(character);
  for (const award of record.scholarships) {
    if (award.status !== 'applied') continue;
    const definition = scholarships.find((item) => item.id === award.scholarshipId);
    if (!definition || !definition.eligibleLevels.includes(program.level)) continue;
    const eligible = potentialGpa >= definition.minimumGpa
      && character.stats.reputation >= definition.minimumReputation;
    nextRecord = {
      ...nextRecord,
      scholarships: nextRecord.scholarships.map((item) => (
        item.id === award.id ? { ...item, status: eligible ? 'active' : 'denied' } : item
      )),
    };
    nextRecord = appendHistory(
      nextRecord,
      character.currentYear,
      eligible
        ? `Mendapat ${definition.name}.`
        : `Pengajuan ${definition.name} belum memenuhi seleksi.`,
    );
  }
  return nextRecord;
}

function getCourseGrade(
  character: Character,
  course: Course,
  random: () => number,
): CourseGrade {
  const effortBonus = character.educationRecord.studyEffort === 'focused'
    ? 0.2
    : character.educationRecord.studyEffort === 'light'
      ? -0.25
      : 0;
  const gradePoints = Math.max(0, Math.min(
    4,
    getPotentialGpa(character) + effortBonus + (safeRandom(random) - 0.5) * 0.7,
  ));
  const gradeLetter = gradePoints >= 3.7 ? 'A'
    : gradePoints >= 3.3 ? 'B+'
      : gradePoints >= 3 ? 'B'
        : gradePoints >= 2.7 ? 'C+'
          : gradePoints >= 2 ? 'C'
            : 'D';
  return { ...course, gradePoints, gradeLetter, passed: gradePoints >= 2 };
}

function weightedGpa(semesters: AcademicSemester[]): number {
  const credits = semesters.reduce((sum, semester) => sum + semester.creditsEarned, 0);
  if (credits === 0) return 0;
  const points = semesters.reduce((sum, semester) => (
    sum + semester.gpa * semester.creditsEarned
  ), 0);
  return Math.round((points / credits) * 100) / 100;
}

function updateScholarshipsAfterTerm(
  record: EducationRecord,
  semesterGpa: number,
): EducationRecord {
  return {
    ...record,
    scholarships: record.scholarships.map((award) => {
      if (award.status !== 'active') return award;
      if (semesterGpa < award.minimumGpa) return { ...award, status: 'revoked' };
      const remainingSemesters = Math.max(0, award.remainingSemesters - 1);
      return {
        ...award,
        remainingSemesters,
        status: remainingSemesters === 0 ? 'completed' : 'active',
      };
    }),
  };
}

function applyTertiarySemester(
  character: Character,
  record: EducationRecord,
  program: StudyProgram,
  random: () => number,
): { character: Character; record: EducationRecord; completed: boolean } {
  const tuition = Math.round(program.tuitionPerSemester * getNominalPriceFactor(character.currentYear));
  const activeScholarships = record.scholarships.filter((award) => award.status === 'active');
  const coverage = Math.min(100, activeScholarships.reduce(
    (total, award) => total + award.tuitionCoveragePercent,
    0,
  ));
  const stipend = activeScholarships.reduce((total, award) => total + award.stipendPerSemester, 0);
  const scholarshipMoney = Math.round(tuition * coverage / 100) + stipend;
  const outOfPocket = Math.max(0, tuition - scholarshipMoney);
  if (character.cash < outOfPocket) {
    const leaveRecord = appendHistory(
      { ...record, status: 'on_leave' },
      character.currentYear,
      'Kuliah ditangguhkan karena dana semester belum mencukupi.',
    );
    return {
      character: {
        ...character,
        educationRecord: leaveRecord,
      },
      record: leaveRecord,
      completed: false,
    };
  }

  const termNumber = record.semester + 1;
  const courseSemester = ((termNumber - 1) % program.durationSemesters) + 1;
  const courses = program.courses.filter((course) => course.semester === courseSemester);
  const courseGrades = courses.map((course) => getCourseGrade(character, course, random));
  const termCredits = courseGrades.reduce((sum, course) => sum + course.credits, 0);
  const termPoints = courseGrades.reduce((sum, course) => sum + course.gradePoints * course.credits, 0);
  const semesterGpa = termCredits > 0 ? Math.round((termPoints / termCredits) * 100) / 100 : 0;
  const creditsEarned = courseGrades.filter((course) => course.passed)
    .reduce((sum, course) => sum + course.credits, 0);
  const minimumGpa = educationCountries[character.birthInformation.location.countryCode]?.minimumPassingGpa ?? 2;
  const standing = semesterGpa < minimumGpa
    ? record.academicWarnings > 0 ? 'probation' : 'warning'
    : 'good';
  const semester: AcademicSemester = {
    id: `${program.id}:${character.currentYear}:${termNumber}`,
    year: character.currentYear,
    month: character.currentMonth,
    semester: termNumber,
    courses: courseGrades,
    gpa: semesterGpa,
    creditsEarned,
    standing,
  };
  let nextRecord: EducationRecord = {
    ...record,
    semester: termNumber,
    semesters: [...record.semesters, semester],
    totalCredits: record.totalCredits + creditsEarned,
    cumulativeGpa: weightedGpa([...record.semesters, semester]),
    academicWarnings: standing === 'good' ? 0 : record.academicWarnings + 1,
  };
  nextRecord = updateScholarshipsAfterTerm(nextRecord, semesterGpa);
  nextRecord = appendHistory(
    nextRecord,
    character.currentYear,
    `Menyelesaikan semester ${termNumber} dengan IP ${semesterGpa.toFixed(2)}.`,
  );
  let nextCharacter: Character = {
    ...character,
    cash: Math.max(0, character.cash + scholarshipMoney - tuition),
    netWorth: Math.max(0, character.netWorth + scholarshipMoney - tuition),
    lastYearIncome: Math.max(0, character.lastYearIncome + scholarshipMoney),
    lastYearExpenses: Math.max(0, character.lastYearExpenses + tuition),
    stats: {
      ...character.stats,
      intelligence: clampStat(character.stats.intelligence + (semesterGpa >= minimumGpa ? 1 : 0)),
      health: clampStat(character.stats.health - (character.educationRecord.studyEffort === 'focused' ? 1 : 0)),
      energy: clampStat(character.stats.energy - (character.educationRecord.studyEffort === 'focused' ? 2 : 1)),
      happiness: clampStat(character.stats.happiness + (semesterGpa >= 3 ? 1 : semesterGpa < minimumGpa ? -2 : 0)),
    },
    educationRecord: nextRecord,
  };

  if (semesterGpa >= 3.8) {
    const awardId = `academic-merit:${program.id}:${character.currentYear}:${termNumber}`;
    if (!nextRecord.awards.some((award) => award.id === awardId)) {
      nextRecord = {
        ...nextRecord,
        awards: [...nextRecord.awards, {
          id: awardId,
          title: 'Penghargaan Prestasi Akademik Semester',
          category: 'academic',
          year: character.currentYear,
          description: `IP ${semesterGpa.toFixed(2)} pada ${program.name}.`,
          institutionId: record.institutionId ?? undefined,
        }],
      };
      nextCharacter = { ...nextCharacter, educationRecord: nextRecord };
    }
  }

  const completionEligible = termNumber >= program.durationSemesters
    && semesterGpa >= minimumGpa
    && nextRecord.cumulativeGpa >= minimumGpa;
  if (!completionEligible) return { character: nextCharacter, record: nextRecord, completed: false };

  const university = universities.find((item) => item.id === record.institutionId);
  const degreeId = `degree:${program.id}:${record.institutionId}`;
  const degree = {
    id: degreeId,
    level: program.level,
    title: program.degreeTitle,
    abbreviation: program.degreeAbbreviation,
    programId: program.id,
    institutionId: record.institutionId ?? '',
    year: character.currentYear,
    gpa: nextRecord.cumulativeGpa,
  };
  const finalRecord = appendHistory({
    ...nextRecord,
    status: 'completed',
    currentLevel: program.level,
    completedLevels: [...new Set([...nextRecord.completedLevels, program.level])],
    degrees: nextRecord.degrees.some((item) => item.id === degreeId)
      ? nextRecord.degrees
      : [...nextRecord.degrees, degree],
  }, character.currentYear, `Lulus ${program.name} dengan gelar ${program.degreeAbbreviation}${university ? ` dari ${university.name}` : ''}.`);
  return {
    character: { ...nextCharacter, educationRecord: finalRecord },
    record: finalRecord,
    completed: true,
  };
}

function expectedSchoolLevel(age: number, currentLevel: EducationLevel): EducationLevel | null {
  if (age === 3) return 'paud';
  if (age >= 4 && age <= 5) return 'tk';
  if (age >= 6 && age <= 11) return 'sd';
  if (age >= 12 && age <= 14) return 'smp';
  if (age >= 15 && age <= 17) return currentLevel === 'smk' ? 'smk' : 'sma';
  return null;
}

function progressSchoolYear(character: Character): {
  character: Character;
  historyEntries: string[];
} {
  let record = character.educationRecord;
  const age = character.age;
  const expected = expectedSchoolLevel(age, record.currentLevel);
  const historyEntries: string[] = [];
  if (record.status === 'on_leave' || record.status === 'dropped_out'
    || record.programId || levelRanks[record.currentLevel] > levelRanks.smk) {
    return { character, historyEntries };
  }
  if (!expected) {
    if (schoolLevels.includes(record.currentLevel) && age >= 18 && record.status === 'enrolled') {
      record = appendHistory({
        ...record,
        status: 'completed',
        completedLevels: [...new Set([...record.completedLevels, record.currentLevel])],
      }, character.currentYear, `Menyelesaikan ${getEducationLevelLabel(record.currentLevel)}.`);
      historyEntries.push(`${character.currentYear}: Menyelesaikan ${getEducationLevelLabel(record.currentLevel)}.`);
      return { character: { ...character, educationRecord: record }, historyEntries };
    }
    return { character, historyEntries };
  }
  if (record.currentLevel !== expected) {
    if (schoolLevels.includes(record.currentLevel) && record.status === 'enrolled') {
      record = {
        ...record,
        completedLevels: [...new Set([...record.completedLevels, record.currentLevel])],
      };
      const completionText = `Menyelesaikan ${getEducationLevelLabel(record.currentLevel)}.`;
      record = appendHistory(record, character.currentYear, completionText);
      historyEntries.push(`${character.currentYear}: ${completionText}`);
    }
    record = {
      ...record,
      currentLevel: expected,
      status: 'enrolled',
      stageYearsCompleted: 0,
    };
    const startText = `Memulai ${getEducationLevelLabel(expected)}.`;
    record = appendHistory(record, character.currentYear, startText);
    historyEntries.push(`${character.currentYear}: ${startText}`);
  } else {
    record = { ...record, stageYearsCompleted: record.stageYearsCompleted + 1 };
  }
  return { character: { ...character, educationRecord: record }, historyEntries };
}

export function simulateEducationSemester(
  character: Character,
  random: () => number = Math.random,
): { character: Character; historyEntries: string[] } {
  const record = character.educationRecord;
  if (record.status !== 'enrolled' || !record.programId) return { character, historyEntries: [] };
  const program = studyPrograms.find((item) => item.id === record.programId);
  if (!program) return { character, historyEntries: [] };
  const updatedRecord = evaluateScholarships(character, record, program);
  const result = applyTertiarySemester(character, updatedRecord, program, random);
  const historyEntries = result.record.semesters.length > record.semesters.length
    ? [`${character.currentYear}-${String(character.currentMonth).padStart(2, '0')}: Semester ${result.record.semester} selesai dengan IP ${result.record.semesters[result.record.semesters.length - 1].gpa.toFixed(2)}.`]
    : [];
  if (result.completed) {
    historyEntries.push(`${character.currentYear}-${String(character.currentMonth).padStart(2, '0')}: Lulus ${program.name} dan memperoleh gelar ${program.degreeAbbreviation}.`);
  }
  return {
    character: { ...result.character, educationRecord: result.record },
    historyEntries,
  };
}

export function simulateEducationMonth(
  character: Character,
  month: number,
  isBirthday: boolean,
  random: () => number = Math.random,
): { character: Character; historyEntries: string[] } {
  if (character.educationRecord.programId
    && character.educationRecord.status === 'enrolled') {
    return month === 6 || month === 12
      ? simulateEducationSemester(character, random)
      : { character, historyEntries: [] };
  }
  return isBirthday ? progressSchoolYear(character) : { character, historyEntries: [] };
}

export function simulateEducationYear(
  character: Character,
  random: () => number = Math.random,
): { character: Character; historyEntries: string[] } {
  if (character.educationRecord.status === 'enrolled' && character.educationRecord.programId) {
    let updatedCharacter = character;
    const historyEntries: string[] = [];
    for (let term = 0; term < 2 && updatedCharacter.educationRecord.status === 'enrolled'; term += 1) {
      const result = simulateEducationSemester(updatedCharacter, random);
      updatedCharacter = result.character;
      historyEntries.push(...result.historyEntries);
    }
    return { character: updatedCharacter, historyEntries };
  }
  return progressSchoolYear(character);
}

export function applyScholarshipChanges(
  record: EducationRecord,
  changes: ScholarshipAward[],
  year: number,
): EducationRecord {
  let next = record;
  for (const change of changes) {
    if (next.scholarships.some((award) => award.id === change.id)) continue;
    next = {
      ...next,
      scholarships: [...next.scholarships, {
        ...change,
        appliedYear: change.appliedYear || year,
      }],
    };
  }
  return next;
}

export function addHonoraryDegrees(
  record: EducationRecord,
  degrees: EducationRecord['honoraryDegrees'],
  year: number,
): EducationRecord {
  const additions = degrees
    .filter((degree) => !record.honoraryDegrees.some((existing) => existing.id === degree.id))
    .map((degree) => ({ ...degree, year: degree.year || year }));
  return additions.length === 0
    ? record
    : { ...record, honoraryDegrees: [...record.honoraryDegrees, ...additions] };
}

export function addAcademicAwards(
  record: EducationRecord,
  awards: EducationRecord['awards'],
  year: number,
): EducationRecord {
  const additions = awards
    .filter((award) => !record.awards.some((existing) => existing.id === award.id))
    .map((award) => ({ ...award, year: award.year || year }));
  return additions.length === 0
    ? record
    : { ...record, awards: [...record.awards, ...additions] };
}

export function getEligibleScholarships(character: Character): typeof scholarships {
  const program = studyPrograms.find((item) => item.id === character.educationRecord.programId);
  if (!program) return [];
  return scholarships.filter((definition) => (
    definition.countryCode === character.birthInformation.location.countryCode
    && definition.eligibleLevels.includes(program.level)
    && !character.educationRecord.scholarships.some((award) => (
      award.scholarshipId === definition.id && ['applied', 'active'].includes(award.status)
    ))
  ));
}
