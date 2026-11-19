// Minimal ambient types for the server folder (the project has no @types/node and adds no dependency).
declare const process: { env: Record<string, string | undefined> };

declare module 'node:os' {
  export function tmpdir(): string;
}

declare module 'node:child_process' {
  type Chunk = { toString(): string };
  interface Readable {
    on(event: 'data', listener: (chunk: Chunk) => void): unknown;
  }
  interface Writable {
    on(event: 'error', listener: (error: Error) => void): unknown;
    end(data?: string): unknown;
  }
  interface ChildProcess {
    stdout: Readable;
    stdin: Writable;
    kill(): boolean;
    on(event: 'error', listener: (error: Error) => void): this;
    on(event: 'close', listener: (code: number | null) => void): this;
  }
  export function spawn(
    command: string,
    args: string[],
    options: { shell: false; cwd: string; signal: AbortSignal; stdio: ['pipe', 'pipe', 'ignore'] },
  ): ChildProcess;
}
