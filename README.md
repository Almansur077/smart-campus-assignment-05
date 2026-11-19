# Smart Campus room availability: Practice #11

**Student:** Almansur Baidildanov, 24B031671 · Thursday 13:00–16:00
**Course:** AI-Driven Software Engineering (KBTU). Practice #11: *Engineering LLM-enabled applications: build a small AI-enabled feature*
**AI tools:** Claude Code (CLI agent) for the implementation (Task 03) and the read-only agentic review (Task 06); a real model (Claude Haiku through `claude -p`) for the prompt comparison and the live demo

**Live demo (static, mock adapter):** https://almansur077.github.io/smart-campus-practice-11/

This branch continues the final Practice #10 project (tag `p11-baseline`). It adds an optional **"Explain availability"** feature. The student checks a time, and an LLM explains the decision in at most two sentences. **The deterministic checker stays the only source of truth:** the LLM never decides availability and never changes bookings.

* [`docs/FEATURE_CONTRACT.md`](docs/FEATURE_CONTRACT.md) has the user story, inputs and outputs, reason codes, prompt contract, failure behavior, AC1–AC6 and a flow diagram.
* `src/explain/` holds the browser-safe parts: validation, facts, prompt, output validator, fallback text, the explain service and the mock adapter.
* `server/` is server-only: `POST /api/explain` (a Vite dev/preview middleware) plus the Anthropic and `claude -p` adapters. Keys come only from the server environment.
* [`RISK_REGISTER.md`](RISK_REGISTER.md) adds risks R-08 to R-11: prompt injection, secrets, provider failures and personal data.
* [`AGENTS.md`](AGENTS.md) contains the repository rules for agents, updated for this feature.

## Flow
```
student input -> validation -> deterministic checker -> status banner (source of truth)
             -> [Explain availability] -> POST /api/explain -> validate + re-run checker -> LLM adapter (timeout)
             -> output validator -> labeled explanation panel | deterministic fallback on any failure
```

## Run
```bash
npm ci
npm test            # 163 tests: 36 from Practice #10 (unchanged) + 127 for Practice #11
npm run typecheck
npm run lint        # ESLint (added in Practice #11)
npm run build
npm run dev         # http://localhost:5173, mock adapter by default
```

Server environment variables (never `VITE_`, never committed):
```
EXPLAIN_PROVIDER=mock|anthropic|claude-cli   # default mock (free, no network)
ANTHROPIC_API_KEY=...                        # only for anthropic; read by the server process
EXPLAIN_MODEL=claude-haiku-5-5               # anthropic default; e.g. haiku for claude-cli
EXPLAIN_TIMEOUT_MS=4000                      # 100..30000 (keep below 8000, see known issue F-04)
```
Real model on a developer machine: `EXPLAIN_PROVIDER=claude-cli EXPLAIN_MODEL=haiku npm run dev`.
The static demo (GitHub Pages) has no server, so it is built with `VITE_EXPLAIN_TRANSPORT=browser-mock`. The mock adapter then runs in the browser and is labeled "Mock".

## Practice #11 commits
| Commit | Task | Change |
|---|---|---|
| `510e8e7` | 01 | ESLint and `npm run lint`; baseline 36/36, typecheck, build, lint |
| `ba3fd85` | 02 | Feature contract and flow; AGENTS.md scope |
| `5490dab` | 03 | AI-generated feature (Claude Code), inspected before acceptance |
| `c64eef7` | 04 | Prompt engineering: three prompts compared on a real model; final prompt 18/18 valid |
| `43e7e12` | 06 | Agentic review findings reproduced as failing tests |
| `7e332b3` | 07 | Fixes F-01/F-02 (output validator) and M1 (personal data redaction) |

## Known open issues (not fixed in Practice #11)
* F-07: the request body is decoded chunk by chunk, so a Cyrillic letter split across two network chunks becomes `�`.
* F-04: the browser timeout (8 s) is shorter than the maximum server timeout (30 s).
* F-03: there is no rate limit on `/api/explain`, which is acceptable for a local single-user demo only.
* F-05: the footer text still says "no backend or external APIs".
* F-06: lint and typecheck do not enforce the browser/server boundary.
* F-09: the explanation panel has no `aria-live`.
* F-11: the middleware path guard does not stop requests to other paths.
* M3: changing the question does not clear the old explanation.

The full report, raw agent logs, command outputs and screenshots are submitted separately and are not stored in this repository.
