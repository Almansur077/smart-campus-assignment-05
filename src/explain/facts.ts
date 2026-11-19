// Minimal facts for the prompt + server-side re-check of the client's claim (contract: never trust the client).
import {
  evaluateAvailability,
  formatTime,
  MAX_MINUTES,
  type DetailedResult,
  type RoomState,
} from '../domain/availability';
import { ROOM_LABEL, type ExplainFacts, type ExplainRequest } from './types';
import { validateExplainRequest } from './validateRequest';

function timeText(minutes: number | null): string | null {
  return minutes !== null && Number.isInteger(minutes) && minutes >= 0 && minutes <= 1440 ? formatTime(minutes) : null;
}

/** Build the facts from the deterministic result only. Never includes other bookings, names or secrets. */
export function buildFacts(room: RoomState, start: number | null, end: number | null, detail: DetailedResult): ExplainFacts {
  const facts: ExplainFacts = {
    roomLabel: ROOM_LABEL,
    request: { start, end, startText: timeText(start), endText: timeText(end) },
    now: { minutes: room.now, text: formatTime(room.now) },
    isAvailable: detail.available,
    reasonCode: detail.reasonCode,
    maxMinutes: MAX_MINUTES,
  };
  // The requested length is a fact of the request (not of other bookings); models naturally mention it ("60 minutes").
  if (start !== null && end !== null && Number.isInteger(start) && Number.isInteger(end) && end > start) {
    facts.durationMinutes = end - start;
  }
  if (detail.reasonCode === 'OVERLAP' && detail.conflict) {
    facts.conflict = {
      start: detail.conflict.start,
      end: detail.conflict.end,
      startText: formatTime(detail.conflict.start),
      endText: formatTime(detail.conflict.end),
    };
  }
  return facts;
}

export type PreparedExplain =
  | { ok: true; request: ExplainRequest; facts: ExplainFacts }
  | { ok: false; error: string };

/**
 * Validate the body, re-run the deterministic checker with the fixture and reject a mismatch.
 * `room` is never mutated: the checker gets a copy with the requested `blocked` flag.
 */
export function prepareExplain(body: unknown, room: RoomState): PreparedExplain {
  const parsed = validateExplainRequest(body);
  if (!parsed.ok) return parsed;
  const request = parsed.value;
  const detail = evaluateAvailability(
    { now: room.now, blocked: request.roomBlocked, bookings: room.bookings.map((b) => ({ ...b })) },
    request.start,
    request.end,
  );
  if (detail.available !== request.isAvailable || detail.reasonCode !== request.reasonCode) {
    return { ok: false, error: 'isAvailable/reasonCode do not match the deterministic checker.' };
  }
  return { ok: true, request, facts: buildFacts(room, request.start, request.end, detail) };
}
