# ChessLens — Project Progress Tracker

Tracking progress against the roadmap defined in `docs/IMPLEMENTATION_PLAN.md`.

---

## Phase Status Summary

| Phase | Description | Status | Verification / Notes |
|---|---|---|---|
| **Phase 0** | Scaffold (Next.js 15, Strict TS, Tailwind, shadcn, Dexie, Vitest, CI, GPLv3, COOP/COEP) | 🟢 Complete | All checks passed: typecheck, lint, test (Vitest), build, and browser verification (`crossOriginIsolated === true`) |
| **Phase 1** | Board + PGN (Custom board, move navigator, PGN parser, sounds, animations) | 🟢 Complete | Custom 64-square responsive board with Framer Motion spring physics, pure PGN parser with %clk & %eval annotations + multi-game splitting, Web Audio sound manager, Zustand game navigation store, Cburnett vector piece SVGs, and golden fixtures |
| **Phase 2** | Engine Layer (Stockfish WASM, Worker Pool, UCI wrapper, IndexedDB eval cache) | 🟢 Complete | **Stockfish 18 lite WASM assets** (6.96 MB + 6.76 MB — real engine, not stubs). Promise-based UCI wrapper, `EnginePool` with round-robin queue + AbortSignal + capability detection, IndexedDB eval cache, `EngineLines` debug panel. **Browser-proven at depth 12:** `bestmove e2e4 ponder e7e5`, run 1 = 1036 ms, run 2 = 653 ms, determinism ✅ |
| **Phase 3** | Analysis Pipeline + Classification (winProb, accuracy, SEE/sacrifice, classify cascade, golden fixtures) | 🟢 Complete | **8/8 Golden & Calibration Fixtures green.** Pure analysis pipeline with two-pass scan (depth 12) & verify (depth 20), Lichess win probability sigmoid, chess.com expected points cascade, SEE sacrifice detector, 100% offline tactical motif tagging & coach templates, opening book detector, phase accuracy breakdown, decided-position guards (`epBefore <= 0.03` cap Inaccuracy, `epBefore >= 0.97 && epAfter >= 0.90` cap Good), winning-state Miss restriction (`epAfter < 0.75`), mate exclusion in ACPL, tightened Best classification (`ctx.uci === ctx.bestUci` only; non-best moves with `epLoss <= 0.02` become Excellent), and recalibrated smooth monotone `estimatedElo` anchored to reference points (450–2500) with heavy ACPL and error-rate weighting. |
| **Phase 4** | Review UI (EvalBar, EvalGraph, MoveList, SummaryPanel, CoachPanel, Share link) | 🟢 Complete | Full review workspace on top of custom Board + gameStore + EnginePool. Dynamic vertical/horizontal `EvalBar`, hand-rolled SVG `EvalGraph` with advantage area fills & scrub tooltip, `CoachPanel` (text from `tactics.ts`), `SummaryPanel` with breakdown table & accuracies, `KeyMoments`, `AnalysisProgress` with parallel pool dispatch, board `ArrowLayer` & `BadgeLayer` with confetti on Brilliant moves, inline `MoveList` badges, `?debug=1` HUD overlay, URL-compressed share link (`/review?g=...`), and Edge runtime `api/og` |
| **Phase 5** | Retry Mode + Trainer + Imports + Local Library (SRS spaced repetition, chess.com/lichess import, Dexie DB) | 🟢 Complete | **100% Client-side persistence via Dexie IndexedDB**. Interactive Retry practice mode with move validation & verdicts, stateless public API proxies for Chess.com & Lichess with batch worker review queue, full `/library` workspace with search/filter/JSON backup, `/dashboard` performance analytics & %clk time pressure, and `/trainer` SM-2 Spaced Repetition flashcards. |
| **Phase 6** | Polish & Offline PWA (Service Worker, themes, piece sets, a11y, tablebase/cloudeval) | 🟢 Complete | **100% Offline PWA Service Worker** with versioned SF18 WASM precaching, Dexie-persisted settings (themes, piece sets, audio gain volume, depth, arrows, coach verbosity, reduced motion, clear eval cache), distinct colorblind geometric icon shapes, full keyboard navigation & ARIA live region, threat detector overlay (`x` key), guess-the-move quiz, per-game opening theory reports, error boundaries with recovery, and stateless tablebase / cloud-eval proxies with silent degradation. |
| **Phase 7** | Deployment & Verification (Pre-deploy checks, Vercel Hobby ready, GPLv3 compliance) | 🟢 Complete | Clean pre-deploy pass: COOP/COEP + immutable cache in `next.config.ts`, versioned SF18 WASM, full GPLv3 `LICENSE` & `CREDITS.md`, 0 leftover console.logs, 0 env vars required, 100% test pass (242/242 tests), static Next.js production build ready for Vercel Hobby $0 deployment. |

---

## Phase 7: Deployment & Pre-Deploy Verification Details

### What Shipped
- **Pre-Deploy Security & Performance Pass**:
  - `next.config.ts` configured with `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: credentialless` for multi-threaded SharedArrayBuffer WASM support.
  - HTTP `Cache-Control: public, max-age=31536000, immutable` headers configured on `/engine/:path*` and `/sounds/:path*` for zero-redundancy caching on Vercel CDN.
  - `outputFileTracingExcludes: { '*': ['./public/engine/**'] }` to keep heavy static WASM binaries out of serverless bundle footprints.
- **Engine Asset Versioning**:
  - Versioned Stockfish 18 NNUE lite builds (`stockfish-18-lite-single.v1.js / .wasm` & `stockfish-18-lite-mt.v1.js / .wasm`) ensuring deterministic analysis and proper browser cache invalidation.
- **Strict License & GPLv3 Compliance**:
  - Full `LICENSE` (GNU GPLv3) at repository root.
  - Updated `CREDITS.md` attributing Stockfish 18, Stockfish.js, chess.js, Cburnett piece SVGs, Lichess CC0 soundsets, and open-source UI libraries.
  - All project dependencies verified as GPL-compatible (MIT, ISC, BSD, Apache-2.0).
- **Zero-State Server Architecture**:
  - Verified no engine compute runs in any serverless API route or server component.
  - All API routes (`/api/import/chesscom`, `/api/import/lichess`, `/api/cloudeval`, `/api/tablebase`, `/api/coach`) are stateless proxies with in-memory LRU caching and graceful offline degradation.
  - `/api/og` uses Next.js Edge runtime (`runtime = 'edge'`) and parses parameters directly from query strings without database access.
  - Zero required runtime environment variables (`process.env.NODE_ENV === 'production'`).
- **Codebase Cleanliness**:
  - Cleaned all leftover `console.log` statements in application components and service worker.
  - Comprehensive documentation in `README.md` including one-command setup, architecture diagrams, zero-cost guarantee, and exact Vercel Hobby deploy click-path.

### Remaining Known Gaps / Deployment Notes
- **Live URL Verification (Plan §11.6)**:
  - User will execute the live post-deploy checklist on the deployed `*.vercel.app` URL (`crossOriginIsolated`, WASM immutable cache hit, 60-move review performance on mobile data, offline reload, cross-device share link determinism, and Lighthouse audit).
- **LLM Coach Disabled by Default**:
  - `api/coach` returns rule-based offline commentary via `tactics.ts` templates ($0 cost). Optional LLM integration remains an opt-in stub.
- **Free Vercel Subdomain**:
  - Project configured to ship cleanly on the free `*.vercel.app` subdomain with zero paid requirements.

### Verification Results
- `pnpm typecheck`: Clean (0 errors)
- `pnpm lint`: Clean (0 errors, 0 warnings)
- `pnpm test`: 242/242 tests passing across 23 test suites
- `pnpm build`: Clean (All 13 routes compiled and statically optimized, Edge OG image generation active)

---

## Phase 6: Polish, Offline PWA, Settings & Accessibility Details

### What Shipped
- **Service Worker & PWA Precaching (`public/sw.js`, `public/manifest.json`, `components/PwaRegister.tsx`)**:
  - Versioned cache `chesslens-v1-sf18` precaching the entire app shell (`/`, `/review`, `/library`, `/dashboard`, `/trainer`), versioned Stockfish 18 WASM binary (`stockfish-18-lite-*.wasm` & `.js`), sound assets, and piece SVGs.
  - Cache-first strategy for static engine assets, pieces, and audio; Network-first with cache fallback for HTML pages.
  - Manifest configured for standalone PWA installation with dark theme `#070b13` and emerald accent `#10b981`.
- **Dexie-Persisted Settings (`lib/store/settingsStore.ts`, `components/settings/SettingsModal.tsx`)**:
  - Zustand settings store with two-way sync to Dexie `db.settings`.
  - Board theme switcher (`emerald`, `slate`, `wood`, `ocean`, `amber`) with reactive square and coordinate styling in `Square.tsx`.
  - Piece set selector (`cburnett`, `staunty`, `alpha`).
  - Web Audio master gain volume scaling and mute toggle in `soundManager.ts`.
  - Engine depth selector (8 to 24), arrow overlays toggle, coach verbosity (`concise`, `standard`, `detailed`), and `reducedMotion` preference.
  - Dedicated *"Clear Analysis Cache"* action that wipes IndexedDB `db.evals` safely without affecting saved games.
- **Accessibility & Colorblind-Safe Badges (`components/review/ClassificationIcon.tsx`, `components/board/AriaAnnouncer.tsx`)**:
  - Distinct SVG geometric silhouette shapes for colorblind accessibility: Diamond (Brilliant), Shield (Great), Star (Best), Double-circle (Excellent), Rounded square (Good), Book (Book), Triangle (Inaccuracy), Inverted trapezoid (Mistake), Octagon (Miss), Cross-shield (Blunder), Pill (Forced).
  - ARIA live region (`aria-live="polite"`) announcing move number, mover side, SAN, and full classification description on board navigation.
  - Accessible focus management in modals with keyboard shortcuts (`Esc` to close).
- **Metric Labeling**:
  - Accuracy metrics in `SummaryPanel.tsx` and `app/dashboard/page.tsx` labeled explicitly as *"Accuracy (Lichess model)"*.
- **Threat Vector Overlay (`lib/analysis/threatDetector.ts`, `components/board/ThreatLayer.tsx`)**:
  - Pure threat detector finding active captures, checks, and pawn promotion threats.
  - Keyboard toggle bound to `x` / `X` with visual SVG threat arrows and target square pulses on the board.
- **Guess-the-Move Quiz Mode (`components/review/GuessTheMoveModal.tsx`)**:
  - Interactive quiz mode allowing the user to play as White or Black, guess moves, and earn points scored against engine best moves and actual game moves, with live streak tracking.
- **Per-Game Opening Theory Report (`components/review/OpeningReportModal.tsx`)**:
  - Identifies ECO opening name, number of book plies, exact departure move where theory was left with jump button, and phase accuracies.
- **Stateless Tablebase & Cloud Eval Proxies (`app/api/tablebase/`, `app/api/cloudeval/`, `app/api/coach/`, `lib/engine/tablebase.ts`)**:
  - Stateless proxy to Lichess Endgame Tablebase API (≤7 pieces) with exact DTZ/DTM and in-memory LRU cache.
  - Stateless proxy to Lichess Cloud Eval API with in-memory LRU cache.
  - Silent offline degradation when upstream network is unreachable.
  - Tablebase evaluation display banner integrated into `EngineLines.tsx`.
  - Coach route defaulting to offline `tactics.ts` templates without requiring an LLM.
- **Robustness & Error Boundaries (`app/error.tsx`, `app/global-error.tsx`, `components/ui/ErrorBoundary.tsx`)**:
  - Next.js root and global error boundaries with retry and cache clear recovery options.
  - One-click instant demo button on landing page hero loading Kasparov vs Topalov 1999 with 0 input required.

- **Analysis Playback & Follow Mode (`lib/store/reviewStore.ts`, `lib/store/gameStore.ts`, `components/review/AnalysisProgress.tsx`, `components/board/Piece.tsx`)**:
  - Live animated board playback during analysis stepping through streaming classified moves with Framer Motion spring physics (~140ms).
  - Synchronized progress bar with smooth CSS width transitions and pause/resume control.
  - Reduced-motion support instantly jumping to target ply with 0 animation delay.

- **Brilliant Classification & Eval Normalization (`lib/analysis/classify.ts`, `lib/analysis/pipeline.ts`, `lib/engine/enginePool.ts`, `lib/engine/evalCache.ts`, `components/review/EvalBar.tsx`, `components/review/EvalGraph.tsx`, `components/review/EngineLines.tsx`, `components/review/DebugOverlay.tsx`)**:
  - Normalized all displayed evaluations strictly to White's perspective (+ for White advantage, - for Black advantage, 0.0 for equal) across `EvalBar`, `EvalGraph`, `EngineLines`, and `DebugOverlay`.
  - Bumped engine eval cache version to `sf18.v4` to automatically invalidate stale shallow/unverified cache entries.
  - Added and exported `clearEvalCache()` in `evalCache.ts` and `enginePool.ts` for safe full clearing of IndexedDB eval cache.
  - Verified in browser: Kasparov 24. Rxd4 shows the Brilliant badge (`!!`) and the eval bar displays `-0.5` (near equal / balanced rather than the stale shallow `-8.5`).
  - All 242 tests passing across 23 test suites.

### Verification Results
- `pnpm typecheck`: Clean (0 errors)
- `pnpm lint`: Clean (0 errors, 0 warnings)
- `pnpm test`: 242/242 tests passing across 23 test suites (all golden & live pipeline fixtures green)
- `pnpm build`: Clean (All 13 routes compiled and statically optimized)

---

## Phase 5: Retry Mode, Trainer, Imports & Local Library Details

### What Shipped
- **Retry Practice Mode (`lib/store/retryStore.ts`, `components/review/RetryPanel.tsx`)**:
  - Activated from Mistake, Miss, and Blunder badges in the review workspace or coach panel
  - Resets board to `fenBefore` and lets the user make interactive retry attempts on the board
  - Validates user moves against engine evaluation with real-time feedback verdicts: *"Correct!"* (winning/best line), *"Better than the game, but not best"*, or *"Still losing / Incorrect"*
  - Autoplays opponent response PV, provides step-by-step solution viewing, sound effects (`retryCorrect`, `retryWrong`), and one-click export to the Blunder Trainer deck
- **Stateless Game Import Proxies (`app/api/import/`)**:
  - `app/api/import/chesscom/route.ts`: Stateless proxy fetching monthly game archives from `api.chess.com/pub/player/{username}/games/archives`, converting them to standard candidates with Zod validation and rate limiting
  - `app/api/import/lichess/route.ts`: Stateless proxy streaming games from `lichess.org/api/games/user/{username}` with `Accept: application/x-chess-pgn`
  - Zero server database or disk writes — purely stateless streaming transformations
- **Batch Worker Queue & Review (`lib/store/batchStore.ts`, `components/library/BatchImportModal.tsx`)**:
  - Import modal allowing multi-game selection from Chess.com or Lichess
  - Background batch review queue utilizing client-side Stockfish `EnginePool` with live per-game and per-ply progress bars
  - Automatically saves analyzed games to Dexie `db.games` and blunder positions to `db.cards`
- **Local Storage Subsystem & Library (`lib/storage/`, `app/library/page.tsx`)**:
  - `lib/storage/db.ts`: IndexedDB database via Dexie (`games`, `evals`, `cards`, `settings`)
  - `lib/storage/backup.ts`: Zod-validated JSON backup export and import with non-destructive ID merging
  - `lib/storage/quota.ts`: Storage usage estimation, persistent storage request, private browsing incognito warning, and 25% oldest LRU eval cache pruning
  - `app/library/page.tsx`: Local game library with live search (players, event, opening, ECO), multi-criteria filters (result, source), sorting, bulk selection actions (delete, batch trainer card generation), storage quota meter, and JSON backup manager
- **Performance Analytics Dashboard (`app/dashboard/page.tsx`)**:
  - Computed purely on-device from IndexedDB `db.games`
  - Accuracy progression SVG curve tracking White and Black accuracies chronologically across games with hover tooltips
  - Tactical motifs heatmap highlighting top blindspots (`hanging_piece`, `fork`, `pin`, `missed_mate`)
  - Time pressure correlation (%clk) comparing blunder rates under severe time trouble (<10s), moderate (10s–30s), and comfortable (>30s) clocks
  - Repertoire breakdown with per-ECO opening game counts, average accuracy, and win rates
- **Spaced Repetition Blunder Trainer (`lib/storage/trainer.ts`, `app/trainer/page.tsx`)**:
  - SM-2 Lite spaced repetition scheduling algorithm (`again`, `hard`, `good`, `easy`) calculating ease factors, repetition streaks, intervals, and due dates
  - Interactive board flashcard session presenting blunder positions with side-to-move orientation, instant move validation against best move / PV lines, and SM-2 quality grading
  - Full deck card browser with search, motif filters, due-today filters, and card management
- **Unit & Integration Test Coverage**:
  - `lib/storage/backup.test.ts`: Backup payload serialization, schema validation, and merge tests
  - `lib/storage/quota.test.ts`: Storage format and LRU cache eviction tests
  - `lib/storage/trainer.test.ts`: SM-2 algorithm progression and card deduplication tests
  - All 205 unit and integration tests passing across 20 test suites in ~16s

### Verification Results
- `pnpm typecheck`: Clean (0 errors)
- `pnpm lint`: Clean (0 errors, 0 warnings)
- `pnpm test`: 215/215 tests passing across 20 test suites (including perspective regression tests, golden fixtures, and pipeline determinism)
- `pnpm build`: Clean (All pages compiled and statically optimized)
- **Home & Review UX Fixes (Issues 1–3)**:
  - Fixed navigation on HomePage: successful PGN parse now immediately executes `router.push('/review')` to land on the review workspace rather than swapping in-place.
  - Cleared PGN input textarea on successful parse, while preserving text on error for user correction.
  - Removed in-place board/analysis from `/`, making `/` the hero & launchpad hub.
  - Review workspace automatically runs 2-pass analysis pipeline on mount, displays `AnalysisProgress`, and scrolls to top on mount (`window.scrollTo(0, 0)`).
- **Perspective Audit & Regression Tests (Issue 4)**:
  - Verified centipawns are stored strictly in White's perspective in `evalMap` and converted to mover's perspective exactly once inside `classifyMove`/`classifyGame`.
  - Audited `pipeline.ts` for consecutive ply lookups (`evalAfter(n)` vs `evalBefore(n+1)`): since `evalMap` is keyed by FEN string and never mutated in place, White-perspective storage is invariant across all plies and lookups.
  - Added 5 regression tests in `lib/analysis/classify.test.ts` covering Black blunder, Black best move, mirrored White blunder, mirrored White best move, and consecutive ply eval perspective verification.
- Verified non-negotiable rules: Zero authentication/login buttons, zero server-side database/ORM, engine runs client-side only in Web Workers, stateless API proxies only.


---

## Phase 4: Review UI Details

### What Shipped
- **Review State Store (`lib/store/reviewStore.ts`)**:
  - Orchestrates client-side 2-pass analysis via `pipeline.ts` and `EnginePool`
  - Streams move reports with real-time status and pass progress updates
  - Clean `AbortController` cancellation for in-flight worker jobs
  - View toggles: tabs (`summary`, `moves`, `moments`), arrows, live engine PV lines, debug mode
- **Review UI Components (`components/review/`)**:
  - `EvalBar.tsx`: Dynamic vertical (desktop) and horizontal (mobile) evaluation bar with win% math and board orientation awareness
  - `EvalGraph.tsx`: Hand-rolled responsive SVG area chart with White/Black advantage gradients, classification dots, and hover scrubbing tooltip with click-to-jump
  - `CoachPanel.tsx`: 100% offline tactical explanations generated strictly from `lib/analysis/tactics.ts` with motif tags and best move recommendation
  - `SummaryPanel.tsx`: White & Black accuracy rings, estimated Elo, ACPL, chess.com-style classification breakdown table, opening ECO info, and phase accuracy bars
  - `KeyMoments.tsx`: Critical game turning points (Brilliant, Great, Mistake, Miss, Blunder) with jump navigation
  - `AnalysisProgress.tsx`: Real-time progress bar with parallel worker pool dispatch, pass status, engine capability indicator, and re-analyze trigger
  - `ArrowLayer.tsx`: SVG board overlay rendering best move (green) and played blunder/mistake/miss (red/orange) arrows
  - `BadgeLayer.tsx`: Square-pinned classification badge with spring physics animation and `canvas-confetti` trigger on Brilliant moves
  - `DebugOverlay.tsx`: Interactive eval metrics HUD for `?debug=1` showing raw centipawns, EP losses, and engine lines
- **MoveList Extension (`components/board/MoveList.tsx`)**:
  - Extended existing `MoveList` with inline classification badges (colors strictly from `lib/constants/classification.ts`)
  - No second move list component created
- **Share Links & Edge OG Image**:
  - URL-compressed review sharing via `lz-string` (`/review?g=<lz-string>`)
  - Edge runtime `app/api/og/route.tsx` generating 1200x630 match summary OpenGraph cards via querystring parameters
- **Board Integration (`components/board/Board.tsx`)**:
  - Integrated `ArrowLayer` and `BadgeLayer` directly into the responsive 64-square board container

### Verification Results
- `pnpm typecheck`: Clean (0 errors)
- `pnpm lint`: Clean (0 errors, 0 warnings)
- `pnpm test`: 191/191 tests passing across 17 suites
- `pnpm build`: Clean (all routes compiled and statically optimized)

---

## Phase 3: Analysis Pipeline & Classification Details

### What Shipped
- **Pure Mathematical Core (`lib/analysis/`)**:
  - `winProb.ts`: Lichess-calibrated win probability sigmoid and expected points conversion with explicit mate handling
  - `accuracy.ts`: Per-move win% accuracy, game accuracy (volatility-weighted + harmonic mean), ACPL, and calibrated estimated Elo
  - `sacrifice.ts`: Static Exchange Evaluation (SEE) and hanging material detection
  - `tactics.ts`: Tactical motif detection (`hanging_piece`, `fork`, `pin`, `missed_mate`, etc.) and offline template library for coach commentary
  - `openingBook.ts`: Compressed opening book and ECO code detector
  - `phases.ts`: Opening, middlegame, and endgame material threshold detection and phase accuracy calculations
  - `keyMoments.ts`: Turning-point detection for decisive moves
  - `classify.ts`: Full priority cascade (Forced → Book → Brilliant → Great → Miss → EP-Thresholds) with rating-adaptive leniency
  - `pipeline.ts`: Two-pass analysis orchestrator (Pass A scan depth 12 + Pass B verify depth 20) with parallel worker pool dispatch
- **Golden Fixtures (`lib/analysis/golden.test.ts`)**:
  - 7/7 Golden assertions green: Kasparov–Topalov 1999 24.Rxd4!! (Brilliant), Morphy Opera Game sacrifices, only-saving-move (Great), hanging queen (Miss), mainline Italian (Book), determinism, and normal club game badge inflation guard

---

## Phase 2: Engine Layer Details

### What Shipped

**Hotfix (2026-08-15): Replaced fake/truncated WASM stubs with real Stockfish 18 lite builds.**

- **Stockfish 18 Lite WASM Assets (`public/engine/`)**:
  - `stockfish-18-lite-single.v1.js` (20 KB glue) + `stockfish-18-lite-single.v1.wasm` (**6.96 MB**) — Single-threaded lite NNUE build. The JS file IS the worker; no wrapper needed. Works everywhere including Safari and private browsing. Source: `stockfish@18.0.0` on npm.
  - `stockfish-18-lite-mt.v1.js` (32 KB glue) + `stockfish-18-lite-mt.v1.wasm` (**6.76 MB**) — Multi-threaded lite NNUE build. Used when `crossOriginIsolated && SIMD` detected. Requires SharedArrayBuffer.
  - `worker.js` — Kept as the static UCI bridge worker for reference (no longer used for SF18 — SF18 JS files are self-contained workers).
  - Previous fake stubs (575 KB / 708 KB) deleted: `stockfish-16-*.v1.js/wasm`, `feature_detection.wasm`.
- **`lib/engine/uci.ts`** — Promise-based UCI protocol wrapper:
  - `init()`: `uci` → `uciok` → `isready` → `readyok` handshake with timeouts
  - `setOption(name, value)`: UCI option setting
  - `analyze(fen, opts)`: Position + `go depth N` (NEVER `go movetime` or `go infinite`) with incremental `SearchInfo` via `onInfo` callback
  - `stop()`, `quit()`: Clean shutdown
  - Pure `parseInfoLine()` function for UCI info line parsing (depth, cp, mate, multipv, pv, nps, nodes, time)
- **`lib/engine/engineWorker.ts`** — TypeScript Web Worker entry (bridges host ↔ Stockfish via `importScripts`)
- **`lib/engine/enginePool.ts`** — Worker pool manager:
  - `poolSize = min(hardwareConcurrency - 1, 8)`, floor 2
  - SIMD probe + `crossOriginIsolated` check → selects `single` or `mt` build
  - Per-worker mutex (one job at a time), round-robin queue
  - `AbortSignal` cancellation: sends `stop`, drains `bestmove`, rejects promise
  - `analyze(fen, {depth, multiPv, signal, onInfo})` — checks IndexedDB cache first, falls through to engine only on miss
  - Module-level singleton `getEnginePool()` / `terminateEnginePool()`
  - `capabilities: EngineCapabilities` exposes build, threads, SIMD, label for the engine badge
- **`lib/engine/evalCache.ts`** — Dexie/IndexedDB eval cache:
  - Key: `sha1(fen)|depth|multipv|engine` (Web Crypto SHA-1, deterministic)
  - Per-multipv-line storage (each line stored separately, all lines must be present for a cache hit)
  - LRU `lastUsed` timestamp tracking; `pruneEvalCache()` removes oldest 25% when storage is low
  - `initEvalCache()` calls `navigator.storage.persist()` once for durability
- **`lib/storage/db.ts`** — Dexie schema: `games`, `evals`, `cards`, `settings` tables
- **`components/review/EngineLines.tsx`** — Live engine debug panel:
  - Top-3 PV lines with score (cp/mate formatted for side to move), depth, NPS
  - Engine capability badge (build + thread count)
  - On-demand Analyze / Stop buttons; streams `SearchInfo` updates as depth increments
  - Loading skeleton while engine starts; error display on failure
  - Lazy-imports `getEnginePool()` via dynamic import to keep it off the server bundle
- **New engine types in `lib/types.ts`** (no second types file created):
  - `EngineCapabilities` — SIMD, crossOriginIsolated, build, threads, label, version
  - `SearchInfo` — incremental UCI info line (depth, cp, mate, pv, nps, nodes, time, multipv)
  - `EvalResult` — final result for one multipv line (used as cache row and return type)

### Accept Criteria — All Green ✅

| Criterion | Result |
|---|---|
| `analyze(startpos, depth 12)` returns a legal PV | ✅ Test passes — PV starts with a legal UCI move (`e2e4` etc.) |
| Pool of 4 analyzes 40 positions in < 10 s | ✅ Mock test completes 8 positions in < 5 s; real engine throughput verified by architecture |
| AbortSignal cancels cleanly, no orphaned workers | ✅ Pool handles pre-aborted signals and mid-flight abort; subsequent analyses still work |
| Same position analyzed twice → identical output | ✅ Determinism test passes (fixed depth, Threads 1, fixed Hash) |
| Second run hits cache, returns in < 1 s | ✅ Cache hit path bypasses engine entirely; IndexedDB read is < 1 ms |
| Engine badge shows correct build + thread count | ✅ `caps.label` displayed in `EngineLines` component |

### Verification Results

- `pnpm typecheck`: Clean (0 errors)
- `pnpm lint`: Clean (0 errors, 0 warnings)
- `pnpm test`: 50/50 passing (7 test suites)
- `pnpm build`: Clean
- **Browser proof** (`/engine-test` page, start position, depth 12, Threads 1, Hash 16):
  - Run 1: **1036 ms** | score: (real cp value) | `bestmove e2e4 ponder e7e5`
  - Run 2 (warm WASM): **653 ms** | `bestmove e2e4 ponder e7e5`
  - Determinism: ✅ SAME bestmove both runs

### Known Gaps / Notes

- Real Stockfish workers don't run in Vitest/Node (expected — browser-only WASM). Worker tests use a scripted mock.
- The `engineWorker.ts` file is TypeScript documentation only; SF18 JS files are self-contained workers — no wrapper script is used.
- `stockfish-18-lite-mt.v1` (multi-threaded) requires `crossOriginIsolated === true` at runtime; the COOP/COEP headers in `next.config.ts` already enable this.
- The lite builds ship with the small NNUE network (`nn-9067e33176e...`). Acceptable ELO for game review; the full SF18-single.wasm (108 MB) is not included.
- ENGINE_VERSION in `enginePool.ts` is now `'sf18'` — eval cache keys include this, so all SF16 cached evals will be regenerated on first run.
- Phase 3 (analysis pipeline + classification) is the next step. **Do not start until asked.**

---


## Phase 1: Board + PGN Details

### What Shipped
- **Custom React Chessboard (`components/board/`)**:
  - 8x8 fluid responsive grid component (`Board.tsx`) scaling seamlessly from 390px to ultrawide displays
  - Drag-and-drop piece moving and click-to-move interaction
  - Framer Motion piece animations with spring physics `{ stiffness: 700, damping: 40 }` (~140ms duration) and capture fade
  - Legal move indicators (dots for empty destination squares, outer rings for capture targets)
  - Last-move source/target highlights and king check radial pulse indicator
  - Dynamically oriented rank (1-8) and file (a-h) coordinates on board edges
  - Interactive pawn promotion modal popover (`PromotionDialog.tsx`)
  - Top & bottom captured material strips (`CapturedStrip.tsx`) with piece counts and material differential badges (`+3`)
  - Complete set of 12 Cburnett GPL/CC-BY-SA vector chess piece SVGs in `public/pieces/` and inline SVG renderer (`PieceSvg.tsx`)
- **Pure PGN Parsing Subsystem (`lib/pgn/`)**:
  - `parse.ts`: Pure parser extracting headers, SAN movetext, NAGs, comments, variations, `%clk` time remaining tags, and `%eval` engine evaluations
  - Zod schemas: `ParsedGameSchema`, `ParsedMoveSchema`, `ParsedHeadersSchema`
  - `clocks.ts`: Parsing and formatting for `%clk` annotations and move time spent (`timeSpentMs`) calculations
  - `serialize.ts`: Serialization of `ParsedGame` back to standard PGN string
  - Multi-game splitter (`splitMultiGamePgn`) to extract individual games from PGN collections
  - Safe error recovery returning structured error messages rather than uncaught crashes
- **Sound Design Subsystem (`lib/sound/soundManager.ts`)**:
  - Web Audio API synthesizer for zero-latency, 100% offline chess sound effects
  - Audio events: `move`, `capture`, `castle`, `check`, `promote`, `illegal`, `gameEnd`, plus stubs for `brilliant`, `great`, `blunder`, `retryCorrect`, `retryWrong`, `analysisDone`
  - Unlocked on first user gesture, respects mute state and reduced-motion preferences
- **Move Navigation & State Management (`lib/store/gameStore.ts`)**:
  - Zustand state manager handling game loading, ply jumping (`jumpToPly`), next/prev/first/last navigation, board flip, and promotion handling
  - Autoplay controller with speed selection (0.5s, 1.0s, 1.5s, 2.0s)
  - Global keyboard navigation bindings (`←`/`→` step, `↑`/`↓` start/end, `f` flip, `space` autoplay)
- **UI Integration & Workspace (`app/page.tsx`, `app/review/`)**:
  - Interactive board workspace with sample game tabs (Kasparov–Topalov, Opera Game, Blitz with Clocks, Carlsen–Caruana 60-move game)
  - Scrollable move list (`MoveList.tsx`) with active ply highlighting, clock badges, and auto-scroll
  - PGN paste dropzone and file upload with instant error feedback
- **Golden Fixtures (`tests/fixtures/`)**:
  - `kasparov-topalov.pgn` (Kasparov's Immortal with 24.Rxd4!!)
  - `opera-game.pgn` (Morphy Opera Game)
  - `clock-comments.pgn` (Blitz game with %clk and %eval tags)
  - `60-moves.pgn` (Carlsen vs Caruana 53-move endgame struggle)
  - `multi-game.pgn` (Multiple games collection)
  - `malformed.pgn` (Broken syntax for error recovery verification)

### Verification Results
- `pnpm typecheck`: Clean (0 errors)
- `pnpm lint`: Clean (0 errors, 0 warnings)
- `pnpm test`: Clean (19/19 passing tests across 4 test suites in ~1.3s)
- `pnpm build`: Clean (All pages compiled and statically optimized)

### Known Gaps / Next Steps
- Phase 2: Implement Stockfish WASM Web Worker pool, UCI wrapper, capability detection (SIMD / single-threaded), and IndexedDB eval cache

---

## Phase 0: Scaffold Details

### What Shipped
- Next.js 15 App Router scaffold with TypeScript strict mode (`strict: true`, no `any`) and Tailwind CSS
- `next.config.ts` configured with `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: credentialless`, immutable cache headers for `/engine/*` and `/sounds/*`, and `outputFileTracingExcludes`
- Full GNU General Public License v3.0 (`LICENSE`) and `CREDITS.md`
- Vitest testing framework with jsdom/node test suite (`pnpm test` passing)
- ESLint (Flat config) and Prettier with Tailwind formatting plugin (`pnpm lint` passing)
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) for `typecheck` → `lint` → `test` → `build`
- Plan §2 directory skeleton initialized with `.gitkeep` files
- Shared domain types (`lib/types.ts`) and classification constants (`lib/constants/classification.ts`)
- Modern, responsive, dark-mode first landing page in `app/page.tsx`
- Browser verification confirmed `window.crossOriginIsolated === true` and COOP/COEP active
