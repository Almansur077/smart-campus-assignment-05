// Explain service: adapter call with timeout -> output validation -> deterministic fallback. Never throws.
import { fallbackExplanation } from './fallback';
import { buildUserMessage, SYSTEM_PROMPT } from './prompt';
import { DEFAULT_TIMEOUT_MS, type ExplainAdapter, type ExplainFacts, type ExplainResponse } from './types';
import { validateExplanation } from './validateOutput';

const NOTICE_UNAVAILABLE = 'AI unavailable - showing the deterministic fallback explanation.';
const NOTICE_REJECTED = 'AI output failed validation - showing the deterministic fallback explanation.';

function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('timeout'));
    }, timeoutMs);
  });
  // The adapter may ignore the abort signal, so the race (not the signal) enforces the deadline.
  return Promise.race([Promise.resolve().then(() => run(controller.signal)), timeout]).finally(() => clearTimeout(timer));
}

export type ExplainOptions = { timeoutMs?: number };

export async function explainWithAdapter(
  facts: ExplainFacts,
  question: string | undefined,
  adapter: ExplainAdapter,
  options: ExplainOptions = {},
): Promise<ExplainResponse> {
  const startedAt = Date.now();
  const timeoutMs = options.timeoutMs !== undefined && options.timeoutMs > 0 ? options.timeoutMs : DEFAULT_TIMEOUT_MS;
  const fallback = (notice: string): ExplainResponse => ({
    explanation: fallbackExplanation(facts),
    source: 'fallback',
    provider: adapter.name,
    latencyMs: Date.now() - startedAt,
    notice,
  });

  try {
    const output = await withTimeout(
      (signal) => adapter.explain({ system: SYSTEM_PROMPT, user: buildUserMessage(facts, question), facts, signal }),
      timeoutMs,
    );
    const checked = validateExplanation(output?.explanation, facts);
    if (!checked.ok) return fallback(NOTICE_REJECTED);
    return {
      explanation: checked.text,
      source: adapter.kind === 'mock' ? 'mock' : 'llm',
      provider: adapter.name,
      latencyMs: Date.now() - startedAt,
    };
  } catch {
    // Missing key, timeout, network/provider error, bad JSON: all end in the same safe fallback.
    return fallback(NOTICE_UNAVAILABLE);
  }
}
