// Anthropic Messages API adapter (fetch only, no SDK). Server-side only: the key comes from the server environment.
import { MissingKeyError, type ExplainAdapter } from '../../src/explain/types';

export const DEFAULT_MODEL = 'claude-haiku-5-5';
const ENDPOINT = 'https://api.anthropic.com/v1/messages';

export type AnthropicOptions = { apiKey: string | undefined; model?: string; fetchImpl?: typeof fetch };

export function createAnthropicAdapter(options: AnthropicOptions): ExplainAdapter {
  const model = options.model && options.model.trim() !== '' ? options.model.trim() : DEFAULT_MODEL;
  return {
    name: `anthropic:${model}`,
    kind: 'llm',
    async explain({ system, user, signal }) {
      if (!options.apiKey) throw new MissingKeyError('ANTHROPIC_API_KEY is not set');
      const response = await (options.fetchImpl ?? fetch)(ENDPOINT, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': options.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model, max_tokens: 200, system, messages: [{ role: 'user', content: user }] }),
        signal,
      });
      if (!response.ok) throw new Error(`Anthropic API returned HTTP ${response.status}`);
      const data = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
      const text = data.content?.find((block) => block.type === 'text')?.text;
      if (typeof text !== 'string') throw new Error('Anthropic API response has no text block');
      return { explanation: text };
    },
  };
}
