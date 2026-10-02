import { describe, expect, it } from 'vitest';
import { brand } from './brand';

describe('brand', () => {
  it('has a name and peer prefix usable in a peer id', () => {
    expect(brand.name.length).toBeGreaterThan(0);
    expect(brand.peerPrefix).toMatch(/^[a-z0-9]+$/);
  });
});
