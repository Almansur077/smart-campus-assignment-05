// Browser-side transport. Never throws; every failure ends in the deterministic fallback shown locally.
// Imports only browser-safe code (no server adapters, no keys).
import type { DetailedResult, RoomState } from '../domain/availability';
import { mockAdapter } from './adapters/mock';
import { buildFacts, prepareExplain } from './facts';
import { fallbackExplanation } from './fallback';
import { explainWithAdapter } from './service';
import type { ExplainFacts, ExplainRequest, ExplainResponse, ExplainSource } from './types';
import { ROOM_LABEL } from './types';
import { validateExplainRequest } from './validateRequest';
import { validateExplanation } from './validateOutput';

export const CLIENT_TIMEOUT_MS = 8000;
const SOURCES: readonly ExplainSource[] = ['llm', 'mock', 'fallback'];

export type ExplainInput = {
  room: RoomState;
  start: number | null;
  end: number | null;
  blocked: boolean;
  detail: DetailedResult;
  question?: string;
};

type ClientOptions = { fetchImpl?: typeof fetch; timeoutMs?: number };

function localFallback(facts: ExplainFacts, notice: string): ExplainResponse {
  return { explanation: fallbackExplanation(facts), source: 'fallback', provider: 'local', latencyMs: 0, notice };
}

// Treat the server answer as untrusted: check its shape and re-validate the text against our own facts.
function parseServerResponse(data: unknown, facts: ExplainFacts): ExplainResponse | null {
  if (typeof data !== 'object' || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.source !== 'string' || !SOURCES.includes(d.source as ExplainSource)) return null;
  const checked = validateExplanation(d.explanation, facts);
  if (!checked.ok) return null;
  return {
    explanation: checked.text,
    source: d.source as ExplainSource,
    provider: typeof d.provider === 'string' ? d.provider.slice(0, 40) : 'unknown',
    latencyMs: typeof d.latencyMs === 'number' && Number.isFinite(d.latencyMs) ? d.latencyMs : 0,
    ...(typeof d.notice === 'string' ? { notice: d.notice.slice(0, 200) } : {}),
  };
}

export async function requestExplanation(input: ExplainInput, options: ClientOptions = {}): Promise<ExplainResponse> {
  const { room, start, end, blocked, detail } = input;
  const facts = buildFacts(room, start, end, detail);
  try {
    const body: Record<string, unknown> = {
      roomLabel: ROOM_LABEL,
      start,
      end,
      roomBlocked: blocked,
      isAvailable: detail.available,
      reasonCode: detail.reasonCode,
    };
    if (input.question !== undefined && input.question.trim() !== '') body.question = input.question;
    const parsed = validateExplainRequest(body);
    // INVALID_NUMBER / OUT_OF_DAY (and a bad question) can never be sent: explain locally.
    if (!parsed.ok) return localFallback(facts, `Not sent to the explain service (${parsed.error})`);
    const request: ExplainRequest = parsed.value;

    if (import.meta.env.VITE_EXPLAIN_TRANSPORT === 'browser-mock') {
      const prepared = prepareExplain(request, room);
      if (!prepared.ok) return localFallback(facts, 'AI unavailable - showing the deterministic fallback explanation.');
      return await explainWithAdapter(prepared.facts, request.question, mockAdapter);
    }

    const fetchImpl = options.fetchImpl ?? fetch;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? CLIENT_TIMEOUT_MS);
    try {
      const response = await fetchImpl('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      if (!response.ok) return localFallback(facts, 'Explain service unavailable - showing the deterministic fallback.');
      const result = parseServerResponse(await response.json(), facts);
      return result ?? localFallback(facts, 'Explain service returned an invalid answer - showing the deterministic fallback.');
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return localFallback(facts, 'Explain service unreachable - showing the deterministic fallback.');
  }
}
