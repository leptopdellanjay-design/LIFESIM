import { useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import type { AvatarId, Character } from '../types/game';
import { useGameStore } from '../store/gameStore';
import { CharacterPortrait } from './CharacterPortrait';

const avatarOptions: { id: AvatarId; label: string }[] = [
  { id: 'leaf', label: 'Rimbun' },
  { id: 'sunrise', label: 'Senja' },
  { id: 'ocean', label: 'Pesisir' },
  { id: 'earth', label: 'Bumi' },
];

export function CharacterProfileEditor({
  character,
  onClose,
}: {
  character: Character;
  onClose: () => void;
}) {
  const [firstName, setFirstName] = useState(character.identity.firstName);
  const [lastName, setLastName] = useState(character.identity.lastName);
  const [gender, setGender] = useState(character.identity.gender);
  const [avatarId, setAvatarId] = useState(character.identity.avatarId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const updateCharacterIdentity = useGameStore((state) => state.updateCharacterIdentity);
  const persistenceError = useGameStore((state) => state.persistenceError);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      setError('Nama depan dan belakang wajib diisi.');
      return;
    }

    setSaving(true);
    setError(null);
    const saved = await updateCharacterIdentity({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      gender,
      avatarId,
    });
    setSaving(false);
    if (saved) onClose();
    else setError(persistenceError ?? 'Perubahan profil belum tersimpan.');
  };

  return (
    <div className="dialog-backdrop">
      <section className="profile-editor" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
        <div className="profile-editor-heading">
          <div><span className="eyebrow">PROFIL KARAKTER</span><h2 id="profile-editor-title">Edit identitas</h2></div>
          <button type="button" className="icon-button" aria-label="Tutup editor profil" onClick={onClose}><X size={18} aria-hidden="true" /></button>
        </div>
        <p className="editor-note">Perubahan ini tidak mengatur ulang usia, keluarga, statistik, atau kemajuan permainan.</p>
        <form onSubmit={(event) => void saveProfile(event)}>
          <div className="form-grid two-columns">
            <label className="field"><span>Nama depan</span><input autoComplete="given-name" maxLength={40} value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
            <label className="field"><span>Nama belakang</span><input autoComplete="family-name" maxLength={40} value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
          </div>
          <fieldset className="field-set">
            <legend>Jenis kelamin</legend>
            <div className="choice-row">
              {([
                ['male', 'Laki-laki'],
                ['female', 'Perempuan'],
                ['other', 'Lainnya'],
              ] as const).map(([value, label]) => (
                <button className={`option-chip${gender === value ? ' is-selected' : ''}`} type="button" aria-pressed={gender === value} key={value} onClick={() => setGender(value)}>{label}</button>
              ))}
            </div>
          </fieldset>
          <fieldset className="field-set avatar-field">
            <legend>Ilustrasi</legend>
            <div className="avatar-options">
              {avatarOptions.map(({ id, label }) => (
                <button className={`avatar-option${avatarId === id ? ' is-selected' : ''}`} type="button" aria-pressed={avatarId === id} key={id} onClick={() => setAvatarId(id)}>
                  <CharacterPortrait avatarId={id} /><span>{label}</span>
                </button>
              ))}
            </div>
          </fieldset>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="creation-actions">
            <button type="button" className="back-button" disabled={saving} onClick={onClose}>Batal</button>
            <button type="submit" className="continue-button" disabled={saving}>{saving ? 'Menyimpan…' : 'Simpan profil'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
