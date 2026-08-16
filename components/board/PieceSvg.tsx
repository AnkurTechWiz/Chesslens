import React from 'react';

export type PieceCode =
  | 'wP' | 'wN' | 'wB' | 'wR' | 'wQ' | 'wK'
  | 'bP' | 'bN' | 'bB' | 'bR' | 'bQ' | 'bK'
  | 'P' | 'N' | 'B' | 'R' | 'Q' | 'K'
  | 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface PieceSvgProps {
  piece: PieceCode;
  className?: string;
}

export function normalizePieceCode(piece: PieceCode): string {
  if (piece.length === 2) return piece;
  const isUpper = piece === piece.toUpperCase();
  return `${isUpper ? 'w' : 'b'}${piece.toUpperCase()}`;
}

export const PieceSvg: React.FC<PieceSvgProps> = ({ piece, className = 'w-full h-full' }) => {
  const code = normalizePieceCode(piece);

  switch (code) {
    case 'wP':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <path
            d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 C 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z"
            style={{
              fill: '#ffffff',
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
            }}
          />
        </svg>
      );
    case 'wN':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g
            style={{
              opacity: 1,
              fill: 'none',
              fillRule: 'evenodd',
              fillOpacity: 1,
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeMiterlimit: 4,
              strokeDasharray: 'none',
              strokeOpacity: 1,
            }}
          >
            <path
              d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18"
              style={{ fill: '#ffffff', stroke: '#000000' }}
            />
            <path
              d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10"
              style={{ fill: '#ffffff', stroke: '#000000' }}
            />
            <path
              d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z"
              style={{ fill: '#000000', stroke: '#000000' }}
            />
            <path
              d="M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z"
              transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)"
              style={{ fill: '#000000', stroke: '#000000' }}
            />
          </g>
        </svg>
      );
    case 'wB':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g
            style={{
              opacity: 1,
              fill: 'none',
              fillRule: 'evenodd',
              fillOpacity: 1,
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeMiterlimit: 4,
              strokeDasharray: 'none',
              strokeOpacity: 1,
            }}
          >
            <g
              style={{
                fill: '#ffffff',
                stroke: '#000000',
                strokeLinecap: 'butt',
              }}
            >
              <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.54 9,36 9,36 z" />
              <path d="M 12,36 C 12,32 15,27 22.5,27 C 30,27 33,32 33,36 z" />
              <path d="M 15,18 C 15,13.5 18,9 22.5,9 C 27,9 30,13.5 30,18 C 30,22.5 27,27 22.5,27 C 18,27 15,22.5 15,18 z" />
              <path d="M 22.5,6 L 22.5,9" />
              <path d="M 21,7.5 L 24,7.5" />
            </g>
            <path
              d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18"
              style={{
                fill: 'none',
                stroke: '#000000',
                strokeLinejoin: 'miter',
              }}
            />
          </g>
        </svg>
      );
    case 'wR':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g
            style={{
              opacity: 1,
              fill: '#ffffff',
              fillRule: 'evenodd',
              fillOpacity: 1,
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeMiterlimit: 4,
              strokeDasharray: 'none',
              strokeOpacity: 1,
            }}
          >
            <path
              d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z"
              style={{ strokeLinecap: 'butt' }}
            />
            <path
              d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z"
              style={{ strokeLinecap: 'butt' }}
            />
            <path
              d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14"
              style={{ strokeLinecap: 'butt' }}
            />
            <path d="M 34,14 L 31,17 L 14,17 L 11,14" />
            <path
              d="M 13,17 L 13,29.5 L 32,29.5 L 32,17"
              style={{ strokeLinecap: 'butt', strokeLinejoin: 'miter' }}
            />
            <path
              d="M 14,29.5 L 12,32 L 33,32 L 31,29.5"
              style={{ strokeLinecap: 'butt', strokeLinejoin: 'miter' }}
            />
            <path
              d="M 14,16.5 L 31,16.5 M 13,20.5 L 32,20.5 M 13,24.5 L 32,24.5 M 13,28.5 L 32,28.5"
              style={{
                fill: 'none',
                stroke: '#000000',
                strokeLinejoin: 'miter',
              }}
            />
          </g>
        </svg>
      );
    case 'wQ':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g
            style={{
              opacity: 1,
              fill: '#ffffff',
              fillRule: 'evenodd',
              fillOpacity: 1,
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeMiterlimit: 4,
              strokeDasharray: 'none',
              strokeOpacity: 1,
            }}
          >
            <path d="M 8 12 A 2 2 0 1 1 4,12 A 2 2 0 1 1 8 12 z" />
            <path d="M 16 8.5 A 2 2 0 1 1 12,8.5 A 2 2 0 1 1 16 8.5 z" />
            <path d="M 24.5 7.5 A 2 2 0 1 1 20.5,7.5 A 2 2 0 1 1 24.5 7.5 z" />
            <path d="M 33 8.5 A 2 2 0 1 1 29,8.5 A 2 2 0 1 1 33 8.5 z" />
            <path d="M 41 12 A 2 2 0 1 1 37,12 A 2 2 0 1 1 41 12 z" />
            <path
              d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 22.5,10 L 14,25 L 6.5,13.5 L 9,26 z"
              style={{ strokeLinecap: 'butt' }}
            />
            <path
              d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 10.5,36 10.5,36 C 9,37.5 11,38.5 11,38.5 L 34,38.5 C 34,38.5 36,37.5 34.5,36 C 34.5,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z"
              style={{ strokeLinecap: 'butt' }}
            />
            <path
              d="M 11.5,30 C 15,29 30,29 33.5,30 M 12,33.5 C 18,32.5 27,32.5 33,33.5"
              style={{ fill: 'none' }}
            />
          </g>
        </svg>
      );
    case 'wK':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g
            style={{
              opacity: 1,
              fill: 'none',
              fillRule: 'evenodd',
              fillOpacity: 1,
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeMiterlimit: 4,
              strokeDasharray: 'none',
              strokeOpacity: 1,
            }}
          >
            <path
              d="M 22.5,11.63 L 22.5,6"
              style={{ fill: 'none', stroke: '#000000', strokeLinejoin: 'miter' }}
            />
            <path
              d="M 20,8 L 25,8"
              style={{ fill: 'none', stroke: '#000000', strokeLinejoin: 'miter' }}
            />
            <path
              d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 24,11.5 21,11.5 22.5,8.5 C 24,11.5 21,11.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25"
              style={{ fill: '#ffffff', stroke: '#000000', strokeLinecap: 'butt' }}
            />
            <path
              d="M 11.5,37 C 17,40.5 28,40.5 33.5,37 C 36.5,34 36.5,28.5 36.5,28.5 C 36.5,28.5 34.5,25 31,25 C 27.5,25 25.5,28 22.5,28 C 19.5,28 17.5,25 14,25 C 10.5,25 8.5,28.5 8.5,28.5 C 8.5,28.5 8.5,34 11.5,37 z"
              style={{ fill: '#ffffff', stroke: '#000000' }}
            />
            <path
              d="M 11.5,30 C 17,27 28,27 33.5,30"
              style={{ fill: 'none', stroke: '#000000' }}
            />
            <path
              d="M 11.5,33.5 C 17,30.5 28,30.5 33.5,33.5"
              style={{ fill: 'none', stroke: '#000000' }}
            />
            <path
              d="M 11.5,37 C 17,34 28,34 33.5,37"
              style={{ fill: 'none', stroke: '#000000' }}
            />
          </g>
        </svg>
      );
    case 'bP':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <path
            d="m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 l 23,0 c 0,-7.92 -4.41,-12.41 -7.41,-13.47 C 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z"
            style={{
              fill: '#242424',
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
            }}
          />
        </svg>
      );
    case 'bN':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g
            style={{
              opacity: 1,
              fill: 'none',
              fillRule: 'evenodd',
              fillOpacity: 1,
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeMiterlimit: 4,
              strokeDasharray: 'none',
              strokeOpacity: 1,
            }}
          >
            <path
              d="M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18"
              style={{ fill: '#242424', stroke: '#000000' }}
            />
            <path
              d="M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10"
              style={{ fill: '#242424', stroke: '#000000' }}
            />
            <path
              d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z"
              style={{ fill: '#ffffff', stroke: '#ffffff' }}
            />
            <path
              d="M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z"
              transform="matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)"
              style={{ fill: '#ffffff', stroke: '#ffffff' }}
            />
          </g>
        </svg>
      );
    case 'bB':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g
            style={{
              opacity: 1,
              fill: 'none',
              fillRule: 'evenodd',
              fillOpacity: 1,
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeMiterlimit: 4,
              strokeDasharray: 'none',
              strokeOpacity: 1,
            }}
          >
            <g
              style={{
                fill: '#242424',
                stroke: '#000000',
                strokeLinecap: 'butt',
              }}
            >
              <path d="M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.646,38.99 6.677,38.97 6,38 C 7.354,36.54 9,36 9,36 z" />
              <path d="M 12,36 C 12,32 15,27 22.5,27 C 30,27 33,32 33,36 z" />
              <path d="M 15,18 C 15,13.5 18,9 22.5,9 C 27,9 30,13.5 30,18 C 30,22.5 27,27 22.5,27 C 18,27 15,22.5 15,18 z" />
              <path d="M 22.5,6 L 22.5,9" />
              <path d="M 21,7.5 L 24,7.5" />
            </g>
            <path
              d="M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18"
              style={{
                fill: 'none',
                stroke: '#ffffff',
                strokeLinejoin: 'miter',
              }}
            />
          </g>
        </svg>
      );
    case 'bR':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g
            style={{
              opacity: 1,
              fill: '#242424',
              fillRule: 'evenodd',
              fillOpacity: 1,
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeMiterlimit: 4,
              strokeDasharray: 'none',
              strokeOpacity: 1,
            }}
          >
            <path
              d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z"
              style={{ strokeLinecap: 'butt' }}
            />
            <path
              d="M 12.5,32 L 12.5,36 L 32.5,36 L 32.5,32 L 12.5,32 z"
              style={{ strokeLinecap: 'butt' }}
            />
            <path
              d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14"
              style={{ strokeLinecap: 'butt' }}
            />
            <path d="M 34,14 L 31,17 L 14,17 L 11,14" />
            <path
              d="M 13,17 L 13,29.5 L 32,29.5 L 32,17"
              style={{ strokeLinecap: 'butt', strokeLinejoin: 'miter' }}
            />
            <path
              d="M 14,29.5 L 12,32 L 33,32 L 31,29.5"
              style={{ strokeLinecap: 'butt', strokeLinejoin: 'miter' }}
            />
            <path
              d="M 14,16.5 L 31,16.5 M 13,20.5 L 32,20.5 M 13,24.5 L 32,24.5 M 13,28.5 L 32,28.5"
              style={{
                fill: 'none',
                stroke: '#ffffff',
                strokeLinejoin: 'miter',
              }}
            />
          </g>
        </svg>
      );
    case 'bQ':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g
            style={{
              opacity: 1,
              fill: '#242424',
              fillRule: 'evenodd',
              fillOpacity: 1,
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeMiterlimit: 4,
              strokeDasharray: 'none',
              strokeOpacity: 1,
            }}
          >
            <path d="M 8 12 A 2 2 0 1 1 4,12 A 2 2 0 1 1 8 12 z" />
            <path d="M 16 8.5 A 2 2 0 1 1 12,8.5 A 2 2 0 1 1 16 8.5 z" />
            <path d="M 24.5 7.5 A 2 2 0 1 1 20.5,7.5 A 2 2 0 1 1 24.5 7.5 z" />
            <path d="M 33 8.5 A 2 2 0 1 1 29,8.5 A 2 2 0 1 1 33 8.5 z" />
            <path d="M 41 12 A 2 2 0 1 1 37,12 A 2 2 0 1 1 41 12 z" />
            <path
              d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 22.5,10 L 14,25 L 6.5,13.5 L 9,26 z"
              style={{ strokeLinecap: 'butt' }}
            />
            <path
              d="M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 10.5,36 10.5,36 C 9,37.5 11,38.5 11,38.5 L 34,38.5 C 34,38.5 36,37.5 34.5,36 C 34.5,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z"
              style={{ strokeLinecap: 'butt' }}
            />
            <path
              d="M 11.5,30 C 15,29 30,29 33.5,30 M 12,33.5 C 18,32.5 27,32.5 33,33.5"
              style={{ fill: 'none', stroke: '#ffffff' }}
            />
          </g>
        </svg>
      );
    case 'bK':
      return (
        <svg viewBox="0 0 45 45" className={className}>
          <g
            style={{
              opacity: 1,
              fill: 'none',
              fillRule: 'evenodd',
              fillOpacity: 1,
              stroke: '#000000',
              strokeWidth: 1.5,
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeMiterlimit: 4,
              strokeDasharray: 'none',
              strokeOpacity: 1,
            }}
          >
            <path
              d="M 22.5,11.63 L 22.5,6"
              style={{ fill: 'none', stroke: '#000000', strokeLinejoin: 'miter' }}
            />
            <path
              d="M 20,8 L 25,8"
              style={{ fill: 'none', stroke: '#000000', strokeLinejoin: 'miter' }}
            />
            <path
              d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 24,11.5 21,11.5 22.5,8.5 C 24,11.5 21,11.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25"
              style={{ fill: '#242424', stroke: '#000000', strokeLinecap: 'butt' }}
            />
            <path
              d="M 11.5,37 C 17,40.5 28,40.5 33.5,37 C 36.5,34 36.5,28.5 36.5,28.5 C 36.5,28.5 34.5,25 31,25 C 27.5,25 25.5,28 22.5,28 C 19.5,28 17.5,25 14,25 C 10.5,25 8.5,28.5 8.5,28.5 C 8.5,28.5 8.5,34 11.5,37 z"
              style={{ fill: '#242424', stroke: '#000000' }}
            />
            <path
              d="M 11.5,30 C 17,27 28,27 33.5,30"
              style={{ fill: 'none', stroke: '#ffffff' }}
            />
            <path
              d="M 11.5,33.5 C 17,30.5 28,30.5 33.5,33.5"
              style={{ fill: 'none', stroke: '#ffffff' }}
            />
            <path
              d="M 11.5,37 C 17,34 28,34 33.5,37"
              style={{ fill: 'none', stroke: '#ffffff' }}
            />
          </g>
        </svg>
      );
    default:
      return null;
  }
};
