import { describe, it, expect } from 'vitest';
import { formatMoney, buildPopupHtml, escapeHtml, safeColor } from './MapView';
import type { Pdv } from '../types';

function pdv(overrides: Partial<Pdv> = {}): Pdv {
  return {
    id: '1', n: 'Cliente Uno', dir: 'Calle 123', com: 'Almacén', loc: 'CABA', par: 'CABA',
    lat: -34.6, lng: -58.4, desactivado: false, vnd_cod: 'V1', vnd_nombre: 'Vendedor Uno', dia: 1, frq: 'Semanal', reparto: 'Reparto A',
    vendedores: [{ cod: 'V1', nombre: 'Vendedor Uno', dia: 1, frq: 'Semanal', reparto: 'Reparto A' }],
    facturacion: 150000, proveedores: [], divisiones: [], lineas: [], articulos: [],
    ...overrides,
  };
}

const RANGO = { desde: '2025-07-28', hasta: '2026-07-28' };

describe('escapeHtml', () => {
  it('escapa &, < y >', () => {
    expect(escapeHtml('A & B < C > D')).toBe('A &amp; B &lt; C &gt; D');
  });

  it('no toca texto sin caracteres especiales', () => {
    expect(escapeHtml('Cliente Normal')).toBe('Cliente Normal');
  });
});

describe('safeColor', () => {
  it('devuelve el color si es un hex válido', () => {
    expect(safeColor('#7c3aed')).toBe('#7c3aed');
  });

  it('devuelve el gris por defecto ante un color inválido (ej. inyección de atributo)', () => {
    expect(safeColor('red" onmouseover="alert(1)')).toBe('#6b7280');
  });
});

describe('formatMoney', () => {
  it('formatea con el símbolo de peso y sin decimales', () => {
    expect(formatMoney(150000)).toMatch(/^\$\s?150\.000$/);
  });

  it('formatea 0 correctamente', () => {
    expect(formatMoney(0)).toMatch(/^\$\s?0$/);
  });
});

describe('buildPopupHtml', () => {
  it('incluye id, nombre y los datos principales del cliente', () => {
    const html = buildPopupHtml(pdv({ id: '42', n: 'Kiosco Norte' }), [], RANGO);
    expect(html).toContain('42 - Kiosco Norte');
    expect(html).toContain('Calle 123, CABA, CABA');
    expect(html).toContain('Almacén');
    expect(html).toContain('Reparto A');
  });

  it('usa "–" como fallback para dirección y reparto faltantes, "Sin rubro" para el tipo', () => {
    const html = buildPopupHtml(pdv({ dir: '', loc: '', par: '', com: null, reparto: null }), [], RANGO);
    const guiones = (html.match(/–/g) || []).length;
    expect(guiones).toBeGreaterThanOrEqual(2);
    expect(html).toContain('Sin rubro');
  });

  it('lista cada vendedor asignado en una sola línea, con día y frecuencia', () => {
    const html = buildPopupHtml(pdv({
      vendedores: [
        { cod: 'V1', nombre: 'Vendedor Uno', dia: 1, frq: 'Semanal', reparto: 'R' },
        { cod: 'V2', nombre: null, dia: 2, frq: null, reparto: 'R2' },
      ],
    }), [], RANGO);

    expect(html).toContain('Vendedor Uno (Lunes, Semanal)');
    expect(html).toContain('V2 (Martes)');
  });

  it('avisa "sin vendedor asignado" si no tiene ninguno', () => {
    const html = buildPopupHtml(pdv({ vendedores: [] }), [], RANGO);
    expect(html).toContain('Sin vendedor asignado');
  });

  it('resalta en negrita/violeta los vendedores que coinciden con el filtro activo', () => {
    const html = buildPopupHtml(pdv({
      vendedores: [
        { cod: 'V1', nombre: 'Uno', dia: 1, frq: 'SE', reparto: 'R' },
        { cod: 'V2', nombre: 'Dos', dia: 1, frq: 'SE', reparto: 'R' },
      ],
    }), ['V2'], RANGO);

    expect(html).toContain('<span style="font-weight:700;color:#7c3aed">Dos');
    expect(html).toContain('<span style="">Uno');
  });

  it('sin filtro de vendedor activo, ningún vendedor se resalta', () => {
    const html = buildPopupHtml(pdv({ vendedores: [{ cod: 'V1', nombre: 'Uno', dia: 1, frq: 'SE', reparto: 'R' }] }), [], RANGO);
    expect(html).toContain('<span style="">Uno');
  });

  it('escapa HTML en campos controlados por datos (nombre, dirección)', () => {
    const html = buildPopupHtml(pdv({ n: '<script>alert(1)</script>', dir: 'Calle & Cía' }), [], RANGO);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Calle &amp; Cía');
  });

  it('incluye el botón de excluir con el id del PDV', () => {
    const html = buildPopupHtml(pdv({ id: 'ID-99' }), [], RANGO);
    expect(html).toContain('data-excluir-id="ID-99"');
  });

  it('formatea la facturación con el mismo criterio que formatMoney', () => {
    const html = buildPopupHtml(pdv({ facturacion: 150000 }), [], RANGO);
    expect(html).toContain(formatMoney(150000));
  });

  it('el label de facturación muestra el rango de fechas filtrado, no un "(12m)" fijo', () => {
    const html = buildPopupHtml(pdv(), [], RANGO);
    expect(html).toContain('Facturación (28/07/2025–28/07/2026):');
  });
});
