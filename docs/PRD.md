# PRD — openreview

**Product:** Free, account-free chess game review
**Owner:** Aayush Sahu · **Date:** 14 Aug 2026 · **Status:** Approved for build
**Related:** `docs/IMPLEMENTATION_PLAN.md` (how) · `AGENTS.md` (rules)

---

## 1. Problem

Reviewing your own games is the single highest-leverage way to improve at chess. Every major platform puts it behind a paywall — chess.com allows one free Game Review per day, then charges ~$5–14/month. The engine analysis itself is a solved, open problem (Stockfish is free and runs fine in a browser); what's paywalled is really just the presentation layer.

Meanwhile the free alternatives fail on experience: Lichess analysis is excellent but sparse and unfriendly to beginners; standalone engines give you a raw centipawn number with no explanation of *what you did wrong or why*.

**The gap:** nobody offers chess.com-quality review UX — move classifications, accuracy, eval bar, coaching, sacrifice recognition — for free, unlimited, with no account.

## 2. Goal

Paste a PGN, get a complete, chess.com-quality game review in under 15 seconds. Free, unlimited, no login, works offline.

**Strategy:** run Stockfish in the user's browser instead of on a server. Compute cost drops to zero, which makes "unlimited and free" structurally sustainable rather than a loss-leader we later have to paywall.

## 3. Users

| User | Job to be done |
|---|---|
| **Primary — improving club player (800–1800)** | "I lost that game and I don't know why. Show me my mistakes and what I should have played." |
| Casual player | "Did I actually play a brilliant move there?" |
| Coach / streamer | "Review a student's 10 recent games without paying per seat." |
| Privacy-minded player | "Analyze my games without creating yet another account." |

## 4. Non-goals (v1)

Not building: online play, puzzles-as-a-product, engine vs engine, tournament management, mobile native apps, social features/comments, video lessons, a rating system, or accounts and cloud sync. **Explicitly declining monetization for v1** — no ads, no tiers, no "3 free reviews left".

## 5. Success metrics

| Metric | Target (90 days post-launch) |
|---|---|
| Reviews completed | 10,000 |
| Median time-to-first-review (paste → rendered) | < 20 s |
| Review completion rate (started → viewed past move 10) | > 70 % |
| Return rate (users reviewing a 2nd game within 7 days) | > 30 % |
| Classification agreement with chess.com on a 50-game benchmark | > 90 % |
| Retry-mode engagement (reviews where user retries ≥1 move) | > 25 % |
| Server cost per review | **$0.00** |

**Counter-metric:** Brilliant moves awarded per 100 games ≤ 4. Badge inflation destroys the credibility of the whole system.

## 6. Requirements

### P0 — launch blockers
1. PGN input: paste, `.pgn` upload, multi-game split.
2. Browser Stockfish analysis, two-pass (scan then verify), streaming progress, deterministic output.
3. Move classification: Brilliant, Great, Best, Excellent, Good, Book, Inaccuracy, Mistake, Miss, Blunder, Forced — using the Expected-Points model with rating-adaptive leniency.
4. Accuracy % and ACPL per side; move-count summary.
5. Interactive board: navigate, flip, animate, sounds, best-move/played arrows, badge on destination square.
6. Eval bar + eval graph with scrubbing.
7. Coach panel: plain-English explanation per move + best-line preview.
8. Engine lines panel (top 3, live depth/PV).
9. Retry-the-move practice mode with verdicts.
10. Game summary: opening/ECO, accuracies, estimated Elo (±range), key moments, phase breakdown.
11. Local persistence (IndexedDB): saved games, settings, eval cache. No login anywhere.
12. Responsive 390px → desktop, dark mode, keyboard navigation.

### P1 — fast follow
13. chess.com + Lichess username import; batch review.
14. Blunder Trainer (SRS deck from your own mistakes).
15. Insights dashboard: accuracy trend, mistake patterns, time-pressure correlation.
16. Share links (PGN encoded in URL, no storage) + OG summary card.
17. Backup export/import JSON.
18. PWA / full offline.
19. Tablebase-exact endgame verdicts; cloud-eval cross-check.

### P2 — later
20. Threat view, guess-the-move, opening report, GIF/MP4 export of key moments, LLM-enriched coaching, public API.

## 7. Core flow

```
Landing → paste PGN → analysis starts immediately (progress bar, move 1 reviewable at ~2s)
  → review workspace: board + eval bar + graph + move list + coach card
  → click any mistake → "Try again" → play your move → verdict → back to game
  → save locally / share link / review another
```
No modal, no signup wall, no interstitial. First review must be reachable in **one click** from the landing page (ship with a demo game preloaded).

## 8. Principles

1. **Free means free** — no cap, no tier, no account, no dark patterns.
2. **Explain, don't just score.** A number without a reason teaches nothing.
3. **The user's data is the user's** — it stays on their device.
4. **Trustworthy over flattering.** Rare Brilliants, honest Elo ranges, no fake praise.
5. **Fast enough to feel free.** Perceived speed comes from streaming results, not from finishing first.

## 9. Constraints

- Engine runs client-side only; no server compute, no database, no auth (see `AGENTS.md` §1).
- ~7 MB WASM download on first visit; cached permanently after.
- Analysis quality is bounded by the user's device — adaptive depth on mobile, disclosed via an engine badge.
- Original assets only; no chess.com icons, sounds, or branding.
- **Zero budget.** Build and run cost must be ₹0 — free tiers and free software only, no paid services, no required API keys, no custom domain at launch (ship on the free `*.vercel.app` subdomain). See plan §12.
- Repo is **GPLv3** and public, because we distribute Stockfish. All dependencies must be GPL-compatible.

## 10. Risks

| Risk | Mitigation |
|---|---|
| Classifications disagree with chess.com → users distrust the tool | 50-game benchmark + golden fixture tests; debug overlay exposing the math |
| Too slow on low-end phones | Adaptive depth, single-threaded fallback, streamed results, honest engine badge |
| Brilliant badge inflation | 6 strict conditions, deep verification, ≤4-per-100-games counter-metric |
| User clears browser data → library lost | Storage persist request, backup nudges, one-click export/import, URL-encoded share links |
| Legal/brand pressure | Public APIs only, original assets, no chess.com naming |

## 11. Launch

- **Build:** 7 phases, ~9 days (plan §7). Phase 3 (classification) is the critical path — no UI work until its golden tests are green.
- **Deploy:** Vercel free tier, custom domain (plan §11).
- **Launch surfaces:** r/chess, r/chessbeginners, Hacker News, chess Discords. Headline: *"Free unlimited game review. No account. Runs in your browser."*
- **Proof asset:** side-by-side screenshot of our review vs chess.com's on the same famous game, showing identical classifications.

## 12. Open questions

1. Which Stockfish build ships as default — 17 or 18 lite? (Decide in Phase 2 on measured speed.)
2. Estimated-Elo calibration dataset size — is 2k Lichess games enough for ±150 confidence?
3. Do we bundle the opening eval pack at launch or lazy-fetch it? (Bundle size vs first-review speed.)
4. Is the chess.com public API reliably CORS-open, or is the proxy route permanently required?
