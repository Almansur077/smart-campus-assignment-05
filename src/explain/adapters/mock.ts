// MOCK adapter (default). Deterministic, no network, no model. The UI labels it "Mock".
import { fallbackExplanation } from '../fallback';
import type { ExplainAdapter } from '../types';

export const mockAdapter: ExplainAdapter = {
  name: 'mock',
  kind: 'mock',
  async explain({ facts }) {
    // The student question is deliberately ignored: a mock has nothing to answer and must not echo untrusted text.
    return { explanation: `Mock explanation: ${fallbackExplanation(facts)}` };
  },
};
