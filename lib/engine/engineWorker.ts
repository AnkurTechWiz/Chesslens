// lib/engine/engineWorker.ts — Web Worker entry point for Stockfish WASM
//
// This file is compiled as a separate worker bundle.
// It MUST NOT import React, DOM, or any Node-only module.
// Communication is via postMessage string protocol.
//
// Message protocol (both directions are plain strings):
//   HOST → WORKER:   raw UCI commands (uci, isready, setoption, position, go, stop, quit)
//   WORKER → HOST:   raw UCI responses (id, uciok, readyok, info, bestmove)
//
// The worker simply bridges the host ↔ Stockfish engine, no business logic here.

/// <reference lib="webworker" />

declare function importScripts(...urls: string[]): void;

// The Stockfish JS file is loaded via importScripts. The global `Stockfish`
// function is injected by the IIFE in the stockfish-nnue-16-*.js files.
declare function Stockfish(): StockfishInstance;

interface StockfishInstance {
  addMessageListener(callback: (line: string) => void): void;
  postMessage(message: string): void;
  terminate?(): void;
}

// Engine script URL is passed as the first message before UCI init.
// This allows the pool to select single vs multi-threaded at runtime.
let engine: StockfishInstance | null = null;
let engineScriptUrl = '';

/** Forward engine output lines to the host. */
function forwardToHost(line: string): void {
  self.postMessage(line);
}

/** Initialize Stockfish from the given script URL. */
async function initEngine(scriptUrl: string): Promise<void> {
  engineScriptUrl = scriptUrl;

  try {
    // importScripts is the standard way to load scripts in a DedicatedWorker.
    importScripts(scriptUrl);
    engine = Stockfish();
    engine.addMessageListener(forwardToHost);
    // Signal successful initialization
    self.postMessage('workerinit ok');
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    self.postMessage(`workerinit error ${message}`);
  }
}

self.onmessage = (event: MessageEvent<string>) => {
  const data = event.data;

  // Special bootstrap message: "init <scriptUrl>"
  if (data.startsWith('init ')) {
    const url = data.slice('init '.length).trim();
    initEngine(url).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      self.postMessage(`workerinit error ${message}`);
    });
    return;
  }

  // UCI passthrough to Stockfish
  if (engine) {
    engine.postMessage(data);
  } else {
    self.postMessage(`info string Worker not initialized (received: ${data})`);
  }
};

// Suppress TS unused variable warning for engineScriptUrl
void engineScriptUrl;
