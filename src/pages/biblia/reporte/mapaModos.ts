import type { Modo } from './MapaReporte'

export const MODOS: { value: Modo; label: string }[] = [
  { value: 'zona', label: 'Zona' },
  { value: 'codigo', label: 'Código de despacho' },
  { value: 'chofer', label: 'Chofer' },
]
