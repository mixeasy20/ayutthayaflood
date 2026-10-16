import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans_Thai_Looped } from 'next/font/google';
import './tailwind.css';
import './globals.css';
import './responsive.css';
import 'maplibre-gl/dist/maplibre-gl.css';

const ibmPlex = IBM_Plex_Sans_Thai_Looped({
  weight: ['400', '500', '600', '700'],
  subsets: ['latin', 'thai'],
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: 'FloodWatch Ayutthaya',
  description: 'Flood forecasts and monitoring for Ayutthaya Province, Thailand.',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="th" className={ibmPlex.className}><body>{children}</body></html>;
}
