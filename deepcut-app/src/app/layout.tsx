import type { Metadata, Viewport } from 'next';
import { Press_Start_2P, VT323 } from 'next/font/google';
import { cssVariables } from '@/design/tokens';
import './globals.css';

const press = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-press', display: 'swap' });
const vt = VT323({ weight: '400', subsets: ['latin'], variable: '--font-vt', display: 'swap' });

export const metadata: Metadata = {
  title: 'Deep Cut · scava nel disco',
  description: 'Ogni giorno 7 artisti: scrivi una loro canzone. Più è sconosciuta, più scavi in profondità.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#181425',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${press.variable} ${vt.variable}`} style={cssVariables() as React.CSSProperties}>
      <body>{children}</body>
    </html>
  );
}
