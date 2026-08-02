import { describe, it, expect } from 'vitest';
import { formatCurrency, ESTADO_DOT } from './bibliaUtils';

describe('formatCurrency', () => {
  it('formatea como pesos argentinos sin decimales', () => {
    expect(formatCurrency(1234)).toBe('$ 1.234');
  });

  it('formatea cero correctamente', () => {
    expect(formatCurrency(0)).toBe('$ 0');
  });
});

describe('ESTADO_DOT', () => {
  it('tiene las keys en minúscula (regresión F2: el estado real llega con mayúscula inicial)', () => {
    for (const key of Object.keys(ESTADO_DOT)) {
      expect(key).toBe(key.toLowerCase());
    }
  });

  it('cubre los estados conocidos de una preparación', () => {
    for (const estado of ['pendiente', 'en preparacion', 'completada', 'remitido', 'eliminado']) {
      expect(ESTADO_DOT[estado]).toBeDefined();
    }
  });
});

// --- Refuerzos de mutation testing: valores exactos de las tablas de estilo ---
// Estas tablas son datos (estado→clase). Asegurar el valor exacto evita que una
// mutación las vacíe sin que ningún test lo note.

import { ESTADO_BORDER, TIPO_BG } from './bibliaUtils';

describe('tablas de estilo — valores exactos', () => {
  it('ESTADO_DOT mapea cada estado a su color', () => {
    expect(ESTADO_DOT).toEqual({
      pendiente: 'bg-slate-400',
      'en preparacion': 'bg-amber-400',
      completada: 'bg-emerald-500',
      completo: 'bg-emerald-500',
      remitido: 'bg-sky-500',
      eliminado: 'bg-red-400',
    });
  });

  it('ESTADO_BORDER mapea cada estado a su borde', () => {
    expect(ESTADO_BORDER).toEqual({
      pendiente: 'border-l-slate-400',
      'en preparacion': 'border-l-amber-400',
      completada: 'border-l-emerald-500',
      completo: 'border-l-emerald-500',
      remitido: 'border-l-sky-500',
      eliminado: 'border-l-red-400',
    });
  });

  it('TIPO_BG mapea cada tipo de preparación a su fondo', () => {
    expect(TIPO_BG).toEqual({
      'Pedidos individuales': 'bg-amber-100',
      'Agrupa por direccion de entrega': 'bg-teal-100',
      'Consolidado de pedidos': 'bg-violet-100',
      'Consolidado que luego se va a desconsolidar.': 'bg-violet-100',
    });
  });
});
