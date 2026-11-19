// @vitest-environment node
/**
 * Practice #11 server tests: POST /api/explain middleware (H01-H12) and adapters (A01-A07).
 * Uses fake req/res objects; no network, no real keys, no child process.
 */
import { describe, expect, it, vi } from 'vitest';
import { mockAdapter } from '../src/explain/adapters/mock';
import { MissingKeyError, type ExplainAdapter } from '../src/explain/types';
import { createAdapter, readTimeoutMs } from './adapters';
import { createAnthropicAdapter, DEFAULT_MODEL } from './adapters/anthropic';
import { createExplainMiddleware, type ExplainHandlerOptions } from './explainHandler';

const GOOD = { roomLabel: 'B-204', start: 630, end: 700, roomBlocked: false, isAvailable: false, reasonCode: 'OVERLAP' };

type Reply = { status: number; headers: Record<string, string>; json: Record<string, unknown> };

async function call(
  body: string,
  options: ExplainHandlerOptions = {},
  { method = 'POST', contentType = 'application/json', length }: { method?: string; contentType?: string; length?: number } = {},
): Promise<Reply> {
  const middleware = createExplainMiddleware({ env: () => ({}), ...options });
  const headers: Record<string, string | undefined> = { 'content-type': contentType };
  if (length !== undefined) headers['content-length'] = String(length);
  const req = {
    method,
    url: '/',
    headers,
    on(event: string, listener: (arg?: unknown) => void) {
      if (event === 'data') queueMicrotask(() => listener({ length: new TextEncoder().encode(body).length, toString: () => body }));
      if (event === 'end') setTimeout(() => listener(), 0);
    },
  };
  return new Promise((resolve) => {
    const out: Reply = { status: 0, headers: {}, json: {} };
    const res = {
      statusCode: 200,
      setHeader(name: string, value: string) {
        out.headers[name.toLowerCase()] = value;
      },
      end(text?: string) {
        out.status = res.statusCode;
        out.json = text ? JSON.parse(text) : {};
        resolve(out);
      },
    };
    void middleware(req as never, res as never);
  });
}

const failing = (explain: ExplainAdapter['explain']) => ({ adapterFactory: (): ExplainAdapter => ({ name: 'x', kind: 'llm', explain }) });

describe('H: POST /api/explain', () => {
  it('H01 valid request with the default mock provider -> 200, source mock', async () => {
    const r = await call(JSON.stringify({ ...GOOD, question: 'Why?' }));
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ source: 'mock', provider: 'mock' });
    expect(String(r.json.explanation)).toMatch(/^Mock explanation:/);
    expect(typeof r.json.latencyMs).toBe('number');
    expect(r.headers['cache-control']).toBe('no-store');
  });

  it('H02 malformed JSON -> 400, no model call', async () => {
    const explain = vi.fn();
    const r = await call('{not json', failing(explain));
    expect(r.status).toBe(400);
    expect(explain).not.toHaveBeenCalled();
  });

  it('H03 body over 2 KB -> 400, no model call (streamed body and declared length)', async () => {
    const explain = vi.fn();
    const big = JSON.stringify({ ...GOOD, question: 'a'.repeat(3000) });
    expect((await call(big, failing(explain))).status).toBe(400);
    expect((await call('{}', failing(explain), { length: 5000 })).status).toBe(400);
    expect(explain).not.toHaveBeenCalled();
  });

  it('H04 non-JSON content type -> 400', async () => {
    expect((await call(JSON.stringify(GOOD), {}, { contentType: 'text/plain' })).status).toBe(400);
    expect((await call(JSON.stringify(GOOD), {}, { contentType: '' })).status).toBe(400);
  });

  it('H05 other methods -> 405', async () => {
    const r = await call('', {}, { method: 'GET' });
    expect(r.status).toBe(405);
    expect(r.headers.allow).toBe('POST');
  });

  it.each([
    ['unknown field', { ...GOOD, extra: 1 }],
    ['empty question', { ...GOOD, question: '' }],
    ['201-char question', { ...GOOD, question: 'a'.repeat(201) }],
    ['wrong room', { ...GOOD, roomLabel: 'C-1' }],
  ])('H06 invalid input (%s) -> 400, no model call', async (_n, body) => {
    const explain = vi.fn();
    expect((await call(JSON.stringify(body), failing(explain))).status).toBe(400);
    expect(explain).not.toHaveBeenCalled();
  });

  it('H07 client lies about availability -> 400, no model call', async () => {
    const explain = vi.fn();
    const r = await call(JSON.stringify({ ...GOOD, isAvailable: true, reasonCode: 'AVAILABLE' }), failing(explain));
    expect(r.status).toBe(400);
    expect(String(r.json.error)).toMatch(/checker/);
    expect(explain).not.toHaveBeenCalled();
  });

  it('H08 provider error -> 200 with deterministic fallback', async () => {
    const r = await call(JSON.stringify(GOOD), failing(async () => { throw new Error('HTTP 503'); }));
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ source: 'fallback' });
    expect(String(r.json.notice)).toMatch(/AI unavailable/);
  });

  it('H09 anthropic provider without a key -> fallback "AI unavailable"', async () => {
    const r = await call(JSON.stringify(GOOD), { env: () => ({ EXPLAIN_PROVIDER: 'anthropic' }) });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ source: 'fallback' });
    expect(String(r.json.notice)).toMatch(/AI unavailable/);
  });

  it('H10 timeout from EXPLAIN_TIMEOUT_MS -> fallback', async () => {
    const r = await call(JSON.stringify(GOOD), {
      env: () => ({ EXPLAIN_TIMEOUT_MS: '100' }),
      ...failing(() => new Promise(() => undefined)),
    });
    expect(r.json).toMatchObject({ source: 'fallback' });
  });

  it('H11 invalid model output -> fallback, invalid text not returned', async () => {
    const r = await call(JSON.stringify(GOOD), failing(async () => ({ explanation: 'The room is available at 03:33.' })));
    expect(r.json.source).toBe('fallback');
    expect(String(r.json.explanation)).not.toContain('03:33');
  });

  it('H12 the response never contains the API key', async () => {
    const secret = 'sk-test-SECRET-123';
    const r = await call(JSON.stringify(GOOD), { env: () => ({ EXPLAIN_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: secret }) , adapterFactory: (env) => {
      const a = createAnthropicAdapter({ apiKey: env.ANTHROPIC_API_KEY, fetchImpl: (async () => new Response('{}', { status: 401 })) as typeof fetch });
      return a;
    } });
    expect(JSON.stringify(r)).not.toContain(secret);
    expect(r.json.source).toBe('fallback');
  });
});

describe('A: adapters and environment', () => {
  const input = (user = 'u') => ({ system: 's', user, facts: {} as never, signal: new AbortController().signal });

  it('A01 default provider is the mock; unknown values also fall back to the mock', () => {
    expect(createAdapter({})).toBe(mockAdapter);
    expect(createAdapter({ EXPLAIN_PROVIDER: 'something-else' })).toBe(mockAdapter);
  });

  it('A02 provider selection', () => {
    expect(createAdapter({ EXPLAIN_PROVIDER: 'anthropic' }).name).toBe(`anthropic:${DEFAULT_MODEL}`);
    expect(createAdapter({ EXPLAIN_PROVIDER: 'anthropic', EXPLAIN_MODEL: 'm-1' }).name).toBe('anthropic:m-1');
    expect(createAdapter({ EXPLAIN_PROVIDER: 'claude-cli' }).name).toBe('claude-cli');
    expect(DEFAULT_MODEL).toBe('claude-haiku-5-5');
  });

  it('A03 timeout parsing: default 4000, clamped, garbage ignored', () => {
    expect(readTimeoutMs({})).toBe(4000);
    expect(readTimeoutMs({ EXPLAIN_TIMEOUT_MS: 'abc' })).toBe(4000);
    expect(readTimeoutMs({ EXPLAIN_TIMEOUT_MS: '-5' })).toBe(4000);
    expect(readTimeoutMs({ EXPLAIN_TIMEOUT_MS: '1' })).toBe(100);
    expect(readTimeoutMs({ EXPLAIN_TIMEOUT_MS: '999999' })).toBe(30000);
    expect(readTimeoutMs({ EXPLAIN_TIMEOUT_MS: '1500' })).toBe(1500);
  });

  it('A04 anthropic adapter without key throws MissingKeyError and does not call fetch', async () => {
    const fetchImpl = vi.fn();
    const a = createAnthropicAdapter({ apiKey: undefined, fetchImpl: fetchImpl as never });
    await expect(a.explain(input())).rejects.toBeInstanceOf(MissingKeyError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('A05 anthropic adapter sends key only in a header and parses the text block', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: 'hello' }] }), { status: 200 }));
    const a = createAnthropicAdapter({ apiKey: 'k-1', model: 'claude-haiku-5-5', fetchImpl: fetchImpl as never });
    expect(await a.explain(input('the user message'))).toEqual({ explanation: 'hello' });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('k-1');
    expect(init.body).not.toContain('k-1');
    expect(JSON.parse(init.body)).toMatchObject({ model: 'claude-haiku-5-5', system: 's', messages: [{ role: 'user', content: 'the user message' }] });
  });

  it('A06 anthropic adapter rejects non-200 and bodies without text', async () => {
    const bad = (res: Response) => createAnthropicAdapter({ apiKey: 'k', fetchImpl: (async () => res) as never });
    await expect(bad(new Response('{}', { status: 500 })).explain(input())).rejects.toThrow(/500/);
    await expect(bad(new Response('{"content":[]}', { status: 200 })).explain(input())).rejects.toThrow(/text/);
    await expect(bad(new Response('not json', { status: 200 })).explain(input())).rejects.toThrow();
  });

  it('A07 claude-cli adapter with a missing binary rejects (service then falls back)', async () => {
    const { createClaudeCliAdapter } = await import('./adapters/claudeCli');
    const a = createClaudeCliAdapter({ command: 'definitely-not-an-installed-binary-xyz' });
    await expect(a.explain(input())).rejects.toThrow();
  });
});
