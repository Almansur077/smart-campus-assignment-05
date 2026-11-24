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

// Fix F-01 (agent review): a word list of what must NOT be said is not enough. The text must also positively state
// the checker's decision, and must never claim a booking exists for the student (the app never creates bookings).
const STATES_AVAILABLE = /\b(available|is free|can be booked)\b/i;
const STATES_UNAVAILABLE =
  /\b(unavailable|not available|isn't available|cannot|can't|can not|blocked|overlap\w*|conflict\w*|too long|exceed\w*|longer than|limit|passed|earlier|not later|before|not valid|invalid|must)\b/i;
// For an AVAILABLE result any "it is booked/taken" claim is a contradiction. For any result, a confirmation addressed to
// the student is false. ("already booked from 10:00 to 11:00" stays allowed for OVERLAP: that booking really exists.)
const SAYS_TAKEN = /\b(is booked|been booked|already booked|is taken|occupied|reserved)\b/i;
const CLAIMS_CONFIRMATION = /\b(confirm\w*|yours|booked for you|reserved for you|booking is complete)\b/i;
// "couldn't be confirmed" / "is not confirmed" deny a booking, so they agree with an unavailable result.
const NEGATED_CONFIRMATION = /\b(couldn't|could not|cannot|can't|can not|isn't|is not|wasn't|was not|not)\s+(be\s+)?confirm\w*/gi;
// Fix F-02 (agent review): invented details written as words cannot be checked against the facts.
const PERSON_TITLE = /\b(prof|professor|dr|doctor|mr|mrs|ms|mx|sir|madam|teacher|lecturer)\b\.?/i;
const WORD_DURATION =
  /\b(an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|ninety|half an?|a couple of|several|few)\s+(hours?|minutes?|mins?)\b/i;

// Assignment #05 mitigation A05-R01 (AI review C-01): an unavailable text must not name a specific reason that the
// checker did not report. Each phrase group belongs to exactly one reason code; other codes may not use it.
const REASON_PHRASES: readonly { code: ExplainFacts['reasonCode']; pattern: RegExp }[] = [
  { code: 'ROOM_BLOCKED', pattern: /\bblocked\b/i },
  { code: 'OVERLAP', pattern: /\b(overlap\w*|conflict\w*|clash\w*|already booked)\b/i },
  { code: 'TOO_LONG', pattern: /\b(too long|longer than|exceed\w*)\b/i },
  { code: 'PAST_TIME', pattern: /\b(in the past|already passed|has passed|is over)\b/i },
];

function namesWrongReason(text: string, facts: ExplainFacts): boolean {
  return REASON_PHRASES.some(({ code, pattern }) => code !== facts.reasonCode && pattern.test(text));
}

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
  if (CLAIMS_CONFIRMATION.test(text.replace(NEGATED_CONFIRMATION, ' '))) return { ok: false, reason: 'claims a booking confirmation' };
  if (facts.isAvailable) {
    if (SAYS_UNAVAILABLE.test(text) || SAYS_TAKEN.test(text)) return { ok: false, reason: 'contradicts available status' };
    if (!STATES_AVAILABLE.test(text)) return { ok: false, reason: 'does not state the available status' };
  } else {
    if (SAYS_AVAILABLE.test(text.replace(NEGATED_AVAILABLE, ' '))) {
      return { ok: false, reason: 'contradicts unavailable status' };
    }
    if (!STATES_UNAVAILABLE.test(text)) return { ok: false, reason: 'does not state why the room is unavailable' };
    if (namesWrongReason(text, facts)) return { ok: false, reason: 'gives a reason the checker did not report' };
  }

  // No invented people or durations written in words (F-02).
  if (PERSON_TITLE.test(text)) return { ok: false, reason: 'mentions a person' };
  if (WORD_DURATION.test(text)) return { ok: false, reason: 'duration written in words' };

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
