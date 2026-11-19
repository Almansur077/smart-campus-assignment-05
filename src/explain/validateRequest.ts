// Request validation for POST /api/explain (contract: Input). Rejects, never repairs.
import { REASON_CODES, ROOM_LABEL, MAX_QUESTION_LENGTH, type ExplainRequest } from './types';
import type { ReasonCode } from '../domain/availability';

export type ValidationResult = { ok: true; value: ExplainRequest } | { ok: false; error: string };

const ALLOWED_KEYS = new Set(['roomLabel', 'start', 'end', 'roomBlocked', 'isAvailable', 'reasonCode', 'question']);
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function fail(error: string): ValidationResult {
  return { ok: false, error };
}

function isMinute(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1440;
}

export function validateExplainRequest(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return fail('Body must be a JSON object.');
  const input = body as Record<string, unknown>;

  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) return fail(`Unknown field: ${key.slice(0, 30)}.`);
  }
  if (input.roomLabel !== ROOM_LABEL) return fail(`roomLabel must be ${ROOM_LABEL}.`);
  if (!isMinute(input.start)) return fail('start must be an integer from 0 to 1440.');
  if (!isMinute(input.end)) return fail('end must be an integer from 0 to 1440.');
  if (typeof input.roomBlocked !== 'boolean') return fail('roomBlocked must be a boolean.');
  if (typeof input.isAvailable !== 'boolean') return fail('isAvailable must be a boolean.');
  if (typeof input.reasonCode !== 'string' || !REASON_CODES.includes(input.reasonCode as ReasonCode)) {
    return fail('reasonCode is not a known reason code.');
  }
  const reasonCode = input.reasonCode as ReasonCode;
  if (input.isAvailable !== (reasonCode === 'AVAILABLE')) return fail('isAvailable does not match reasonCode.');

  let question: string | undefined;
  if (input.question !== undefined) {
    if (typeof input.question !== 'string') return fail('question must be a string.');
    question = input.question.trim();
    if (question.length === 0) return fail('question must not be empty.');
    if (question.length > MAX_QUESTION_LENGTH) return fail(`question must be at most ${MAX_QUESTION_LENGTH} characters.`);
    if (CONTROL_CHARS.test(question)) return fail('question must not contain control characters.');
  }

  const value: ExplainRequest = {
    roomLabel: ROOM_LABEL,
    start: input.start,
    end: input.end,
    roomBlocked: input.roomBlocked,
    isAvailable: input.isAvailable,
    reasonCode,
  };
  if (question !== undefined) value.question = question;
  return { ok: true, value };
}
