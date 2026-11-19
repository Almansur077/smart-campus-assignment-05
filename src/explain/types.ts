// Shared types for the optional "Explain availability" feature (docs/FEATURE_CONTRACT.md).
import type { ReasonCode } from '../domain/availability';

export const ROOM_LABEL = 'B-204';
export const MAX_QUESTION_LENGTH = 200;
export const MAX_BODY_BYTES = 2048;
export const MAX_EXPLANATION_LENGTH = 300;
export const DEFAULT_TIMEOUT_MS = 4000;

export const REASON_CODES: readonly ReasonCode[] = [
  'INVALID_NUMBER',
  'OUT_OF_DAY',
  'SAME_TIME',
  'REVERSED',
  'PAST_TIME',
  'TOO_LONG',
  'ROOM_BLOCKED',
  'OVERLAP',
  'AVAILABLE',
];

/** POST /api/explain body (validated). */
export type ExplainRequest = {
  roomLabel: string;
  start: number;
  end: number;
  roomBlocked: boolean;
  isAvailable: boolean;
  reasonCode: ReasonCode;
  question?: string;
};

export type TimeRange = { start: number; end: number; startText: string; endText: string };

/** Minimal facts for the prompt: nothing but what the deterministic checker decided. */
export type ExplainFacts = {
  roomLabel: string;
  /** null only for client-side cases the API would reject (INVALID_NUMBER / OUT_OF_DAY). */
  request: { start: number | null; end: number | null; startText: string | null; endText: string | null };
  now: { minutes: number; text: string };
  isAvailable: boolean;
  reasonCode: ReasonCode;
  maxMinutes: number;
  /** Requested length in minutes, whenever end > start (both whole minutes). */
  durationMinutes?: number;
  /** Only for OVERLAP: the one conflicting booking interval. */
  conflict?: TimeRange;
};

export type ExplainSource = 'llm' | 'mock' | 'fallback';

export type ExplainResponse = {
  explanation: string;
  source: ExplainSource;
  provider: string;
  latencyMs: number;
  notice?: string;
};

export type AdapterInput = { system: string; user: string; facts: ExplainFacts; signal: AbortSignal };

/** An adapter only produces text. It never sees or changes booking data. */
export interface ExplainAdapter {
  /** Human-readable provider name shown in `provider`. */
  readonly name: string;
  /** 'mock' is labeled as such in the UI; everything else is a real model. */
  readonly kind: 'mock' | 'llm';
  explain(input: AdapterInput): Promise<{ explanation: string }>;
}

/** Thrown by a real adapter when its credentials are not configured. */
export class MissingKeyError extends Error {
  constructor(message = 'API key is not configured') {
    super(message);
    this.name = 'MissingKeyError';
  }
}
