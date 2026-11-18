export type Gender = 'male' | 'female' | 'other';
export type LifeStatus = 'alive' | 'deceased';
export type AvatarId = 'leaf' | 'sunrise' | 'ocean' | 'earth';
export type LifeStage =
  | 'baby'
  | 'toddler'
  | 'child'
  | 'teenager'
  | 'young_adult'
  | 'adult'
  | 'middle_age'
  | 'senior'
  | 'elderly';

export interface CharacterIdentity {
  firstName: string;
  lastName: string;
  gender: Gender;
  avatarId: AvatarId;
}

export interface Location {
  countryCode: string;
  province: string;
  city: string;
  currencyCode: string;
}

export interface BirthInformation {
  date: string;
  location: Location;
}

export interface BirthEvent {
  id: string;
  title: string;
  description: string;
  statChanges: Partial<CharacterStats>;
}

export interface DeathRecord {
  age: number;
  year: number;
  cause: string;
}

export type CharacterStats = {
  health: number;
  happiness: number;
  intelligence: number;
  looks: number;
  energy: number;
  reputation: number;
  wealth: number;
};

export type Stats = CharacterStats;

export type FamilyBackgroundTier =
  | 'very_poor'
  | 'poor'
  | 'modest'
  | 'middle'
  | 'affluent'
  | 'wealthy';

export interface FamilyBackground {
  tier: FamilyBackgroundTier;
}

export type ParentCondition =
  | 'both_alive'
  | 'father_only'
  | 'mother_only'
  | 'both_deceased'
  | 'guardian';

export type FamilyMemberRole =
  | 'father'
  | 'mother'
  | 'sibling'
  | 'guardian'
  | 'grandparent'
  | 'aunt'
  | 'uncle'
  | 'cousin'
  | 'in_law';
export type FamilyMemberStatus = 'alive' | 'deceased' | 'unknown';
export type RelationshipStatus = 'active' | 'strained' | 'ended';
export type RomanticRelationshipStage =
  | 'friend'
  | 'dating'
  | 'engaged'
  | 'married'
  | 'separated'
  | 'ended';
export type SocialRelationshipKind =
  | 'friend'
  | 'romantic_partner'
  | 'mentor'
  | 'colleague'
  | 'spouse'
  | 'child';
export type MaritalStatus = 'single' | 'partnered' | 'engaged' | 'married' | 'separated' | 'widowed';
export type LegalStatus = 'clear' | 'under_investigation' | 'convicted';
export type EventCategory =
  | 'family'
  | 'education'
  | 'career'
  | 'romance'
  | 'friendship'
  | 'finance'
  | 'health'
  | 'crime'
  | 'underworld'
  | 'social'
  | 'historical'
  | 'random_life'
  | 'death';

export interface FamilyMember {
  id: string;
  role: FamilyMemberRole;
  name: string;
  status: FamilyMemberStatus;
  relationship: number;
  trust: number;
  loyalty: number;
  birthYear?: number | null;
  gender?: Gender;
  health?: number;
  estateCash?: number;
  netWorth?: number;
  educationLevel?: EducationLevel;
  occupationId?: string | null;
  personality?: PersonalityTraits;
  generation?: number;
  parentIds?: string[];
  kinshipLabel?: string;
  history?: string[];
}

export interface Family {
  parentCondition: ParentCondition;
  members: FamilyMember[];
  livingArrangement: 'with_parents' | 'with_parent' | 'with_guardian';
  history: string[];
}

export interface SocialRelationship {
  id: string;
  name: string;
  kind: SocialRelationshipKind;
  score: number;
  trust: number;
  loyalty: number;
  status: RelationshipStatus;
  startedYear: number;
  stage?: RomanticRelationshipStage;
  profile?: RelationshipProfile;
  history?: RelationshipHistoryEntry[];
  generation?: number;
}

export interface RelationshipProfile {
  age: number;
  gender: Gender;
  personality: PersonalityTraits;
  occupationId: string | null;
  educationLevel: EducationLevel;
  netWorth: number;
  health: number;
  lifeStatus: LifeStatus;
}

export interface RelationshipHistoryEntry {
  id: string;
  year: number;
  action: string;
  details: string;
}

export interface ChildRecord {
  id: string;
  name: string;
  birthYear: number;
  relationship: number;
  trust?: number;
  loyalty?: number;
  health?: number;
  happiness?: number;
  intelligence?: number;
  educationLevel?: EducationLevel;
  personality?: PersonalityTraits;
  parentingStyle?: 'supportive' | 'balanced' | 'strict';
  lifeStatus?: LifeStatus;
  deathYear?: number | null;
  adopted?: boolean;
  history?: string[];
  parentIds?: string[];
  generation?: number;
}

export interface CharacterAsset {
  id: string;
  name: string;
  category: 'home' | 'vehicle' | 'business' | 'investment' | 'other';
  value: number;
  purchasePrice?: number;
  acquiredYear?: number;
  propertyType?: 'primary' | 'rental' | 'land';
  annualRent?: number;
  annualMaintenanceCost?: number;
  investmentKind?: 'deposit' | 'balanced_fund';
  annualYieldRate?: number;
}

export type BusinessKind = 'food_stall' | 'grocery' | 'craft_shop';
export type BusinessStatus = 'active' | 'closed';

export interface BusinessRecord {
  id: string;
  name: string;
  kind: BusinessKind;
  assetId: string;
  startedYear: number;
  initialInvestment: number;
  annualRevenue: number;
  annualOperatingCosts: number;
  stability: number;
  status: BusinessStatus;
  history: string[];
}

export interface LoanRecord {
  id: string;
  name: string;
  purpose: 'personal' | 'business' | 'property';
  principal: number;
  balance: number;
  annualInterestRate: number;
  annualPayment: number;
  termYears: number;
  startedYear: number;
  status: 'active' | 'paid';
  history: string[];
}

export type BudgetCategory = 'housing' | 'food' | 'transport' | 'health' | 'education' | 'leisure';

export interface EconomyRecord {
  businesses: BusinessRecord[];
  loans: LoanRecord[];
  monthlyBudget: Record<BudgetCategory, number>;
  monthlyBudgetYear: number;
  budgetConfigured: boolean;
  history: string[];
}

export interface OrganizationMembership {
  id: string;
  name: string;
  type: 'community' | 'fictional_underworld';
  rank: string;
  joinedYear: number;
  status: 'active' | 'left';
}

export type PersonalityTrait =
  | 'brave'
  | 'shy'
  | 'intelligent'
  | 'ambitious'
  | 'friendly'
  | 'short_tempered'
  | 'disciplined'
  | 'lazy'
  | 'creative'
  | 'lucky';

export interface PersonalityTraits {
  traits: PersonalityTrait[];
}

export type HousingCondition =
  | 'temporary'
  | 'basic'
  | 'modest'
  | 'comfortable'
  | 'large';

export type OpportunityLevel = 'limited' | 'basic' | 'growing' | 'broad';

export interface StartingAssets {
  housingCondition: HousingCondition;
  nonCashValue: number;
  facilities: string[];
  opportunityLevel: OpportunityLevel;
}

export type EducationLevel =
  | 'none'
  | 'paud'
  | 'tk'
  | 'sd'
  | 'smp'
  | 'sma'
  | 'smk'
  | 'd1'
  | 'd2'
  | 'd3'
  | 'd4'
  | 's1'
  | 's2'
  | 's3';
export type EducationStatus = 'not_started' | 'enrolled' | 'on_leave' | 'completed' | 'dropped_out';
export type AcademicStanding = 'good' | 'warning' | 'probation';
export type StudyEffort = 'light' | 'balanced' | 'focused';
export type ScholarshipType =
  | 'full'
  | 'partial'
  | 'government'
  | 'university'
  | 'merit'
  | 'research'
  | 'international'
  | 'economic_aid';
export type ScholarshipStatus = 'applied' | 'active' | 'denied' | 'revoked' | 'completed';

export interface Course {
  id: string;
  code: string;
  name: string;
  semester: number;
  credits: number;
  kind: 'lecture' | 'practicum' | 'research' | 'thesis';
}

export interface CourseGrade extends Course {
  gradePoints: number;
  gradeLetter: string;
  passed: boolean;
}

export interface AcademicSemester {
  id: string;
  year: number;
  semester: number;
  courses: CourseGrade[];
  gpa: number;
  creditsEarned: number;
  standing: AcademicStanding;
}

export interface School {
  id: string;
  name: string;
  countryCode: string;
  city: string;
  level: EducationLevel;
  fictional: boolean;
}

export interface Faculty {
  id: string;
  universityId: string;
  name: string;
  programIds: string[];
}

export interface StudyProgram {
  id: string;
  name: string;
  facultyId: string;
  level: EducationLevel;
  durationSemesters: number;
  entryLevels: EducationLevel[];
  minimumGpa?: number;
  tuitionPerSemester: number;
  degreeTitle: string;
  degreeAbbreviation: string;
  courses: Course[];
  countryCode: string;
}

export interface University {
  id: string;
  name: string;
  countryCode: string;
  city: string;
  reputation: number;
  faculties: Faculty[];
  facilities: string[];
  accreditation: string;
  fictional: boolean;
}

export interface ScholarshipDefinition {
  id: string;
  name: string;
  type: ScholarshipType;
  countryCode: string;
  eligibleLevels: EducationLevel[];
  minimumGpa: number;
  minimumReputation: number;
  tuitionCoveragePercent: number;
  stipendPerSemester: number;
  durationSemesters: number;
}

export interface ScholarshipAward {
  id: string;
  scholarshipId: string;
  name: string;
  type: ScholarshipType;
  status: ScholarshipStatus;
  tuitionCoveragePercent: number;
  stipendPerSemester: number;
  remainingSemesters: number;
  appliedYear: number;
  minimumGpa: number;
}

export interface AcademicDegree {
  id: string;
  level: EducationLevel;
  title: string;
  abbreviation: string;
  programId: string;
  institutionId: string;
  year: number;
  gpa: number;
}

export interface HonoraryDegree {
  id: string;
  title: string;
  abbreviation: 'Dr. H.C.';
  institutionId: string;
  year: number;
  citation: string;
}

export interface AcademicAward {
  id: string;
  title: string;
  category: 'academic' | 'research' | 'innovation' | 'service' | 'international' | 'honorary_professor';
  year: number;
  description: string;
  institutionId?: string;
}

export interface EducationHistoryEntry {
  id: string;
  year: number;
  text: string;
}

export interface EducationRecord {
  currentLevel: EducationLevel;
  status: EducationStatus;
  institutionId: string | null;
  programId: string | null;
  semester: number;
  stageYearsCompleted: number;
  totalCredits: number;
  cumulativeGpa: number;
  completedLevels: EducationLevel[];
  semesters: AcademicSemester[];
  scholarships: ScholarshipAward[];
  degrees: AcademicDegree[];
  honoraryDegrees: HonoraryDegree[];
  awards: AcademicAward[];
  history: EducationHistoryEntry[];
  studyEffort: StudyEffort;
  academicWarnings: number;
}

export type CareerStatus = 'unemployed' | 'employed' | 'retired' | 'laid_off';
export type CareerCategory =
  | 'government'
  | 'state_enterprise'
  | 'private'
  | 'health'
  | 'education'
  | 'technology'
  | 'business'
  | 'law'
  | 'security'
  | 'creative'
  | 'politics'
  | 'agriculture'
  | 'transport'
  | 'sports'
  | 'media'
  | 'freelance';

export interface Occupation {
  id: string;
  category: CareerCategory;
  name: string;
  countryCode: string;
  minimumAge: number;
  requiredLevels: EducationLevel[];
  requiredProgramIds?: string[];
  minimumExperienceYears: number;
  minimumReputation: number;
  monthlySalary: number;
  workHoursPerWeek: number;
  promotionAfterYears: number;
  titles: string[];
  fictionalEmployerNames: string[];
  risk: 'low' | 'moderate' | 'high';
}

export interface Employer {
  id: string;
  name: string;
  countryCode: string;
  category: CareerCategory;
  fictional: boolean;
}

export interface JobApplication {
  id: string;
  occupationId: string;
  year: number;
  status: 'offered' | 'rejected' | 'accepted' | 'declined';
  score: number;
  offeredMonthlySalary: number;
  employerId: string;
}

export interface CareerHistoryEntry {
  id: string;
  year: number;
  type: 'application' | 'hired' | 'promotion' | 'salary_change' | 'experience' | 'bonus' | 'layoff' | 'resignation' | 'retirement';
  occupationId: string;
  title: string;
  details: string;
  monthlySalary?: number;
}

export interface CareerRecord {
  status: CareerStatus;
  currentOccupationId: string | null;
  employerId: string | null;
  positionIndex: number;
  experienceYears: number;
  monthlySalary: number;
  satisfaction: number;
  professionalReputation: number;
  promotionCooldownUntil: number;
  applications: JobApplication[];
  history: CareerHistoryEntry[];
}

export type CareerChange =
  | { type: 'hire'; occupationId: string; employerId?: string; monthlySalary?: number }
  | { type: 'promote'; monthlySalary?: number }
  | { type: 'salary_change'; monthlySalary: number }
  | { type: 'raise'; percent: number }
  | { type: 'bonus'; amount: number }
  | { type: 'layoff' }
  | { type: 'resign' }
  | { type: 'retire' };

export interface Character {
  id: string;
  identity: CharacterIdentity;
  birthInformation: BirthInformation;
  birthEvent: BirthEvent;
  currentYear: number;
  age: number;
  deathRecord: DeathRecord | null;
  lastYearIncome: number;
  lastYearExpenses: number;
  debt: number;
  assets: CharacterAsset[];
  economyRecord: EconomyRecord;
  relationships: SocialRelationship[];
  children: ChildRecord[];
  maritalStatus: MaritalStatus;
  spouseName: string | null;
  legalStatus: LegalStatus;
  organizations: OrganizationMembership[];
  familyBackground: FamilyBackground;
  family: Family;
  personality: PersonalityTraits;
  startingAssets: StartingAssets;
  cash: number;
  netWorth: number;
  educationRecord: EducationRecord;
  careerRecord: CareerRecord;
  status: LifeStatus;
  stats: CharacterStats;
}

export interface CharacterDraft {
  firstName: string;
  lastName: string;
  gender: Gender | '';
  birthDate: string;
  avatarId: AvatarId;
  countryCode: string;
  province: string;
  city: string;
  familyBackground: FamilyBackgroundTier | '';
  parentCondition: ParentCondition | '';
  siblingCount: number;
  personalityTraits: PersonalityTrait[];
}

export interface RelationshipEffect {
  target: { type: 'family'; role: FamilyMemberRole | 'living_family' }
    | { type: 'social'; id: string }
    | { type: 'child'; id: string };
  scoreChange?: number;
  trustChange?: number;
  loyaltyChange?: number;
  status?: RelationshipStatus;
  stage?: RomanticRelationshipStage;
}

export type AssetChange =
  | { action: 'add' | 'update'; asset: CharacterAsset }
  | { action: 'remove'; assetId: string };

export interface ConsequencePayload {
  statChanges?: Partial<CharacterStats>;
  cashChange?: number;
  incomeChange?: number;
  expensesChange?: number;
  debtChange?: number;
  assetChanges?: AssetChange[];
  careerChange?: CareerChange;
  scholarshipChanges?: ScholarshipAward[];
  honoraryDegreesAdded?: HonoraryDegree[];
  academicAwardsAdded?: AcademicAward[];
  studyEffortChange?: StudyEffort;
  maritalStatus?: MaritalStatus;
  spouseName?: string | null;
  relationshipsAdded?: SocialRelationship[];
  relationshipEffects?: RelationshipEffect[];
  childrenAdded?: ChildRecord[];
  organizationChanges?: OrganizationMembership[];
  legalStatus?: LegalStatus;
  relationshipChanges?: Array<{
    role: FamilyMemberRole | 'living_family';
    amount: number;
  }>;
  historyText: string;
}

export interface DelayedTrigger {
  minAge?: number;
  maxAge?: number;
  minCash?: number;
  minStats?: Partial<Record<keyof CharacterStats, number>>;
  requiresCompletedEventIds?: string[];
  requiredOrganizationIds?: string[];
}

export interface DelayedConsequenceDefinition {
  id: string;
  delayYears: number;
  expiresAfterYears?: number;
  historyText: string;
  trigger?: DelayedTrigger;
  consequence: ConsequencePayload;
  followUpEventIds?: string[];
}

export interface ScheduledConsequence extends DelayedConsequenceDefinition {
  sourceEventId: string;
  sourceChoiceId: string;
  dueYear: number;
  expiresYear?: number;
}

export interface Consequence extends ConsequencePayload {
  followUpEventIds?: string[];
  delayedConsequences?: DelayedConsequenceDefinition[];
}

export interface ChoiceRequirements {
  minCash?: number;
  maxDebt?: number;
  minAssetValue?: number;
  minStats?: Partial<Record<keyof CharacterStats, number>>;
  requiredEducation?: string[];
  requiredOccupation?: string[];
  requiredMaritalStatuses?: MaritalStatus[];
  requiredLegalStatuses?: LegalStatus[];
  requiredOrganizationIds?: string[];
}

export interface EventChoice {
  id: string;
  label: string;
  description: string;
  minimumCash?: number;
  requirements?: ChoiceRequirements;
  consequence: Consequence;
}

export interface LifeEvent {
  id: string;
  title: string;
  description: string;
  category: EventCategory | (string & {});
  minAge: number;
  maxAge: number;
  minYear?: number;
  maxYear?: number;
  countryCode?: string;
  province?: string;
  city?: string;
  familyConditions?: ParentCondition[];
  occupationRequirement?: 'employed' | 'unemployed';
  requiredOccupation?: string[];
  educationRequirement?: string[];
  educationStatusRequirements?: EducationStatus[];
  academicStandingRequirements?: AcademicStanding[];
  minCash?: number;
  maxCash?: number;
  minDebt?: number;
  maxDebt?: number;
  minAssetValue?: number;
  maxAssetValue?: number;
  maritalStatuses?: MaritalStatus[];
  legalStatuses?: LegalStatus[];
  requiredOrganizationIds?: string[];
  historicalClassification?: 'historical_fact' | 'fictional_personal' | 'alternate_future';
  historicalSource?: string;
  followUpOnly?: boolean;
  requiresCompletedEventIds?: string[];
  excludesCompletedEventIds?: string[];
  probability?: number;
  cooldownYears?: number;
  once?: boolean;
  fictional?: boolean;
  statRequirements?: Partial<Record<keyof CharacterStats, { min?: number; max?: number }>>;
  relationshipRequirements?: Array<{
    role: FamilyMemberRole;
    min?: number;
    max?: number;
  }>;
  socialRelationshipRequirements?: Array<{
    kind?: SocialRelationshipKind;
    minScore?: number;
    minTrust?: number;
    minLoyalty?: number;
    status?: RelationshipStatus;
  }>;
  careerRequirements?: {
    minExperienceYears?: number;
    minSatisfaction?: number;
    minProfessionalReputation?: number;
    maxPositionIndex?: number;
    requiresAvailablePromotion?: boolean;
  };
  choices: EventChoice[];
}

export interface EventHistoryEntry {
  eventId: string;
  title: string;
  category: EventCategory | (string & {});
  year: number;
  age: number;
  choiceId: string;
  choiceLabel: string;
  outcomeText: string;
}

export interface EventProgress {
  completedEventIds: string[];
  lastEventYears: Record<string, number>;
  history: EventHistoryEntry[];
  pendingEventIds: string[];
  pendingConsequences: ScheduledConsequence[];
  processedConsequenceIds: string[];
}
