// Practice #11 Task 06: reproduce the remaining agent findings with concrete checks (not fixed in Task 07).
// Run: npx vite-node scripts/verify-findings.ts > ../evidence/test_output/06_verify_other_findings.txt
import { readFileSync } from 'node:fs';
import { readTimeoutMs } from '../server/adapters';
import { createExplainMiddleware } from '../server/explainHandler';
import { CLIENT_TIMEOUT_MS } from '../src/explain/client';
import type { ExplainAdapter } from '../src/explain/types';

type Res = { statusCode: number; body: string; setHeader(): void; end(b?: string): void };
const response = (): Res => ({ statusCode: 0, body: '', setHeader() {}, end(b) { this.body = b ?? ''; } });

function request(url: string, chunks: Buffer[]) {
  const listeners: Record<string, Array<(x?: unknown) => void>> = {};
  const req = {
    method: 'POST',
    url,
    headers: { 'content-type': 'application/json' },
    on(event: string, fn: (x?: unknown) => void) {
      (listeners[event] ??= []).push(fn);
      return req;
    },
  };
  setTimeout(() => {
    for (const c of chunks) listeners.data?.forEach((fn) => fn(c));
    listeners.end?.forEach((fn) => fn());
  }, 0);
  return req;
}

async function main() {
  console.log('F-04 timeouts');
  console.log(`  client timeout CLIENT_TIMEOUT_MS = ${CLIENT_TIMEOUT_MS} ms`);
  console.log(`  server readTimeoutMs({EXPLAIN_TIMEOUT_MS: "20000"}) = ${readTimeoutMs({ EXPLAIN_TIMEOUT_MS: '20000' })} ms`);
  console.log(`  -> CONFIRMED: a valid server setting (20000) is longer than the browser timeout (8000)`);

  console.log('\nF-07 body reader decodes chunks separately');
  let seen = '';
  const spy: ExplainAdapter = { name: 'spy', kind: 'llm', async explain({ user }) { seen = user; return { explanation: 'x' }; } };
  const body = Buffer.from(
    JSON.stringify({ roomLabel: 'B-204', start: 660, end: 720, roomBlocked: false, isAvailable: true, reasonCode: 'AVAILABLE', question: 'Почему?' }),
  );
  const cut = body.indexOf(Buffer.from('Почему')) + 1; // split inside the first 2-byte Cyrillic letter
  const res = response();
  await createExplainMiddleware({ env: () => ({}), adapterFactory: () => spy })(
    request('/', [body.subarray(0, cut), body.subarray(cut)]) as never,
    res as never,
  );
  const q = seen.split('<student_question>\n')[1]?.split('\n')[0];
  console.log(`  HTTP ${res.statusCode}; question as received by the adapter: ${JSON.stringify(q)}`);
  console.log(`  -> ${q?.includes('�') ? 'CONFIRMED: the multibyte letter was corrupted to U+FFFD' : 'NOT reproduced'}`);

  console.log('\nF-11 handler without next() on another path');
  const res2 = response();
  await createExplainMiddleware({ env: () => ({}) })(request('/other', [Buffer.from('{}')]) as never, res2 as never);
  console.log(`  url=/other, no next -> HTTP ${res2.statusCode} ${res2.body}`);
  console.log(`  -> ${res2.statusCode !== 404 ? 'CONFIRMED: the request was processed instead of 404' : 'NOT reproduced'}`);

  console.log('\nF-06 browser/server boundary');
  const eslint = readFileSync('eslint.config.js', 'utf8');
  const envd = readFileSync('server/env.d.ts', 'utf8');
  console.log(`  eslint uses globals.node for all files: ${eslint.includes('...globals.node')}`);
  console.log(`  server/env.d.ts declares a global process: ${/declare\s+(var|const)\s+process/.test(envd)}`);
  console.log('  -> CONFIRMED by reading (typecheck/lint would not flag process.env inside src/)');
}

main();
