import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = '🥗 LANSEL - Gestión de comidas';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8f5ed', color: '#173c35', fontFamily: 'sans-serif' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
          <div style={{ fontSize: 160 }}>🥗</div>
          <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2 }}>LANSEL</div>
          <div style={{ fontSize: 34, color: '#42735d' }}>Gestión de comidas</div>
        </div>
      </div>
    ),
    size
  );
}
