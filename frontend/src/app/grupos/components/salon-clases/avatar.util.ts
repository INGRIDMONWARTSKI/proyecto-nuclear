const PALETTES = [
  { bg: '#FFE8A3', accent: '#F4B400', emoji: '🦊' },
  { bg: '#C8F7DC', accent: '#2ECC71', emoji: '🐸' },
  { bg: '#D6E8FF', accent: '#4A90E2', emoji: '🐧' },
  { bg: '#FFD6E8', accent: '#E84393', emoji: '🐰' },
  { bg: '#E8D9FF', accent: '#9B59B6', emoji: '🦄' },
  { bg: '#FFE0C2', accent: '#E67E22', emoji: '🐱' },
  { bg: '#CFFAFE', accent: '#06B6D4', emoji: '🐬' },
  { bg: '#FDE68A', accent: '#D97706', emoji: '🐻' },
];

export interface AvatarStyle {
  bg: string;
  accent: string;
  emoji: string;
  initials: string;
}

export function buildAvatarStyle(fullName: string, seed = ''): AvatarStyle {
  const source = `${fullName}${seed}`;
  let hash = 0;

  for (let i = 0; i < source.length; i++) {
    hash = source.charCodeAt(i) + ((hash << 5) - hash);
  }

  const palette = PALETTES[Math.abs(hash) % PALETTES.length];
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : (parts[0]?.slice(0, 2) ?? '??').toUpperCase();

  return { ...palette, initials };
}
