export interface AvatarPreset {
  id: string;
  emoji: string;
  color: string;
  label: { 'en-US': string; 'zh-CN': string };
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  { id: 'spade', emoji: '♠', color: '#2E7D63', label: { 'en-US': 'Spade', 'zh-CN': '黑桃' } },
  { id: 'heart', emoji: '♥', color: '#C23B3B', label: { 'en-US': 'Heart', 'zh-CN': '红心' } },
  { id: 'diamond', emoji: '♦', color: '#2E7D63', label: { 'en-US': 'Diamond', 'zh-CN': '方块' } },
  { id: 'club', emoji: '♣', color: '#17191C', label: { 'en-US': 'Club', 'zh-CN': '梅花' } },
  { id: 'ace', emoji: 'A', color: '#6B7280', label: { 'en-US': 'Ace', 'zh-CN': 'Ace' } },
  { id: 'king', emoji: 'K', color: '#E67E22', label: { 'en-US': 'King', 'zh-CN': 'King' } },
  { id: 'chip', emoji: '🎰', color: '#1ABC9C', label: { 'en-US': 'Lucky', 'zh-CN': '幸运' } },
  { id: 'fire', emoji: '🔥', color: '#E74C3C', label: { 'en-US': 'Fire', 'zh-CN': '火热' } },
];

export function presetAvatarUrl(id: string): string {
  return `preset:${id}`;
}

export function parseAvatarPreset(avatarUrl?: string | null): AvatarPreset | null {
  if (!avatarUrl?.startsWith('preset:')) return null;
  const id = avatarUrl.slice('preset:'.length);
  return AVATAR_PRESETS.find((p) => p.id === id) ?? null;
}

export function isValidPresetAvatarUrl(avatarUrl?: string | null): boolean {
  if (avatarUrl == null) return true;
  return parseAvatarPreset(avatarUrl) !== null;
}
