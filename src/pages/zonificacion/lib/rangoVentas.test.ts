import { describe, it, expect, vi, afterEach } from 'vitest';
import { defaultRangoVentas, formatRangoVentas } from './rangoVentas';

describe('defaultRangoVentas', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('devuelve un rango de 1 mes hacia atrás desde hoy, no 12', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-28T12:00:00Z'));

    expect(defaultRangoVentas()).toEqual({ desde: '2026-06-28', hasta: '2026-07-28' });
  });
});

describe('formatRangoVentas', () => {
  it('formatea desde/hasta como DD/MM/YYYY–DD/MM/YYYY', () => {
    expect(formatRangoVentas({ desde: '2025-07-28', hasta: '2026-07-28' })).toBe('28/07/2025–28/07/2026');
  });
});
