import { useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { CharacterDraftError, createCharacter, createCharacterId, initialCharacterDraft, validateCharacterDraft } from '../engine/characterCreation';
import { getFamilyBackground, familyBackgrounds } from '../data/familyBackgrounds';
import { getCities, getProvinces, supportedCountries } from '../data/locations';
import { getMonthlyParentalSupport } from '../engine/familySupport';
import { getWorldYearContext } from '../engine/worldEra';
import { getOccupation } from '../data/careerCatalog';
import { useGameStore } from '../store/gameStore';
import type {
  AvatarId,
  CharacterDraft,
  CharacterStats,
  FamilyBackgroundTier,
  ParentCondition,
  PersonalityTrait,
} from '../types/game';
import { CharacterPortrait } from './CharacterPortrait';

const STARTING_AGE = 18;

const steps = [
  'Identitas',
  'Tempat lahir',
  'Keluarga',
  'Orang tua',
  'Kepribadian',
  'Konfirmasi',
] as const;

const avatarOptions: { id: AvatarId; label: string }[] = [
  { id: 'leaf', label: 'Rimbun' },
  { id: 'sunrise', label: 'Senja' },
  { id: 'ocean', label: 'Pesisir' },
  { id: 'earth', label: 'Bumi' },
];

const backgroundOptions: Record<FamilyBackgroundTier, string> = {
  very_poor: 'Sangat miskin',
  poor: 'Miskin',
  modest: 'Sederhana',
  middle: 'Menengah',
  affluent: 'Berada',
  wealthy: 'Kaya',
};

const parentOptions: { id: ParentCondition; label: string; description: string }[] = [
  { id: 'both_alive', label: 'Kedua orang tua masih hidup', description: 'Tumbuh bersama ayah dan ibu.' },
  { id: 'father_only', label: 'Hanya ayah yang masih hidup', description: 'Tinggal bersama ayah.' },
  { id: 'mother_only', label: 'Hanya ibu yang masih hidup', description: 'Tinggal bersama ibu.' },
  { id: 'both_deceased', label: 'Kedua orang tua sudah meninggal', description: 'Diasuh oleh wali keluarga.' },
  { id: 'guardian', label: 'Tinggal bersama wali atau keluarga lain', description: 'Keadaan orang tua tidak diketahui.' },
];

const memberStatusLabels = {
  alive: 'masih hidup',
  deceased: 'telah meninggal',
  unknown: 'tidak diketahui',
} as const;

const personalityOptions: { id: PersonalityTrait; label: string; description: string }[] = [
  { id: 'brave', label: 'Pemberani', description: 'Cenderung menghadapi tantangan.' },
  { id: 'shy', label: 'Pemalu', description: 'Lebih nyaman mengamati sebelum berbicara.' },
  { id: 'intelligent', label: 'Cerdas', description: 'Cepat memahami hal baru.' },
  { id: 'ambitious', label: 'Ambisius', description: 'Memiliki dorongan untuk berkembang.' },
  { id: 'friendly', label: 'Ramah', description: 'Mudah menjalin hubungan.' },
  { id: 'short_tempered', label: 'Pemarah', description: 'Mudah bereaksi saat tertekan.' },
  { id: 'disciplined', label: 'Disiplin', description: 'Tekun menjalani rutinitas.' },
  { id: 'lazy', label: 'Pemalas', description: 'Cenderung memilih langkah yang santai.' },
  { id: 'creative', label: 'Kreatif', description: 'Senang menemukan pendekatan baru.' },
  { id: 'lucky', label: 'Beruntung', description: 'Sering melihat peluang di sekitarnya.' },
];

const statLabels: { key: keyof CharacterStats; label: string }[] = [
  { key: 'health', label: 'Kesehatan' },
  { key: 'happiness', label: 'Kebahagiaan' },
  { key: 'intelligence', label: 'Kecerdasan' },
  { key: 'looks', label: 'Penampilan' },
  { key: 'energy', label: 'Energi' },
  { key: 'reputation', label: 'Reputasi' },
  { key: 'wealth', label: 'Kekayaan' },
];

const stepFields: (keyof CharacterDraft)[][] = [
  ['firstName', 'lastName', 'gender', 'birthDate', 'avatarId'],
  ['countryCode', 'province', 'city'],
  ['familyBackground'],
  ['parentCondition', 'siblingCount'],
  ['personalityTraits'],
  [],
];

const today = new Date();
const todayDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

function formatMoney(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(amount);
}

function fieldError(errors: Partial<Record<keyof CharacterDraft, string>>, field: keyof CharacterDraft) {
  return errors[field] ? <span className="field-error" role="alert">{errors[field]}</span> : null;
}

export function CharacterCreation() {
  const [draft, setDraft] = useState<CharacterDraft>({
    ...initialCharacterDraft,
    personalityTraits: [],
  });
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Partial<Record<keyof CharacterDraft, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const startLife = useGameStore((state) => state.startLife);
  const importGameBackup = useGameStore((state) => state.importGameBackup);
  const persistenceError = useGameStore((state) => state.persistenceError);
  const hydrate = useGameStore((state) => state.hydrate);
  const provinces = getProvinces(draft.countryCode);
  const cities = getCities(draft.countryCode, draft.province);
  const preview = useMemo(() => {
    if (Object.keys(validateCharacterDraft(draft)).length > 0) return null;
    return createCharacter(draft, { idFactory: () => 'character-preview', startAge: STARTING_AGE });
  }, [draft]);

  const updateDraft = <K extends keyof CharacterDraft>(key: K, value: CharacterDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setFormError(null);
  };

  const continueStep = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const allErrors = validateCharacterDraft(draft);
    const currentErrors = Object.fromEntries(
      stepFields[step]
        .filter((field) => allErrors[field])
        .map((field) => [field, allErrors[field]]),
    ) as Partial<Record<keyof CharacterDraft, string>>;
    setErrors(currentErrors);
    if (Object.keys(currentErrors).length > 0) return;
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const startCharacterLife = async () => {
    setFormError(null);
    const allErrors = validateCharacterDraft(draft);
    setErrors(allErrors);
    if (Object.keys(allErrors).length > 0) {
      setStep(stepFields.findIndex((fields) => fields.some((field) => allErrors[field])));
      return;
    }

    setIsStarting(true);
    try {
      const character = preview
        ? { ...preview, id: createCharacterId() }
        : createCharacter(draft, { startAge: STARTING_AGE });
      const started = await startLife(character);
      const state = useGameStore.getState();
      if (!started && !state.character && state.persistenceStatus !== 'error') {
        setFormError('Simpanan aktif sudah tersedia dan tidak ditimpa. Memuat karakter yang tersimpan.');
      }
      if (!state.character) setIsStarting(false);
    } catch (error) {
      setIsStarting(false);
      if (error instanceof CharacterDraftError) {
        setErrors(error.errors);
      } else {
        setFormError(error instanceof Error ? error.message : String(error));
      }
    }
  };

  const restoreBackup = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      window.alert('Ukuran file cadangan maksimal 10 MB.');
      return;
    }
    setIsImportingBackup(true);
    try {
      await importGameBackup(await file.text());
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    } finally {
      setIsImportingBackup(false);
    }
  };

  const chosenBackground = draft.familyBackground
    ? getFamilyBackground(draft.familyBackground)
    : null;
  const yearContext = preview ? getWorldYearContext(preview.currentYear) : null;
  const currencyCode = preview?.birthInformation.location.currencyCode ?? 'IDR';

  return (
    <main className="creation-shell">
      <header className="creation-header">
        <a className="brand" href="#home">
          <span className="brand-mark"><span>IL</span></span>
          <span><b>INDOLIFE</b><small>SIMULATOR KEHIDUPAN</small></span>
        </a>
        <span className="creation-label">MEMULAI PERJALANAN BARU</span>
      </header>

      <section className="creation-card" aria-labelledby="creation-title">
        <div className="restore-backup-row">
          <span>Sudah memiliki file cadangan?</span>
          <label className={`secondary-button backup-import-button${isImportingBackup ? ' is-disabled' : ''}`} htmlFor="creation-backup-file">
            {isImportingBackup ? 'Memulihkan…' : 'Pulihkan cerita'}
            <input
              id="creation-backup-file"
              type="file"
              accept="application/json,.json"
              disabled={isImportingBackup}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void restoreBackup(file);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </div>
        <div className="creation-heading">
          <span className="eyebrow">PEMBUATAN KARAKTER</span>
          <h1 id="creation-title">{step === 5 ? 'Periksa ceritamu' : 'Ciptakan karakter'}</h1>
          <p>Setiap pilihan membentuk awal perjalanan hidup.</p>
        </div>

        <div className="step-progress" aria-label={`Langkah ${step + 1} dari ${steps.length}`}>
          <div className="step-progress-track"><span style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
          <div className="step-indicators">
            {steps.map((label, index) => (
              <div className={`step-indicator${index === step ? ' is-current' : index < step ? ' is-complete' : ''}`} key={label}>
                <span>{index < step ? <Check size={14} aria-hidden="true" /> : index + 1}</span>
                <small>{label}</small>
              </div>
            ))}
          </div>
        </div>

        <form className="creation-form" onSubmit={continueStep} noValidate>
          {step === 0 && (
            <section className="creation-step" aria-labelledby="identity-title">
              <div className="step-title"><span>01</span><div><h2 id="identity-title">Siapa namamu?</h2><p>Kenali karakter yang akan menjalani cerita.</p></div></div>
              <div className="form-grid two-columns">
                <label className="field">
                  <span>Nama depan</span>
                  <input value={draft.firstName} maxLength={40} autoComplete="given-name" aria-invalid={Boolean(errors.firstName)} onChange={(event) => updateDraft('firstName', event.target.value)} />
                  {fieldError(errors, 'firstName')}
                </label>
                <label className="field">
                  <span>Nama belakang</span>
                  <input value={draft.lastName} maxLength={40} autoComplete="family-name" aria-invalid={Boolean(errors.lastName)} onChange={(event) => updateDraft('lastName', event.target.value)} />
                  {fieldError(errors, 'lastName')}
                </label>
              </div>
              <fieldset className="field-set">
                <legend>Jenis kelamin</legend>
                <div className="choice-row">
                  {([
                    ['male', 'Laki-laki'],
                    ['female', 'Perempuan'],
                    ['other', 'Lainnya'],
                  ] as const).map(([value, label]) => (
                    <button className={`option-chip${draft.gender === value ? ' is-selected' : ''}`} type="button" aria-pressed={draft.gender === value} key={value} onClick={() => updateDraft('gender', value)}>{label}</button>
                  ))}
                </div>
                {fieldError(errors, 'gender')}
              </fieldset>
              <label className="field date-field">
                <span>Tanggal lahir</span>
                <input type="date" min="1900-01-01" max={todayDate} value={draft.birthDate} aria-invalid={Boolean(errors.birthDate)} onChange={(event) => updateDraft('birthDate', event.target.value)} />
                <small>Permainan dimulai saat karakter berusia 18 tahun, setelah lulus SMA/SMK.</small>
                {fieldError(errors, 'birthDate')}
              </label>
              <fieldset className="field-set avatar-field">
                <legend>Pilih ilustrasi karakter</legend>
                <div className="avatar-options">
                  {avatarOptions.map(({ id, label }) => (
                    <button className={`avatar-option${draft.avatarId === id ? ' is-selected' : ''}`} type="button" aria-pressed={draft.avatarId === id} key={id} onClick={() => updateDraft('avatarId', id)}>
                      <CharacterPortrait avatarId={id} />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
                {fieldError(errors, 'avatarId')}
              </fieldset>
            </section>
          )}

          {step === 1 && (
            <section className="creation-step" aria-labelledby="birthplace-title">
              <div className="step-title"><span>02</span><div><h2 id="birthplace-title">Di mana kamu lahir?</h2><p>Pilihan kota mengikuti provinsi yang dipilih.</p></div></div>
              <div className="form-grid">
                <label className="field">
                  <span>Negara</span>
                  <select value={draft.countryCode} onChange={(event) => {
                    const country = supportedCountries.find((item) => item.code === event.target.value);
                    if (!country) return;
                    const province = Object.keys(country.provinces)[0];
                    setDraft((current) => ({ ...current, countryCode: country.code, province, city: country.provinces[province][0] }));
                    setErrors((current) => ({ ...current, countryCode: undefined, province: undefined, city: undefined }));
                  }}>
                    {supportedCountries.map((country) => <option value={country.code} key={country.code}>{country.name}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Provinsi / wilayah</span>
                  <select value={draft.province} aria-invalid={Boolean(errors.province)} onChange={(event) => {
                    const province = event.target.value;
                    setDraft((current) => ({ ...current, province, city: getCities(current.countryCode, province)[0] ?? '' }));
                    setErrors((current) => ({ ...current, province: undefined, city: undefined }));
                  }}>
                    <option value="">Pilih provinsi</option>
                    {provinces.map((province) => <option value={province} key={province}>{province}</option>)}
                  </select>
                  {fieldError(errors, 'province')}
                </label>
                <label className="field">
                  <span>Kota</span>
                  <select value={draft.city} aria-invalid={Boolean(errors.city)} onChange={(event) => updateDraft('city', event.target.value)}>
                    <option value="">Pilih kota</option>
                    {cities.map((city) => <option value={city} key={city}>{city}</option>)}
                  </select>
                  {fieldError(errors, 'city')}
                </label>
              </div>
              <p className="form-note">Indonesia tersedia dengan data provinsi dan kota. Negara lain dapat ditambahkan tanpa mengubah struktur lokasi.</p>
            </section>
          )}

          {step === 2 && (
            <section className="creation-step" aria-labelledby="background-title">
              <div className="step-title"><span>03</span><div><h2 id="background-title">Seperti apa keluargamu?</h2><p>Latar ekonomi memengaruhi aset, fasilitas, dan peluang awal.</p></div></div>
              <div className="background-options">
                {familyBackgrounds.map((background) => (
                  <button className={`background-option${draft.familyBackground === background.id ? ' is-selected' : ''}`} type="button" aria-pressed={draft.familyBackground === background.id} key={background.id} onClick={() => updateDraft('familyBackground', background.id)}>
                    <span className="option-radio" />
                    <span><b>{background.label}</b><small>{background.description}</small><em>{background.facilities.join(' · ')}</em></span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </button>
                ))}
              </div>
              {fieldError(errors, 'familyBackground')}
              <p className="form-note">Nominal aset adalah nilai simulasi dalam Rupiah yang disesuaikan dengan tahun lahir, bukan catatan harga historis faktual.</p>
            </section>
          )}

          {step === 3 && (
            <section className="creation-step" aria-labelledby="parents-title">
              <div className="step-title"><span>04</span><div><h2 id="parents-title">Siapa yang membesarkanmu?</h2><p>Hubungan dan wali awal disiapkan sesuai pilihanmu.</p></div></div>
              <div className="parent-options">
                {parentOptions.map(({ id, label, description }) => (
                  <button className={`parent-option${draft.parentCondition === id ? ' is-selected' : ''}`} type="button" aria-pressed={draft.parentCondition === id} key={id} onClick={() => updateDraft('parentCondition', id)}>
                    <span className="option-radio" /><span><b>{label}</b><small>{description}</small></span>
                  </button>
                ))}
              </div>
              {fieldError(errors, 'parentCondition')}
              <div className="sibling-control">
                <div><b>Saudara kandung</b><small>Jumlah saudara dalam keluarga awal (maksimal 4).</small></div>
                <div className="stepper-control">
                  <button type="button" aria-label="Kurangi jumlah saudara" disabled={draft.siblingCount <= 0} onClick={() => updateDraft('siblingCount', Math.max(0, draft.siblingCount - 1))}>−</button>
                  <output aria-live="polite">{draft.siblingCount}</output>
                  <button type="button" aria-label="Tambah jumlah saudara" disabled={draft.siblingCount >= 4} onClick={() => updateDraft('siblingCount', Math.min(4, draft.siblingCount + 1))}>+</button>
                </div>
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="creation-step" aria-labelledby="personality-title">
              <div className="step-title"><span>05</span><div><h2 id="personality-title">Apa sifat yang menonjol?</h2><p>Pilih 1–3 sifat. Sifat memberi kecenderungan, bukan menentukan hasil hidup.</p></div></div>
              <div className="personality-options">
                {personalityOptions.map(({ id, label, description }) => {
                  const selected = draft.personalityTraits.includes(id);
                  return (
                    <button className={`personality-option${selected ? ' is-selected' : ''}`} type="button" aria-pressed={selected} key={id} onClick={() => {
                      const traits = selected
                        ? draft.personalityTraits.filter((trait) => trait !== id)
                        : draft.personalityTraits.length < 3
                          ? [...draft.personalityTraits, id]
                          : draft.personalityTraits;
                      updateDraft('personalityTraits', traits);
                    }}>
                      <span className="personality-check">{selected && <Check size={13} aria-hidden="true" />}</span>
                      <span><b>{label}</b><small>{description}</small></span>
                    </button>
                  );
                })}
              </div>
              <p className="selection-count">{draft.personalityTraits.length} dari 3 sifat dipilih</p>
              {fieldError(errors, 'personalityTraits')}
            </section>
          )}

          {step === 5 && (
            <section className="creation-step confirmation-step" aria-labelledby="confirmation-title">
              <div className="step-title"><span>06</span><div><h2 id="confirmation-title">Periksa informasi karaktermu</h2><p>Kamu masih bisa kembali untuk mengubah pilihan sebelum memulai.</p></div></div>
              {preview && yearContext ? (
                <>
                  <div className="confirm-identity">
                    <CharacterPortrait avatarId={preview.identity.avatarId} />
                    <div><span className="eyebrow">KARAKTER BARU</span><h3>{preview.identity.firstName} {preview.identity.lastName}</h3><p>{preview.identity.gender === 'male' ? 'Laki-laki' : preview.identity.gender === 'female' ? 'Perempuan' : 'Lainnya'} · Lahir {preview.birthInformation.date}</p></div>
                  </div>
                  <div className="confirmation-block">
                    <div className="confirmation-block-heading"><h3>Tempat lahir dan awal permainan</h3><button type="button" onClick={() => setStep(0)}>Ubah identitas</button></div>
                    <p>{preview.birthInformation.location.city}, {preview.birthInformation.location.province}, Indonesia · Usia {preview.age} · Tahun permainan {preview.currentYear}</p>
                    <div className="era-callout"><b>{yearContext.decadeLabel}</b><span>{yearContext.technologySummary}</span></div>
                    {!yearContext.smartphoneAvailable && <p className="asset-list">Smartphone belum tersedia pada tahun ini.</p>}
                    <p className="asset-list"><b>Kelulusan:</b> Karakter memulai simulasi setelah lulus SMA/SMK pada usia 18 tahun.</p>
                  </div>
                  <div className="confirmation-block">
                    <div className="confirmation-block-heading"><h3>Keluarga dan ekonomi</h3><button type="button" onClick={() => setStep(2)}>Ubah keluarga</button></div>
                    <p>{chosenBackground?.label} · Tinggal {preview.family.livingArrangement === 'with_parents' ? 'bersama kedua orang tua' : preview.family.livingArrangement === 'with_parent' ? 'bersama orang tua yang masih hidup' : 'bersama wali keluarga'}.</p>
                    <p className="asset-list">{preview.family.members.map((member) => {
                      const occupation = getOccupation(member.occupationId ?? null);
                      const occupationLabel = occupation ? ` · bekerja sebagai ${occupation.name}` : '';
                      return `${member.name}: ${memberStatusLabels[member.status]}${occupationLabel}`;
                    }).join(' · ')}</p>
                    <p>{preview.family.members.filter((member) => member.role === 'sibling').length} saudara · {chosenBackground?.housingLabel} · Peluang {chosenBackground?.opportunityLabel}</p>
                    <p className="asset-list">Kiriman orang tua saat masih di bawah 18 tahun: {formatMoney(getMonthlyParentalSupport(preview), currencyCode)} per bulan.</p>
                    <p className="asset-list">Fasilitas awal: {preview.startingAssets.facilities.join(', ')}.</p>
                    <p className="asset-list">Uang tunai {formatMoney(preview.cash, currencyCode)} · Kekayaan bersih {formatMoney(preview.netWorth, currencyCode)}.</p>
                  </div>
                  <div className="confirmation-block">
                    <div className="confirmation-block-heading"><h3>Kepribadian</h3><button type="button" onClick={() => setStep(4)}>Ubah sifat</button></div>
                    <p>{draft.personalityTraits.map((trait) => personalityOptions.find((option) => option.id === trait)?.label).join(', ')}</p>
                  </div>
                  <div className="confirmation-block stats-confirmation">
                    <h3>Statistik awal <span>· Usia {preview.age}</span></h3>
                    <div className="initial-stat-grid">
                      {statLabels.map(({ key, label }) => <div key={key}><span>{label}</span><b>{preview.stats[key]}<small>/100</small></b></div>)}
                    </div>
                  </div>
                </>
              ) : (
                <div className="form-error" role="alert">Lengkapi semua pilihan untuk melihat ringkasan karakter.</div>
              )}
            </section>
          )}

          {(formError || persistenceError) && (
            <div className="form-error" role="alert">
              <span>{formError ?? persistenceError}</span>
              {persistenceError && <button type="button" onClick={() => void hydrate()}>Coba lagi</button>}
            </div>
          )}

          <div className="creation-actions">
            <button className="back-button" type="button" disabled={step === 0 || isStarting} onClick={() => setStep((current) => Math.max(0, current - 1))}>
              <ChevronLeft size={18} aria-hidden="true" /> Kembali
            </button>
            {step < steps.length - 1 ? (
              <button className="continue-button" type="submit">
                Lanjutkan <ChevronRight size={18} aria-hidden="true" />
              </button>
            ) : (
              <button className="continue-button" type="button" disabled={!preview || isStarting} onClick={() => void startCharacterLife()}>
                {isStarting ? 'Menyimpan…' : 'Mulai kehidupan'} <ArrowRight size={18} aria-hidden="true" />
              </button>
            )}
          </div>
        </form>
      </section>

      <footer className="creation-footer">INDOLIFE <span>·</span> Cerita hidupmu, langkah demi langkah.</footer>
    </main>
  );
}
