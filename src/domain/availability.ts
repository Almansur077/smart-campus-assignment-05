// Pure booking rule for room availability (AC1-AC5). No React, no I/O, no mutation.

export type Booking = { start: number; end: number };
export type RoomState = { now: number; blocked: boolean; bookings: Booking[] };
export type Result = { available: boolean; message: string };

export type ReasonCode =
  | 'INVALID_NUMBER'
  | 'OUT_OF_DAY'
  | 'SAME_TIME'
  | 'REVERSED'
  | 'PAST_TIME'
  | 'TOO_LONG'
  | 'ROOM_BLOCKED'
  | 'OVERLAP'
  | 'AVAILABLE';

// Practice #11: same decision as `Result`, plus the machine-readable reason (and the one conflicting booking).
export type DetailedResult = Result & { reasonCode: ReasonCode; conflict?: Booking };

export const MAX_MINUTES = 120;
export const DAY_MINUTES = 1440;

function isWholeMinute(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value);
}

function overlaps(start: number, end: number, booking: Booking): boolean {
  return start < booking.end && end > booking.start;
}

// The single rule engine. The order of checks and every message are unchanged from Practice #10.
export function evaluateAvailability(room: RoomState, start: number | null, end: number | null): DetailedResult {
  if (!isWholeMinute(start) || !isWholeMinute(end)) {
    return {
      available: false,
      reasonCode: 'INVALID_NUMBER',
      message: 'Start and end must be whole-number minutes (integers).',
    };
  }
  if (start < 0 || end > DAY_MINUTES) {
    return {
      available: false,
      reasonCode: 'OUT_OF_DAY',
      message: 'Times must be within the same day: 0 to 1440 minutes.',
    };
  }
  if (start >= end) {
    return start === end
      ? { available: false, reasonCode: 'SAME_TIME', message: 'Start and end must be different times.' }
      : {
          available: false,
          reasonCode: 'REVERSED',
          message: 'Start must be earlier than end (reversed times are not allowed).',
        };
  }
  if (start <= room.now) {
    return {
      available: false,
      reasonCode: 'PAST_TIME',
      message: `Start must be later than the current time (${room.now} min = ${formatTime(room.now)}).`,
    };
  }
  const duration = end - start;
  if (duration > MAX_MINUTES) {
    return {
      available: false,
      reasonCode: 'TOO_LONG',
      message: `Maximum booking length is ${MAX_MINUTES} minutes; this request is ${duration} minutes.`,
    };
  }
  if (room.blocked) {
    return {
      available: false,
      reasonCode: 'ROOM_BLOCKED',
      message: 'Room B-204 is blocked (demo) and cannot be used.',
    };
  }
  for (const booking of room.bookings) {
    if (overlaps(start, end, booking)) {
      return {
        available: false,
        reasonCode: 'OVERLAP',
        conflict: { start: booking.start, end: booking.end },
        message: `Overlaps an existing booking (${booking.start}–${booking.end} min = ${formatTime(booking.start)}–${formatTime(booking.end)}).`,
      };
    }
  }
  return { available: true, reasonCode: 'AVAILABLE', message: 'Room B-204 is available for this time.' };
}

// Unchanged public contract: exactly { available, message }.
export function checkAvailability(room: RoomState, start: number | null, end: number | null): Result {
  const { available, message } = evaluateAvailability(room, start, end);
  return { available, message };
}

export function formatTime(minutes: number): string {
  if (minutes === DAY_MINUTES) return '24:00';
  const m = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
