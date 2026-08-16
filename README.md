# ChessLens ♞

> **Free, account-free chess Game Review web app powered by Stockfish WASM running entirely in your browser.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Next.js 15](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue)](https://www.typescriptlang.org/)
[![Stockfish WASM](https://img.shields.io/badge/Stockfish-18%20NNUE%20WASM-green)](https://stockfishchess.org/)

---

## 🌟 What is ChessLens?

ChessLens gives you deep, chess.com-style game reviews and move-by-move analysis with **zero paywalls, zero accounts, and zero server computing costs**.

- 🎯 **Full Move Classification:** Brilliant (`!!`), Great (`!`), Best (`★`), Excellent, Good, Book (`📖`), Inaccuracy (`?!`), Mistake (`?`), Miss (`⁉`), Blunder (`??`), and Forced.
- 📊 **Accuracy & Metrics:** Move accuracy percentage (Lichess win-probability model), Average Centipawn Loss (ACPL), estimated Elo range, and phase-by-phase breakdown (Opening, Middlegame, Endgame).
- 📈 **Dynamic Eval Bar & Graph:** Responsive advantage bar and interactive SVG eval chart with White/Black advantage fills, classification markers, and scrubbable move timeline.
- 💡 **100% Offline Coach Commentary:** Natural-language explanations generated from rule-based tactical motif detection (forks, pins, skewers, hanging pieces, missed mates, back-rank weaknesses, discovered attacks, and sacrifices).
- 🔄 **Interactive Retry Practice Mode:** Test your intuition on blunders, misses, and mistakes with live engine feedback verdicts (*"Correct!"*, *"Better than the game, but not best"*, *"Still losing"*).
- 📚 **Personal Game Library & SRS Trainer:** Save reviewed games, inspect trends on your dashboard, and drill past blunders with a Spaced Repetition (SM-2) flashcard trainer.
- ⚡ **Game Imports:** One-click stateless import from Chess.com and Lichess username archives.
- 🔗 **Zero-Backend Share Links:** Share reviews via URL-compressed PGNs (`/review?g=...`) that recipient browsers load and analyze deterministically without needing a database.
- 📴 **Offline PWA:** Installable Progressive Web App with Service Worker precaching that runs 100% offline after your first visit.

---

## ⚡ One-Command Setup

Get ChessLens running locally in seconds:

```bash
# Clone the repository
git clone https://github.com/your-username/ChessLens.git
cd ChessLens

# Install dependencies and start the dev server
pnpm install && pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Verification & Testing
```bash
pnpm typecheck   # Strict TypeScript check (0 errors)
pnpm lint        # ESLint flat config validation
pnpm test        # Vitest suite (240+ unit, pipeline & golden fixture tests)
pnpm build       # Optimized Next.js production build
```

---

## 🏗️ Architecture

ChessLens is designed from first principles to be **completely free to host and run forever**:

```
 ┌─────────────────────────────────────────────────────────────┐
 │                       USER BROWSER                          │
 │                                                             │
 │  ┌─────────────────┐   ┌────────────────┐   ┌────────────┐  │
 │  │   Next.js UI    │◄──┤ Zustand Stores │◄──┤  Dexie DB  │  │
 │  │  (App Router)   │   │  (Game/Review) │   │(IndexedDB) │  │
 │  └────────┬────────┘   └───────▲────────┘   └────────────┘  │
 │           │                    │                            │
 │           ▼                    │ (results)                  │
 │  ┌──────────────────────────────────────┐                   │
 │  │  Stockfish 18 NNUE Web Workers Pool  │                   │
 │  │   (Multi-threaded SIMD / Fallback)   │                   │
 │  └──────────────────────────────────────┘                   │
 └─────────────────────────────────────────────────────────────┘
                               ▲
                               │ (Stateless proxies only)
 ┌─────────────────────────────┴───────────────────────────────┐
 │                       VERCEL / EDGE                         │
 │                                                             │
 │  • Static HTML / JS / CSS Bundle                            │
 │  • Immutable Engine WASM & Sounds CDN Assets                │
 │  • Stateless API Proxies: /import, /cloudeval, /tablebase  │
 │  • Edge OG Image Generation (/api/og)                       │
 │  • ZERO Server Database, ZERO Compute, ZERO User Accounts   │
 └─────────────────────────────────────────────────────────────┘
```

1. **Client-Side Stockfish WASM:**
   Stockfish runs directly on the visitor's CPU inside Web Workers. When `crossOriginIsolated` is active, ChessLens utilizes the multi-threaded SIMD build; otherwise, it falls back seamlessly to the single-threaded build (e.g. on iOS Safari). Zero engine compute touches the server.
2. **Dexie / IndexedDB Local Storage:**
   All persistent data (saved games, cached engine evaluations, spaced repetition trainer cards, and visual settings) is stored locally in the browser via Dexie.js. Data can be backed up or restored as JSON with one click.
3. **No Authentication / No Accounts:**
   No sign-up, login, OAuth, sessions, cookies, or tracking. The app is immediately usable by anyone.
4. **Stateless API Proxies:**
   Next.js API routes act solely as lightweight, stateless proxies for external public endpoints (Chess.com archives, Lichess games, Lichess Cloud Eval, and Lichess Endgame Tablebase). They never write to disk or persist state.
5. **Deterministic Analysis:**
   Classification uses fixed-depth engine evaluations (`go depth N`), single-thread worker allocation, fixed hash, and versioned cache keys (`sf18.v4`), guaranteeing byte-identical reports for the same PGN across devices.

---

## 🚀 How to Deploy to Vercel (Hobby Tier — $0/mo)

Because all heavy engine computation is client-side and no server database exists, ChessLens runs entirely within the **free Vercel Hobby plan**.

### Step-by-Step Click Path:
1. **Push to GitHub:**
   Ensure your repository is pushed to a **public** GitHub repository (required for GPLv3 compliance).
2. **Log into Vercel:**
   Navigate to [vercel.com](https://vercel.com) and click **Add New... → Project**.
3. **Import Git Repository:**
   Locate your `ChessLens` repository in the list and click **Import**.
4. **Configure Project:**
   - **Framework Preset:** `Next.js` (auto-detected)
   - **Root Directory:** `./`
   - **Build Command:** `next build` (default)
   - **Output Directory:** `.next` (default)
   - **Environment Variables:** *Leave blank! No environment variables or API keys are required.*
5. **Click Deploy:**
   Click the **Deploy** button. In ~1-2 minutes, your deployment will complete and provide a live `https://<your-project>.vercel.app` URL.

> **Zero-Cost Domain:** Ship on the free `*.vercel.app` subdomain. No custom domain or paid tier is necessary.

---

## 📜 License & Attributions

This project is licensed under the **[GNU General Public License v3.0 (GPLv3)](LICENSE)** because it distributes WebAssembly builds of Stockfish.

### Open-Source Credits
- **[Stockfish](https://stockfishchess.org/)** — Stockfish 18 NNUE (GPLv3).
- **[Stockfish.js](https://github.com/nmrugg/stockfish.js)** — Nathan Rugg's Emscripten/WASM compilation of Stockfish (GPLv3).
- **[chess.js](https://github.com/jhlywa/chess.js)** — Jeff Hlywa's chess rules engine (BSD-2-Clause).
- **[Cburnett Chess Pieces](https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces)** — Vector piece graphics by Colin M.L. Burnett (CC-BY-SA 3.0 / GPL).
- **[Lichess](https://lichess.org/)** — Audio sound effects (CC0 / Public Domain), Cloud Eval API, and Endgame Tablebase API.
- See **[CREDITS.md](CREDITS.md)** for complete third-party licenses and attributions.
