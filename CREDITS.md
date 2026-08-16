# Credits & Attributions

ChessLens is built on top of incredible open-source chess projects and assets. We gratefully acknowledge and credit the following creators and communities:

## Chess Engine
- **[Stockfish](https://stockfishchess.org/)** — The world's strongest open-source chess engine. Distributed under the GNU General Public License v3.0 (GPLv3). Stockfish 18 NNUE lite build used in ChessLens.
- **[Stockfish.js (nmrugg)](https://github.com/nmrugg/stockfish.js)** — WebAssembly/JavaScript port of Stockfish, maintained by Nathan Rugg. Licensed under GPLv3. ChessLens ships the following builds:
  - `stockfish-18-lite-single.v1.js / .wasm` — Single-threaded NNUE build (default). Works across all modern browsers including iOS/iPadOS Safari and private browsing.
  - `stockfish-18-lite-mt.v1.js / .wasm` — Multi-threaded NNUE build (max strength, requires `crossOriginIsolated`). Used when SharedArrayBuffer and SIMD are available.
  - `public/engine/worker.js` — Custom UCI bridge worker script, original code under GPLv3 (this project's license).


## Chess Rules & Notation
- **[chess.js](https://github.com/jhlywa/chess.js)** — TypeScript/JavaScript chess library by Jeff Hlywa. Licensed under the BSD-2-Clause License.

## Audio & Sound Effects
- **[Lichess](https://lichess.org/) Sound Sets** — Audio assets for move, capture, castle, check, and game-end events sourced from Lichess under Creative Commons CC0 / Public Domain.

## Piece Sets & Visuals
- **[Cburnett Chess Piece Set](https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces)** — Created by Colin M.L. Burnett, distributed under CC-BY-SA 3.0 / GPL.
- **Classification Badges & Custom Icons** — Original SVG designs tailored for clarity and accessibility.
- **[Lucide Icons](https://lucide.dev/)** — Beautiful open-source icons licensed under ISC.

## Web Platform & Libraries
- **[Next.js](https://nextjs.org/)** — React framework created by Vercel (MIT License).
- **[Dexie.js](https://dexie.org/)** — IndexedDB wrapper for client-side persistence by David Fahlander (Apache-2.0 License).
- **[Zustand](https://github.com/pmndrs/zustand)** — Bearbones state-management for React (MIT License).
- **[Framer Motion](https://www.framer.com/motion/)** — Production-ready animation library for React (MIT License).
- **[Tailwind CSS](https://tailwindcss.com/)** & **[shadcn/ui](https://ui.shadcn.com/)** — UI styling system and accessible component primitives (MIT License).
- **[Vitest](https://vitest.dev/)** — Blazing fast unit test framework (MIT License).
- **[Zod](https://zod.dev/)** — TypeScript-first schema declaration and validation (MIT License).
- **[lz-string](https://github.com/pieroxy/lz-string)** — Fast string compression algorithm for URL sharing by Pieroxy (MIT License).
- **[canvas-confetti](https://github.com/catdad/canvas-confetti)** — Performant canvas confetti by Kiril Vatev (ISC License).

---
All third-party libraries and assets comply with the GPLv3 license terms of this project.
