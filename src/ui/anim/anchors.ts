import { useCallback } from 'react';

/** Table pieces register themselves here so flights know where to start and land. */
const anchors = new Map<string, HTMLElement>();

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function useAnchor(key: string) {
  return useCallback(
    (el: HTMLElement | null) => {
      if (el) anchors.set(key, el);
      else anchors.delete(key);
    },
    [key],
  );
}

export function anchorRect(key: string): Rect | null {
  const el = anchors.get(key);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

export function hasAnchor(key: string) {
  return anchors.has(key);
}
