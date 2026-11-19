import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BookOpen,
  Briefcase,
  Camera,
  CalendarDays,
  CreditCard,
  HardDrive,
  GraduationCap,
  Heart,
  Home,
  House,
  MapPin,
  Menu,
  Pencil,
  ShoppingBag,
  Settings,
  Smartphone,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import type {
  CareerChange,
  Character,
  ChildRecord,
  BusinessKind,
  DigitalAppId,
  DigitalContentCategory,
  DigitalPlatformId,
  EstateDistributionRule,
  EventProgress,
  FamilyMember,
  FamilyMemberRole,
  LifeEvent,
  RomanticRelationshipStage,
  StudyEffort,
} from './types/game';
import type {
  ChildInteraction,
  FamilyInteraction,
  RelationshipInteraction,
} from './engine/relationshipEngine';
import { getCurrentSpouse, getVisibleRelationships } from './engine/relationshipEngine';
import {
  budgetCategories,
  businessCatalog,
  getLoanLimit,
  propertyCatalog,
  type MonthlyBudget,
} from './engine/economyEngine';
import { useGameStore, type PersistenceStatus } from './store/gameStore';
import { getChoiceUnavailableReason } from './engine/eventEngine';
import { CharacterPortrait } from './components/CharacterPortrait';
import { CharacterCreation } from './components/CharacterCreation';
import { CharacterProfileEditor } from './components/CharacterProfileEditor';
import { getFamilyBackground } from './data/familyBackgrounds';
import { getCharacterName } from './engine/characterCreation';
import { getMonthlyParentalSupport } from './engine/familySupport';
import { getLifeStage } from './engine/lifeStages';
import { getMonthName, monthNames } from './engine/calendar';
import { getNominalPriceFactor, getWorldYearContext } from './engine/worldEra';
import {
  getEducationDisplayLabel,
  getEligibleUniversities,
  getEligiblePrograms,
  getEligibleScholarships,
} from './engine/educationEngine';
import { getEligibleOccupations, canReceivePromotion } from './engine/careerEngine';
import { getEducationLevelLabel, studyPrograms, universities } from './data/educationCatalog';
import { careerCategoryLabels, getEmployer, getOccupation, getOccupationTitle } from './data/careerCatalog';
import { exportGameBackup, type SaveSlotSummary } from './persistence/gameSave';
import { getEligibleSuccessors } from './engine/successionEngine';
import {
  canMonetizeAccount,
  getDigitalProductionCost,
  getDigitalCreatorLevel,
} from './engine/digitalLifeEngine';
import {
  creatorEquipment,
  dataPackages,
  digitalApps,
  digitalContentCategories,
  digitalPlatforms,
  getDigitalPlatform,
  getSmartphoneModel,
  smartphoneModels,
} from './data/digitalCatalog';

type PageId =
  | 'home'
  | 'activity'
  | 'education'
  | 'career'
  | 'relationships'
  | 'family'
  | 'finance'
  | 'digital'
  | 'property'
  | 'history'
  | 'settings';

interface NavigationItem {
  id: PageId;
  label: string;
  icon: LucideIcon;
}

const navigationItems: NavigationItem[] = [
  { id: 'home', label: 'Beranda', icon: Home },
  { id: 'activity', label: 'Aktivitas', icon: Activity },
  { id: 'education', label: 'Pendidikan', icon: GraduationCap },
  { id: 'career', label: 'Karier', icon: Briefcase },
  { id: 'relationships', label: 'Hubungan', icon: Heart },
  { id: 'family', label: 'Keluarga', icon: Users },
  { id: 'finance', label: 'Keuangan', icon: Wallet },
  { id: 'digital', label: 'Kehidupan digital', icon: Smartphone },
  { id: 'property', label: 'Properti', icon: House },
  { id: 'history', label: 'Riwayat hidup', icon: BookOpen },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

const money = (amount: number, currencyCode = 'IDR') => new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: currencyCode,
  maximumFractionDigits: 0,
}).format(amount);

const eventDateLabel = (year: number, month?: number) => (
  month ? `${year}-${String(month).padStart(2, '0')}` : String(year)
);

const genderLabels = {
  male: 'Laki-laki',
  female: 'Perempuan',
  other: 'Lainnya',
} as const;

function getDashboardCharacterName(character: Character): string {
  const degrees = character.educationRecord.degrees;
  const doctorate = degrees.some((degree) => degree.level === 's3');
  const postnominals = [...new Set(degrees
    .filter((degree) => degree.level !== 's3' || degree.abbreviation !== 'Dr.')
    .map((degree) => degree.abbreviation))];
  return `${doctorate ? 'Dr. ' : ''}${getCharacterName(character)}${postnominals.length > 0 ? `, ${postnominals.join(', ')}` : ''}`;
}

function CalendarPanel({ month, year }: { month: number; year: number }) {
  const moments: Record<number, string> = {
    1: 'Tahun baru',
    8: '17 Agustus',
    12: 'Akhir tahun',
  };
  return (
    <section className="panel calendar-panel" aria-label="Kalender kehidupan">
      <div className="panel-heading">
        <div><span className="eyebrow">KALENDER KEHIDUPAN</span><h2>{getMonthName(month)} {year}</h2></div>
        <CalendarDays size={19} aria-hidden="true" />
      </div>
      <div className="calendar-month-grid">
        {monthNames.map((name, index) => {
          const monthNumber = index + 1;
          return (
            <div
              className={`calendar-month${monthNumber === month ? ' is-current' : ''}${moments[monthNumber] ? ' has-moment' : ''}`}
              aria-current={monthNumber === month ? 'date' : undefined}
              key={name}
            >
              <span>{name.slice(0, 3)}</span>
              {moments[monthNumber] && <small>{moments[monthNumber]}</small>}
            </div>
          );
        })}
      </div>
      <p className="footnote">Momen nasional dan tahunan membuka pilihan saat waktunya tiba; kejadian acak dapat muncul sepanjang tahun.</p>
    </section>
  );
}

const eventCategoryLabels: Record<string, string> = {
  family: 'Keluarga',
  education: 'Pendidikan',
  career: 'Karier',
  romance: 'Percintaan',
  friendship: 'Pertemanan',
  finance: 'Keuangan',
  health: 'Kesehatan',
  crime: 'Hukum',
  underworld: 'Dunia bawah',
  social: 'Sosial',
  historical: 'Sejarah',
  random_life: 'Kejadian hidup',
  death: 'Kematian',
};

const eventClassificationLabels = {
  historical_fact: 'Fakta sejarah',
  fictional_personal: 'Kisah fiksi',
  alternate_future: 'Masa depan fiksi',
} as const;

const statDefinitions = [
  { key: 'health', label: 'Kesehatan' },
  { key: 'happiness', label: 'Kebahagiaan' },
  { key: 'intelligence', label: 'Kecerdasan' },
  { key: 'looks', label: 'Penampilan' },
  { key: 'energy', label: 'Energi' },
  { key: 'reputation', label: 'Reputasi' },
  { key: 'wealth', label: 'Kekayaan' },
] as const;

function CharacterStats({ character }: { character: Character }) {
  return (
    <section className="panel stats-panel" aria-labelledby="stats-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">GAMBARAN DIRI</span>
          <h2 id="stats-title">Statistik karakter</h2>
        </div>
        <span className="quiet-label">Dari permainanmu</span>
      </div>
      <div className="stats-grid">
        {statDefinitions.map(({ key, label }) => {
          const value = character.stats[key];
          return (
            <div className="stat-item" key={key}>
              <div className="stat-label">
                <span>{label}</span>
                <b>{value}<small>/100</small></b>
              </div>
              <div
                className="stat-track"
                role="progressbar"
                aria-label={label}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={value}
              >
                <span style={{ width: `${value}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FinancialOverview({ character }: { character: Character }) {
  const currencyCode = character.birthInformation.location.currencyCode;
  return (
    <section className="panel finance-panel" aria-labelledby="finance-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">KEUANGAN</span>
          <h2 id="finance-title">Ringkasan keuangan</h2>
        </div>
        <Wallet size={19} aria-hidden="true" />
      </div>
      <span className="finance-caption">Saldo saat ini</span>
      <strong className="balance">{money(character.cash, currencyCode)}</strong>
      <span className={`finance-status ${character.cash > 0 ? 'is-positive' : 'is-neutral'}`}>
        {character.cash > 0 ? 'Saldo tersedia' : 'Saldo kosong'}
      </span>
      <div className="finance-detail">
        <div><span>Kekayaan bersih</span><b>{money(character.netWorth, currencyCode)}</b></div>
        <div><span>Pemasukan tahun ini</span><b>{money(character.lastYearIncome, currencyCode)}</b></div>
        <div><span>Pengeluaran tahun ini</span><b>{money(character.lastYearExpenses, currencyCode)}</b></div>
      </div>
    </section>
  );
}

function LifeHistory({ history, compact = false }: { history: string[]; compact?: boolean }) {
  const entries = (compact ? history.slice(-4) : history).slice().reverse();

  if (entries.length === 0) {
    return <p className="empty-copy">Belum ada catatan dalam perjalanan hidup ini.</p>;
  }

  return (
    <ol className="timeline">
      {entries.map((entry, index) => {
        const separator = entry.indexOf(': ');
        const year = separator < 0 ? '—' : entry.slice(0, separator);
        const description = separator < 0 ? entry : entry.slice(separator + 2);
        return (
          <li className="timeline-entry" key={`${entry}-${index}`}>
            <span className="timeline-year">{year}</span>
            <span className="timeline-dot" aria-hidden="true" />
            <p>{description}</p>
          </li>
        );
      })}
    </ol>
  );
}

function Dashboard({
  character,
  history,
  activeEvent,
  eventProgress,
  chooseEventChoice,
  advanceMonth,
  advanceYear,
  advanceMode,
  isAdvancing,
  isBusy,
  onEditCharacter,
  onContinueAsHeir,
}: {
  character: Character;
  history: string[];
  activeEvent: LifeEvent | null;
  eventProgress: EventProgress;
  chooseEventChoice: (choiceId: string) => void;
  advanceMonth: () => Promise<boolean>;
  advanceYear: () => Promise<boolean>;
  advanceMode: 'month' | 'year' | null;
  isAdvancing: boolean;
  isBusy: boolean;
  onEditCharacter: () => void;
  onContinueAsHeir: (childId: string) => Promise<boolean>;
}) {
  const canAdvance = character.status === 'alive' && activeEvent === null && !isBusy;
  const currencyCode = character.birthInformation.location.currencyCode;
  const background = getFamilyBackground(character.familyBackground.tier);
  const worldContext = getWorldYearContext(character.currentYear);
  const lifeStage = getLifeStage(character.age);
  const eligibleSuccessors = getEligibleSuccessors(character);
  const monthlyParentalSupport = getMonthlyParentalSupport(character);
  const livingFamilySummary = character.family.members
    .filter((member) => member.status === 'alive')
    .map((member) => {
      const occupation = member.role === 'father' || member.role === 'mother'
        ? getOccupation(member.occupationId ?? null)
        : null;
      return occupation ? `${member.name} (${occupation.name})` : member.name;
    });

  return (
    <>
      <div className="page-intro">
        <div>
          <span className="eyebrow">PERJALANAN HIDUPMU</span>
          <h1>Selamat datang kembali</h1>
          <p>Jalani ceritamu, satu bulan pada satu waktu.</p>
        </div>
        <div className="year-card">
          <CalendarDays size={18} aria-hidden="true" />
          <div><span>BULAN · TAHUN</span><b>{getMonthName(character.currentMonth)} {character.currentYear}</b></div>
        </div>
      </div>

      <section className="panel profile-panel" aria-labelledby="profile-name">
        <CharacterPortrait avatarId={character.identity.avatarId} />
        <div className="profile-content">
          <span className="eyebrow">PROFIL KARAKTER</span>
          <div className="profile-title-row">
            <h2 id="profile-name">{getDashboardCharacterName(character)}</h2>
            <button type="button" className="edit-profile-button" onClick={onEditCharacter}><Pencil size={14} aria-hidden="true" /> Edit</button>
          </div>
          <p className="profile-subtitle">{lifeStage.label} · {character.age} tahun <span>·</span> {genderLabels[character.identity.gender]}</p>
          <div className="profile-facts">
            <div><MapPin size={16} aria-hidden="true" /><span>{character.birthInformation.location.city}, {character.birthInformation.location.province}<small>Kota asal</small></span></div>
            <div><GraduationCap size={16} aria-hidden="true" /><span>{getEducationDisplayLabel(character.educationRecord)}<small>Pendidikan</small></span></div>
            <div><Briefcase size={16} aria-hidden="true" /><span>{getOccupationTitle(character.careerRecord.currentOccupationId, character.careerRecord.positionIndex)}<small>Pekerjaan</small></span></div>
            <div><Heart size={16} aria-hidden="true" /><span>{character.status === 'alive' ? 'Menjalani hidup' : 'Telah meninggal'}<small>Kondisi kehidupan</small></span></div>
          </div>
        </div>
        <div className="profile-balance">
          <span>Saldo</span>
          <b>{money(character.cash, currencyCode)}</b>
        </div>
      </section>

      <div className="dashboard-grid">
        <CharacterStats character={character} />
        <FinancialOverview character={character} />
        <CalendarPanel month={character.currentMonth} year={character.currentYear} />
        <section className="panel era-panel" aria-label="Kondisi era permainan">
          <span className="eyebrow">DUNIA PADA TAHUN INI</span>
          <h2>{worldContext.decadeLabel}</h2>
          <p>{worldContext.technologySummary}</p>
          {!worldContext.smartphoneAvailable && <small>Smartphone belum tersedia pada tahun ini.</small>}
        </section>
        <section className="panel family-panel" aria-label="Kondisi keluarga">
          <span className="eyebrow">LATAR KELUARGA</span>
          <h2>{background.label}</h2>
          <p>{livingFamilySummary.join(' · ') || 'Tidak ada anggota keluarga yang tercatat masih hidup'}</p>
          <small>{background.housingLabel} · {character.startingAssets.facilities.join(' · ')}</small>
          {character.age < 18 && (
            <small>
              Kiriman orang tua: {money(monthlyParentalSupport, currencyCode)} per bulan
            </small>
          )}
        </section>

        <section className="panel event-panel" aria-labelledby="event-title">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">MOMEN KEHIDUPAN</span>
              <h2 id="event-title">Kejadian saat ini</h2>
            </div>
            {activeEvent && <span className="event-age">{getMonthName(character.currentMonth)} {character.currentYear}</span>}
          </div>
          {activeEvent ? (
            <>
              <span className="event-category">{eventCategoryLabels[activeEvent.category] ?? activeEvent.category}</span>
              {activeEvent.historicalClassification
                ? <span className="event-category">{eventClassificationLabels[activeEvent.historicalClassification]}</span>
                : activeEvent.fictional && <span className="event-category">Fiksi simulasi</span>}
              {activeEvent.calendarMomentType && (
                <span className="event-category">
                  {activeEvent.calendarMomentType === 'national'
                    ? 'Momen nasional'
                    : activeEvent.calendarMomentType === 'annual'
                      ? 'Momen tahunan'
                      : 'Momen acak'}
                </span>
              )}
              {!activeEvent.calendarMomentType && <span className="event-category">Momen acak</span>}
              <h3>{activeEvent.title}</h3>
              <p className="event-description">{activeEvent.description}</p>
              {activeEvent.historicalSource && <p className="event-source">Sumber: {activeEvent.historicalSource}</p>}
              <div className="choices">
                {activeEvent.choices.map((choice) => {
                  const unavailableReason = getChoiceUnavailableReason(character, choice);
                  return (
                    <button
                      className="choice"
                      key={choice.id}
                      onClick={() => void chooseEventChoice(choice.id)}
                      disabled={isBusy || unavailableReason !== null}
                    >
                      <span>
                        <b>{choice.label}</b>
                        <small>{choice.description}</small>
                        {unavailableReason && <small>{unavailableReason}</small>}
                      </span>
                      <ArrowRight size={17} aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              {eventProgress.history.slice(-3).reverse().map((entry) => (
                <article className="event-history-entry" key={`${entry.eventId}-${entry.year}-${entry.month ?? 0}-${entry.choiceId}`}>
                  <span>{eventDateLabel(entry.year, entry.month)} · {eventCategoryLabels[entry.category] ?? entry.category}</span>
                  <b>{entry.title}: {entry.choiceLabel}</b>
                  <p>{entry.outcomeText}</p>
                </article>
              ))}
              {eventProgress.history.length === 0 && <p className="empty-copy">Tidak ada kejadian yang sedang menunggu pilihanmu.</p>}
            </>
          )}
        </section>

        <section className="panel history-panel" aria-labelledby="history-title">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">CATATAN PERJALANAN</span>
              <h2 id="history-title">Riwayat kehidupan</h2>
            </div>
            <span className="quiet-label">{history.length} catatan</span>
          </div>
          <LifeHistory history={history} compact />
        </section>
      </div>

      <div className="age-up-wrap">
        <div className="age-actions">
          <button className="age-button" onClick={() => void advanceMonth()} disabled={!canAdvance}>
            <span>{isAdvancing && advanceMode === 'month' ? 'Memproses bulan…' : 'Jalani satu bulan lagi'}</span><ArrowRight size={19} aria-hidden="true" />
          </button>
          <button className="age-button age-button-year" onClick={() => void advanceYear()} disabled={!canAdvance}>
            <span>
              {isAdvancing && advanceMode === 'year'
                ? 'Memproses satu tahun…'
                : eventProgress.yearAdvanceRemaining
                  ? `Lanjutkan tahun (${eventProgress.yearAdvanceRemaining} bulan)`
                  : 'Jalani satu tahun'}
            </span>
            <CalendarDays size={18} aria-hidden="true" />
          </button>
        </div>
        <p aria-live="polite">
          {character.status !== 'alive'
            ? 'Perjalanan karakter ini telah berakhir.'
            : activeEvent
              ? eventProgress.yearAdvanceRemaining
                ? `Pilih tindakan pada kejadian ini, lalu lanjutkan sisa ${eventProgress.yearAdvanceRemaining} bulan.`
                : 'Pilih tindakan pada kejadian saat ini sebelum melanjutkan usia.'
              : isAdvancing
                ? advanceMode === 'year'
                  ? 'Waktu bergerak hingga satu tahun dan progres disimpan.'
                  : 'Memproses perkembangan hidup dan menyimpan progres.'
                : eventProgress.yearAdvanceRemaining
                  ? `Tahun dijeda dengan ${eventProgress.yearAdvanceRemaining} bulan tersisa; tombol satu bulan mengurangi sisa itu satu bulan.`
              : 'Jalani satu tahun memajukan maksimal 12 bulan; proses berhenti jika ada kejadian yang perlu dipilih atau kehidupan berakhir.'}
        </p>
      </div>
      {character.deathRecord && (
        <section className="panel death-summary" aria-labelledby="death-summary-title">
          <span className="eyebrow">RINGKASAN KEHIDUPAN</span>
          <h2 id="death-summary-title">Perjalanan berakhir pada usia {character.deathRecord.age}</h2>
          <p>{getMonthName(character.deathRecord.month ?? character.currentMonth)} {character.deathRecord.year} · {character.deathRecord.cause}</p>
          {character.estateSettlement && (
            <div className="estate-summary">
              <p>Harta simulasi {money(character.estateSettlement.grossValue, currencyCode)} · Utang dibayar {money(character.estateSettlement.debtsPaid, currencyCode)} · Sisa {money(character.estateSettlement.netValue, currencyCode)}</p>
              {character.estateSettlement.shares.map((share) => (
                <p key={share.beneficiaryId}>{share.beneficiaryName}: {money(share.amount, currencyCode)}</p>
              ))}
            </div>
          )}
          {eligibleSuccessors.length > 0 ? (
            <div className="succession-actions">
              <h3>Lanjutkan sebagai generasi berikutnya</h3>
              <p>Pilih anak dewasa untuk meneruskan cerita. Harta dialihkan sebagai nilai tunai simulasi setelah utang diselesaikan.</p>
              {eligibleSuccessors.map((child) => (
                <button
                  type="button"
                  className="secondary-button"
                  key={child.id}
                  disabled={isBusy}
                  onClick={() => void onContinueAsHeir(child.id)}
                >
                  {child.name} · {character.currentYear - child.birthYear} tahun · {money(child.inheritanceCash ?? 0, currencyCode)}
                </button>
              ))}
            </div>
          ) : (
            <p>Belum ada anak dewasa yang dapat meneruskan cerita ini. Kamu tetap dapat memulai kehidupan baru di slot berbeda.</p>
          )}
        </section>
      )}
    </>
  );
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="page-intro subpage-intro">
      <div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>
    </div>
  );
}

function FinancePage({
  character,
  onSetBudget,
  onInvest,
  onSellInvestment,
  onTakeLoan,
  onRepayLoan,
  onStartBusiness,
  onCloseBusiness,
  isBusy,
}: {
  character: Character;
  onSetBudget: (budget: MonthlyBudget) => Promise<boolean>;
  onInvest: (amount: number, kind: 'deposit' | 'balanced_fund') => Promise<boolean>;
  onSellInvestment: (assetId: string) => Promise<boolean>;
  onTakeLoan: (amount: number, purpose: 'personal' | 'business' | 'property') => Promise<boolean>;
  onRepayLoan: (loanId: string, amount: number) => Promise<boolean>;
  onStartBusiness: (kind: BusinessKind, name: string) => Promise<boolean>;
  onCloseBusiness: (businessId: string) => Promise<boolean>;
  isBusy: boolean;
}) {
  const [budgetDraft, setBudgetDraft] = useState<MonthlyBudget>({
    housing: character.economyRecord.monthlyBudget.housing,
    food: character.economyRecord.monthlyBudget.food,
    transport: character.economyRecord.monthlyBudget.transport,
    health: character.economyRecord.monthlyBudget.health,
    education: character.economyRecord.monthlyBudget.education,
    leisure: character.economyRecord.monthlyBudget.leisure,
  });
  const [investmentAmount, setInvestmentAmount] = useState('1000000');
  const [loanAmount, setLoanAmount] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessKind, setBusinessKind] = useState<BusinessKind>('food_stall');
  const currencyCode = character.birthInformation.location.currencyCode;
  const factor = getNominalPriceFactor(character.currentYear);
  const loanLimit = getLoanLimit(character);
  const monthlyBudgetTotal = Object.values(budgetDraft).reduce((total, amount) => total + amount, 0);

  return (
    <>
      <PageHeading eyebrow="KEUANGAN" title="Keuangan" description="Ringkasan berdasarkan saldo yang tersimpan di permainan." />
      <FinancialOverview character={character} />
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">PERENCANAAN</span><h2>Anggaran bulanan</h2></div></div>
        <p className="footnote">Anggaran yang disimpan menjadi pengeluaran rutin setiap bulan. Nilai menyesuaikan inflasi simulasi.</p>
        <div className="economy-budget-grid">
          {budgetCategories.map(({ id, label }) => (
            <label className="education-effort" key={id}>{label}
              <input
                type="number"
                min={0}
                max={100_000_000}
                step={50_000}
                value={budgetDraft[id]}
                disabled={isBusy}
                onChange={(event) => setBudgetDraft((previous) => ({
                  ...previous,
                  [id]: Math.max(0, Math.round(Number(event.target.value) || 0)),
                }))}
              />
            </label>
          ))}
        </div>
        <div className="economy-action-row">
          <span>Rencana {money(monthlyBudgetTotal, currencyCode)} per bulan</span>
          <button className="primary-button compact-button" disabled={isBusy || monthlyBudgetTotal > 100_000_000} onClick={() => void onSetBudget(budgetDraft)}>Simpan anggaran</button>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">INVESTASI</span><h2>Kelola dana</h2></div></div>
        <p className="footnote">Deposito memakai hasil tetap simulasi; reksa dana campuran dapat naik atau turun tiap tahun. Nilai bukan nasihat atau jaminan finansial.</p>
        <div className="economy-action-row">
          <label className="education-effort">Nominal
            <input type="number" min={100_000} step={100_000} value={investmentAmount} disabled={isBusy} onChange={(event) => setInvestmentAmount(event.target.value)} />
          </label>
          <button className="secondary-button" disabled={isBusy || character.age < 18 || Number(investmentAmount) > character.cash || Number(investmentAmount) < 100_000} onClick={() => void onInvest(Math.round(Number(investmentAmount)), 'deposit')}>Buka deposito</button>
          <button className="secondary-button" disabled={isBusy || character.age < 18 || Number(investmentAmount) > character.cash || Number(investmentAmount) < 100_000} onClick={() => void onInvest(Math.round(Number(investmentAmount)), 'balanced_fund')}>Beli reksa dana</button>
        </div>
        {character.assets.filter((asset) => asset.category === 'investment').map((asset) => (
          <article className="education-option" key={asset.id}>
            <div><b>{asset.name}</b><p>Nilai saat ini {money(asset.value, currencyCode)} · Hasil tahunan {Math.round((asset.annualYieldRate ?? 0) * 100)}%</p></div>
            <button className="secondary-button" disabled={isBusy} onClick={() => void onSellInvestment(asset.id)}>Cairkan · {money(Math.round(asset.value * 0.99), currencyCode)}</button>
          </article>
        ))}
        {character.assets.every((asset) => asset.category !== 'investment') && <p className="empty-copy">Belum ada investasi.</p>}
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">PINJAMAN</span><h2>Utang dan cicilan</h2></div><span className="quiet-label">Batas simulasi {money(loanLimit, currencyCode)}</span></div>
        <p className="footnote">Pinjaman memiliki bunga 9% per tahun dengan cicilan bulanan selama lima tahun. Pembayaran menyesuaikan saldo yang tersedia.</p>
        <div className="economy-action-row">
          <label className="education-effort">Jumlah pinjaman
            <input type="number" min={1_000_000} max={loanLimit} step={500_000} value={loanAmount} disabled={isBusy} onChange={(event) => setLoanAmount(event.target.value)} />
          </label>
          <button className="secondary-button" disabled={isBusy || Number(loanAmount) < 1_000_000 || Number(loanAmount) > loanLimit} onClick={() => void onTakeLoan(Math.round(Number(loanAmount)), 'personal')}>Ajukan pinjaman</button>
        </div>
        <div className="loan-list">
          {character.economyRecord.loans.map((loan) => (
            <article className="education-option" key={loan.id}>
              <div><b>{loan.name} · {loan.status === 'active' ? 'Aktif' : 'Lunas'}</b><p>Sisa {money(loan.balance, currencyCode)} · Bunga 9% per tahun · Cicilan bulanan sekitar {money(Math.ceil(loan.annualPayment / 12), currencyCode)}</p></div>
              {loan.status === 'active' && <button className="secondary-button" disabled={isBusy || character.cash <= 0} onClick={() => void onRepayLoan(loan.id, Math.min(loan.balance, loan.annualPayment, character.cash))}>Bayar {money(Math.min(loan.balance, loan.annualPayment, character.cash), currencyCode)}</button>}
            </article>
          ))}
          {character.economyRecord.loans.length === 0 && <p className="empty-copy">Belum ada pinjaman.</p>}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">USAHA</span><h2>Kelola bisnis</h2></div></div>
        <div className="economy-action-row">
          <label className="education-effort">Nama usaha
            <input value={businessName} maxLength={40} disabled={isBusy} onChange={(event) => setBusinessName(event.target.value)} placeholder="Contoh: Warung keluarga" />
          </label>
          <label className="education-effort">Jenis usaha
            <select value={businessKind} disabled={isBusy} onChange={(event) => setBusinessKind(event.target.value as BusinessKind)}>
              {businessCatalog.map((business) => <option key={business.id} value={business.id}>{business.name} · {money(Math.round(business.startupCost * factor), currencyCode)}</option>)}
            </select>
          </label>
          <button className="primary-button compact-button" disabled={isBusy || character.age < 18 || !businessName.trim()} onClick={() => void onStartBusiness(businessKind, businessName).then((success) => { if (success) setBusinessName(''); })}>Mulai usaha</button>
        </div>
        {character.economyRecord.businesses.map((business) => (
          <article className="education-option" key={business.id}>
            <div><b>{business.name} · {business.status === 'active' ? 'Berjalan' : 'Ditutup'}</b><p>Stabilitas {business.stability}/100 · Omzet tahunan sekitar {money(business.annualRevenue, currencyCode)} · Biaya operasional {money(business.annualOperatingCosts, currencyCode)}</p></div>
            {business.status === 'active' && <button className="secondary-button" disabled={isBusy} onClick={() => void onCloseBusiness(business.id)}>Tutup usaha</button>}
          </article>
        ))}
        {character.economyRecord.businesses.length === 0 && <p className="empty-copy">Belum ada usaha yang dimiliki.</p>}
      </section>
    </>
  );
}

function PropertyPage({
  character,
  onBuy,
  onSell,
  isBusy,
}: {
  character: Character;
  onBuy: (propertyId: string) => Promise<boolean>;
  onSell: (assetId: string) => Promise<boolean>;
  isBusy: boolean;
}) {
  const currencyCode = character.birthInformation.location.currencyCode;
  const factor = getNominalPriceFactor(character.currentYear);
  const properties = character.assets.filter((asset) => asset.category === 'home');
  return (
    <>
      <PageHeading eyebrow="PROPERTI" title="Properti" description="Beli dan kelola rumah, properti sewa, atau tanah. Pembelian memakai saldo permainan." />
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">KATALOG</span><h2>Aset yang tersedia</h2></div></div>
        {propertyCatalog.map((property) => {
          const price = Math.round(property.price * factor);
          const ownsPrimary = properties.some((asset) => asset.propertyType === 'primary');
          const canBuy = character.age >= 18 && character.cash >= price && properties.length < 5
            && !(property.type === 'primary' && ownsPrimary);
          return (
            <article className="education-option" key={property.id}>
              <div><b>{property.name}</b><p>{property.description} · Harga {money(price, currencyCode)} · Sewa bulanan {money(Math.round(property.annualRent * factor / 12), currencyCode)} · Perawatan bulanan {money(Math.round(property.annualMaintenanceCost * factor / 12), currencyCode)}</p></div>
              <button className="secondary-button" disabled={isBusy || !canBuy} onClick={() => void onBuy(property.id)}>Beli</button>
            </article>
          );
        })}
        {character.age < 18 && <p className="footnote">Pembelian properti tersedia mulai usia 18 tahun.</p>}
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">ASET MILIKMU</span><h2>{properties.length} properti</h2></div></div>
        {properties.map((property) => (
          <article className="education-option" key={property.id}>
            <div><b>{property.name}</b><p>Nilai {money(property.value, currencyCode)} · {property.propertyType === 'primary' ? 'Tempat tinggal' : property.propertyType === 'rental' ? `Sewa bulanan ${money(Math.round((property.annualRent ?? 0) / 12), currencyCode)}` : 'Tanah'} · Perawatan bulanan {money(Math.round((property.annualMaintenanceCost ?? 0) / 12), currencyCode)}</p></div>
            <button className="secondary-button" disabled={isBusy} onClick={() => void onSell(property.id)}>Jual · {money(Math.round(property.value * 0.95), currencyCode)}</button>
          </article>
        ))}
        {properties.length === 0 && <p className="empty-copy">Belum memiliki properti.</p>}
      </section>
    </>
  );
}

function EducationPage({
  character,
  onEnroll,
  onScholarship,
  onStudyEffort,
  onLeave,
  onResume,
  onDropOut,
  onTransfer,
  isBusy,
}: {
  character: Character;
  onEnroll: (programId: string, universityId: string) => void;
  onScholarship: (scholarshipId: string) => void;
  onStudyEffort: (effort: StudyEffort) => void;
  onLeave: () => void;
  onResume: () => void;
  onDropOut: () => void;
  onTransfer: (universityId: string) => void;
  isBusy: boolean;
}) {
  const record = character.educationRecord;
  const program = studyPrograms.find((item) => item.id === record.programId);
  const institution = universities.find((item) => item.id === record.institutionId);
  const eligiblePrograms = getEligiblePrograms(character);
  const availableScholarships = getEligibleScholarships(character);
  const eligibleUniversities = program ? getEligibleUniversities(program.id) : [];
  const currencyCode = character.birthInformation.location.currencyCode;
  const priceFactor = getNominalPriceFactor(character.currentYear);
  const statusLabels = {
    not_started: 'Belum memulai',
    enrolled: 'Sedang belajar',
    on_leave: 'Cuti akademik',
    completed: 'Selesai',
    dropped_out: 'Terhenti',
  } as const;
  const standingLabels = { good: 'Baik', warning: 'Perlu perhatian', probation: 'Masa evaluasi' } as const;
  const scholarshipStatusLabels = {
    applied: 'Menunggu seleksi',
    active: 'Aktif',
    denied: 'Tidak lolos',
    revoked: 'Dihentikan',
    completed: 'Selesai',
  } as const;

  return (
    <>
      <PageHeading eyebrow="PENDIDIKAN" title="Pendidikan" description="Pilih jalur studi, kelola perkuliahan, dan tinjau hasil akademik yang tersimpan." />
      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">STATUS SAAT INI</span><h2>{getEducationDisplayLabel(record)}</h2></div>
          <span className="status-tag">{statusLabels[record.status]}</span>
        </div>
        <p>Usia {character.age} · {getLifeStage(character.age).label}{institution ? ` · ${institution.name}` : ''}</p>
        {program && (
          <>
            <p>{record.semester} dari {program.durationSemesters} semester · {record.totalCredits} SKS · IPK {record.cumulativeGpa.toFixed(2)}</p>
            <label className="education-effort">
              Intensitas belajar
              <select value={record.studyEffort} disabled={isBusy || record.status !== 'enrolled'} onChange={(event) => onStudyEffort(event.target.value as StudyEffort)}>
                <option value="light">Ringan</option><option value="balanced">Seimbang</option><option value="focused">Fokus</option>
              </select>
            </label>
            <div className="choice-row">
              {record.status === 'enrolled' && <button className="secondary-button" disabled={isBusy} onClick={onLeave}>Ambil cuti akademik</button>}
              {record.status === 'on_leave' && <button className="secondary-button" disabled={isBusy} onClick={onResume}>Lanjutkan studi</button>}
              {(record.status === 'enrolled' || record.status === 'on_leave') && <button className="secondary-button" disabled={isBusy} onClick={onDropOut}>Hentikan studi</button>}
            </div>
            {record.status === 'enrolled' && eligibleUniversities.some((item) => item.id !== record.institutionId) && (
              <label className="education-effort">
                Pindah institusi
                <select value="" disabled={isBusy} onChange={(event) => event.target.value && onTransfer(event.target.value)}>
                  <option value="">Pilih institusi tujuan</option>
                  {eligibleUniversities.filter((item) => item.id !== record.institutionId).map((item) => <option value={item.id} key={item.id}>{item.name} · {item.city}</option>)}
                </select>
              </label>
            )}
          </>
        )}
        {!program && <p>Usia {character.age} · {getLifeStage(character.age).label} · Pendidikan tertinggi: {getEducationLevelLabel(record.currentLevel)}.</p>}
      </section>

      {availableScholarships.length > 0 && program && record.status === 'enrolled' && (
        <section className="panel">
          <span className="eyebrow">BANTUAN PENDIDIKAN</span><h2>Peluang beasiswa</h2>
          <div className="education-options">
            {availableScholarships.map((scholarship) => (
              <article className="education-option" key={scholarship.id}>
                <div><b>{scholarship.name}</b><p>Cakupan biaya hingga {scholarship.tuitionCoveragePercent}% · IPK minimum {scholarship.minimumGpa.toFixed(2)}</p></div>
                <button className="secondary-button" disabled={isBusy} onClick={() => onScholarship(scholarship.id)}>Ajukan</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {eligiblePrograms.length > 0 && (
        <section className="panel">
          <span className="eyebrow">JALUR LANJUTAN</span><h2>Program yang memenuhi syarat</h2>
          <div className="education-options">
            {eligiblePrograms.map((item) => (
              <article className="education-option" key={item.id}>
                <div><b>{item.name}</b><p>{getEducationLevelLabel(item.level)} · {item.durationSemesters} semester · {money(Math.round(item.tuitionPerSemester * priceFactor), currencyCode)} per semester</p></div>
                <div className="choice-row">
                  {getEligibleUniversities(item.id).map((university) => (
                    <button className="secondary-button" key={university.id} disabled={isBusy} onClick={() => onEnroll(item.id, university.id)}>
                      Daftar · {university.name}
                    </button>
                  ))}
                </div>
              </article>
            ))}
          </div>
          <p className="footnote">Institusi dan program di katalog ini adalah bagian fiktif dari simulasi. Biaya memakai nilai nominal sesuai era permainan.</p>
        </section>
      )}

      <section className="panel">
        <span className="eyebrow">BANTUAN PENDIDIKAN</span><h2>Status beasiswa</h2>
        {record.scholarships.map((award) => (
          <article className="education-option" key={award.id}>
            <div><b>{award.name}</b><p>{scholarshipStatusLabels[award.status]} · Cakupan {award.tuitionCoveragePercent}% · Sisa {award.remainingSemesters} semester</p></div>
          </article>
        ))}
        {record.scholarships.length === 0 && <p className="empty-copy">Belum ada beasiswa atau bantuan yang diajukan.</p>}
      </section>

      <section className="panel">
        <span className="eyebrow">RIWAYAT AKADEMIK</span><h2>Hasil dan penghargaan</h2>
        {record.semesters.slice().reverse().slice(0, 6).map((semester) => (
          <article className="education-option" key={semester.id}>
            <div>
              <b>{semester.year} · Semester {semester.semester}</b>
              <p>IP {semester.gpa.toFixed(2)} · {semester.creditsEarned} SKS · {standingLabels[semester.standing]}</p>
              <p>{semester.courses.map((course) => `${course.code}: ${course.gradeLetter}`).join(' · ')}</p>
            </div>
          </article>
        ))}
        {record.degrees.map((degree) => <article className="education-option" key={degree.id}><div><b>{degree.title} ({degree.abbreviation})</b><p>{degree.year} · IPK {degree.gpa.toFixed(2)}</p></div></article>)}
        {record.honoraryDegrees.map((degree) => <article className="education-option" key={degree.id}><div><b>{degree.title} ({degree.abbreviation})</b><p>{degree.year} · {degree.citation}</p></div></article>)}
        {record.awards.map((award) => <article className="education-option" key={award.id}><div><b>{award.title}</b><p>{award.year} · {award.description}</p></div></article>)}
        {record.semesters.length === 0 && record.degrees.length === 0 && record.honoraryDegrees.length === 0 && record.awards.length === 0
          && <p className="empty-copy">Belum ada hasil akademik atau penghargaan yang tercatat.</p>}
      </section>
    </>
  );
}

function CareerPage({
  character,
  onApply,
  onAccept,
  onDecline,
  onChange,
  isBusy,
}: {
  character: Character;
  onApply: (occupationId: string) => void;
  onAccept: (applicationId: string) => void;
  onDecline: (applicationId: string) => void;
  onChange: (change: CareerChange) => void;
  isBusy: boolean;
}) {
  const record = character.careerRecord;
  const occupation = getOccupation(record.currentOccupationId);
  const employer = getEmployer(record.employerId);
  const currencyCode = character.birthInformation.location.currencyCode;
  const priceFactor = getNominalPriceFactor(character.currentYear);
  const eligibleOccupations = getEligibleOccupations(character);
  const statusLabels = { employed: 'Bekerja', unemployed: 'Belum bekerja', retired: 'Pensiun', laid_off: 'Sedang mencari kerja' } as const;
  const applicationLabels = { offered: 'Tawaran tersedia', rejected: 'Belum berhasil', accepted: 'Diterima', declined: 'Ditolak' } as const;

  return (
    <>
      <PageHeading eyebrow="KARIER" title="Karier" description="Ajukan lamaran yang memenuhi kualifikasi dan kelola pekerjaan yang tercatat." />
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">STATUS SAAT INI</span><h2>{occupation ? getOccupationTitle(occupation.id, record.positionIndex) : statusLabels[record.status]}</h2></div><span className="status-tag">{statusLabels[record.status]}</span></div>
        {occupation ? (
          <>
            <p>{occupation.name}{employer ? ` · ${employer.name} (fiktif)` : ''}</p>
            <div className="finance-detail">
              <div><span>Gaji bulanan</span><b>{money(record.monthlySalary, currencyCode)}</b></div>
              <div><span>Pengalaman</span><b>{record.experienceYears} tahun</b></div>
              <div><span>Kepuasan kerja</span><b>{record.satisfaction}/100</b></div>
              <div><span>Pemasukan tahun ini</span><b>{money(character.lastYearIncome, currencyCode)}</b></div>
            </div>
            {canReceivePromotion(character) && <button className="secondary-button" disabled={isBusy} onClick={() => onChange({ type: 'promote' })}>Ajukan promosi</button>}
            {character.age >= 60 && record.status === 'employed' && <button className="secondary-button" disabled={isBusy} onClick={() => onChange({ type: 'retire' })}>Mulai pensiun</button>}
          </>
        ) : <p>{record.status === 'retired' ? 'Pemasukan dari pekerjaan dihentikan setelah pensiun.' : 'Pilih salah satu lowongan yang memenuhi usia, pendidikan, dan kualifikasi karakter.'}</p>}
      </section>

      {eligibleOccupations.length > 0 && (
        <section className="panel">
          <span className="eyebrow">LOWONGAN TERSEDIA</span><h2>Jalur karier yang memenuhi syarat</h2>
          <div className="education-options">
            {eligibleOccupations.map((item) => (
              <article className="education-option" key={item.id}>
                <div><b>{item.name}</b><p>{careerCategoryLabels[item.category]} · Gaji awal sekitar {money(Math.round(item.monthlySalary * priceFactor), currencyCode)} per bulan · Pendidikan: {item.requiredLevels.map(getEducationLevelLabel).join(', ') || 'Tidak ditentukan'}</p></div>
                <button className="secondary-button" disabled={isBusy} onClick={() => onApply(item.id)}>Lamar</button>
              </article>
            ))}
          </div>
        </section>
      )}

      {record.applications.length > 0 && (
        <section className="panel">
          <span className="eyebrow">LAMARAN DAN TAWARAN</span><h2>Keputusan rekrutmen</h2>
          {record.applications.slice().reverse().map((application) => (
            <article className="education-option" key={application.id}>
              <div><b>{getOccupation(application.occupationId)?.name ?? 'Pekerjaan'}</b><p>{application.year} · {money(application.offeredMonthlySalary, currencyCode)} per bulan · {applicationLabels[application.status]}</p></div>
              {application.status === 'offered' && <div className="choice-row"><button className="secondary-button" disabled={isBusy} onClick={() => onAccept(application.id)}>Terima</button><button className="secondary-button" disabled={isBusy} onClick={() => onDecline(application.id)}>Tolak</button></div>}
            </article>
          ))}
        </section>
      )}
      <section className="panel">
        <span className="eyebrow">RIWAYAT KARIER</span><h2>Perjalanan profesional</h2>
        {record.history.slice().reverse().map((entry) => <article className="education-option" key={entry.id}><div><b>{entry.year} · {entry.title}</b><p>{entry.details}</p></div></article>)}
        {record.history.length === 0 && <p className="empty-copy">Belum ada perubahan karier yang tercatat.</p>}
      </section>
    </>
  );
}

const romanticStageLabels: Record<RomanticRelationshipStage, string> = {
  friend: 'Teman',
  dating: 'Berpacaran',
  engaged: 'Bertunangan',
  married: 'Menikah',
  separated: 'Berpisah',
  ended: 'Berakhir',
};

const maritalStatusLabels = {
  single: 'Lajang',
  partnered: 'Berpacaran',
  engaged: 'Bertunangan',
  married: 'Menikah',
  separated: 'Berpisah',
  widowed: 'Duda/janda',
} as const;

function RelationshipsPage({
  character,
  onMeet,
  onInteract,
  onAskToDate,
  onPropose,
  onMarry,
  onEnd,
  onDivorce,
  isBusy,
}: {
  character: Character;
  onMeet: (random?: () => number) => Promise<boolean>;
  onInteract: (id: string, action: RelationshipInteraction) => Promise<boolean>;
  onAskToDate: (id: string, random?: () => number) => Promise<boolean>;
  onPropose: (id: string, random?: () => number) => Promise<boolean>;
  onMarry: (id: string, wedding: 'simple' | 'celebration') => Promise<boolean>;
  onEnd: (id: string) => Promise<boolean>;
  onDivorce: () => Promise<boolean>;
  isBusy: boolean;
}) {
  const factor = getNominalPriceFactor(character.currentYear);
  const activePartner = getCurrentSpouse(character);
  const availableRelationships = getVisibleRelationships(character);
  const simpleWeddingCost = Math.round(500_000 * factor);
  const celebrationCost = Math.round(5_000_000 * factor);
  const getRelationshipStage = (stage?: RomanticRelationshipStage) => (
    stage ? romanticStageLabels[stage] : 'Kenalan'
  );

  return (
    <>
      <PageHeading
        eyebrow="HUBUNGAN"
        title="Hubungan dan pertemanan"
        description={`Status keluarga: ${maritalStatusLabels[character.maritalStatus]}. Pilihan di halaman ini memengaruhi kedekatan, kepercayaan, kebahagiaan, dan keuangan.`}
      />
      <section className="panel">
        <div className="panel-heading">
          <div><span className="eyebrow">LINGKAR SOSIAL</span><h2>Orang-orang dalam hidupmu</h2></div>
          <button
            className="primary-button compact-button"
            type="button"
            disabled={isBusy || character.age < 6}
            onClick={() => void onMeet()}
          >
            Kenalan dengan seseorang
          </button>
        </div>
        {character.age < 6 && <p className="footnote">Kamu masih terlalu kecil untuk mengelola pertemanan sendiri.</p>}
        {availableRelationships.length === 0
          ? <p className="empty-copy">Belum ada teman atau pasangan yang tercatat. Kenalan dengan seseorang untuk memulai.</p>
          : (
            <div className="relationship-card-list">
              {availableRelationships.map((relationship) => {
                const stage = relationship.stage ?? 'friend';
                const canDate = stage === 'friend' && character.age >= 16
                  && (relationship.profile?.age ?? character.age) >= 16
                  && !['partnered', 'engaged', 'married'].includes(character.maritalStatus);
                const canPropose = stage === 'dating' && character.age >= 18;
                const living = relationship.status !== 'ended'
                  && relationship.profile?.lifeStatus !== 'deceased';
                const canApologize = relationship.status === 'strained';
                const canInteract = living && character.age >= 6;

                return (
                  <article className="relationship-card" key={relationship.id}>
                    <div className="relationship-card-heading">
                      <div className="family-member-avatar">{relationship.name.slice(0, 1)}</div>
                      <div className="family-member-details">
                        <b>{relationship.name}</b>
                        <span>
                          {getRelationshipStage(stage)}
                          {relationship.profile ? ` · Usia ${relationship.profile.age}` : ''}
                          {relationship.profile?.lifeStatus === 'deceased' ? ' · Telah meninggal' : ''}
                        </span>
                      </div>
                      <span className={`status-tag ${relationship.status === 'strained' ? 'is-warning' : ''}`}>
                        {relationship.status === 'active' ? 'Aktif' : relationship.status === 'strained' ? 'Merenggang' : 'Berakhir'}
                      </span>
                    </div>
                    <div className="relationship-metrics">
                      <div>
                        <span>Kedekatan</span>
                        <div className="relationship-meter" role="progressbar" aria-label={`Kedekatan dengan ${relationship.name}`} aria-valuenow={relationship.score} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${relationship.score}%` }} /></div>
                      </div>
                      <div>
                        <span>Kepercayaan</span>
                        <div className="relationship-meter" role="progressbar" aria-label={`Kepercayaan ${relationship.name}`} aria-valuenow={relationship.trust} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${relationship.trust}%` }} /></div>
                      </div>
                    </div>
                    <div className="relationship-actions">
                      {canInteract && (
                        <>
                          <button className="secondary-button" disabled={isBusy} onClick={() => void onInteract(relationship.id, 'talk')}>Bicara</button>
                          <button className="secondary-button" disabled={isBusy || character.cash < Math.round(25_000 * factor)} onClick={() => void onInteract(relationship.id, 'visit')}>Kunjungi</button>
                          <button className="secondary-button" disabled={isBusy || character.cash < Math.round(150_000 * factor)} onClick={() => void onInteract(relationship.id, 'gift')}>Beri hadiah</button>
                          <button className="secondary-button" disabled={isBusy || character.cash < Math.round(300_000 * factor)} onClick={() => void onInteract(relationship.id, 'help')}>Bantu</button>
                          <button className="secondary-button" disabled={isBusy || relationship.trust < 55 || (relationship.profile?.netWorth ?? 0) < Math.round(100_000 * factor)} onClick={() => void onInteract(relationship.id, 'ask_help')}>Minta bantuan</button>
                          {canApologize && <button className="secondary-button" disabled={isBusy} onClick={() => void onInteract(relationship.id, 'apologize')}>Minta maaf</button>}
                          {relationship.status === 'active' && <button className="secondary-button" disabled={isBusy} onClick={() => void onInteract(relationship.id, 'argue')}>Berselisih</button>}
                        </>
                      )}
                      {canDate && <button className="primary-button compact-button" disabled={isBusy} onClick={() => void onAskToDate(relationship.id)}>Ajak berpacaran</button>}
                      {canPropose && <button className="primary-button compact-button" disabled={isBusy || relationship.score < 45 || relationship.trust < 45} onClick={() => void onPropose(relationship.id)}>Melamar</button>}
                      {stage === 'engaged' && character.maritalStatus === 'engaged' && (
                        <>
                          <button className="primary-button compact-button" disabled={isBusy || character.cash < simpleWeddingCost} onClick={() => void onMarry(relationship.id, 'simple')} title={`Biaya ${money(simpleWeddingCost, character.birthInformation.location.currencyCode)}`}>Menikah sederhana</button>
                          <button className="secondary-button" disabled={isBusy || character.cash < celebrationCost} onClick={() => void onMarry(relationship.id, 'celebration')} title={`Biaya ${money(celebrationCost, character.birthInformation.location.currencyCode)}`}>Perayaan keluarga</button>
                        </>
                      )}
                      {living && stage === 'dating' && <button className="secondary-button" disabled={isBusy} onClick={() => void onEnd(relationship.id)}>Akhiri hubungan</button>}
                      {living && relationship.status !== 'ended' && !['married', 'dating'].includes(stage) && (
                        <button className="secondary-button" disabled={isBusy} onClick={() => void onInteract(relationship.id, 'end')}>Akhiri pertemanan</button>
                      )}
                    </div>
                    {(relationship.history?.length ?? 0) > 0 && (
                      <p className="relationship-last-note">
                        Terakhir: {relationship.history?.[relationship.history.length - 1]?.year} · {relationship.history?.[relationship.history.length - 1]?.details}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        {character.maritalStatus === 'married' && activePartner && (
          <div className="relationship-footer-action">
            <p>Perceraian menimbulkan biaya administrasi dan membagi sebagian saldo tunai sebagai penyelesaian.</p>
            <button className="secondary-button" disabled={isBusy || character.cash < Math.round(250_000 * factor)} onClick={() => void onDivorce()}>Ajukan perceraian</button>
          </div>
        )}
      </section>
    </>
  );
}

function DigitalLifePage({
  character,
  onBuySmartphone,
  onSellSmartphone,
  onBuyDataPackage,
  onBuyCreatorEquipment,
  onCreateAccount,
  onActivateMonetization,
  onPublishContent,
  isBusy,
}: {
  character: Character;
  onBuySmartphone: (modelId: string, condition?: 'new' | 'used') => Promise<boolean>;
  onSellSmartphone: () => Promise<boolean>;
  onBuyDataPackage: (packageId: string) => Promise<boolean>;
  onBuyCreatorEquipment: (equipmentId: string) => Promise<boolean>;
  onCreateAccount: (platformId: DigitalPlatformId, username: string) => Promise<boolean>;
  onActivateMonetization: (accountId: string) => Promise<boolean>;
  onPublishContent: (input: {
    accountId: string;
    category: DigitalContentCategory;
    title: string;
    description: string;
  }) => Promise<boolean>;
  isBusy: boolean;
}) {
  const [selectedApp, setSelectedApp] = useState<DigitalAppId>('wallet');
  const [platformId, setPlatformId] = useState<DigitalPlatformId>('indotube');
  const [username, setUsername] = useState('');
  const [accountId, setAccountId] = useState('');
  const [category, setCategory] = useState<DigitalContentCategory>('vlog');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const currencyCode = character.birthInformation.location.currencyCode;
  const smartphone = character.digitalLife.smartphone;
  const phoneModel = smartphone ? getSmartphoneModel(smartphone.modelId) : null;
  const availableApps = digitalApps.filter((app) => (
    app.releaseYear <= character.currentYear
      && (smartphone
        ? smartphone.installedApps.includes(app.id)
        : app.id === 'market' || app.id === 'wallet')
  ));
  const availablePlatforms = digitalPlatforms.filter((platform) => (
    platform.releaseYear <= character.currentYear
  ));
  const currentAccount = character.digitalLife.accounts.find((account) => account.id === accountId)
    ?? character.digitalLife.accounts[0];
  const currentIndex = character.currentYear * 12 + character.currentMonth - 1;
  const dataPlan = smartphone?.dataPlan;
  const productionCost = getDigitalProductionCost(character);
  const planExpired = !dataPlan || dataPlan.expiresAtMonthIndex <= currentIndex
    || dataPlan.remainingMb <= 0;
  const canCreateAccount = Boolean(smartphone && character.age >= 13 && availablePlatforms.some(
    (platform) => platform.id === platformId
      && !character.digitalLife.accounts.some((account) => account.platform === platformId),
  ) && /^[a-z0-9._]{3,20}$/i.test(username.trim()));
  const selectedAppIcon: Record<DigitalAppId, LucideIcon> = {
    social: Users,
    creator: Camera,
    market: ShoppingBag,
    wallet: CreditCard,
  };
  const accountPlatform = currentAccount ? getDigitalPlatform(currentAccount.platform) : null;

  return (
    <>
      <PageHeading eyebrow="SMARTPHONE & DIGITAL LIFE" title="Kehidupan digital" description="Ponsel, paket data, jejaring sosial, dan konten kreator terhubung langsung ke saldo, aset, statistik, dan riwayat hidup." />
      {character.currentYear < 2007 ? (
        <section className="panel">
          <span className="eyebrow">BELUM TERSEDIA</span>
          <h2>Smartphone belum hadir di era ini</h2>
          <p className="footnote">Katalog ponsel dan aplikasi digital baru terbuka mulai 2007.</p>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="panel-heading">
              <div><span className="eyebrow">APP LAUNCHER</span><h2>Aplikasi ponsel</h2></div>
              <Smartphone size={19} aria-hidden="true" />
            </div>
            {smartphone
              ? <p className="footnote">{phoneModel?.name ?? smartphone.modelId} · Kondisi {Math.round(smartphone.condition)}% · Nomor {smartphone.phoneNumber}</p>
              : <p className="empty-copy">Belum memiliki smartphone. Gunakan Pasar Digital untuk membeli perangkat pertamamu.</p>}
            <div className="digital-app-launcher">
              {availableApps.map((app) => {
                const Icon = selectedAppIcon[app.id];
                return (
                  <button
                    key={app.id}
                    type="button"
                    className={`digital-app-button${selectedApp === app.id ? ' is-active' : ''}`}
                    aria-pressed={selectedApp === app.id}
                    onClick={() => setSelectedApp(app.id)}
                  >
                    <Icon size={18} aria-hidden="true" />
                    <span>{app.name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {selectedApp === 'market' && (
            <section className="panel">
              <div className="panel-heading"><div><span className="eyebrow">PASAR DIGITAL</span><h2>Perangkat dan studio</h2></div></div>
              {character.age < 13 && <p className="footnote">Pembelian perangkat pribadi tersedia mulai usia 13 tahun.</p>}
              <div className="education-options">
                {smartphoneModels.filter((model) => model.releaseYear <= character.currentYear).map((model) => {
                  const price = Math.round(model.price * getNominalPriceFactor(character.currentYear));
                  const existingModel = phoneModel;
                  const canUpgrade = !existingModel || model.creatorQuality > existingModel.creatorQuality;
                  const isCurrent = smartphone?.modelId === model.id;
                  const availableCash = character.cash
                    + (smartphone
                      ? Math.round((character.assets.find((asset) => asset.id === smartphone.assetId)?.value ?? 0) * 0.55)
                      : 0);
                  return (
                    <article className="education-option" key={model.id}>
                      <div><b>{model.name}</b><p>Dirilis {model.releaseYear} · Kualitas kreator {model.creatorQuality}/100 · Harga {money(price, currencyCode)}</p></div>
                      <div className="digital-action-buttons">
                        <button className="secondary-button" disabled={isBusy || character.age < 13 || !canUpgrade || isCurrent || availableCash < price} onClick={() => void onBuySmartphone(model.id, 'new')}>{isCurrent ? 'Sedang dipakai' : 'Beli baru'}</button>
                        <button className="secondary-button" disabled={isBusy || character.age < 13 || !canUpgrade || isCurrent || availableCash < Math.round(price * 0.62)} onClick={() => void onBuySmartphone(model.id, 'used')}>Beli bekas</button>
                      </div>
                    </article>
                  );
                })}
              </div>
              {smartphone && <button className="secondary-button" disabled={isBusy} onClick={() => void onSellSmartphone()}>Jual ponsel · {money(Math.round((character.assets.find((asset) => asset.id === smartphone.assetId)?.value ?? 0) * 0.5), currencyCode)}</button>}
              <h3 className="digital-section-title">Peralatan kreator</h3>
              {creatorEquipment.filter((item) => item.releaseYear <= character.currentYear).map((equipment) => {
                const owned = character.assets.some((asset) => asset.id === `gear-${character.id}-${equipment.id}`);
                const price = Math.round(equipment.price * getNominalPriceFactor(character.currentYear));
                return (
                  <article className="education-option" key={equipment.id}>
                    <div><b>{equipment.name}</b><p>Kualitas +{equipment.quality} · Harga {money(price, currencyCode)}</p></div>
                    <button className="secondary-button" disabled={isBusy || character.age < 13 || owned || character.cash < price} onClick={() => void onBuyCreatorEquipment(equipment.id)}>{owned ? 'Dimiliki' : 'Beli'}</button>
                  </article>
                );
              })}
            </section>
          )}

          {selectedApp === 'wallet' && (
            <section className="panel">
              <div className="panel-heading"><div><span className="eyebrow">DOMPET</span><h2>Saldo dan paket data</h2></div><CreditCard size={19} aria-hidden="true" /></div>
              <div className="finance-detail">
                <div><span>Saldo utama permainan</span><b>{money(character.cash, currencyCode)}</b></div>
                <div><span>Pemasukan tercatat</span><b>{money(character.lastYearIncome, currencyCode)}</b></div>
                <div><span>Pengeluaran tercatat</span><b>{money(character.lastYearExpenses, currencyCode)}</b></div>
              </div>
              {smartphone && dataPlan && !planExpired && (
                <p className="footnote">{dataPackages.find((item) => item.id === dataPlan.packageId)?.name ?? 'Paket data'} · {Math.round(dataPlan.remainingMb)} MB tersisa · Berakhir {getMonthName((dataPlan.expiresAtMonthIndex % 12) + 1)} {Math.floor(dataPlan.expiresAtMonthIndex / 12)}</p>
              )}
              {smartphone ? (
                dataPackages.map((dataPackage) => {
                  const price = Math.round(dataPackage.price * getNominalPriceFactor(character.currentYear));
                  return (
                    <article className="education-option" key={dataPackage.id}>
                      <div><b>{dataPackage.name}</b><p>{dataPackage.dataMb.toLocaleString('id-ID')} MB · {dataPackage.durationMonths} bulan · {money(price, currencyCode)}</p></div>
                      <button className="secondary-button" disabled={isBusy || !planExpired || character.cash < price} onClick={() => void onBuyDataPackage(dataPackage.id)}>Beli paket</button>
                    </article>
                  );
                })
              ) : <p className="empty-copy">Beli smartphone untuk mengaktifkan paket data.</p>}
              {character.digitalLife.transactions.length > 0 && (
                <>
                  <h3 className="digital-section-title">Transaksi digital terbaru</h3>
                  {character.digitalLife.transactions.slice(-5).reverse().map((transaction) => (
                    <article className="event-history-entry" key={transaction.id}>
                      <span>{getMonthName(transaction.month)} {transaction.year} · {transaction.type === 'creator_income' || transaction.type === 'phone_sale' ? 'Pemasukan' : 'Pengeluaran'}</span>
                      <b>{transaction.description}</b>
                      <p>{money(transaction.amount, currencyCode)}</p>
                    </article>
                  ))}
                </>
              )}
            </section>
          )}

          {selectedApp === 'social' && (
            <section className="panel">
              <div className="panel-heading"><div><span className="eyebrow">JARINGAN</span><h2>Profil dan audiens</h2></div><Users size={19} aria-hidden="true" /></div>
              {character.age < 13 && <p className="footnote">Pembuatan akun tersedia mulai usia 13 tahun.</p>}
              {smartphone && availablePlatforms.length > 0 && (
                <div className="digital-form">
                  <label className="education-effort">Platform
                    <select value={platformId} disabled={isBusy} onChange={(event) => setPlatformId(event.target.value as DigitalPlatformId)}>
                      {availablePlatforms.map((platform) => <option key={platform.id} value={platform.id} disabled={character.digitalLife.accounts.some((account) => account.platform === platform.id)}>{platform.name}{character.digitalLife.accounts.some((account) => account.platform === platform.id) ? ' · akun dibuat' : ''}</option>)}
                    </select>
                  </label>
                  <label className="education-effort">Nama pengguna
                    <input value={username} maxLength={20} disabled={isBusy} onChange={(event) => setUsername(event.target.value)} placeholder="namapengguna" />
                  </label>
                  <button className="primary-button compact-button" disabled={isBusy || !canCreateAccount} onClick={() => void onCreateAccount(platformId, username)}>Buat akun</button>
                </div>
              )}
              {character.digitalLife.accounts.map((account) => {
                const platform = getDigitalPlatform(account.platform);
                const audience = account.platform === 'indotube' ? account.subscribers : account.followers;
                return (
                  <article className="education-option" key={account.id}>
                    <div><b>{platform.name} · @{account.username}</b><p>{audience.toLocaleString('id-ID')} {platform.audienceLabel} · {account.totalViews.toLocaleString('id-ID')} tayangan · {account.monetized ? 'Monetisasi aktif' : 'Monetisasi belum aktif'}</p></div>
                    {!account.monetized && (
                      <button className="secondary-button" disabled={isBusy || !canMonetizeAccount(account)} onClick={() => void onActivateMonetization(account.id)}>{canMonetizeAccount(account) ? 'Aktifkan monetisasi' : `Syarat: ${platform.monetizationAudienceThreshold.toLocaleString('id-ID')} audiens & ${platform.monetizationViewThreshold.toLocaleString('id-ID')} tayangan`}</button>
                    )}
                  </article>
                );
              })}
              {character.digitalLife.accounts.length === 0 && <p className="empty-copy">Belum ada akun sosial. Buat akun setelah memiliki ponsel.</p>}
              <p className="footnote">Level kreator: {getDigitalCreatorLevel(character)}. Audiens tumbuh dari hasil konten, dan monetisasi baru tersedia setelah syarat platform terpenuhi.</p>
            </section>
          )}

          {selectedApp === 'creator' && (
            <section className="panel">
              <div className="panel-heading"><div><span className="eyebrow">KAMERA & STUDIO</span><h2>Produksi konten</h2></div><Camera size={19} aria-hidden="true" /></div>
              {smartphone && character.digitalLife.accounts.length > 0 ? (
                <div className="digital-form">
                  <label className="education-effort">Akun
                    <select value={currentAccount?.id ?? ''} disabled={isBusy} onChange={(event) => setAccountId(event.target.value)}>
                      {character.digitalLife.accounts.map((account) => <option key={account.id} value={account.id}>{getDigitalPlatform(account.platform).name} · @{account.username}</option>)}
                    </select>
                  </label>
                  <label className="education-effort">Kategori
                    <select value={category} disabled={isBusy} onChange={(event) => setCategory(event.target.value as DigitalContentCategory)}>
                      {digitalContentCategories.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="education-effort">Judul
                    <input value={title} maxLength={100} disabled={isBusy} onChange={(event) => setTitle(event.target.value)} placeholder="Judul kontenmu" />
                  </label>
                  <label className="education-effort">Deskripsi
                    <input value={description} maxLength={300} disabled={isBusy} onChange={(event) => setDescription(event.target.value)} placeholder="Ceritakan isi konten" />
                  </label>
                  <button
                    className="primary-button compact-button"
                    disabled={isBusy || character.age < 13 || smartphone.condition < 10
                      || !dataPlan || dataPlan.expiresAtMonthIndex <= currentIndex
                      || dataPlan.remainingMb < (accountPlatform?.uploadDataMb ?? 0)
                      || productionCost === null || character.cash < productionCost
                      || title.trim().length < 3 || title.trim().length > 100
                      || description.trim().length > 300}
                    onClick={() => void onPublishContent({
                      accountId: currentAccount?.id ?? '',
                      category,
                      title,
                      description,
                    })}
                  >
                    Unggah konten
                  </button>
                  <p className="footnote">Unggah memakai {accountPlatform?.uploadDataMb ?? 0} MB dan biaya produksi {productionCost === null ? '—' : money(productionCost, currencyCode)}; setiap unggahan mengurangi energi. Konten populer dapat meningkatkan kebahagiaan, reputasi sosial, dan peluang karier.</p>
                </div>
              ) : <p className="empty-copy">Miliki ponsel dan buat akun sosial untuk mulai mengunggah.</p>}
              <h3 className="digital-section-title">Konten terbaru</h3>
              {character.digitalLife.content.slice(-8).reverse().map((content) => (
                <article className="event-history-entry" key={content.id}>
                  <span>{getMonthName(content.month)} {content.year} · {getDigitalPlatform(content.platform).name} · {content.performance}</span>
                  <b>{content.title}</b>
                  <p>{content.views.toLocaleString('id-ID')} tayangan · {content.likes.toLocaleString('id-ID')} suka · +{content.newFollowers.toLocaleString('id-ID')} audiens · Pendapatan {money(content.revenue, currencyCode)}</p>
                </article>
              ))}
              {character.digitalLife.content.length === 0 && <p className="empty-copy">Belum ada konten yang diunggah.</p>}
            </section>
          )}
        </>
      )}
    </>
  );
}

function HistoryPage({ history }: { history: string[] }) {
  return (
    <>
      <PageHeading eyebrow="CATATAN PERJALANAN" title="Riwayat kehidupan" description="Kejadian yang telah tercatat sepanjang perjalanan karakter." />
      <section className="panel history-full-panel">
        <div className="panel-heading">
          <h2>Linimasa</h2>
          <span className="quiet-label">{history.length} catatan</span>
        </div>
        <LifeHistory history={history} />
      </section>
    </>
  );
}

function ActivityPage({
  history,
  eventProgress,
}: {
  history: string[];
  eventProgress: EventProgress;
}) {
  const recentEvents = eventProgress.history.slice(-12).reverse();
  return (
    <>
      <PageHeading eyebrow="AKTIVITAS" title="Aktivitas terbaru" description="Perkembangan bulanan dan pilihan kejadian yang tercatat dalam cerita." />
      <section className="panel history-full-panel">
        <div className="panel-heading"><h2>Catatan terbaru</h2><span className="quiet-label">{history.length} catatan</span></div>
        <LifeHistory history={history.slice(-12)} />
      </section>
      <section className="panel">
        <div className="panel-heading"><h2>Pilihan kejadian terbaru</h2><span className="quiet-label">{eventProgress.history.length} pilihan</span></div>
        {recentEvents.length > 0 ? recentEvents.map((entry) => (
          <article className="event-history-entry" key={`${entry.eventId}-${entry.year}-${entry.month ?? 0}-${entry.choiceId}`}>
            <span>{eventDateLabel(entry.year, entry.month)} · {eventCategoryLabels[entry.category] ?? entry.category}</span>
            <b>{entry.title}: {entry.choiceLabel}</b>
            <p>{entry.outcomeText}</p>
          </article>
        )) : <p className="empty-copy">Belum ada pilihan kejadian yang tercatat.</p>}
      </section>
    </>
  );
}

function FamilyPage({
  character,
  onInteract,
  onChildInteraction,
  onCreateChild,
  onSetParentingStyle,
  onSetEstatePlan,
  isBusy,
}: {
  character: Character;
  onInteract: (id: string, action: FamilyInteraction) => Promise<boolean>;
  onChildInteraction: (id: string, action: ChildInteraction) => Promise<boolean>;
  onCreateChild: (name: string, adopted?: boolean) => Promise<boolean>;
  onSetParentingStyle: (id: string, style: NonNullable<ChildRecord['parentingStyle']>) => Promise<boolean>;
  onSetEstatePlan: (distribution: EstateDistributionRule, namedHeirId?: string | null) => Promise<boolean>;
  isBusy: boolean;
}) {
  const [childName, setChildName] = useState('');
  const conditionLabels = {
    both_alive: 'Kedua orang tua masih hidup',
    father_only: 'Ayah masih hidup',
    mother_only: 'Ibu masih hidup',
    both_deceased: 'Kedua orang tua telah meninggal',
    guardian: 'Tinggal bersama wali keluarga',
  } as const;
  const statusLabels = {
    alive: 'Masih hidup',
    deceased: 'Telah meninggal',
    unknown: 'Tidak diketahui',
  } as const;
  const roleLabels: Record<FamilyMemberRole, string> = {
    father: 'Ayah',
    mother: 'Ibu',
    sibling: 'Saudara',
    guardian: 'Wali keluarga',
    grandparent: 'Kakek/nenek',
    aunt: 'Bibi',
    uncle: 'Paman',
    cousin: 'Sepupu',
    in_law: 'Keluarga pasangan',
  };
  const spouse = character.relationships.find((item) => item.stage === 'married' && item.status === 'active');
  const canParent = character.status === 'alive' && character.age >= 18
    && character.maritalStatus === 'married' && !!spouse;
  const adoptionFee = Math.round(2_000_000 * getNominalPriceFactor(character.currentYear));
  const canAdopt = canParent && character.age >= 25 && character.cash >= adoptionFee;
  const grandparents = character.family.members.filter((member) => member.role === 'grandparent');
  const closeFamily = character.family.members.filter((member) => member.role !== 'grandparent');
  const livingChildren = character.children.filter((child) => child.lifeStatus !== 'deceased');
  const statusOfChild = (child: ChildRecord) => child.lifeStatus === 'deceased' ? 'Telah meninggal' : 'Masih hidup';
  const childAge = (child: ChildRecord) => Math.max(0, character.currentYear - child.birthYear);

  return (
    <>
      <PageHeading eyebrow="KELUARGA" title="Keluarga dan silsilah" description="Rawat hubungan keluarga, catat perjalanan anak, dan lihat susunan generasi dalam keluargamu." />
      <section className="panel family-page-panel">
        <div className="panel-heading">
          <div><span className="eyebrow">KONDISI KELUARGA</span><h2>{conditionLabels[character.family.parentCondition]}</h2></div>
          <span className="status-tag">{getFamilyBackground(character.familyBackground.tier).label}</span>
        </div>
        <div className="kinship-tree">
          <div className="kinship-generation">
            <span className="eyebrow">GENERASI SEBELUM ORANG TUA</span>
            <div className="family-member-list">
              {grandparents.map((member) => (
                <FamilyMemberCard
                  key={member.id}
                  member={member}
                  roleLabel={member.kinshipLabel ?? roleLabels[member.role]}
                  statusLabel={statusLabels[member.status]}
                  currentYear={character.currentYear}
                />
              ))}
            </div>
          </div>
          <div className="kinship-generation">
            <span className="eyebrow">KELUARGA INTI DAN WALI</span>
            <div className="family-member-list">
              {closeFamily.map((member) => (
                <article className="family-member family-member-interactive" key={member.id}>
                  <div className="family-member-avatar">{member.name.slice(0, 1)}</div>
                  <div className="family-member-details">
                    <b>{member.name}</b>
                    <span>{roleLabels[member.role]}{member.birthYear ? ` · sekitar ${character.currentYear - member.birthYear} tahun` : ''}</span>
                  </div>
                  <div className="family-member-status">
                    <b>{statusLabels[member.status]}</b>
                    {member.status === 'alive' && <span>Hubungan {member.relationship}/100 · Kepercayaan {member.trust}/100</span>}
                  </div>
                  {member.status === 'alive' && (
                    <div className="relationship-actions">
                      <button className="secondary-button" disabled={isBusy} onClick={() => void onInteract(member.id, 'talk')}>Bicara</button>
                      <button className="secondary-button" disabled={isBusy || character.cash < Math.round(20_000 * getNominalPriceFactor(character.currentYear))} onClick={() => void onInteract(member.id, 'visit')}>Kunjungi</button>
                      <button className="secondary-button" disabled={isBusy || character.cash < Math.round(200_000 * getNominalPriceFactor(character.currentYear))} onClick={() => void onInteract(member.id, 'help')}>Bantu</button>
                      {member.relationship < 50 && <button className="secondary-button" disabled={isBusy} onClick={() => void onInteract(member.id, 'apologize')}>Minta maaf</button>}
                      <button className="secondary-button" disabled={isBusy} onClick={() => void onInteract(member.id, 'argue')}>Berselisih</button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
          <div className="kinship-generation">
            <span className="eyebrow">PASANGAN DAN ANAK</span>
            {spouse ? (
              <article className="family-member">
                <div className="family-member-avatar">{spouse.name.slice(0, 1)}</div>
                <div className="family-member-details"><b>{spouse.name}</b><span>Pasangan · {spouse.profile?.lifeStatus === 'deceased' ? 'Telah meninggal' : 'Masih hidup'}</span></div>
                <div className="family-member-status"><b>Hubungan {spouse.score}/100</b><span>Kepercayaan {spouse.trust}/100</span></div>
              </article>
            ) : <p className="empty-copy">Belum ada pasangan yang tercatat.</p>}
            {character.children.map((child) => (
              <article className="family-member" key={child.id}>
                <div className="family-member-avatar">{child.name.slice(0, 1)}</div>
                <div className="family-member-details"><b>{child.name}</b><span>{childAge(child)} tahun · {child.adopted ? 'Anak adopsi' : 'Anak'} · {statusOfChild(child)}</span></div>
                <div className="family-member-status"><b>Hubungan {child.relationship}/100</b><span>{getEducationLevelLabel(child.educationLevel ?? 'none')}</span></div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">PENGASUHAN</span><h2>Menjalani peran sebagai orang tua</h2></div></div>
        {!canParent && <p className="empty-copy">Memulai keluarga saat ini membutuhkan karakter dewasa yang sudah menikah dengan pasangan yang masih hidup.</p>}
        {character.children.map((child) => {
          const age = childAge(child);
          const living = child.lifeStatus !== 'deceased';
          return (
            <article className="child-card" key={child.id}>
              <div className="child-card-heading">
                <div><b>{child.name}</b><span>{age} tahun · {statusOfChild(child)} · {getEducationLevelLabel(child.educationLevel ?? 'none')}</span></div>
                <label className="education-effort">Pola asuh
                  <select
                    value={child.parentingStyle ?? 'balanced'}
                    disabled={isBusy || !living}
                    onChange={(event) => void onSetParentingStyle(child.id, event.target.value as NonNullable<ChildRecord['parentingStyle']>)}
                  >
                    <option value="supportive">Suportif</option>
                    <option value="balanced">Seimbang</option>
                    <option value="strict">Tegas</option>
                  </select>
                </label>
              </div>
              <div className="relationship-metrics">
                <div><span>Kesehatan {child.health ?? 75}/100</span><div className="relationship-meter"><span style={{ width: `${child.health ?? 75}%` }} /></div></div>
                <div><span>Kecerdasan {child.intelligence ?? 50}/100</span><div className="relationship-meter"><span style={{ width: `${child.intelligence ?? 50}%` }} /></div></div>
              </div>
              {living && age <= 17 && (
                <div className="relationship-actions">
                  <button className="secondary-button" disabled={isBusy} onClick={() => void onChildInteraction(child.id, 'talk')}>Bicara</button>
                  <button className="secondary-button" disabled={isBusy} onClick={() => void onChildInteraction(child.id, 'play')}>Bermain</button>
                  {age >= 5 && <button className="secondary-button" disabled={isBusy} onClick={() => void onChildInteraction(child.id, 'study')}>Belajar bersama</button>}
                  <button className="secondary-button" disabled={isBusy} onClick={() => void onChildInteraction(child.id, 'discipline')}>Tetapkan batas</button>
                </div>
              )}
              {(child.history?.length ?? 0) > 0 && <p className="relationship-last-note">{child.history?.[child.history.length - 1]}</p>}
            </article>
          );
        })}
        {canParent && (
          <form
            className="child-create-form"
            onSubmit={(event) => {
              event.preventDefault();
              void onCreateChild(childName, false).then((success) => {
                if (success) setChildName('');
              });
            }}
          >
            <label className="education-effort">Nama anak
              <input value={childName} onChange={(event) => setChildName(event.target.value)} maxLength={40} required />
            </label>
            <div className="relationship-actions">
              <button className="primary-button compact-button" type="submit" disabled={isBusy || !childName.trim() || character.age > 50}>Menyambut kelahiran</button>
              <button
                className="secondary-button"
                type="button"
                disabled={isBusy || !childName.trim() || !canAdopt}
                title={`Biaya adopsi ${money(adoptionFee, character.birthInformation.location.currencyCode)}`}
                onClick={() => void onCreateChild(childName, true).then((success) => {
                  if (success) setChildName('');
                })}
              >
                Adopsi · {money(adoptionFee, character.birthInformation.location.currencyCode)}
              </button>
            </div>
          </form>
        )}
      </section>
      <section className="panel family-background-panel">
        <div className="panel-heading"><div><span className="eyebrow">KEHIDUPAN AWAL</span><h2>{getFamilyBackground(character.familyBackground.tier).label}</h2></div></div>
        <p>{getFamilyBackground(character.familyBackground.tier).description}</p>
        <p>{getFamilyBackground(character.familyBackground.tier).housingLabel} · {character.startingAssets.facilities.join(' · ')}</p>
        <small>Nilai simulasi awal di tahun {character.currentYear}: {money(character.cash, character.birthInformation.location.currencyCode)} tunai, {money(character.netWorth, character.birthInformation.location.currencyCode)} kekayaan bersih.</small>
      </section>
      <section className="panel family-history-panel">
        <div className="panel-heading"><div><span className="eyebrow">CATATAN KELUARGA</span><h2>Riwayat keluarga</h2></div></div>
        {character.family.history.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>)}
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">SILSILAH</span><h2>Generasi keluarga</h2></div></div>
        {character.ancestors.length > 0 ? (
          <ol className="lineage-list">
            {[...character.ancestors].reverse().map((ancestor) => (
              <li key={ancestor.id}>
                <b>{ancestor.name}</b>
                <span>Generasi {ancestor.generation + 1} · lahir {ancestor.birthYear} · wafat {ancestor.deathYear}</span>
                <small>{ancestor.children.length} anak tercatat · harta simulasi saat wafat {money(ancestor.netWorthAtDeath, character.birthInformation.location.currencyCode)}</small>
              </li>
            ))}
            <li className="current-generation">
              <b>{getCharacterName(character)}</b>
              <span>Generasi {character.generation + 1} · {character.age} tahun · {character.status === 'alive' ? 'masih hidup' : 'telah meninggal'}</span>
              <small>{character.children.length} anak tercatat</small>
            </li>
          </ol>
        ) : (
          <p>Generasi pertama dalam catatan silsilah ini. Penerus yang dimainkan akan tercatat di sini.</p>
        )}
      </section>
      <section className="panel">
        <div className="panel-heading"><div><span className="eyebrow">PERENCANAAN SIMULASI</span><h2>Rencana warisan keluarga</h2></div></div>
        <p className="footnote">Aturan ini hanya mekanik permainan, bukan panduan atau representasi hukum waris Indonesia. Nilai aset dan utang dihitung sebelum pembagian.</p>
        {character.status === 'alive' && character.age >= 18 ? (
          <>
            <label className="education-effort">Cara pembagian
              <select
                value={character.estatePlan.distribution}
                disabled={isBusy}
                onChange={(event) => {
                  const distribution = event.target.value as EstateDistributionRule;
                  if (distribution === 'named_heir') {
                    if (livingChildren[0]) void onSetEstatePlan(distribution, livingChildren[0].id);
                  } else {
                    void onSetEstatePlan(distribution, null);
                  }
                }}
              >
                <option value="equal_heirs">Dibagi rata kepada pasangan dan anak</option>
                <option value="spouse_priority">Pasangan 50%, sisanya dibagi kepada anak</option>
                <option value="named_heir" disabled={livingChildren.length === 0}>Penerus pilihan menerima 60%</option>
              </select>
            </label>
            {character.estatePlan.distribution === 'named_heir' && (
              <label className="education-effort">Penerus pilihan
                <select
                  value={character.estatePlan.namedHeirId ?? ''}
                  disabled={isBusy}
                  onChange={(event) => void onSetEstatePlan('named_heir', event.target.value)}
                >
                  {livingChildren.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
                </select>
              </label>
            )}
          </>
        ) : (
          <p className="empty-copy">Rencana warisan dapat diatur oleh karakter dewasa yang masih hidup.</p>
        )}
        {character.estateSettlement && (
          <div className="estate-summary">
            <p>Harta bersih: {money(character.estateSettlement.netValue, character.birthInformation.location.currencyCode)}</p>
            {character.estateSettlement.shares.map((share) => (
              <p key={share.beneficiaryId}>{share.beneficiaryName}: {money(share.amount, character.birthInformation.location.currencyCode)}</p>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function FamilyMemberCard({
  member,
  roleLabel,
  statusLabel,
  currentYear,
}: {
  member: FamilyMember;
  roleLabel: string;
  statusLabel: string;
  currentYear: number;
}) {
  const occupation = getOccupation(member.occupationId ?? null);
  return (
    <article className="family-member">
      <div className="family-member-avatar">{member.name.slice(0, 1)}</div>
      <div className="family-member-details">
        <b>{member.name}</b>
        <span>{roleLabel}{member.birthYear ? ` · sekitar ${currentYear - member.birthYear} tahun` : ''}</span>
        {occupation && <span>Pekerjaan: {occupation.name}</span>}
      </div>
      <div className="family-member-status"><b>{statusLabel}</b>{member.status === 'unknown' && <span>Belum tercatat</span>}</div>
    </article>
  );
}

const persistenceLabels: Record<PersistenceStatus, string> = {
  loading: 'Memuat simpanan',
  unsaved: 'Belum disimpan',
  saving: 'Menyimpan',
  saved: 'Tersimpan di perangkat',
  error: 'Perlu perhatian',
};

function SettingsPage({
  persistenceStatus,
  persistenceError,
  selectedSaveSlotId,
  saveSlots,
  onSave,
  onSelectSaveSlot,
  onCreateSaveSlot,
  onImportBackup,
}: {
  persistenceStatus: PersistenceStatus;
  persistenceError: string | null;
  onSave: () => void;
  selectedSaveSlotId: string;
  saveSlots: SaveSlotSummary[];
  onSelectSaveSlot: (slotId: string) => void;
  onCreateSaveSlot: () => void;
  onImportBackup: (file: File) => void;
}) {
  const selectedSlot = saveSlots.find((slot) => slot.id === selectedSaveSlotId);

  const downloadBackup = async () => {
    try {
      const backup = await exportGameBackup(selectedSaveSlotId);
      const blob = new Blob([backup], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `indolife-${(selectedSlot?.characterName ?? 'cadangan').toLowerCase().replace(/[^a-z0-9-]+/g, '-')}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  return (
    <>
      <PageHeading eyebrow="PREFERENSI" title="Pengaturan" description="Status fitur yang tersedia pada versi saat ini." />
      <section className="panel settings-list">
        <div className="setting-row">
          <div className="setting-icon"><HardDrive size={19} aria-hidden="true" /></div>
          <div><b>Penyimpanan permainan</b><p>Beberapa slot lokal dengan penyimpanan otomatis. Cloud-save opsional belum dikonfigurasi.</p></div>
          <span className={`status-tag save-state-${persistenceStatus}`}>{persistenceLabels[persistenceStatus]}</span>
        </div>
        <div className="save-management">
          <label htmlFor="save-slot">Cerita tersimpan</label>
          <select
            id="save-slot"
            value={selectedSaveSlotId}
            disabled={persistenceStatus === 'saving' || persistenceStatus === 'error' || saveSlots.length === 0}
            onChange={(event) => onSelectSaveSlot(event.target.value)}
          >
            {saveSlots.map((slot) => (
              <option key={slot.id} value={slot.id}>
                {slot.characterName} · {slot.age} th · {getMonthName(slot.month)} {slot.year}
              </option>
            ))}
          </select>
          <div className="save-management-actions">
            <button type="button" className="secondary-button" disabled={!selectedSlot || persistenceStatus === 'saving'} onClick={() => void downloadBackup()}>
              Unduh cadangan
            </button>
            <label className={`secondary-button backup-import-button${persistenceStatus === 'saving' ? ' is-disabled' : ''}`} htmlFor="backup-file">
              Pulihkan cadangan
              <input
                id="backup-file"
                type="file"
                accept="application/json,.json"
                disabled={persistenceStatus === 'saving'}
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  if (file && file.size <= 10 * 1024 * 1024
                    && window.confirm('Cadangan akan mengganti cerita yang sedang dipilih. Lanjutkan?')) {
                    onImportBackup(file);
                  } else if (file && file.size > 10 * 1024 * 1024) {
                    window.alert('Ukuran file cadangan maksimal 10 MB.');
                  }
                  event.currentTarget.value = '';
                }}
              />
            </label>
            <button
              type="button"
              className="primary-button compact-button"
              disabled={persistenceStatus === 'saving' || persistenceStatus === 'error'}
              onClick={() => {
                if (window.confirm('Cerita saat ini akan tetap tersimpan. Mulai cerita baru di slot terpisah?')) {
                  onCreateSaveSlot();
                }
              }}
            >
              Mulai cerita baru
            </button>
          </div>
        </div>
        <div className="setting-row">
          <div className="setting-icon"><Settings size={19} aria-hidden="true" /></div>
          <div><b>Preferensi permainan</b><p>Kontrol audio, bahasa, dan tampilan belum tersedia.</p></div>
          <span className="status-tag">Belum tersedia</span>
        </div>
        {persistenceError && <div className="persistence-alert" role="alert">{persistenceError}<button type="button" onClick={onSave}>Coba simpan lagi</button></div>}
      </section>
    </>
  );
}

export default function App() {
  const [page, setPage] = useState<PageId>('home');
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const {
    character,
    history,
    activeEvent,
    eventProgress,
    isAdvancing,
    isHydrated,
    persistenceStatus,
    persistenceError,
    selectedSaveSlotId,
    saveSlots,
    setEstatePlan,
    continueAsHeir,
    hydrate,
    selectSaveSlot,
    createNewSaveSlot,
    importGameBackup,
    chooseEventChoice,
    advanceMonth,
    advanceYear,
    advanceMode,
    enrollInProgram,
    applyForScholarship,
    setStudyEffort,
    takeAcademicLeave,
    resumeEducation,
    dropOut,
    transferUniversity,
    applyForOccupation,
    acceptJobOffer,
    declineJobOffer,
    changeCareer,
    meetNewPerson,
    interactWithRelationship,
    interactWithFamilyMember,
    interactWithChild,
    askToDate,
    proposeEngagement,
    marryPartner,
    divorcePartner,
    endRelationship,
    createChild,
    setChildParentingStyle,
    setMonthlyBudget,
    buyProperty,
    sellProperty,
    invest,
    sellInvestment,
    takeLoan,
    repayLoan,
    startBusiness,
    closeBusiness,
    buySmartphone,
    sellSmartphone,
    buyMobileDataPackage,
    buyCreatorEquipment,
    createSocialAccount,
    activateDigitalMonetization,
    publishDigitalContent,
    saveCurrentGame,
  } = useGameStore();
  useEffect(() => {
    if (!isHydrated) void hydrate();
  }, [hydrate, isHydrated]);

  if (!isHydrated) {
    return <main className="loading-screen" aria-live="polite"><span className="loading-mark">IL</span><p>Memuat perjalanan hidup…</p></main>;
  }
  if (!character) return <CharacterCreation />;

  const currentPage = navigationItems.find((item) => item.id === page) ?? navigationItems[0];
  const CurrentPageIcon = currentPage.icon;
  const SaveIcon = HardDrive;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); setPage('home'); setNavigationOpen(false); }}>
          <span className="brand-mark"><Home size={21} aria-hidden="true" /></span>
          <span><b>INDOLIFE</b><small>SIMULATOR KEHIDUPAN</small></span>
        </a>
        <button
          type="button"
          className="icon-button navigation-toggle"
          aria-label={navigationOpen ? 'Tutup navigasi utama' : 'Buka navigasi utama'}
          aria-expanded={navigationOpen}
          aria-controls="primary-navigation"
          onClick={() => setNavigationOpen(!navigationOpen)}
        >
          {navigationOpen ? <X size={19} aria-hidden="true" /> : <Menu size={19} aria-hidden="true" />}
        </button>
        <div className="topbar-actions">
          <div className="year-card topbar-year">
            <CalendarDays size={17} aria-hidden="true" />
            <div><span>BULAN · TAHUN</span><b>{getMonthName(character.currentMonth)} {character.currentYear}</b></div>
          </div>
          <div className={`save-indicator save-state-${persistenceStatus}`} title={persistenceError ?? persistenceLabels[persistenceStatus]} aria-live="polite">
            <SaveIcon size={16} aria-hidden="true" /><span>{persistenceLabels[persistenceStatus]}</span>
          </div>
          <button className="icon-button settings-shortcut" aria-label="Buka pengaturan" onClick={() => setPage('settings')}>
            <Settings size={19} aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className="workspace">
        {navigationOpen && (
          <button
            type="button"
            className="navigation-backdrop"
            aria-label="Tutup menu navigasi"
            onClick={() => setNavigationOpen(false)}
          />
        )}
        <aside className={`sidebar${navigationOpen ? ' is-open' : ''}`} id="primary-navigation" aria-hidden={!navigationOpen}>
          <span className="nav-heading">MENU UTAMA</span>
          <nav aria-label="Navigasi utama">
            <ul className="nav-list">
              {navigationItems.map(({ id, label, icon: Icon }) => (
                <li key={id}>
                  <button
                    className={`nav-link${page === id ? ' is-active' : ''}`}
                    aria-current={page === id ? 'page' : undefined}
                    onClick={() => { setPage(id); setNavigationOpen(false); }}
                  >
                    <Icon size={18} aria-hidden="true" /><span>{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="sidebar-note">
            <span className="note-dot" />
            <p>Versi awal<br /><b>Pengembangan aktif</b></p>
          </div>
        </aside>

        <main className="main-content">
          {persistenceError && (
            <div className="persistence-alert" role="alert">
              <span>{persistenceError}</span>
              <button type="button" onClick={() => void saveCurrentGame()}>Coba simpan lagi</button>
            </div>
          )}
          <div className="mobile-page-label">
            <CurrentPageIcon size={17} aria-hidden="true" /><span>{currentPage.label}</span>
          </div>
          {page === 'home' && (
            <Dashboard
              character={character}
              history={history}
              activeEvent={activeEvent}
              eventProgress={eventProgress}
              chooseEventChoice={chooseEventChoice}
              advanceMonth={advanceMonth}
              advanceYear={advanceYear}
              advanceMode={advanceMode}
              isAdvancing={isAdvancing}
              isBusy={isAdvancing || persistenceStatus === 'saving'}
              onEditCharacter={() => setEditingProfile(true)}
              onContinueAsHeir={continueAsHeir}
            />
          )}
          {page === 'activity' && <ActivityPage history={history} eventProgress={eventProgress} />}
          {page === 'finance' && (
            <FinancePage
              character={character}
              onSetBudget={setMonthlyBudget}
              onInvest={invest}
              onSellInvestment={sellInvestment}
              onTakeLoan={takeLoan}
              onRepayLoan={repayLoan}
              onStartBusiness={startBusiness}
              onCloseBusiness={closeBusiness}
              isBusy={isAdvancing || persistenceStatus === 'saving' || activeEvent !== null}
            />
          )}
          {page === 'digital' && (
            <DigitalLifePage
              character={character}
              onBuySmartphone={buySmartphone}
              onSellSmartphone={sellSmartphone}
              onBuyDataPackage={buyMobileDataPackage}
              onBuyCreatorEquipment={buyCreatorEquipment}
              onCreateAccount={createSocialAccount}
              onActivateMonetization={activateDigitalMonetization}
              onPublishContent={publishDigitalContent}
              isBusy={isAdvancing || persistenceStatus === 'saving' || activeEvent !== null}
            />
          )}
          {page === 'property' && (
            <PropertyPage
              character={character}
              onBuy={buyProperty}
              onSell={sellProperty}
              isBusy={isAdvancing || persistenceStatus === 'saving' || activeEvent !== null}
            />
          )}
          {page === 'education' && (
            <EducationPage
              character={character}
              onEnroll={(programId, universityId) => void enrollInProgram(programId, universityId)}
              onScholarship={(scholarshipId) => void applyForScholarship(scholarshipId)}
              onStudyEffort={(effort) => void setStudyEffort(effort)}
              onLeave={() => void takeAcademicLeave()}
              onResume={() => void resumeEducation()}
              onDropOut={() => void dropOut()}
              onTransfer={(universityId) => void transferUniversity(universityId)}
              isBusy={isAdvancing || persistenceStatus === 'saving'}
            />
          )}
          {page === 'career' && (
            <CareerPage
              character={character}
              onApply={(occupationId) => void applyForOccupation(occupationId)}
              onAccept={(applicationId) => void acceptJobOffer(applicationId)}
              onDecline={(applicationId) => void declineJobOffer(applicationId)}
              onChange={(change) => void changeCareer(change)}
              isBusy={isAdvancing || persistenceStatus === 'saving'}
            />
          )}
          {page === 'relationships' && (
            <RelationshipsPage
              character={character}
              onMeet={meetNewPerson}
              onInteract={interactWithRelationship}
              onAskToDate={askToDate}
              onPropose={proposeEngagement}
              onMarry={marryPartner}
              onEnd={endRelationship}
              onDivorce={divorcePartner}
              isBusy={isAdvancing || persistenceStatus === 'saving' || activeEvent !== null}
            />
          )}
          {page === 'family' && (
            <FamilyPage
              character={character}
              onInteract={interactWithFamilyMember}
              onChildInteraction={interactWithChild}
              onCreateChild={createChild}
              onSetParentingStyle={setChildParentingStyle}
              onSetEstatePlan={setEstatePlan}
              isBusy={isAdvancing || persistenceStatus === 'saving' || activeEvent !== null}
            />
          )}
          {page === 'history' && <HistoryPage history={history} />}
          {page === 'settings' && (
            <SettingsPage
              persistenceStatus={persistenceStatus}
              persistenceError={persistenceError}
              selectedSaveSlotId={selectedSaveSlotId}
              saveSlots={saveSlots}
              onSave={() => void saveCurrentGame()}
              onSelectSaveSlot={(slotId) => void selectSaveSlot(slotId)}
              onCreateSaveSlot={() => void createNewSaveSlot()}
              onImportBackup={(file) => {
                void file.text()
                  .then((text) => importGameBackup(text))
                  .catch((error: unknown) => window.alert(
                    error instanceof Error ? error.message : String(error),
                  ));
              }}
            />
          )}
        </main>
      </div>
      <footer className="app-footer">INDOLIFE <span>·</span> Cerita hidupmu, langkah demi langkah.</footer>
      {editingProfile && <CharacterProfileEditor character={character} onClose={() => setEditingProfile(false)} />}
    </div>
  );
}
