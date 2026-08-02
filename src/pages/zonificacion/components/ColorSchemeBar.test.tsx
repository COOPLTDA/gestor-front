import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColorSchemeBar } from './ColorSchemeBar';

describe('ColorSchemeBar', () => {
  it('muestra un botón por cada esquema de color', () => {
    render(<ColorSchemeBar scheme="tipo" onChange={vi.fn()} />);
    ['Tipo PDV', 'Día visita', 'Vendedor', 'Reparto'].forEach((label) => {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    });
  });

  it('llama a onChange con el value del esquema clickeado', () => {
    const onChange = vi.fn();
    render(<ColorSchemeBar scheme="tipo" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Vendedor' }));

    expect(onChange).toHaveBeenCalledWith('vendedor');
  });

  it('marca como activo (variant default = bg-primary) solo el esquema seleccionado', () => {
    render(<ColorSchemeBar scheme="dia" onChange={vi.fn()} />);

    const activo = screen.getByRole('button', { name: 'Día visita' });
    expect(activo.className).toContain('bg-primary');

    ['Tipo PDV', 'Vendedor', 'Reparto'].forEach((label) => {
      expect(screen.getByRole('button', { name: label }).className).not.toContain('bg-primary');
    });
  });

  it('cada esquema activa el que corresponde (no queda pegado al primero)', () => {
    render(<ColorSchemeBar scheme="reparto" onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Reparto' }).className).toContain('bg-primary');
    expect(screen.getByRole('button', { name: 'Tipo PDV' }).className).not.toContain('bg-primary');
  });
});
