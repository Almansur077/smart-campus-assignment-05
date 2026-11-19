// Provider selection from the SERVER environment: EXPLAIN_PROVIDER = mock | anthropic | claude-cli (default mock).
import { mockAdapter } from '../../src/explain/adapters/mock';
import { DEFAULT_TIMEOUT_MS, type ExplainAdapter } from '../../src/explain/types';
import { createAnthropicAdapter } from './anthropic';
import { createClaudeCliAdapter } from './claudeCli';

export type ServerEnv = Record<string, string | undefined>;

export function createAdapter(env: ServerEnv): ExplainAdapter {
  switch ((env.EXPLAIN_PROVIDER ?? 'mock').trim().toLowerCase()) {
    case 'anthropic':
      return createAnthropicAdapter({ apiKey: env.ANTHROPIC_API_KEY, model: env.EXPLAIN_MODEL });
    case 'claude-cli':
      return createClaudeCliAdapter({ model: env.EXPLAIN_MODEL });
    default:
      // 'mock' and any unknown value: the safe, free, clearly labeled default.
      return mockAdapter;
  }
}

/** EXPLAIN_TIMEOUT_MS: positive integer, clamped to 100..30000 ms; anything else -> 4000 ms. */
export function readTimeoutMs(env: ServerEnv): number {
  const value = Number(env.EXPLAIN_TIMEOUT_MS);
  if (!Number.isInteger(value) || value <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(value, 100), 30000);
}
