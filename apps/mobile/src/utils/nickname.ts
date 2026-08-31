/** Seat label: at most 4 Latin letters, else first 4 characters (CJK names). */
export function abbrevNickname(raw: string, max = 4): string {
  const stripped = raw
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  const letters = stripped.replace(/[^A-Za-z]/g, '');
  if (letters.length > 0) return letters.slice(0, max).toUpperCase();
  const chars = Array.from(stripped);
  return (chars.slice(0, max).join('') || '?').toUpperCase();
}
