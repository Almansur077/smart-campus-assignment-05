# Smart Campus room availability: Practice #10

**Student:** Almansur Baidildanov, 24B031671 · Thursday 13:00–16:00
**Course:** AI-Driven Software Engineering (KBTU). Practice #10: *Review AI-assisted software for risks*
**AI tool:** Claude Code (CLI agent), model `claude-opus-5-5`, fresh read-only sessions for the review prompts

This branch continues the final Practice #09 project (tag `p10-baseline`). It contains:
* [`RISK_REGISTER.md`](RISK_REGISTER.md): 7 evaluated risks with L × I scores, owners, verification and residual risk
* [`AGENTS.md`](AGENTS.md): the agent playbook, updated after the Task 06 audit
* `tests/p10.input-parsing.regression.test.tsx`: regression tests P01–P04 for the confirmed risk R-01

The full report, raw agent logs, command outputs and screenshots are submitted separately. They are not stored in this repository (see R-06).

## Changes since Practice #09
| Commit | Change | Risk |
|---|---|---|
| `08fa57e` | Add regression tests P01–P04 (3 of 4 fail on the baseline) | R-01 |
| `d512fa4` | AGENTS.md: one fictional room, no secrets, no deployments, branch-only work with a human merge gate, full checks before acceptance; `.env` ignored | R-04 |
| `e435b19` | `App.tsx`: parse the fields with `Number()` instead of `parseInt` | R-01 |
| `cf1e5a0` | Bump devDependencies postcss 8.5.32, vite 5.4.21, vitest 2.1.9 | R-02 |

## Run
```bash
npm ci
npm test            # 153 tests: 36 from Practice #10 (U01-U13, D01-D09/F01/X01, R01-R08, P01-P04) + 117 for Practice #11
npm run typecheck
npm run build
npm audit           # known residual: tinypool / esbuild / @vitest/mocker (dev tooling only, see R-02)
```

## Optional "Explain availability" (Practice #11)
The deterministic checker decides; the explanation is a separate, labeled panel and never changes the status.
Contract: `docs/FEATURE_CONTRACT.md`. Server environment variables only (never `VITE_`, never committed):

```
EXPLAIN_PROVIDER=mock|anthropic|claude-cli   # default mock (free, no network)
ANTHROPIC_API_KEY=...                        # only for anthropic; read by the server process
EXPLAIN_MODEL=claude-haiku-5-5               # anthropic default; optional --model for claude-cli
EXPLAIN_TIMEOUT_MS=4000                      # 100..30000
```

`npm run dev` / `npm run preview` serve `POST /api/explain`. Static demo without a server:
`VITE_EXPLAIN_TRANSPORT=browser-mock npm run build` (the mock adapter runs in the browser, labeled "Mock").
