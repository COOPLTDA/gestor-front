import { describe, it, expect } from 'vitest';
import { normalizeForSearch } from './normalization';

describe('normalizeForSearch', () => {
  it('convierte a minúsculas', () => {
    expect(normalizeForSearch('LANUS ESTE')).toBe('lanus este');
  });

  it('deja intacto un string ya normalizado', () => {
    expect(normalizeForSearch('lomas')).toBe('lomas');
  });

  it('maneja el string vacío', () => {
    expect(normalizeForSearch('')).toBe('');
  });
});
