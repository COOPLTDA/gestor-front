import { describe, it, expect } from 'vitest';
import { MODOS } from './mapaModos';

describe('MODOS', () => {
  it('define los tres modos del mapa en orden', () => {
    expect(MODOS.map(m => m.value)).toEqual(['zona', 'codigo', 'chofer']);
  });

  it('cada modo tiene un label legible', () => {
    expect(MODOS.find(m => m.value === 'zona')?.label).toBe('Zona');
    expect(MODOS.find(m => m.value === 'codigo')?.label).toBe('Código de despacho');
    expect(MODOS.find(m => m.value === 'chofer')?.label).toBe('Chofer');
  });
});
