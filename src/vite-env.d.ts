/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'browser-mock' runs the mock adapter in the browser (static demo, no server). Never put a key here. */
  readonly VITE_EXPLAIN_TRANSPORT?: string;
}
