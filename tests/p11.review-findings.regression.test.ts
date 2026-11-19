/**
 * Practice #11 Task 06/07: regression tests that reproduce the two findings selected for repair.
 * They were written BEFORE the fixes and failed on commit c64eef7 (see evidence/test_output/06_findings_red.txt).
 *   RF01-RF04  F-01 (agent review, Medium): output validator accepted text that contradicts the checker (AC2).
 *   RF05-RF06  F-02 (agent review, Low): invented people / spelled-out durations passed the validator (AC2).
 *   RP01-RP04  M1 (manual inspection, Medium): personal data in the question reached the external model.
 * Fixture: now = 540, booking 600-660.
 */
import { describe, expect, it } from 'vitest';
import { DEMO_ROOM } from '../src/data/demoRoom';
import { evaluateAvailability, type RoomState } from '../src/domain/availability';
import { buildFacts } from '../src/explain/facts';
import { fallbackExplanation } from '../src/explain/fallback';
import { buildUserMessage } from '../src/explain/prompt';
import { explainWithAdapter } from '../src/explain/service';
import type { ExplainAdapter, ExplainFacts } from '../src/explain/types';
import { validateExplanation } from '../src/explain/validateOutput';

const room = (blocked = false): RoomState => ({
  now: DEMO_ROOM.now,
  blocked,
  bookings: DEMO_ROOM.bookings.map((b) => ({ ...b })),
});
const facts = (start: number, end: number, blocked = false): ExplainFacts =>
  buildFacts(room(blocked), start, end, evaluateAvailability(room(blocked), start, end));

const AVAILABLE_720 = facts(720, 780); // 12:00-13:00, AVAILABLE
const OVERLAP_620 = facts(620, 680); // 10:20-11:20, OVERLAP with 10:00-11:00

describe('F-01: the explanation must agree with the deterministic status (AC2)', () => {
  it('RF01 AVAILABLE: "already booked" contradicts the decision and is rejected', () => {
    expect(validateExplanation('Room B-204 is already booked from 12:00 to 13:00.', AVAILABLE_720).ok).toBe(false);
  });
  it('RF02 OVERLAP: "your booking is confirmed" contradicts the decision and is rejected', () => {
    expect(
      validateExplanation('Your booking of Room B-204 from 10:20 to 11:20 is confirmed.', OVERLAP_620).ok,
    ).toBe(false);
    expect(validateExplanation('Room B-204 is yours from 10:20 to 11:20, enjoy.', OVERLAP_620).ok).toBe(false);
  });
  it('RF03 an unavailable explanation must actually state a reason for refusal', () => {
    expect(validateExplanation('Room B-204 was requested from 10:20 to 11:20.', OVERLAP_620).ok).toBe(false);
  });
  it('RF04 faithful texts (deterministic fallbacks, real LLM wording) are still accepted', () => {
    expect(validateExplanation(fallbackExplanation(AVAILABLE_720), AVAILABLE_720).ok).toBe(true);
    expect(validateExplanation(fallbackExplanation(OVERLAP_620), OVERLAP_620).ok).toBe(true);
    expect(
      validateExplanation(
        'Room B-204 is unavailable for your requested time of 10:20 to 11:20 because it overlaps with an existing booking from 10:00 to 11:00.',
        OVERLAP_620,
      ).ok,
    ).toBe(true);
    expect(
      validateExplanation(
        'Room B-204 is available for your requested booking from 12:00 to 13:00, which is 60 minutes and within the 120-minute maximum.',
        AVAILABLE_720,
      ).ok,
    ).toBe(true);
    // Real model output from Task 04 round 2 (P3, C2, run 2): a negated confirmation agrees with "unavailable".
    expect(
      validateExplanation(
        "Room B-204 is unavailable for your requested time of 10:20 to 11:20 because it overlaps with an existing booking from 10:00 to 11:00. Thank you for your understanding, and I'm sorry this slot couldn't be confirmed for you.",
        OVERLAP_620,
      ).ok,
    ).toBe(true);
  });
});

describe('F-02: no invented booking details written as words (AC2)', () => {
  it('RF05 an invented person is rejected', () => {
    expect(
      validateExplanation('Room B-204 is available from 12:00 to 13:00, but Dr. Lee needs it later.', AVAILABLE_720).ok,
    ).toBe(false);
    expect(validateExplanation('Room B-204 is available from 12:00 to 13:00 for Professor Smith.', AVAILABLE_720).ok).toBe(
      false,
    );
  });
  it('RF06 a duration written in words is rejected (it cannot be checked against the facts)', () => {
    expect(
      validateExplanation('Room B-204 is available from 12:00 to 13:00 for a two hour exam.', AVAILABLE_720).ok,
    ).toBe(false);
  });
});

describe('M1: personal information in the question never reaches the model', () => {
  const PII_QUESTION =
    'I am Aidar, email aidar.k@kbtu.kz, phone +7 701 234 56 78, student ID 24B031671. Why is it unavailable?';

  it('RP01 e-mail addresses are removed from the prompt', () => {
    const message = buildUserMessage(OVERLAP_620, PII_QUESTION);
    expect(message).not.toContain('aidar.k@kbtu.kz');
    expect(message).toContain('[email removed]');
  });
  it('RP02 phone numbers are removed from the prompt', () => {
    const message = buildUserMessage(OVERLAP_620, PII_QUESTION);
    expect(message).not.toMatch(/701\s*234/);
    expect(message).toContain('[phone removed]');
  });
  it('RP03 student IDs are removed from the prompt', () => {
    const message = buildUserMessage(OVERLAP_620, PII_QUESTION);
    expect(message).not.toContain('24B031671');
    expect(message).toContain('[id removed]');
  });
  it('RP04 end to end: the adapter never receives the personal data, the question itself is kept', async () => {
    let seen = '';
    const spy: ExplainAdapter = {
      name: 'spy',
      kind: 'llm',
      async explain({ user }) {
        seen = user;
        return { explanation: fallbackExplanation(OVERLAP_620) };
      },
    };
    const response = await explainWithAdapter(OVERLAP_620, PII_QUESTION, spy);
    expect(response.source).toBe('llm');
    expect(seen).toContain('Why is it unavailable?');
    for (const secret of ['aidar.k@kbtu.kz', '24B031671', '234 56 78']) expect(seen).not.toContain(secret);
  });
});
