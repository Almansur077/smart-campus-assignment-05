// Vite plugin: mounts POST /api/explain on the dev server and on `vite preview`. The only server code in the project.
import type { Connect, Plugin } from 'vite';
import { createExplainMiddleware, EXPLAIN_PATH } from './explainHandler';

export function explainApi(): Plugin {
  // Node's req/res satisfy the handler's structural types; the cast is needed only because @types/node is not installed.
  const middleware = createExplainMiddleware() as unknown as Connect.NextHandleFunction;
  return {
    name: 'smart-campus-explain-api',
    configureServer(server) {
      server.middlewares.use(EXPLAIN_PATH, middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(EXPLAIN_PATH, middleware);
    },
  };
}
