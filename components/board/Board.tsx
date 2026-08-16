'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Chess, type Square as ChessSquare } from 'chess.js';
import { useGameStore } from '@/lib/store/gameStore';
import { useRetryStore } from '@/lib/store/retryStore';
import { Square } from './Square';
import { Piece } from './Piece';
import { PromotionDialog } from './PromotionDialog';
import { CapturedStrip } from './CapturedStrip';
import { BoardControls } from './BoardControls';
import { ArrowLayer } from '@/components/review/ArrowLayer';
import { BadgeLayer } from '@/components/review/BadgeLayer';
import { ThreatLayer } from './ThreatLayer';
import { AriaAnnouncer } from './AriaAnnouncer';
import type { PieceCode } from './PieceSvg';

export interface BoardProps {
  showControls?: boolean;
  showCapturedStrips?: boolean;
  className?: string;
}

export const Board: React.FC<BoardProps> = ({
  showControls = true,
  showCapturedStrips = true,
  className = '',
}) => {
  const {
    boardFen,
    orientation,
    selectedSquare,
    legalMoves,
    lastMoveSquares,
    inCheck,
    checkSquare,
    pendingPromotion,
    isPlaying,
    autoplaySpeed,
    game,
    capturedPieces,
    materialAdvantage,
    nextMove,
    prevMove,
    firstMove,
    lastMove,
    selectSquare,
    makeMove,
    cancelPromotion,
    toggleFlip,
    togglePlay,
  } = useGameStore();

  const {
    isActive: isRetryActive,
    currentFen: retryFen,
    playUserMove: playRetryMove,
  } = useRetryStore();

  const [showThreats, setShowThreats] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);

  // Active FEN to display
  const activeFen = isRetryActive && retryFen ? retryFen : boardFen;

  // Autoplay loop
  useEffect(() => {
    if (!isPlaying || isRetryActive) return;

    const interval = setInterval(() => {
      const state = useGameStore.getState();
      if (state.game && state.currentPly < state.game.moves.length) {
        state.nextMove();
      } else {
        state.togglePlay();
      }
    }, autoplaySpeed);

    return () => clearInterval(interval);
  }, [isPlaying, autoplaySpeed, isRetryActive]);

  // Global Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in form inputs
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (isRetryActive) {
        if (e.key === 'f' || e.key === 'F') {
          e.preventDefault();
          toggleFlip();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          prevMove();
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextMove();
          break;
        case 'ArrowUp':
        case 'Home':
          e.preventDefault();
          firstMove();
          break;
        case 'ArrowDown':
        case 'End':
          e.preventDefault();
          lastMove();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFlip();
          break;
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'x':
        case 'X':
          e.preventDefault();
          setShowThreats((prev) => !prev);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prevMove, nextMove, firstMove, lastMove, toggleFlip, togglePlay, isRetryActive]);

  // Parse current FEN board pieces
  const chess = new Chess(activeFen);
  const turn = chess.turn();

  const ranks = orientation === 'white' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === 'white' ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];

  const executeMove = (from: string, to: string, promo?: 'q' | 'r' | 'b' | 'n') => {
    if (isRetryActive) {
      playRetryMove(from, to, promo);
    } else {
      makeMove(from, to, promo);
    }
  };

  const handleSquareClick = (square: string) => {
    if (selectedSquare) {
      if (selectedSquare === square) {
        selectSquare(null);
        return;
      }

      if (legalMoves.includes(square)) {
        executeMove(selectedSquare, square);
        return;
      }
    }

    const piece = chess.get(square as ChessSquare);
    if (piece && piece.color === turn) {
      const moves = chess.moves({ square: square as ChessSquare, verbose: true });
      const legalDestinations = moves.map((m) => m.to);
      useGameStore.setState({
        selectedSquare: square,
        legalMoves: legalDestinations,
      });
    } else {
      selectSquare(null);
    }
  };

  const handleDragStart = (square: string) => {
    const piece = chess.get(square as ChessSquare);
    if (piece && piece.color === turn) {
      const moves = chess.moves({ square: square as ChessSquare, verbose: true });
      const legalDestinations = moves.map((m) => m.to);
      useGameStore.setState({
        selectedSquare: square,
        legalMoves: legalDestinations,
      });
    }
  };

  const handleDragEnd = (
    fromSquare: string,
    _e: MouseEvent | TouchEvent | PointerEvent,
    info: { point: { x: number; y: number } }
  ) => {
    if (!boardRef.current) return;

    // Get element under the drop point
    const dropTarget = document.elementFromPoint(info.point.x, info.point.y);
    const squareEl = dropTarget?.closest('[data-square]');
    const toSquare = squareEl?.getAttribute('data-square');

    if (toSquare && toSquare !== fromSquare && legalMoves.includes(toSquare)) {
      executeMove(fromSquare, toSquare);
    } else {
      selectSquare(null);
    }
  };

  const handlePromotionChoice = (promoPiece: 'q' | 'r' | 'b' | 'n') => {
    if (pendingPromotion) {
      executeMove(pendingPromotion.from, pendingPromotion.to, promoPiece);
    }
  };

  const promotionColor = pendingPromotion
    ? (chess.get(pendingPromotion.from as ChessSquare)?.color || turn)
    : turn;

  const isWhiteOrientation = orientation === 'white';

  const whitePlayerName = game?.headers?.White as string | undefined;
  const blackPlayerName = game?.headers?.Black as string | undefined;
  const whiteElo = game?.headers?.WhiteElo ? Number(game.headers.WhiteElo) : undefined;
  const blackElo = game?.headers?.BlackElo ? Number(game.headers.BlackElo) : undefined;

  return (
    <div className={`flex flex-col items-center gap-3 w-full max-w-[560px] mx-auto ${className}`}>
      {/* Screen Reader Announcer */}
      <AriaAnnouncer />

      {/* Top Player Strip */}
      {showCapturedStrips && (
        <CapturedStrip
          playerName={isWhiteOrientation ? blackPlayerName : whitePlayerName}
          playerElo={isWhiteOrientation ? blackElo : whiteElo}
          playerColor={isWhiteOrientation ? 'black' : 'white'}
          capturedPieces={isWhiteOrientation ? capturedPieces.black : capturedPieces.white}
          materialAdvantage={isWhiteOrientation ? materialAdvantage.black : materialAdvantage.white}
          isTurn={isWhiteOrientation ? turn === 'b' : turn === 'w'}
        />
      )}

      {/* 8x8 Chessboard Container */}
      <div
        ref={boardRef}
        className="relative w-full aspect-square rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800 bg-slate-950 select-none touch-none"
      >
        <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
          {ranks.map((rank, rankIdx) =>
            files.map((file, fileIdx) => {
              const square = `${file}${rank}` as ChessSquare;
              const isLight = (rankIdx + fileIdx) % 2 === 0;
              const piece = chess.get(square);

              const isLastMoveSource = lastMoveSquares?.from === square;
              const isLastMoveDest = lastMoveSquares?.to === square;
              const isSelected = selectedSquare === square;
              const isLegalTarget = legalMoves.includes(square);
              const isCaptureTarget = isLegalTarget && Boolean(piece && piece.color !== turn);
              const isKingInCheck = inCheck && checkSquare === square;

              const showRankCoord = fileIdx === 0 ? String(rank) : undefined;
              const showFileCoord = rankIdx === 7 ? file : undefined;

              const pieceCode = piece
                ? (`${piece.color}${piece.type.toUpperCase()}` as PieceCode)
                : null;

              return (
                <Square
                  key={square}
                  square={square}
                  isLight={isLight}
                  isLastMoveSource={isLastMoveSource}
                  isLastMoveDest={isLastMoveDest}
                  isSelected={isSelected}
                  isLegalTarget={isLegalTarget}
                  isCaptureTarget={isCaptureTarget}
                  isInCheck={isKingInCheck}
                  showRankCoord={showRankCoord}
                  showFileCoord={showFileCoord}
                  onClick={handleSquareClick}
                >
                  {pieceCode && piece && (
                    <Piece
                      piece={pieceCode}
                      square={square}
                      isDraggable={piece.color === turn}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onClick={handleSquareClick}
                    />
                  )}
                </Square>
              );
            })
          )}
        </div>

        {/* Review Overlays */}
        <ArrowLayer />
        <BadgeLayer />
        <ThreatLayer showThreats={showThreats} />

        {/* Promotion Dialog Modal */}
        {pendingPromotion && (
          <PromotionDialog
            color={promotionColor as 'w' | 'b'}
            onSelect={handlePromotionChoice}
            onCancel={cancelPromotion}
          />
        )}
      </div>

      {/* Bottom Player Strip */}
      {showCapturedStrips && (
        <CapturedStrip
          playerName={isWhiteOrientation ? whitePlayerName : blackPlayerName}
          playerElo={isWhiteOrientation ? whiteElo : blackElo}
          playerColor={isWhiteOrientation ? 'white' : 'black'}
          capturedPieces={isWhiteOrientation ? capturedPieces.white : capturedPieces.black}
          materialAdvantage={isWhiteOrientation ? materialAdvantage.white : materialAdvantage.black}
          isTurn={isWhiteOrientation ? turn === 'w' : turn === 'b'}
        />
      )}

      {/* Navigation and Playback Controls */}
      {showControls && <BoardControls />}
    </div>
  );
};
