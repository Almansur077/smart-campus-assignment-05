// Assignment #05 Task 07, mitigation 1 (risk A05-R01 = AI review C-01): an LLM explanation must not give a reason
// that the deterministic checker did not report. These tests failed on a05-baseline (wrong reasons were accepted).
import { describe, expect, it } from 'vitest';
import { evaluateAvailability, type RoomState } from '../src/domain/availability';
import { DEMO_ROOM } from '../src/data/demoRoom';
import { buildFacts } from '../src/explain/facts';
import { fallbackExplanation } from '../src/explain/fallback';
import { validateExplanation } from '../src/explain/validateOutput';
import { REASON_CODES } from '../src/explain/types';

const room: RoomState = { ...DEMO_ROOM, bookings: DEMO_ROOM.bookings.map((b) => ({ ...b })) };
function facts(start: number, end: number, blocked = false) {
  const r = { ...room, blocked };
  return buildFacts(r, start, end, evaluateAvailability(r, start, end));
}

describe('A05-R01: explanation reason must match the checker reason', () => {
  it('RC01 TOO_LONG result: "blocked" is rejected', () => {
    const f = facts(660, 800);
    expect(f.reasonCode).toBe('TOO_LONG');
    expect(validateExplanation('Room B-204 is unavailable because it is blocked.', f).ok).toBe(false);
  });
  it('RC02 OVERLAP result: "blocked" and "too long" are rejected', () => {
    const f = facts(620, 680);
    expect(f.reasonCode).toBe('OVERLAP');
    expect(validateExplanation('Room B-204 is unavailable because the room is blocked.', f).ok).toBe(false);
    expect(validateExplanation('Room B-204 is unavailable because the request is too long.', f).ok).toBe(false);
  });
  it('RC03 ROOM_BLOCKED result: "overlaps a booking" is rejected', () => {
    const f = facts(700, 760, true);
    expect(f.reasonCode).toBe('ROOM_BLOCKED');
    expect(validateExplanation('Room B-204 is unavailable because it overlaps an existing booking.', f).ok).toBe(false);
  });
  it('RC04 REVERSED result: "in the past" is rejected', () => {
    const f = facts(720, 660);
    expect(f.reasonCode).toBe('REVERSED');
    expect(validateExplanation('The start time is in the past, so the room cannot be used.', f).ok).toBe(false);
  });
  it('RC05 correct reasons are still accepted', () => {
    expect(validateExplanation('Room B-204 is unavailable because it overlaps the booking from 10:00 to 11:00.', facts(620, 680)).ok).toBe(true);
    expect(validateExplanation('Room B-204 is blocked in this demo, so it cannot be used.', facts(700, 760, true)).ok).toBe(true);
    expect(validateExplanation('This request is 140 minutes, which is longer than the 120-minute limit.', facts(660, 800)).ok).toBe(true);
  });
  it('RC06 every deterministic fallback text still passes the validator', () => {
    const cases: [number, number, boolean][] = [[660, 720, false], [620, 680, false], [700, 760, true], [720, 660, false],
      [660, 660, false], [500, 560, false], [660, 800, false]];
    for (const [s, e, b] of cases) {
      const f = facts(s, e, b);
      expect(REASON_CODES).toContain(f.reasonCode);
      expect(validateExplanation(fallbackExplanation(f), f)).toEqual({ ok: true, text: fallbackExplanation(f) });
    }
  });
});
