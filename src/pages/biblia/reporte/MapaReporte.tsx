import { useEffect, useMemo, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from 'react-leaflet'
import { FileText } from 'lucide-react'
import { formatCurrency } from '@/pages/biblia/utils/bibliaUtils'

// El tamaño del contenedor cambia (sidebar, tabs, animación del modal) después de que
// Leaflet mide su tamaño inicial. Sin esto, el mosaico de tiles queda desalineado con
// el área realmente visible.
function AjusteTamano() {
  const map = useMap()
  useEffect(() => {
    const contenedor = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(contenedor)
    return () => ro.disconnect()
  }, [map])
  return null
}

// MapContainer solo usa `center` en el montaje inicial: sin esto, al cambiar de fecha/zona
// los marcadores se actualizan pero la vista queda centrada en el dataset anterior.
function Recentrar({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => {
    map.setView([lat, lng], map.getZoom())
  }, [lat, lng, map])
  return null
}

const PALETTE = [
  '#2563eb', '#dc2626', '#16a34a', '#d97706', '#9333ea',
  '#0891b2', '#be185d', '#65a30d', '#c2410c', '#7c3aed',
  '#0d9488', '#e11d48', '#4d7c0f', '#b45309', '#6d28d9',
  '#0369a1', '#9d174d', '#3f6212', '#9a3412', '#5b21b6',
]
const COLOR_MIXTO = '#64748b'

export interface MapaPin {
  key: string
  descripcion: string
  lat: number
  lng: number
  zona: string
  codigoDespacho: string
  importe: number
  choferes: { codigo: string; nombre: string }[]
}

export type Modo = 'zona' | 'codigo' | 'chofer'

function colorForValue(value: string, universo: string[]): string {
  const idx = universo.indexOf(value)
  return PALETTE[idx % PALETTE.length]
}

function valoresDePin(pin: MapaPin, modo: Modo): string[] {
  if (modo === 'zona') return [pin.zona]
  if (modo === 'codigo') return [pin.codigoDespacho]
  return pin.choferes.map(ch => ch.codigo)
}

interface Props {
  pines: MapaPin[]
  loading: boolean
  modo: Modo
  onPinClick?: (pin: MapaPin) => void
}

export function MapaReporte({ pines, loading, modo, onPinClick }: Props) {
  const [ocultosPorModo, setOcultosPorModo] = useState<Record<Modo, Set<string>>>({
    zona: new Set(), codigo: new Set(), chofer: new Set(),
  })
  const ocultos = ocultosPorModo[modo]

  const opcionesPorModo = useMemo(() => {
    const zonas = new Map<string, string>()
    const codigos = new Map<string, string>()
    const choferesMap = new Map<string, string>()
    for (const p of pines) {
      zonas.set(p.zona, p.zona)
      codigos.set(p.codigoDespacho, p.codigoDespacho)
      for (const ch of p.choferes) choferesMap.set(ch.codigo, ch.nombre)
    }
    const toOpciones = (m: Map<string, string>) => [...m.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
    return {
      zona: toOpciones(zonas),
      codigo: toOpciones(codigos),
      chofer: toOpciones(choferesMap),
    } satisfies Record<Modo, { value: string; label: string }[]>
  }, [pines])

  const opciones = opcionesPorModo[modo]
  const universo = useMemo(() => opciones.map(o => o.value), [opciones])

  const pinesVisibles = useMemo(() => {
    if (ocultos.size === 0) return pines
    return pines.filter(p => valoresDePin(p, modo).some(v => !ocultos.has(v)))
  }, [pines, modo, ocultos])

  function toggleValor(value: string) {
    setOcultosPorModo(prev => {
      const next = new Set(prev[modo])
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return { ...prev, [modo]: next }
    })
  }

  function toggleTodos() {
    setOcultosPorModo(prev => ({ ...prev, [modo]: prev[modo].size === 0 ? new Set(universo) : new Set() }))
  }

  function colorForPin(pin: MapaPin): string {
    if (modo === 'chofer') {
      if (pin.choferes.length !== 1) return COLOR_MIXTO
      return colorForValue(pin.choferes[0].codigo, universo)
    }
    return colorForValue(modo === 'zona' ? pin.zona : pin.codigoDespacho, universo)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
        Cargando mapa…
      </div>
    )
  }

  if (pines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400">
        <FileText className="w-12 h-12" />
        <p className="text-sm font-medium">No hay clientes con coordenadas en este período</p>
      </div>
    )
  }

  const avgLat = pines.reduce((s, p) => s + p.lat, 0) / pines.length
  const avgLng = pines.reduce((s, p) => s + p.lng, 0) / pines.length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 8 }}>
      <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <MapContainer
            center={[avgLat, avgLng]}
            zoom={11}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <AjusteTamano />
            <Recentrar lat={avgLat} lng={avgLng} />
            {pinesVisibles.map(pin => {
              const color = colorForPin(pin)
              return (
                <CircleMarker
                  key={pin.key}
                  center={[pin.lat, pin.lng]}
                  radius={7}
                  pathOptions={{ color, fillColor: color, fillOpacity: 0.75, weight: 1.5 }}
                  eventHandlers={onPinClick ? { click: () => onPinClick(pin) } : undefined}
                >
                  <Tooltip>
                    <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 600 }}>{pin.descripcion}</div>
                      <div>{pin.codigoDespacho} · {pin.zona}</div>
                      {pin.choferes.length > 0 && (
                        <div>{pin.choferes.map(ch => ch.nombre).join(', ')}</div>
                      )}
                      <div style={{ fontWeight: 500, color: '#15803d' }}>{formatCurrency(pin.importe)}</div>
                    </div>
                  </Tooltip>
                </CircleMarker>
              )
            })}
          </MapContainer>
        </div>

        <div style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e5e7eb', paddingLeft: 12 }}>
          <span style={{ fontSize: 13, color: '#9ca3af', marginBottom: 8 }}>
            {pinesVisibles.length} cliente{pinesVisibles.length !== 1 ? 's' : ''} con coordenadas
          </span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 600, color: '#374151', cursor: 'pointer', paddingBottom: 8, marginBottom: 6, borderBottom: '1px solid #e5e7eb' }}>
            <input type="checkbox" checked={ocultos.size === 0} onChange={toggleTodos} style={{ margin: 0, width: 15, height: 15 }} />
            Todos
          </label>
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {opciones.map(op => {
              const oculto = ocultos.has(op.value)
              return (
                <label key={op.value} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: oculto ? '#9ca3af' : '#374151', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!oculto} onChange={() => toggleValor(op.value)} style={{ margin: 0, width: 14, height: 14, flexShrink: 0 }} />
                  <span style={{ display: 'inline-block', width: 13, height: 13, borderRadius: '50%', background: colorForValue(op.value, universo), flexShrink: 0, opacity: oculto ? 0.4 : 1 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{op.label}</span>
                </label>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
