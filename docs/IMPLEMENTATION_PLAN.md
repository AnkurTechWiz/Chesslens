# PGN Game Review Platform — Implementation Plan
**Codename:** `openreview` (free, unlimited chess.com-style Game Review)
**Stack:** Next.js 15 (App Router) + TypeScript + Tailwind + Stockfish WASM (client-side) + IndexedDB/Dexie
**Zero-account:** no login, no signup, no user database. Nothing is ever sent to a server. Everything persists locally in the browser.
**Target:** Paste/upload a PGN → full annotated review: Brilliant/Great/Best/Excellent/Good/Book/Inaccuracy/Mistake/Miss/Blunder, accuracy %, eval bar, engine lines, arrows, sounds, animations, coach insights, estimated Elo, retry-the-move practice.
**Built with:** Google Antigravity (agentic IDE) — plan is phase-sliced so each phase = one agent task with hard acceptance criteria.

---

## 0. Core Product Decisions (read this first)

| Decision | Choice | Why |
|---|---|---|
| Where the engine runs | **Stockfish 17/18 WASM in the browser** (Web Worker pool). Server analysis only as an optional queue for "deep re-analyze" | Zero compute cost = the whole reason this app exists. Infinite free reviews. Scales to any traffic. |
| Board rendering | **Custom board component** (SVG/CSS grid + framer-motion), NOT a locked-down library | You need arrow overlays, highlight layers, classification badges pinned to squares, confetti, threat overlays. `react-chessboard` is fine for Phase 1 but plan to own it. |
| Rules/PGN | `chess.js` (v1.x) for legality, SAN/FEN, PGN parse | Battle-tested, tree-friendly. |
| Auth | **None. There is no login, anywhere, ever.** No accounts, no email, no OAuth, no sessions, no user table. | Friction kills the "I just want my free review" use case. Also: no auth bugs, no password resets, no PII, no GDPR surface, no session code to maintain. |
| Storage | **IndexedDB (Dexie), local to the browser.** Saved games, reports, eval cache, trainer cards and settings all live on-device. Manual `.json` **Export / Import backup** for moving between devices. | Persistence still works across visits — the data just belongs to the user's machine, not to you. |
| Backend / DB | **No database. No server state.** API routes exist only as *stateless* proxies (chess.com import, Lichess cloud-eval, tablebase, optional coach text). The app is fully usable with the network off after first load. | Nothing to host, nothing to breach, $0 running cost, deploys anywhere. |
| Legal | Import via **chess.com Public API** (`api.chess.com/pub/...`) and **Lichess API** — both public/allowed. **Do NOT** copy chess.com's icon SVGs, sounds, or CAPS branding. Ship your own icons + CC0/lichess sounds. Call it "Game Review" generically. | Avoid takedown. |

---

## 1. Feature Scope

### 1.1 Parity features (must-have)
1. PGN input: paste, `.pgn` file drop, multi-game PGN split, chess.com username import, Lichess username import, raw FEN + moves.
2. Two-pass analysis with live progress ("Analyzing move 14/78 · depth 16").
3. Per-move classification with icon + color:
   - Brilliant `!!` (teal), Great `!` (blue), Best (green), Excellent (green-light), Good (grey-green), Book (brown), Inaccuracy `?!` (yellow), Mistake `?` (orange), Miss (red-orange), Blunder `??` (red), Forced (grey).
4. Accuracy % per side + move-count breakdown table (like chess.com's summary column).
5. Vertical/horizontal **eval bar** that animates on every move.
6. **Eval graph** (area chart, white-above/black-below) with hoverable move scrubbing + classification dots.
7. Move list with SAN, badge icons, eval, click-to-jump, variation tree for user exploration.
8. Arrows: green = best move, blue = played (when good), red = blunder, orange = threat. Auto-drawn on the review board.
9. Coach panel per move: "You missed a fork on f7. Nxf7 wins a rook." + best-line preview with an animated PV playthrough button.
10. **Retry this move** — board unlocks, you play, engine replies, "Correct!"/"Still losing" feedback, unlimited branching, "back to game" button.
11. Sounds: move, capture, castle, check, promote, illegal, game-end + review-specific (brilliant chime, blunder thud, correct/incorrect in retry).
12. Animations: piece slide/ease, capture fade, check pulse on king, badge pop-in with spring, confetti burst on Brilliant, eval-bar spring.
13. Game summary card: opening name (ECO), accuracies, estimated Elo per side, key moments, biggest mistake, phase breakdown (opening/middlegame/endgame accuracy).
14. Keyboard: ←/→ move, ↑/↓ first/last, `f` flip, `space` autoplay, `e` toggle engine, `r` retry mode, `l` toggle arrows.
15. Board themes + piece sets, sound toggle, coach-voice toggle, dark mode.

### 1.2 Differentiators (your unfair advantages — chess.com charges for or lacks these)
16. **Unlimited, free, and account-free.** No login, no email, no daily cap, no "3 free reviews left". Paste a PGN and get the full review in one click — this is the headline.
17. **Depth slider (up to depth 22 / infinite-time-per-move)** — paid sites cap depth.
18. **Blunder Trainer with spaced repetition**: every Mistake/Miss/Blunder you ever made becomes a puzzle card; SRS scheduler (SM-2 lite) resurfaces your *own* mistakes. This is the killer retention loop.
19. **Pattern diagnosis engine**: aggregate across games → "You lose material to knight forks 3.1× more than average", "62% of your blunders happen on move 20-30", "Your endgame accuracy drops 11% in <5 min time controls".
20. **Time-pressure correlation**: PGN `%clk` comments → overlay time spent per move on the eval graph; flag "blundered with 8s left" vs "blundered with 4 minutes — thinking error, not time".
21. **Opening report per game + aggregate**: where you left theory (first non-book move), your win rate + accuracy by ECO, "your Sicilian Najdorf accuracy: 76%".
22. **Two-engine second opinion**: optional cloud-eval cross-check (Lichess cloud eval API) so classifications are validated, plus tablebase-exact endgame verdicts (Lichess tablebase API for ≤7 pieces) → "Mate in 12" instead of "+8.4".
23. **Shareable review**: OG-image generated summary card (`next/og`), permalink with encoded PGN (`?g=<lz-string>` so no DB needed), and **animated GIF/MP4 export** of a key moment with eval bar (ffmpeg.wasm).
24. **Batch review**: import last 20 games → dashboard of accuracy trend, mistake heatmap, rating estimate curve. Runs in background worker pool.
25. **PWA + fully offline**: engine + wasm cached in a service worker. Reviews work on a plane. Nobody else does this.
26. **Threat view** (`x` key): shows what the opponent is threatening *right now* — huge learning tool.
27. **Guess-the-move mode**: replay any game guessing the best/actual move, scored like a quiz.
28. **Natural-language coach (optional LLM)**: server route that turns the structured move data (FEN, played, best, PV, tags like `hanging_piece`, `missed_fork`) into a 2-sentence human explanation. Rule-based templates first, LLM as enhancement, cached by FEN so cost is near-zero.
29. **Accessibility**: full keyboard nav, ARIA live region announcing SAN + classification, colorblind-safe classification palette + distinct shapes.

---

## 2. Architecture

```
app/
  layout.tsx
  page.tsx                      # landing + PGN dropzone
  review/[id]/page.tsx          # review workspace (id = local uuid, or ?g= encoded PGN)
  library/page.tsx              # locally saved games (IndexedDB) + backup export/import
  dashboard/page.tsx            # multi-game insights, computed from local library
  trainer/page.tsx              # SRS blunder trainer (local deck)
  api/                          # ALL routes are stateless proxies - they store nothing
    import/chesscom/route.ts    # username -> games (server fetch, avoids CORS)
    import/lichess/route.ts
    cloudeval/route.ts          # proxy Lichess cloud eval (in-memory LRU only)
    tablebase/route.ts          # proxy Lichess tablebase (in-memory LRU only)
    coach/route.ts              # optional LLM explanation, stateless
    og/route.tsx                # share card, rendered from querystring
components/
  board/{Board,Square,Piece,ArrowLayer,HighlightLayer,PromotionDialog,BadgeLayer}.tsx
  review/{EvalBar,EvalGraph,MoveList,MoveBadge,CoachPanel,SummaryPanel,EngineLines,
          RetryPanel,KeyMoments,PhaseBreakdown,AnalysisProgress}.tsx
  ui/*                          # shadcn/ui
lib/
  engine/
    enginePool.ts               # N workers, job queue, cancellation
    uci.ts                      # UCI protocol wrapper (promise-based)
    engineWorker.ts             # worker entry, loads stockfish wasm
    evalCache.ts                # IndexedDB (Dexie) FEN+depth -> eval
  analysis/
    pipeline.ts                 # orchestrates 2-pass analysis, emits progress
    classify.ts                 # THE CORE: move classification
    winProb.ts                  # cp <-> win% <-> expected points
    accuracy.ts                 # per-move + game accuracy, ACPL, est. Elo
    sacrifice.ts                # SEE / hanging detection for Brilliant
    tactics.ts                  # motif tagging: fork, pin, skewer, mate-in-N missed
    openingBook.ts              # ECO/book detection
    phases.ts                   # opening/middlegame/endgame split
    keyMoments.ts
  pgn/{parse.ts,clocks.ts,serialize.ts}
  sound/{soundManager.ts}
  storage/
    db.ts                       # Dexie schema: games, evals, cards, settings
    backup.ts                   # export/import the whole local DB as .json
    quota.ts                    # navigator.storage.estimate + persist() request + LRU prune
  store/reviewStore.ts          # zustand: game, cursor, evals, mode
public/
  engine/stockfish-17-lite.{js,wasm}   # + single-threaded fallback
  sounds/*.mp3  pieces/*.svg  icons/classification/*.svg
```

### 2.1 Data flow
```
PGN text
  → parse (chess.js) → Move[] with FEN before/after, SAN, UCI, clock
  → Pass A: enginePool.analyze(fen, depth 12, multipv 3) for every ply   [fast, ~8s/game]
  → Pass B: re-analyze "interesting" plies (|Δwin%| > 4, or candidate brilliant/great) at depth 18-22
  → classify(prev, curr, alternatives, playerRating) → MoveReport[]
  → accuracy(), keyMoments(), phases(), tactics() → GameReport
  → render + (optional) persist
```

**Critical detail:** to classify move *n* you need the engine's evaluation of the position *before* move n with **MultiPV ≥ 2** (top move + second-best) and the eval of the position *after* move n. Reuse: eval-after(n) == eval-before(n+1), so one pass over all positions gives you both — you only need MultiPV on the before-positions. Always normalize eval to the **side to move at the before-position** then convert to "the mover's perspective".

---

## 3. The Classification Engine (the heart — get this right)

### 3.1 Win probability & expected points
```ts
// lib/analysis/winProb.ts
// Lichess-calibrated sigmoid. cp is from the perspective of the player we score.
export const winPercent = (cp: number): number =>
  50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamp(cp, -1000, 1000))) - 1);

export const mateWinPercent = (mateIn: number): number => (mateIn > 0 ? 100 : 0);

// Expected points 0..1 (chess.com's EP model operates in this space)
export const expectedPoints = (cp: number): number => winPercent(cp) / 100;
```
Handle mate scores explicitly: `#N` → EP 1.0 (for the winner) / 0.0. Handle a mate-to-cp downgrade as a full-magnitude swing.

### 3.2 Thresholds (chess.com Expected-Points model, documented values)
`epLoss = epBefore - epAfter` (mover's perspective, clamped ≥ 0):

| Classification | epLoss |
|---|---|
| Best | move == engine PV1 (or epLoss ≤ 0.005) |
| Excellent | ≤ 0.02 |
| Good | ≤ 0.05 |
| Inaccuracy | ≤ 0.10 |
| Mistake | ≤ 0.20 |
| Blunder | > 0.20 |

**Rating-adaptive leniency** (chess.com is more generous to lower-rated players):
```ts
const leniency = (rating = 1500) => clamp(1.6 - rating / 2500, 1.0, 1.6);
// thresholds scale: t * leniency  → a 900-rated player's 0.07 loss can still be "Good"
```

### 3.3 Special classifications (order of evaluation matters)
Run this cascade **top-down**, first match wins:

```
1. Forced      : legalMoves.length === 1
2. Book        : ply <= 20 && openingBook.contains(positionKey, move)  (mask any other label)
3. Brilliant   : isBrilliant(...)      // see 3.4
4. Great       : isGreat(...)          // see 3.5
5. Miss        : isMiss(...)           // see 3.6
6. EP-threshold cascade (Best/Excellent/Good/Inaccuracy/Mistake/Blunder)
```

### 3.4 Brilliant `!!` — conditions (all must hold)
1. The move is **best or near-best**: `epLoss <= 0.02`.
2. The move **sacrifices material**: after the move, a piece (value ≥ 3, i.e. not just a pawn) is *capturable at a static loss* — compute `SEE(square)` for every opponent capture; brilliant requires `min(SEE) <= -1.5` pawn units, OR the move itself is a capture that loses material by SEE, OR it leaves a hanging piece the opponent can win.
3. You are **not already completely winning without it**: `epBefore <= 0.97` (roughly eval before < +600cp) — otherwise it's just "Best".
4. You are **not losing after it**: `epAfter >= 0.50` (chess.com: "you shouldn't be in a worse position after the move"). Practically: `winPercentAfter >= 50`.
5. The sacrifice is **not trivially forced/obvious**: at least one non-sacrificial alternative existed that keeps you fine (`secondBest.ep >= 0.5`), i.e. you *chose* the sac.
6. Leniency: for rating < 1200, relax (2) to allow pawn sacs with SEE ≤ -1.0.
> Confetti + special sound fire only here. Keep it rare — ~1 per 30 games feels right.

```ts
// lib/analysis/sacrifice.ts — implement SEE (static exchange evaluation)
export function see(board: Chess, toSquare: Square, side: Color): number
export function hangingMaterialAfter(fenAfter: string, mover: Color): number
```

### 3.5 Great Move `!` — conditions
Either:
- **Only-move**: `epLoss <= 0.02` **and** the second-best move is much worse: `ep(best) - ep(secondBest) >= 0.10` (i.e. you found the *only* move that holds), **or**
- **Game-turning**: the move flips the assessment across a critical boundary — `epBefore < 0.5 && epAfter >= 0.5` (saved a lost position) or `epBefore < 0.75 && epAfter >= 0.9` while `epLoss <= 0.02`, **or**
- **Punished a blunder**: previous opponent move was Mistake/Blunder and this move is best and converts the gift (`epAfter - epBefore >= 0.15`).
- Requires MultiPV ≥ 2 and *deep* verification (re-run at depth 20 before awarding). Never award Great from the shallow pass.

### 3.6 Miss — conditions
Opponent handed you something and you didn't take it:
- `prevMove.classification ∈ {Mistake, Blunder}` **or** a mate/decisive win was available: `ep(best) >= 0.90 || bestIsMate`
- and your move dropped it: `epAfter < 0.75` (or mate no longer available) with `epLoss >= 0.10 * leniency`.
- Special sub-tag `missed_mate` when `bestIsMate && !playedIsMate` → coach text: "Mate in 3 was available: Qh7+!".
- Miss **overrides** Inaccuracy/Mistake in display but keeps the underlying epLoss for accuracy math.

### 3.7 Accuracy, ACPL, estimated Elo
```ts
// Per-move accuracy (Lichess formula), on win% scale (0..100)
const moveAccuracy = (wpBefore: number, wpAfter: number) =>
  clamp(103.1668 * Math.exp(-0.04354 * (wpBefore - wpAfter)) - 3.1669, 0, 100);

// Game accuracy = mean( volatilityWeightedMean(moveAccuracies), harmonicMean(moveAccuracies) )
//   volatility = stdev of win% in a sliding window of ~ceil(len/10) clamped [2,8]
```
Also compute:
- **ACPL** (average centipawn loss, capped per-move at 1000) — the classic metric, shown alongside accuracy.
- **Estimated Elo** per side: fit a monotone map from `(accuracy, acpl, moveCount, phaseAccuracies)`. Start with a documented approximation `elo ≈ 3200 * exp(-acpl/95) ... ` → **calibrate empirically**: batch-analyze ~2k rated games from the Lichess DB, fit a ridge regression `rating ~ f(accuracy, log(acpl), blunderRate, missRate, moveCount)`, ship the coefficients as a JSON constant. Label it "Estimated (±150)".
- **Phase accuracy**: opening = until first non-book ply +2, endgame = when total non-pawn material ≤ 13 or ≤ 6 pieces; middlegame = rest.

### 3.8 Tactic/motif tagging (drives good coach text)
For each Mistake/Miss/Blunder, detect *why* via light heuristics on the best PV:
`hanging_piece`, `fork` (knight/queen/pawn attacking 2+ valuables after PV1), `pin`, `skewer`, `discovered_attack`, `back_rank`, `overloaded_defender`, `trapped_piece`, `missed_mate`, `allowed_mate`, `lost_castling_safety`, `pawn_structure_damage`, `traded_into_bad_endgame`, `time_pressure` (from `%clk`).
Template library maps `(classification, motif, phase)` → sentence. LLM route only rewrites/enriches; never blocks rendering.

### 3.9 Determinism warning
Same PGN must give the same review. Fix: **fixed depth, not fixed time** (`go depth N`), `Threads 1` per worker, fixed `Hash`, and cache by `(fen, depth, multipv, engineVersion)`. Never use `go movetime` for classification.

---

## 4. Engine Layer (performance is the product)

### 4.1 Worker pool
```ts
// lib/engine/enginePool.ts
export class EnginePool {
  constructor(size = Math.min(navigator.hardwareConcurrency - 1 || 2, 8)) {}
  analyze(fen: string, opts: {depth: number; multiPv: number; signal?: AbortSignal}): Promise<EvalResult>
  // internal: round-robin queue, per-worker UCI mutex, isready handshake, abort => 'stop'
}
```
- Ship **stockfish-17/18-lite single-threaded** as the per-worker engine, and run **N workers in parallel over different positions**. This is far simpler and faster for whole-game analysis than one multi-threaded engine, and avoids SharedArrayBuffer entirely for the default path.
- Optional "max strength" mode uses the multi-threaded build → then you need headers:
```ts
// next.config.ts
headers: async () => [{ source: '/(.*)', headers: [
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' }, // 'require-corp' breaks 3p embeds
]}]
```
- Feature-detect: `WebAssembly.validate(SIMD probe)` + `crossOriginIsolated` → choose lite-mt / lite-single / asm.js fallback. Show a badge: "Engine: SF17 · SIMD · 6 threads".

### 4.2 Two-pass budget
| Pass | Depth | MultiPV | Positions | Target time (M-class laptop, 6 workers) |
|---|---|---|---|---|
| A (scan) | 12 | 2 | all plies (~80) | 6–10 s |
| B (verify) | 20 | 3 | interesting only (~12) | 6–12 s |
| C (on-demand) | 24+/infinite | 4 | the position you're staring at | streams live |
- Emit progress via a `ReadableStream`/zustand tick so the UI shows a real progress bar and the user can start reviewing move 1 while later moves are still crunching (**stream results in order**).
- Mobile: detect low core count / `deviceMemory` → depth 10/16, warn "Reduced depth on mobile".

### 4.3 Caching (all local — no server cache, because there's no database)
1. **IndexedDB (Dexie)**: `evals` table keyed `sha1(fen)|depth|multipv|engine`. Makes re-review instant and fully offline. LRU-prune to a configurable cap (default 200 MB) via `quota.ts`; request `navigator.storage.persist()` so the browser doesn't evict it.
2. **Bundled opening eval pack**: precompute evals for the ~20k most common book positions at build time and ship them as a lazy-loaded, compressed static JSON. This replaces the shared server cache — every user gets instant opening analysis with zero backend.
3. **Lichess cloud eval** (optional, via the stateless proxy) for popular non-book positions — one fetch replaces dozens of local evals. Degrades silently when offline.
4. **Tablebase** for ≤7 pieces: exact DTZ/DTM overrides the engine → endgame classification becomes *correct*, not approximate ("Blunder — threw away a won KRP vs KR"). Also degrades silently offline.

---

## 5. UI/UX Spec

### 5.1 Review workspace layout
```
┌───────────────────────────────────────────────────────────────┐
│  header: game title, players+ratings, result, date, depth badge│
├──────┬───────────────────────────────┬────────────────────────┤
│ eval │        BOARD (fluid)          │  SUMMARY / MOVE LIST   │
│ bar  │  arrows, badges, coords       │  tabs: Report | Moves  │
│      │  captured-material strip      │  accuracies, counts    │
├──────┴───────────────────────────────┤  key moments           │
│  EVAL GRAPH (hover-scrub, dots)      │  engine lines (top 3)  │
├──────────────────────────────────────┤  coach card + Retry    │
│  controls: ⏮ ◀ ▶ ⏭ flip ▶auto speed  │                        │
└──────────────────────────────────────┴────────────────────────┘
```
Responsive: single column < 900px (board first, tabs below, eval bar horizontal above board).

### 5.2 Move badge rules
- Badge renders on the **destination square** (top-right corner, 26px) and inline in the move list.
- Colors: Brilliant `#26c2a3`, Great `#5c8bb0`, Best `#95bb4a`, Excellent `#96bc4b`, Good `#96af8b`, Book `#a88865`, Inaccuracy `#f7c631`, Mistake `#ffa459`, Miss `#ee6b55`, Blunder `#fa412d`, Forced `#9e9e9e`. (Your own SVG shapes — distinct silhouettes for colorblind users.)
- Only ONE badge per move; Book suppresses everything else.

### 5.3 Sound design
`lib/sound/soundManager.ts` — Web Audio with a preloaded sprite, respects `prefers-reduced-motion`/mute, unlocked on first user gesture.
Events: `move`, `capture`, `castle`, `check`, `promote`, `illegal`, `gameEnd`, `brilliant`, `great`, `blunder`, `retryCorrect`, `retryWrong`, `analysisDone`. Use **lichess CC0 sound sets** (attribute) or synthesize. Never ship chess.com audio.

### 5.4 Animation spec (framer-motion)
- Piece move: `layoutId` per piece, spring `{stiffness: 700, damping: 40}`, 140ms; capture = scale 0.6 + fade 90ms.
- Badge: pop with `scale [0, 1.25, 1]`, 220ms, slight rotate.
- Eval bar: spring on height with a 300ms color crossfade; flash red/green on the swing direction.
- Brilliant: `canvas-confetti` burst from the destination square + chime.
- Arrow draw-on: SVG `stroke-dashoffset` animation 180ms.
- Eval graph: animate the newly-analyzed segment in as results stream.
- Respect `prefers-reduced-motion`: cut to instant transitions.

### 5.5 Retry mode
Enter on Mistake/Miss/Blunder (auto-suggested via a "Try again" CTA in the coach card).
- Board resets to the before-FEN, side = you, engine plays best replies at your chosen strength.
- Verdict on your move: `epLoss <= 0.02` → "Correct! That's the move." | improvement over what you played → "Better than the game, but still not best" | else "Still losing — try again". Sound + shake.
- Free exploration tree with breadcrumbs; "Show me the answer" plays the PV with animation and voiceover text.
- Track attempts → feeds the SRS trainer.

---

## 6. Data Model (local only — Dexie/IndexedDB)

No Prisma, no Postgres, no user model. The entire "backend" is this schema in the user's browser.

```ts
// lib/storage/db.ts
import Dexie, { type Table } from 'dexie';

export interface SavedGame {          // a reviewed game the user chose to keep
  id: string;                         // uuid (local)
  pgn: string;
  white: string; black: string; whiteElo?: number; blackElo?: number;
  result: string; eco?: string; opening?: string; timeControl?: string;
  playedAt?: number; source: 'paste'|'file'|'chesscom'|'lichess';
  report: GameReport;                 // full computed review
  engineVersion: string; depth: number;
  createdAt: number;
}

export interface CachedEval {
  key: string;                        // sha1(fen)|depth|multipv|engine
  fen: string; cp: number|null; mate: number|null;
  pv: string[]; depth: number; multipv: number; engine: string;
  lastUsed: number;                   // for LRU pruning
}

export interface TrainerCard {        // SRS deck built from your own blunders
  id: string; gameId?: string;
  fen: string; solutionUci: string; pv: string[];
  motifs: string[]; classification: Classification;
  ease: number;                       // 2.5 default (SM-2 lite)
  interval: number; reps: number;
  dueAt: number; lastResult?: 'again'|'hard'|'good'|'easy';
  createdAt: number;
}

export interface Setting { key: string; value: unknown }   // theme, sounds, depth, pieces...

class ReviewDB extends Dexie {
  games!: Table<SavedGame, string>;
  evals!: Table<CachedEval, string>;
  cards!: Table<TrainerCard, string>;
  settings!: Table<Setting, string>;
  constructor() {
    super('openreview');
    this.version(1).stores({
      games:    'id, playedAt, createdAt, white, black, eco',
      evals:    'key, lastUsed',
      cards:    'id, dueAt, gameId, classification',
      settings: 'key',
    });
  }
}
export const db = new ReviewDB();
```

**Backup / device transfer** (`lib/storage/backup.ts`) — replaces what an account would have done:
- `exportBackup()` → downloads `openreview-backup-YYYY-MM-DD.json` containing `games` + `cards` + `settings` (evals excluded, they regenerate).
- `importBackup(file)` → merges by id, never duplicates, shows a diff summary before committing.
- Prompt the user to export after every 10 saved games, and on the library page if a backup is >30 days old.

**Sharing without a server:** a review link is `/review?g=<lz-string-compressed PGN>&d=<depth>`. The recipient's browser re-analyzes locally (or reads its own cache). Long PGNs stay well under URL limits after compression. No shortener, no storage, links never expire.

Shared types in `lib/types.ts`:
```ts
type Classification = 'brilliant'|'great'|'best'|'excellent'|'good'|'book'|'inaccuracy'|'mistake'|'miss'|'blunder'|'forced';
interface MoveReport { ply:number; san:string; uci:string; fenBefore:string; fenAfter:string;
  cpBefore:number|null; mateBefore:number|null; cpAfter:number|null; mateAfter:number|null;
  winBefore:number; winAfter:number; epLoss:number; classification:Classification;
  best:{uci:string;san:string;cp:number|null;mate:number|null;pv:string[]};
  alt?:{uci:string;san:string;cp:number|null}; motifs:string[]; accuracy:number;
  clockMs?:number; timeSpentMs?:number; comment?:string; depth:number }
interface GameReport { moves:MoveReport[]; accuracy:{white:number;black:number};
  acpl:{white:number;black:number}; counts:Record<Classification,{white:number;black:number}>;
  estElo:{white:number;black:number}; phases:{...}; keyMoments:number[]; opening:{eco:string;name:string;bookPlies:number} }
```

---

## 7. Phased Roadmap (feed one phase at a time to Antigravity)

### Phase 0 — Scaffold (0.5 day)
`create-next-app` TS/Tailwind/App Router, shadcn/ui, zustand, chess.js, dexie, framer-motion, vitest, eslint/prettier, `next.config.ts` with COOP/COEP + wasm asset headers, CI (typecheck+test+build).
**Accept:** `pnpm build` clean; `/` renders; `crossOriginIsolated === true` in console.

### Phase 1 — Board + PGN (1 day)
Custom board (drag+click move, legal highlights, coords, flip, promotion dialog, captured strip), PGN parser incl. `%clk`/`%eval` comments and multi-game split, move navigator + keyboard, sounds, animations.
**Accept:** paste a 60-move PGN, arrow through it with sound+animation, flip, no console errors; malformed PGN shows a friendly error.

### Phase 2 — Engine layer (1–1.5 days)
`public/engine` assets, worker + UCI wrapper, `EnginePool`, capability detection & fallbacks, IndexedDB cache, `EngineLines` panel with live depth/nps/PV streaming.
**Accept:** unit test — `analyze(startpos, depth 12)` returns a legal PV; pool of 4 analyzes 40 positions in <10 s; kill-switch aborts cleanly; second run of the same game hits cache and finishes in <1 s.

### Phase 3 — Analysis pipeline + classification (2 days) ← **the crown jewel**
`winProb`, `accuracy`, `see`/`sacrifice`, `openingBook` (bundle a compact ECO/book JSON, ~2–3 MB gzipped, lazy-loaded), `classify` cascade, `pipeline` two-pass with streaming progress, `phases`, `keyMoments`, `tactics`.
**Accept (golden fixtures — write these tests first):**
- Morphy "Opera Game" → `Bxf7+`/`Nxb5`-style sacs classified Brilliant; final mate sequence Best/Forced.
- Kasparov–Topalov 1999 `24.Rxd4!!` → **Brilliant**.
- A position with exactly one saving move → **Great**.
- Opponent blunders a queen, you don't take → **Miss** with `missed_mate`/`hanging_piece` motif.
- Opening moves 1–8 of a mainline Italian → **Book**.
- Deterministic: run pipeline twice → byte-identical report.
- Accuracy of a known Lichess-analyzed game within ±3% of Lichess's number.

### Phase 4 — Review UI (1.5 days)
EvalBar, EvalGraph (recharts or hand-rolled SVG for hover precision), MoveList with badges, SummaryPanel (accuracy, counts, est. Elo, phase bars), CoachPanel with templates, ArrowLayer/BadgeLayer wiring, AnalysisProgress, share link (lz-string encoded PGN in URL) + `next/og` card.
**Accept:** full review of a real chess.com PGN renders in <15 s with progressive results; every move has a badge and coach sentence; share link opens the same review on another device with no DB.

### Phase 5 — Retry + Trainer + imports + local library (1.5 days)
Retry mode with verdicts; chess.com/lichess username import (stateless proxy routes, pagination + rate-limit backoff); batch review queue; local **Library** page backed by Dexie; dashboard trends computed from the local library; SRS trainer (SM-2 lite); backup export/import; storage-quota handling.
**Accept:** import last 10 games of a real username, review all in the background, dashboard shows the accuracy trend; a blunder becomes a trainer card that reappears when due; **close the tab, reopen — library, trainer deck and settings are all still there**; export a backup, wipe site data, re-import, everything returns; **there is no login button anywhere in the app.**

### Phase 6 — Polish (1 day)
PWA/service worker precaching engine, themes/piece sets, settings persistence, a11y pass (axe clean, ARIA live SAN announcements), i18n scaffold, GIF export, tablebase + cloud-eval integration, error boundaries + Sentry, rate limiting on API routes, empty/loading/error states, landing page with a demo game preloaded.
**Accept:** Lighthouse ≥ 95 perf/a11y on `/`; works offline after one visit; mobile 390px layout usable.

### Phase 7 — Ship it (2 hours)
Deploy to Vercel per **Section 11**, wire the custom domain, run the post-deploy verification checklist.
**Accept:** public URL reviews a real PGN correctly on desktop and mobile, works offline after first visit, and every box in 11.6 is ticked.

---

## 8. Antigravity Working Method

1. **Repo rules file** (`AGENTS.md` at root) — paste this so every agent task stays consistent:
   - TypeScript strict, no `any`. Zod-validate all API input.
   - Pure functions in `lib/analysis/*` — **no React imports, no I/O**, so they're unit-testable.
   - Every analysis function ships with a vitest file. Fixtures in `tests/fixtures/*.pgn`.
   - Never call the engine from a React component — only through `EnginePool` via the store.
   - No chess.com assets/sounds/branding. Icons and sounds must be original or CC0-attributed.
   - Fixed-depth analysis only (determinism). Cache key must include engine version.
   - **No auth, no user model, no server persistence.** Never add Prisma, a database, sessions, cookies, or a sign-in flow. If a feature needs to remember something, it goes in Dexie/IndexedDB under `lib/storage`.
   - API routes must be **stateless proxies only** — they may fetch and transform, never store.
   - Never run Stockfish inside a serverless function or API route. The engine is client-side only.
2. **Task granularity**: one phase per Antigravity task, with the Accept criteria pasted in as the definition of done. Ask it to write tests *before* implementation for Phase 3.
3. **Verification commands** in each task: `pnpm typecheck && pnpm test && pnpm build`, plus "open /review with `tests/fixtures/kasparov-topalov.pgn` and screenshot the move-24 badge" (Antigravity's browser tooling can verify visually).
4. **Order matters**: 2 → 3 must be done and green before 4, or you'll debug UI against a wrong engine.
5. Keep a `PROGRESS.md` the agent updates each phase (what's done, known gaps, next).

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Classification "feels wrong" vs chess.com | Golden-fixture test suite + a debug overlay (`?debug=1`) showing epBefore/epAfter/epLoss/SEE/second-best for each move. Tune leniency constants, not the cascade. |
| Slow on mobile / low-end | Adaptive depth, single-threaded fallback, server "deep analyze" queue as opt-in, clear engine badge. |
| WASM 7 MB download | Cache-first service worker, `Cache-Control: immutable`, preload on landing-page hover, show a one-time "downloading engine (7 MB, cached forever)". |
| COEP breaks embeds/ads | Use `credentialless`; keep the default path single-threaded so isolation is optional. |
| Brilliant spam (feels cheap) | Require deep-pass verification + all 6 conditions; assert in tests that a normal club game yields ≤1 Brilliant. |
| Estimated Elo inaccuracy | Calibrate on the Lichess games DB, always show ±range, never call it a rating. |
| Legal / brand | Public APIs only, original assets, no "chess.com" in product name or marketing copy beyond factual comparison. |
| **User clears browser data → library gone** | Loudest tradeoff of the no-account design. Mitigate: `navigator.storage.persist()`, periodic "export backup" nudge, one-click JSON backup/restore, and share links that carry the PGN in the URL so a review is never trapped in one browser. State it plainly in the UI: "Your games are stored on this device only." |
| Private/incognito mode has no persistent IndexedDB | Detect and warn once: reviews still work, saving won't survive the session. |
| Cost | Client-side engine = $0 compute, no database = $0 storage. Only the optional LLM coach costs anything, and it's opt-in. A free Vercel/Cloudflare tier covers essentially unlimited traffic. |

---

## 10. Stretch ideas (post-launch, ranked by leverage)
1. Live game review browser extension overlay for lichess/chess.com boards.
2. "Coach voice" TTS narration of the review as an auto-playing recap video.
3. Opening prep generator: from your losses, build a repertoire drill deck.
4. Head-to-head review: compare your accuracy vs your opponent's per phase.
5. Multiplayer "review room" (shared cursor over a game) via a lightweight WS — *the only idea here that would require server state; keep it a separate opt-in service so the core app stays accountless.*
6. Public API: `POST /api/review` returning the JSON report (self-serve, rate-limited).
7. Tournament/PGN-database mode: analyze a 100-game PGN overnight in a background tab.

---

## 11. Deployment (Vercel) — Phase 7, ~2 hours

Yes. This app is close to the ideal Vercel workload: no database to provision, no auth secrets, no long-running jobs, no background workers. The heavy compute (Stockfish) runs on the visitor's CPU, so your server does almost nothing.

### 11.1 What actually gets deployed
| Piece | Where it runs on Vercel | Notes |
|---|---|---|
| Pages / React app | Static + SSR on the Edge/Node runtime | Default `next build`, no config |
| `public/engine/*.wasm`, `*.js` | Static CDN | ~7 MB, served once per user then cached forever |
| `api/import/*`, `api/cloudeval`, `api/tablebase`, `api/coach` | Serverless functions | Stateless, sub-second, tiny |
| `api/og` | Edge runtime (`export const runtime = 'edge'`) | Required by `next/og` |
| Everything user-owned (library, trainer, cache) | The visitor's browser | Never touches Vercel |

### 11.2 Required config
```ts
// next.config.ts
const nextConfig = {
  async headers() {
    return [
      { source: '/(.*)', headers: [
        { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin' },
        { key: 'Cross-Origin-Embedder-Policy', value: 'credentialless' },
      ]},
      // versioned engine filenames -> cache forever
      { source: '/engine/:path*', headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ]},
      { source: '/sounds/:path*', headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ]},
    ];
  },
  // keep the wasm out of the serverless bundle - it's a static asset, not a dependency
  outputFileTracingExcludes: { '*': ['./public/engine/**'] },
};
export default nextConfig;
```
- Node 20+ in Project Settings → build defaults are fine otherwise.
- **No environment variables required.** Only `OPENAI_API_KEY` (or similar) *if* you enable the optional LLM coach — and the app must degrade to template comments when it's absent.
- Vercel serves `.wasm` with `application/wasm` automatically, so `WebAssembly.instantiateStreaming` works.

### 11.3 Deploy steps
1. Push the repo to GitHub (Antigravity can do this at the end of Phase 6).
2. vercel.com → **Add New → Project → Import** the repo. Framework auto-detects Next.js. Click Deploy.
3. Add a custom domain (free, automatic HTTPS).
4. Turn on Vercel Analytics (free tier) to watch real-world analysis times.
5. Every PR gets a **preview deployment** — pair this with the phase workflow so you can click through each phase's result on a real URL before merging.

### 11.4 Free-tier reality check (Hobby plan)
- **Bandwidth: 100 GB/month.** The engine is the only heavy asset: 100 GB ÷ 7 MB ≈ **~14,000 first-time visitors/month**. Returning visitors cost ~nothing (immutable CDN cache + service-worker precache).
- **Function invocations**: only import/cloud-eval/tablebase proxies hit them, and all three are optional. You will not get close to the limits.
- **Hobby is non-commercial.** If you add ads, donations or anything paid, you need Pro ($20/mo).

**If bandwidth becomes the bottleneck (good problem):**
- Host `engine/*` on **Cloudflare R2 + Workers** or **jsDelivr** and load it cross-origin — R2 has zero egress fees, and it drops your Vercel bandwidth by ~95%.
- Or deploy the whole app to **Cloudflare Pages**, which has *unlimited* free bandwidth and supports Next.js via OpenNext. Given a 7 MB static payload, this is the better long-term home. Vercel is the fastest way to ship; Cloudflare is the cheapest way to scale.
- Ship the **lite** Stockfish build as the default and only fetch the large build when the user explicitly picks "max strength".

### 11.5 Gotchas to handle before you deploy
1. **Safari + `credentialless`**: not supported → `crossOriginIsolated` is false → multi-threaded WASM won't load. Your capability detection must silently fall back to the single-threaded pool. Test on a real iPhone.
2. **COEP breaks cross-origin embeds** (YouTube, some fonts, external images). Self-host fonts (`next/font`) and keep third-party embeds out, or the page will show blank frames.
3. **Service worker + immutable caching**: version the engine filenames (`stockfish-17-lite.v1.wasm`). A stale SW serving an old engine while the cache key says a new version will silently break determinism.
4. **`api/og` must be Edge runtime**, and can't read from a DB (there isn't one) — build the card entirely from querystring params.
5. **Don't let a serverless function try to run Stockfish.** If someone adds a "server analyze" route later it will blow the function timeout. The AGENTS.md rule should forbid it.
6. **Static-export option**: if you drop the chess.com import proxy (Lichess's API sends permissive CORS headers, chess.com's is less reliable — verify before relying on it), the entire app can build with `output: 'export'` and deploy as pure static files anywhere, including GitHub Pages. Worth keeping as a fallback, not the default.

### 11.6 Post-deploy verification checklist
- [ ] Console: `crossOriginIsolated` reports the expected value; engine badge shows the right build/thread count.
- [ ] Network tab: `stockfish-*.wasm` returns `content-type: application/wasm` and `cache-control: immutable`; second load is a cache hit, not a re-download.
- [ ] Full review of a 60-move PGN completes on the deployed URL within the Phase 4 time budget (test on mobile data, not just wifi).
- [ ] Load the site once, go offline (DevTools → Offline), reload → review still works end-to-end.
- [ ] Share link opens on a different device and reproduces an identical report (determinism check in production).
- [ ] Lighthouse on `/`: performance and accessibility ≥ 95.
- [ ] iOS Safari and Android Chrome both complete a review without falling back to asm.js.
- [ ] No login button exists anywhere. :)

---

---

## 12. Zero-Cost Guarantee (₹0 to build, ₹0 to run)

**Hard requirement: this project must cost nothing — no subscriptions, no credit card, no paid API keys, ever.** Everything below is free tier or free software. Any task that would introduce a cost must be rejected or replaced.

### 12.1 Full cost audit

| Item | Choice | Cost |
|---|---|---|
| IDE / agent | Antigravity (free tier) | ₹0 — has daily rate limits; if you hit them, wait for reset or continue in VS Code + Copilot free tier |
| Framework | Next.js, React, TypeScript | ₹0 (MIT) |
| Engine | Stockfish WASM (`stockfish.js`) | ₹0 (GPLv3 — see 12.3) |
| Chess rules | `chess.js` | ₹0 (BSD-2) |
| Storage | Dexie / IndexedDB (user's browser) | ₹0 |
| State | zustand | ₹0 (MIT) |
| UI | Tailwind + shadcn/ui + Lucide icons | ₹0 (MIT / ISC) |
| Animation | framer-motion, canvas-confetti | ₹0 (MIT) |
| Fonts | Google Fonts self-hosted via `next/font` | ₹0 |
| Piece sets | Cburnett / Maestro style (GPL/CC-BY-SA) or self-drawn SVG | ₹0 |
| Sounds | Lichess CC0 sound packs, or synthesize with Web Audio | ₹0 |
| Opening book / ECO | Public ECO datasets, Lichess opening database | ₹0 |
| Elo calibration data | Lichess Open Database monthly dump (free download, CC0) | ₹0 |
| Cloud eval | Lichess cloud-eval API — no key, no account | ₹0 |
| Tablebase | Lichess tablebase API — no key, no account | ₹0 |
| Game import | chess.com Public API + Lichess API — no keys | ₹0 |
| Hosting | Vercel Hobby **or** Cloudflare Pages | ₹0 |
| Domain | Free `*.vercel.app` / `*.pages.dev` subdomain | ₹0 |
| Database | None exists | ₹0 |
| Repo + CI | GitHub free (public repo = unlimited Actions minutes) | ₹0 |
| Error tracking | Sentry free tier (5k events/mo) — or skip entirely and use an in-app error boundary | ₹0 |
| Analytics | Vercel/Cloudflare built-in free analytics | ₹0 |
| **Total** | | **₹0 / month** |

### 12.2 The only two things that could ever cost money — and how to avoid both

1. **Custom domain (~₹700–1,200/year).** Purely cosmetic. **Ship on the free `*.vercel.app` or `*.pages.dev` subdomain.** Buy a domain later only if the project takes off. Nothing in the codebase should assume a custom domain.
2. **LLM coach (usage-priced).** **Do not enable it.** The rule-based template system in `lib/analysis/tactics.ts` produces the coach text for free and works offline. Build `api/coach` as an optional stub that is **disabled by default** and returns templates when no key is present. If you ever want it, Google's Gemini API free tier covers this use case at ₹0 — but the app must never require it.

> Also note: Vercel's Hobby plan is **non-commercial only**. Since v1 has no ads, donations, or payments (PRD §4), you are compliant. The moment you monetize, you must move to Cloudflare Pages (free, no commercial restriction) or pay for Vercel Pro. Keeping the app free keeps the hosting free — the incentives line up.

### 12.3 Licensing consequence — read this, it's not optional

**Stockfish is GPLv3.** Serving `stockfish.wasm` to a browser counts as distribution, which means:
- **This repo must be licensed GPLv3** (add `LICENSE` at root in Phase 0).
- Source must be publicly available — a **public GitHub repo satisfies this**, and public repos also get unlimited free CI minutes. Free requirement and license requirement point the same way.
- Every dependency must be GPL-compatible. MIT / BSD / Apache-2.0 / ISC / CC0 are all fine. **Never add a dependency with a proprietary, "source-available", or commercial-use-restricted license.**
- Credit Stockfish and the sound/piece-set authors in `CREDITS.md` and in an in-app About section.

### 12.4 Free-tier limits to stay inside

| Limit | Value | Practical meaning |
|---|---|---|
| Vercel Hobby bandwidth | 100 GB/mo | ~14,000 first-time visitors (7 MB engine each); returning visitors ≈ free |
| Vercel Hobby function invocations | 100k–1M/mo | Only optional proxies use these — effectively unreachable |
| Cloudflare Pages bandwidth | **Unlimited** | The escape hatch if Vercel bandwidth ever runs out |
| GitHub Actions (public repo) | Unlimited | CI is free forever |
| Lichess API | Be polite: ~1 req/sec, sequential | Batch imports must throttle and back off, never hammer |
| Antigravity free tier | Daily request cap | Work one phase per session; phases are sized to fit |

**Bandwidth-saving moves (all free):** ship the ~7 MB *lite* Stockfish build as default, `Cache-Control: immutable` on `/engine/*`, service-worker precache so each user downloads once ever, and if you ever get real traffic, serve the WASM from **jsDelivr** (free CDN for public GitHub repos) instead of your own host — that alone removes ~95% of your bandwidth.
