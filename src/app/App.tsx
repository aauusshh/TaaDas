import { brand } from '../config/brand';

export function App() {
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 400 }}>{brand.name}</h1>
    </main>
  );
}
