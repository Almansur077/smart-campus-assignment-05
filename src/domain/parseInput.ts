// Pure form-input parsing for the availability form (Assignment #05 Task 03: moved out of App.tsx unchanged).
// No React. Messages and behavior are identical to the previous inline code in App.tsx.

export type ParsedRequest =
  | { ok: false; field: 'start' | 'end'; message: string }
  | { ok: true; start: number | null; end: number | null };

/** Text -> number with `Number()` (not parseInt, risk R-01): "600.5" stays 600.5 so the rule can reject it. */
export function parseMinute(text: string): number | null {
  const value = Number(text);
  return Number.isNaN(value) ? null : value;
}

/** Required-field check first (start, then end), then both fields parsed. */
export function parseRequest(startText: string, endText: string): ParsedRequest {
  if (startText.trim() === '') return { ok: false, field: 'start', message: 'Start is required.' };
  if (endText.trim() === '') return { ok: false, field: 'end', message: 'End is required.' };
  return { ok: true, start: parseMinute(startText), end: parseMinute(endText) };
}
