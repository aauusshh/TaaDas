import { useEffect, useState } from 'react';

export interface Viewport {
  w: number;
  h: number;
  landscape: boolean;
}

const read = (): Viewport => ({
  w: window.innerWidth,
  h: window.innerHeight,
  landscape: window.innerWidth > window.innerHeight,
});

export function useViewport(): Viewport {
  const [v, setV] = useState(read);
  useEffect(() => {
    const on = () => setV(read());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
    };
  }, []);
  return v;
}

/** Hand card width: about 22% of viewport height in landscape, never under 52 px (64 where it fits). */
export function handCardWidth(v: Viewport): number {
  if (v.landscape) return Math.round(Math.max(52, Math.min(80, v.h * 0.2)));
  return Math.round(Math.max(52, Math.min(72, v.w * 0.175)));
}
