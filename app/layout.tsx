import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { PwaRegister } from '@/components/PwaRegister';

const inter = Inter({ subsets: ['latin'] });

export const viewport: Viewport = {
  themeColor: '#070b13',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'ChessLens — Free, Account-Free Chess Game Review',
  description:
    'Paste a PGN to get unlimited, instant grandmaster-grade game review powered by Stockfish in your browser. 100% private, zero cost, no login required.',
  manifest: '/manifest.json',
  icons: {
    icon: '/pieces/wN.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-[#070b13] text-slate-100 antialiased flex flex-col`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
