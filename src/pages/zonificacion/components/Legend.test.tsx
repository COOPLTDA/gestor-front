import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Legend } from './Legend';
import { diaColor, getVndCodColor, getRepartoColor, getRubroColor } from '../lib/colors';
import type { Pdv } from '../types';

function pdv(overrides: Partial<Pdv> = {}): Pdv {
  return {
    id: '1', n: 'Cliente', dir: '', com: 'Almacén', loc: '', par: '',
    lat: 0, lng: 0, desactivado: false, vnd_cod: 'V1', vnd_nombre: 'V', dia: 1, frq: null, reparto: 'Reparto A',
    vendedores: [], facturacion: 0, proveedores: [], divisiones: [], lineas: [], articulos: [],
    ...overrides,
  };
}

describe('Legend', () => {
  it('esquema "dia": lista los días presentes en orden Lunes..Domingo, sin día al final', () => {
    render(<Legend scheme="dia" currentData={[pdv({ dia: 7 }), pdv({ dia: 1 }), pdv({ dia: null })]} />);

    const labels = screen.getAllByText(/Lunes|Domingo|Sin día/).map((el) => el.textContent);
    expect(labels).toEqual(['Lunes', 'Domingo', 'Sin día']);
  });

  it('esquema "dia": no lista los días que no están presentes en los datos', () => {
    render(<Legend scheme="dia" currentData={[pdv({ dia: 1 }), pdv({ dia: 7 })]} />);

    ['Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Sin día'].forEach((label) => {
      expect(screen.queryByText(label)).not.toBeInTheDocument();
    });
  });

  it('esquema "dia": cubre cada label individualmente (Martes..Sábado)', () => {
    render(<Legend scheme="dia" currentData={[pdv({ dia: 2 }), pdv({ dia: 3 }), pdv({ dia: 4 }), pdv({ dia: 5 }), pdv({ dia: 6 })]} />);

    ['Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'].forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('esquema "dia": no repite días ya vistos', () => {
    render(<Legend scheme="dia" currentData={[pdv({ dia: 1 }), pdv({ dia: 1 })]} />);
    expect(screen.getAllByText('Lunes')).toHaveLength(1);
  });

  it('esquema "vendedor": lista códigos únicos, ordenados, ignorando null', () => {
    render(<Legend scheme="vendedor" currentData={[pdv({ vnd_cod: 'V2' }), pdv({ vnd_cod: 'V1' }), pdv({ vnd_cod: null })]} />);
    const labels = screen.getAllByText(/^V\d/).map((el) => el.textContent);
    expect(labels).toEqual(['V1', 'V2']);
  });

  it('esquema "vendedor": un vnd_cod null no agrega una entrada extra (no distingue null de otro null)', () => {
    render(<Legend scheme="vendedor" currentData={[pdv({ vnd_cod: 'V1' }), pdv({ vnd_cod: null }), pdv({ vnd_cod: null })]} />);
    expect(screen.getAllByText(/^V\d/)).toHaveLength(1);
  });

  it('esquema "reparto": lista repartos únicos, ordenados', () => {
    render(<Legend scheme="reparto" currentData={[pdv({ reparto: 'Reparto B' }), pdv({ reparto: 'Reparto A' })]} />);
    const labels = screen.getAllByText(/^Reparto/).map((el) => el.textContent);
    expect(labels).toEqual(['Reparto A', 'Reparto B']);
  });

  it('esquema "reparto": ignora entradas sin reparto asignado', () => {
    render(<Legend scheme="reparto" currentData={[pdv({ reparto: 'Reparto A' }), pdv({ reparto: null })]} />);
    expect(screen.getAllByText(/^Reparto/)).toHaveLength(1);
  });

  it('cualquier otro esquema (ej. "tipo") lista comercios únicos, ordenados', () => {
    render(<Legend scheme="tipo" currentData={[pdv({ com: 'Kiosco' }), pdv({ com: 'Almacén' })]} />);
    const labels = screen.getAllByText(/Almacén|Kiosco/).map((el) => el.textContent);
    expect(labels).toEqual(['Almacén', 'Kiosco']);
  });

  it('esquema "tipo": ignora entradas sin comercio asignado', () => {
    render(<Legend scheme="tipo" currentData={[pdv({ com: 'Almacén' }), pdv({ com: null })]} />);
    expect(screen.getAllByText(/Almacén|Kiosco/)).toHaveLength(1);
  });

  it('sin datos, no muestra ninguna entrada', () => {
    const { container } = render(<Legend scheme="tipo" currentData={[]} />);
    expect(container.querySelectorAll('span > span').length).toBe(0);
  });

  it('usa el mismo color que expone lib/colors para cada esquema', () => {
    render(<Legend scheme="dia" currentData={[pdv({ dia: 1 })]} />);
    const dot = screen.getByText('Lunes').previousElementSibling as HTMLElement;
    expect(dot.style.background).toBe(diaColor(1));
  });

  it('vendedor: el color del punto coincide con getVndCodColor', () => {
    render(<Legend scheme="vendedor" currentData={[pdv({ vnd_cod: 'LEGEND-V1' })]} />);
    const dot = screen.getByText('LEGEND-V1').previousElementSibling as HTMLElement;
    expect(dot.style.background).toBe(getVndCodColor('LEGEND-V1'));
  });

  it('reparto: el color del punto coincide con getRepartoColor', () => {
    render(<Legend scheme="reparto" currentData={[pdv({ reparto: 'LEGEND-R1' })]} />);
    const dot = screen.getByText('LEGEND-R1').previousElementSibling as HTMLElement;
    expect(dot.style.background).toBe(getRepartoColor('LEGEND-R1'));
  });

  it('tipo: el color del punto coincide con getRubroColor', () => {
    render(<Legend scheme="tipo" currentData={[pdv({ com: 'LEGEND-C1' })]} />);
    const dot = screen.getByText('LEGEND-C1').previousElementSibling as HTMLElement;
    expect(dot.style.background).toBe(getRubroColor('LEGEND-C1'));
  });
});
