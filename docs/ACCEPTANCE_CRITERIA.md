# Acceptance criteria (Assignment #05)

These five criteria must stay true after every change on branch `assignment-05` (baseline tag `a05-baseline`).
Each one is checked by a command, not by opinion.

| ID | Criterion | How it is verified |
|---|---|---|
| **AC-1** | The booking rule is unchanged: past or reversed times are rejected, the maximum length is 120 minutes (exactly 120 is allowed), a blocked room is rejected, overlaps are rejected with half-open intervals `[start, end)`, and booking data is never mutated. The order of checks and every message text stay the same. | `npm test`: domain tests D01–D09, F01, X01, R01–R08 and UI tests U01–U13 pass with no edited or removed assertions. |
| **AC-2** | Form input reaches the rule unchanged. Empty fields give "Start is required." or "End is required.", and decimal or exponent input (`600.5`, `7e2`) is rejected as not a whole minute instead of being truncated. | `npm test`: P01–P04 plus the new parser unit tests pass. |
| **AC-3** | The LLM never decides availability. The status banner always comes from the deterministic checker. The explanation is labeled ("AI-generated explanation - not a booking decision", Mock/LLM/Fallback), and every failure (timeout, invalid output, no key, network error) ends in the deterministic fallback. | `npm test`: explain unit, server and UI tests pass. |
| **AC-4** | No secrets. No key, token or `.env` file is committed, and the browser bundle contains no provider key handling or server code. | `git ls-files` contains no `.env*`. Grepping `dist/` after `npm run build` for `ANTHROPIC`, `x-api-key`, `child_process` and `api.anthropic.com` finds nothing. |
| **AC-5** | All quality gates are green: tests, type check, lint and build. | `npm run check` exits 0 locally, and the GitHub Actions CI job passes. |
