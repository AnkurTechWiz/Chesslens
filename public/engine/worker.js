// public/engine/worker.js — Stockfish Web Worker entry point
// Served as a static asset from /engine/worker.js.
// This script bridges the UCI message protocol between the EnginePool and Stockfish.
//
// Protocol:
//   HOST → WORKER:  "init <scriptUrl>" (first message) then raw UCI strings
//   WORKER → HOST:  "workerinit ok" | "workerinit error <msg>" then raw UCI strings

/* global Stockfish */

let engine = null;

function forwardToHost(line) {
  self.postMessage(line);
}

async function initEngine(scriptUrl) {
  try {
    importScripts(scriptUrl);
    engine = await Stockfish();
    engine.addMessageListener(forwardToHost);
    self.postMessage('workerinit ok');
  } catch (err) {
    self.postMessage('workerinit error ' + (err && err.message ? err.message : String(err)));
  }
}

self.onmessage = function (event) {
  const data = event.data;

  if (typeof data !== 'string') return;

  if (data.startsWith('init ')) {
    const url = data.slice('init '.length).trim();
    initEngine(url);
    return;
  }

  if (engine) {
    engine.postMessage(data);
  } else {
    self.postMessage('info string Worker not initialized, ignoring: ' + data);
  }
};
