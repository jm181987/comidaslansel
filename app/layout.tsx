import './globals.css';

export const metadata = {
  title: 'LANSEL · Gestión de comidas',
  description: 'Pedidos de comidas para funcionarios',
  icons: { icon: '/icon.svg' },
  openGraph: {
    title: '🥗 LANSEL · Gestión de comidas',
    description: 'Pedidos de comidas para funcionarios',
    type: 'website' as const,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: '🥗 LANSEL · Gestión de comidas' }]
  },
  twitter: { card: 'summary_large_image' as const }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>;
}
