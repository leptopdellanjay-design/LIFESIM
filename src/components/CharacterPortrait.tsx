import type { AvatarId } from '../types/game';

const palettes: Record<AvatarId, { background: string; shirt: string; accent: string }> = {
  leaf: { background: '#e7eee6', shirt: '#315a43', accent: '#d2dfd2' },
  sunrise: { background: '#f3e8dc', shirt: '#a65e43', accent: '#ead1ba' },
  ocean: { background: '#e1ebef', shirt: '#3e6977', accent: '#c4dbe2' },
  earth: { background: '#ece7d9', shirt: '#78613c', accent: '#d9cfb3' },
};

export function CharacterPortrait({ avatarId = 'leaf' }: { avatarId?: AvatarId }) {
  const palette = palettes[avatarId];

  return (
    <div className="portrait-frame">
      <svg
        className="character-portrait"
        viewBox="0 0 160 160"
        role="img"
        aria-label="Ilustrasi karakter orisinal INDOLIFE"
      >
        <rect width="160" height="160" rx="26" fill={palette.background} />
        <circle cx="126" cy="33" r="13" fill={palette.accent} />
        <path d="M25 160c3-29 22-48 55-48s52 19 55 48" fill={palette.shirt} />
        <path d="M59 109h42l9 23-30 20-30-20z" fill="#f3f0e5" />
        <path d="M64 91h32v29c-8 9-24 9-32 0z" fill="#b97755" />
        <ellipse cx="80" cy="67" rx="35" ry="41" fill="#c98763" />
        <path d="M45 68c-4-31 13-50 37-50 25 0 37 19 34 49-8-4-14-14-16-25-10 11-27 17-52 17z" fill="#292c29" />
        <path d="M52 67c3 26 15 41 28 41 15 0 28-17 29-41-14-3-24-11-29-21-7 11-17 18-28 21z" fill="#c98763" />
        <path d="M64 72h8M88 72h8" stroke="#382d29" strokeWidth="3" strokeLinecap="round" />
        <path d="M73 91c4 3 10 3 14 0" fill="none" stroke="#804c3d" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M44 69c-2-9-1-18 2-25M116 69c2-9 1-18-2-25" fill="none" stroke="#292c29" strokeWidth="6" strokeLinecap="round" />
      </svg>
    </div>
  );
}
