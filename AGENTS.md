# AGENTS.md — openreview

Repo rules for AI agents (Antigravity). **Read this fully before writing any code.** These rules override any default habits or scaffolding preferences you have.

**What this project is:** a free, account-free chess Game Review web app. Paste a PGN → get chess.com-style annotated analysis (Brilliant / Great / Best / Excellent / Good / Book / Inaccuracy / Mistake / Miss / Blunder), accuracy %, eval bar and graph, engine lines, coach commentary, sounds, animations, and a retry-the-move practice mode.

**The full spec lives in `docs/IMPLEMENTATION_PLAN.md`.** This file is the rulebook; that file is the blueprint. When they conflict, ask — do not guess.

---

## 1. Non-negotiable architecture constraints

These are product decisions, not preferences. Violating any one of them breaks the whole premise of the app.

1. **The chess engine runs in the browser. Always.**
   Stockfish WASM in Web Workers. Never in an API route, never in a serverless function, never in a build step, never in Node on the server. Zero server compute is the entire reason this app can be free.
2. **There is no authentication. Ever.**
   No login, no signup, no OAuth, no email, no sessions, no cookies, no `middleware.ts` auth gate, no user model, no "sign in to save". Do not install `next-auth` / `@auth/*` / Clerk / Supabase Auth. If a task seems to need a user identity, it does not — use local storage.
3. **There is no database.**
   No Prisma, no Drizzle, no Postgres, no Mongo, no Redis, no KV, no Vercel Postgres/Blob. All persistence is **IndexedDB via Dexie**, in `lib/storage/`. Do not add a server-side persistence layer of any kind.
4. **API routes are stateless proxies only.**
   They may fetch an external URL, transform the response, and return it. They may hold an in-memory LRU for the lifetime of the function instance. They may **never** write to disk, a DB, or any external store. Current allowed routes: `import/chesscom`, `import/lichess`, `cloudeval`, `tablebase`, `coach`, `og`.
5. **Analysis must be deterministic.**
   The same PGN + same depth must always produce a byte-identical report. Therefore: `go depth N` only — **never `go movetime`, never `go infinite` for classification**, `Threads 1` per worker, fixed `Hash`, and the eval cache key must include the engine version. On-demand "analyze this position deeper" in the UI may use infinite search; classification may not.
6. **No chess.com assets or branding.**
   Do not copy their icon SVGs, sound files, piece sets, or the term "CAPS". Use original SVGs and CC0/Lichess-licensed sounds (attribute in `CREDITS.md`). The product name is never "chess.com anything".
7. **Zero cost, always.** No paid service, no subscription, no required API key, no credit card — not for build, not for runtime. If a task appears to need a paid dependency or service, stop and propose a free alternative instead. `api/coach` (LLM) is disabled by default and must fall back to rule-based templates.
8. **This repo is GPLv3** because we distribute Stockfish. Only add dependencies with GPL-compatible licenses (MIT / BSD / Apache-2.0 / ISC / CC0). Never add anything proprietary, "source-available", or commercial-use-restricted. Credit all borrowed assets in `CREDITS.md`.
9. **The app must work offline** after the first visit. Any feature that hard-requires the network (cloud eval, tablebase, imports, LLM coach) must degrade silently and never block a review.

---

## 2. Code conventions

### TypeScript
- `strict: true`. **No `any`** — use `unknown` + a narrowing guard. No `@ts-ignore`; use `@ts-expect-error` with a one-line reason if truly unavoidable.
- Prefer `type` for unions/shapes, `interface` for extensible object contracts. Shared domain types live in `lib/types.ts` and are imported from there — never redeclared locally.
- Discriminated unions over boolean flags (`{status:'idle'} | {status:'analyzing', ply:number} | {status:'done'}`).
- Zod-validate every API route input and every parsed external payload (PGN import responses, backup JSON files). Never trust a fetch result's shape.

### React / Next.js 15 (App Router)
- Server Components by default; add `'use client'` only where you need state, effects, workers, or events. The whole `/review` workspace is client-side.
- **Never call the engine from a component.** Components read from the zustand store; only `lib/engine/enginePool.ts` talks to workers.
- No `useEffect` for derived state — compute it during render or with a selector.
- Every `useEffect` that starts async work must clean up: abort the request, terminate/stop the worker job, clear the timer.
- Co-locate components by feature (`components/board/`, `components/review/`). Shared primitives only in `components/ui/` (shadcn).

### Purity rule (this is what makes the project testable)
Everything in `lib/analysis/**` must be **pure**:
- No React imports. No DOM. No `fetch`. No IndexedDB. No `Date.now()`, no `Math.random()`.
- Signature shape: `(inputs) => output`. Deterministic for identical inputs.
- If a function needs time or randomness, take it as a parameter.
This lets the entire classification engine be unit-tested in milliseconds with zero mocking.

### Styling
- Tailwind utilities only; no CSS-in-JS, no `.module.css` unless it is genuinely impossible in Tailwind.
- Dark mode is first-class: every color utility needs a `dark:` counterpart.
- Classification colors come from a single exported constant (`lib/constants/classification.ts`) — never hardcode a hex in a component.
- Respect `prefers-reduced-motion` in every animation.
- Layout must work from 390px to ultrawide. No fixed pixel widths on containers.

### Naming
- Files: `camelCase.ts` for lib, `PascalCase.tsx` for components, `kebab-case` for routes.
- Chess vocabulary is exact: `ply` (half-move) ≠ `move` (full move). `uci` = `e2e4`, `san` = `Nf3`. `cp` = centipawns, always from **White's** perspective in storage and converted to the mover's perspective only inside `classify`. Never mix the two — this is the #1 source of bugs in this codebase.

---

## 3. Testing (non-optional)

- **Vitest.** Every file in `lib/analysis/**` and `lib/pgn/**` ships with a sibling `*.test.ts`. No exceptions, no "I'll add tests later".
- **Write the tests first for Phase 3** (classification). The golden fixtures in `tests/fixtures/*.pgn` are the specification — if a fixture fails, the code is wrong, not the fixture.
- Required golden assertions (see plan §7 Phase 3):
  - Kasparov–Topalov 1999, `24.Rxd4` → `brilliant`
  - Morphy Opera Game sacrifices → `brilliant`; final mate → `best`/`forced`
  - A single-saving-move position → `great`
  - Hanging queen not captured → `miss` with a `hanging_piece` motif
  - Mainline Italian moves 1–8 → `book`
  - Same PGN analyzed twice → deep-equal reports (determinism)
  - A normal club game → **at most 1** `brilliant` (guards against badge inflation)
- Engine tests may be slow; mark them `describe.concurrent` with a generous timeout and keep them out of the fast unit suite.
- Never weaken an assertion to make a test pass. Fix the implementation or raise the problem.

---

## 4. Performance budget (treat as acceptance criteria)

| Thing | Budget |
|---|---|
| Pass A (scan, depth 12, MultiPV 2, ~80 plies, 6 workers) | ≤ 10 s |
| Pass B (verify interesting plies at depth 20) | ≤ 12 s |
| Full review of a 40-move game, warm cache | ≤ 1 s |
| First contentful paint on `/` | < 1.5 s |
| Main-thread block from analysis | **0 ms** — if the UI stutters, the work is in the wrong place |

Results must **stream in order** — the user reviews move 1 while move 60 is still computing. Never block the UI on the full analysis completing.

---

## 5. Dependencies

**Use these:** `chess.js`, `dexie`, `zustand`, `framer-motion`, `zod`, `lz-string`, `canvas-confetti`, shadcn/ui + `tailwindcss`, `vitest`.

**Ask before adding anything else.** Specifically forbidden without discussion: any auth library, any ORM/database client, any state manager beyond zustand, any UI kit beyond shadcn, moment.js, lodash (use native), axios (use `fetch`).

**Never add a dependency that is paid, freemium-with-a-key-requirement, or licensed incompatibly with GPLv3.** Check the license before installing. Free tier that requires a credit card = not free, do not use it.

Bundle discipline: the engine WASM is already ~7 MB. Lazy-load the opening book, `ffmpeg.wasm`, and any chart library. Check `pnpm build` output size before merging.

---

## 6. Working method

1. **One phase at a time**, in order, from `docs/IMPLEMENTATION_PLAN.md` §7. Do not start Phase N+1 until Phase N's Accept criteria all pass. Phase 3 must be fully green before any Phase 4 UI work — debugging UI against a broken classifier wastes days.
2. **Before coding:** restate the phase's Accept criteria as a checklist in your response, then implement against it.
3. **Verification command for every phase** — must pass before you report done:
   ```
   pnpm typecheck && pnpm lint && pnpm test && pnpm build
   ```
   For UI phases, additionally open the dev server, load `tests/fixtures/kasparov-topalov.pgn`, and screenshot the move-24 badge to prove it renders.
4. **Update `PROGRESS.md`** at the end of every phase: what shipped, what's stubbed, known gaps, what's next. Keep it honest — a stub described as complete costs more than an admitted gap.
5. **Commits:** conventional style (`feat(analysis): add SEE-based sacrifice detection`). Small and scoped. Never mix a refactor into a feature commit.
6. **Scope discipline:** implement exactly the current phase. Do not "improve" unrelated files, restyle things nobody asked about, or pre-build later phases. If you spot something worth doing later, add it to `PROGRESS.md` under "Ideas" and move on.
7. **When blocked or ambiguous, stop and ask.** Do not invent a threshold, a formula, or a product decision. The classification constants in the plan are researched and deliberate — do not "tune" them without being asked.

---

## 7. Things that will silently break in production

Check these explicitly whenever you touch the relevant area:

- **COOP/COEP headers** must stay in `next.config.ts` or multi-threaded WASM stops loading. Also: COEP blocks cross-origin embeds — self-host fonts via `next/font`.
- **Safari does not support `credentialless` COEP** → `crossOriginIsolated` is false there. The single-threaded fallback must engage silently, never a broken board or an error toast.
- **Version engine filenames** (`stockfish-17-lite.v1.wasm`). A stale service worker serving an old engine against a new cache key breaks determinism invisibly.
- **`api/og` must be Edge runtime** and build its card purely from querystring params (there is no DB to read).
- **Centipawn perspective flips.** Whenever you touch eval math, add a test with a Black-to-move position. Most classification bugs are a missing negation.
- **Mate scores are not centipawns.** `#3` must never be shoved through the win% sigmoid as `30000`. Handle mate explicitly everywhere.
- **IndexedDB is unavailable/ephemeral in private browsing.** Detect once, warn once, keep reviews working.

---

## 8. Definition of done (any task)

- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass
- [ ] New logic in `lib/**` has unit tests; golden fixtures still green
- [ ] No `any`, no `@ts-ignore`, no `console.log` left behind
- [ ] Works at 390px width and in dark mode
- [ ] Keyboard accessible; no new axe violations
- [ ] No network call is required for the core review flow
- [ ] No auth, no database, no server-side engine was introduced
- [ ] No paid service, required API key, or GPL-incompatible dependency was introduced
- [ ] `PROGRESS.md` updated
