// Output validation (contract: Output). The model text is shown only if every check passes.
import { DAY_MINUTES } from '../domain/availability';
import { MAX_EXPLANATION_LENGTH, ROOM_LABEL, type ExplainFacts } from './types';

export type OutputCheck = { ok: true; text: string } | { ok: false; reason: string };

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const NOT_PLAIN = /[<>`*#[\]{}|\\]|_{2,}|https?:|www\.|:\/\/|@|\b[a-z0-9-]+\.(com|org|net|edu|io|kz)\b/i;
const ROOM_LIKE = /\b[A-Za-z]{1,3}-\d{1,4}\b/g;
const CLOCK = /\b\d{1,2}:\d{2}\b/g;
const NUMBER = /\d+/g;

// An "available" text must not talk about refusal; an "unavailable" text must not promise the room.
const SAYS_UNAVAILABLE =
  /\b(unavailable|not available|isn't available|is not free|blocked|overlap\w*|conflict\w*|clash\w*|cannot|can't|can not|not allowed|rejected|denied|too long|exceed\w*)\b/i;
const SAYS_AVAILABLE =
  /\b(available|can be booked|you can book|is free|is open|is bookable|go ahead)\b/i;
const NEGATED_AVAILABLE = /\b(unavailable|not available|isn't available|not currently available)\b/gi;

function allowedNumbers(facts: ExplainFacts): Set<string> {
  const values = [0, DAY_MINUTES, facts.maxMinutes, facts.now.minutes];
  const { start, end } = facts.request;
  if (start !== null) values.push(start);
  if (end !== null) values.push(end);
  if (facts.durationMinutes !== undefined) values.push(facts.durationMinutes);
  if (facts.conflict) values.push(facts.conflict.start, facts.conflict.end);
  return new Set(values.map(String));
}

function allowedTimes(facts: ExplainFacts): Set<string> {
  const values = [facts.now.text, facts.request.startText, facts.request.endText];
  if (facts.conflict) values.push(facts.conflict.startText, facts.conflict.endText);
  return new Set(values.filter((v): v is string => v !== null));
}

function countSentences(text: string): number {
  return text.split(/[.!?]+(?:\s+|$)/).filter((part) => part.trim() !== '').length;
}

export function validateExplanation(raw: unknown, facts: ExplainFacts): OutputCheck {
  if (typeof raw !== 'string') return { ok: false, reason: 'not a string' };
  const text = raw.trim();
  if (text.length === 0) return { ok: false, reason: 'empty' };
  if (text.length > MAX_EXPLANATION_LENGTH) return { ok: false, reason: 'too long' };
  if (CONTROL_CHARS.test(text)) return { ok: false, reason: 'control characters or line breaks' };
  if (NOT_PLAIN.test(text)) return { ok: false, reason: 'not plain text' };
  if (countSentences(text) > 2) return { ok: false, reason: 'more than two sentences' };

  // Status agreement with the deterministic checker.
  if (facts.isAvailable) {
    if (SAYS_UNAVAILABLE.test(text)) return { ok: false, reason: 'contradicts available status' };
  } else {
    if (SAYS_AVAILABLE.test(text.replace(NEGATED_AVAILABLE, ' '))) {
      return { ok: false, reason: 'contradicts unavailable status' };
    }
  }

  // No invented facts: rooms, clock times, numbers.
  for (const room of text.match(ROOM_LIKE) ?? []) {
    if (room !== ROOM_LABEL) return { ok: false, reason: 'unknown room' };
  }
  const times = allowedTimes(facts);
  const withoutRooms = text.replace(ROOM_LIKE, ' ');
  for (const clock of withoutRooms.match(CLOCK) ?? []) {
    const normalized = clock.padStart(5, '0');
    if (!times.has(normalized)) return { ok: false, reason: 'invented time' };
  }
  const numbers = allowedNumbers(facts);
  for (const digits of withoutRooms.replace(CLOCK, ' ').match(NUMBER) ?? []) {
    if (!numbers.has(String(Number(digits)))) return { ok: false, reason: 'invented number' };
  }
  return { ok: true, text };
}
