/** Official-table quick emoji presets (v1.0). */
export interface TableEmojiPreset {
  id: string;
  emoji: string;
  label: { 'en-US': string; 'zh-CN': string };
}

export const TABLE_EMOJI_PRESETS: TableEmojiPreset[] = [
  { id: 'nice_hand', emoji: '👏', label: { 'en-US': 'Nice hand!', 'zh-CN': '好牌！' } },
  { id: 'lucky', emoji: '🍀', label: { 'en-US': 'Lucky!', 'zh-CN': '运气不错' } },
  { id: 'thanks', emoji: '🙏', label: { 'en-US': 'Thanks', 'zh-CN': '谢谢' } },
  { id: 'gg', emoji: '🤝', label: { 'en-US': 'GG', 'zh-CN': 'GG' } },
  { id: 'haha', emoji: '😄', label: { 'en-US': 'Haha', 'zh-CN': '哈哈' } },
  { id: 'thinking', emoji: '🤔', label: { 'en-US': 'Thinking...', 'zh-CN': '让我想想' } },
  { id: 'oops', emoji: '😅', label: { 'en-US': 'Oops', 'zh-CN': '失误了' } },
  { id: 'wow', emoji: '😮', label: { 'en-US': 'Wow', 'zh-CN': '厉害' } },
  { id: 'chill', emoji: '😎', label: { 'en-US': 'Chill', 'zh-CN': '淡定' } },
  { id: 'see_you', emoji: '👋', label: { 'en-US': 'See you', 'zh-CN': '下局见' } },
];

const byId = new Map(TABLE_EMOJI_PRESETS.map((p) => [p.id, p]));

export function getTableEmoji(id: string): TableEmojiPreset | undefined {
  return byId.get(id);
}

export function isValidTableEmojiId(id: string): boolean {
  return byId.has(id);
}
