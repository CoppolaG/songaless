import type { NextConfig } from 'next';

// Esportazione statica: la cartella out/ si può pubblicare su GitHub Pages.
// Per pubblicarla sotto un sottopercorso (es. /songaless/deepcut) imposta
// NEXT_PUBLIC_BASE_PATH prima di `npm run build`.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
