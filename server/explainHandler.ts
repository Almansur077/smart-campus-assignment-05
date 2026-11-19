// POST /api/explain as a connect-style middleware (used by `vite` dev and `vite preview`).
// Order: method -> content-type -> size -> JSON -> validate + re-run checker (400) -> adapter -> validated answer.
// Uses small structural types so it works with Node's IncomingMessage/ServerResponse without @types/node.
import { DEMO_ROOM } from '../src/data/demoRoom';
import type { RoomState } from '../src/domain/availability';
import { prepareExplain } from '../src/explain/facts';
import { explainWithAdapter } from '../src/explain/service';
import { MAX_BODY_BYTES, type ExplainAdapter } from '../src/explain/types';
import { createAdapter, readTimeoutMs, type ServerEnv } from './adapters';

export const EXPLAIN_PATH = '/api/explain';

export type MinimalRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  on(event: 'data', listener: (chunk: { length: number; toString(): string }) => void): unknown;
  on(event: 'end', listener: () => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
};

export type MinimalResponse = {
  statusCode: number;
  setHeader(name: string, value: string): unknown;
  end(body?: string): unknown;
};

export type ExplainHandlerOptions = {
  /** Read at request time so the environment can change without restarting tests. */
  env?: () => ServerEnv;
  room?: RoomState;
  adapterFactory?: (env: ServerEnv) => ExplainAdapter;
};

function send(res: MinimalResponse, status: number, payload: unknown, extra: Record<string, string> = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [name, value] of Object.entries(extra)) res.setHeader(name, value);
  res.end(JSON.stringify(payload));
}

function readBody(req: MinimalRequest): Promise<{ ok: true; text: string } | { ok: false }> {
  return new Promise((resolve) => {
    let size = 0;
    let text = '';
    let done = false;
    const finish = (value: { ok: true; text: string } | { ok: false }) => {
      if (!done) {
        done = true;
        resolve(value);
      }
    };
    req.on('data', (chunk) => {
      if (done) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) return finish({ ok: false });
      text += chunk.toString();
    });
    req.on('end', () => finish({ ok: true, text }));
    req.on('error', () => finish({ ok: false }));
  });
}

export function createExplainMiddleware(options: ExplainHandlerOptions = {}) {
  const getEnv = options.env ?? (() => process.env as ServerEnv);
  const room = options.room ?? DEMO_ROOM;
  const makeAdapter = options.adapterFactory ?? createAdapter;

  return async function explainMiddleware(req: MinimalRequest, res: MinimalResponse, next?: () => void) {
    const path = (req.url ?? '').split('?')[0];
    // Mounted at /api/explain by connect (url is then '/'); also accept the full path for direct use.
    if (path !== '/' && path !== '' && path !== EXPLAIN_PATH) {
      if (next) return next();
    }
    try {
      if (req.method !== 'POST') return send(res, 405, { error: 'Use POST.' }, { Allow: 'POST' });
      const contentType = String(req.headers['content-type'] ?? '').toLowerCase();
      if (!contentType.startsWith('application/json')) return send(res, 400, { error: 'Content-Type must be application/json.' });
      const declared = Number(req.headers['content-length']);
      if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
        return send(res, 400, { error: `Body must be at most ${MAX_BODY_BYTES} bytes.` }, { Connection: 'close' });
      }
      const body = await readBody(req);
      if (!body.ok) return send(res, 400, { error: `Body must be at most ${MAX_BODY_BYTES} bytes.` }, { Connection: 'close' });

      let json: unknown;
      try {
        json = JSON.parse(body.text);
      } catch {
        return send(res, 400, { error: 'Body is not valid JSON.' });
      }

      const prepared = prepareExplain(json, room);
      if (!prepared.ok) return send(res, 400, { error: prepared.error });

      const env = getEnv();
      const response = await explainWithAdapter(prepared.facts, prepared.request.question, makeAdapter(env), {
        timeoutMs: readTimeoutMs(env),
      });
      return send(res, 200, response);
    } catch {
      // Last resort: never leak internals, never crash the dev server.
      return send(res, 500, { error: 'Internal error.' });
    }
  };
}
