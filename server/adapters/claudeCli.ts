// Local `claude -p` adapter for real-LLM demos on a developer machine. Spawned WITHOUT a shell: the prompt is passed
// on stdin and the system prompt as a single argv entry, so student text can never become a command.
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import type { ExplainAdapter } from '../../src/explain/types';

const MAX_STDOUT_BYTES = 8192;

export type ClaudeCliOptions = { command?: string; model?: string };

export function createClaudeCliAdapter(options: ClaudeCliOptions = {}): ExplainAdapter {
  const command = options.command ?? 'claude';
  return {
    name: 'claude-cli',
    kind: 'llm',
    explain({ system, user, signal }) {
      const args = ['-p', '--tools', '', '--no-session-persistence', '--system-prompt', system];
      if (options.model && options.model.trim() !== '') args.push('--model', options.model.trim());
      return new Promise((resolve, reject) => {
        // cwd = temp dir so the CLI does not load this repository's instructions; tools are disabled above.
        const child = spawn(command, args, { shell: false, cwd: tmpdir(), signal, stdio: ['pipe', 'pipe', 'ignore'] });
        let stdout = '';
        child.stdout.on('data', (chunk: { toString(): string }) => {
          stdout += chunk.toString();
          if (stdout.length > MAX_STDOUT_BYTES) child.kill();
        });
        child.on('error', reject);
        child.on('close', (code: number | null) => {
          if (code === 0 && stdout.trim() !== '' && stdout.length <= MAX_STDOUT_BYTES) {
            resolve({ explanation: stdout.trim() });
          } else {
            reject(new Error(`claude CLI exited with code ${code}`));
          }
        });
        child.stdin.on('error', reject);
        child.stdin.end(user);
      });
    },
  };
}
