import { useState, useMemo, useCallback, useEffect, type DragEvent } from "react";
import type { Preparacion, CodigoDespacho, SigmaSyncEstado } from "../types/biblia";
import type { PedidoCambioEstado } from "../../../services/bibliaApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Eye, GripVertical, Search, X, Lock, Wand2, CornerUpLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, ESTADO_BORDER, TIPO_BG } from "../utils/bibliaUtils";
import { normalizeForSearch } from "@/utils/normalization";
import { PreparacionDetalleModal } from "./PreparacionDetalleModal";

interface PendingSidebarProps {
  preparaciones: Preparacion[];
  codigosDespacho?: CodigoDespacho[];
  ocupadasEnOtraBiblia?: Map<number, string>;
  onDragStart?: (prep: Preparacion) => void;
  onDragEnd?: () => void;
  onModificado?: () => void;
  onAutoAsignar?: () => Promise<number>;
  draggedPrep?: Preparacion | null;
  onDesasignar?: (prepId: number) => void;
  sigmaEstadoByPrepId?: Map<number, SigmaSyncEstado>;
  pedidoCambiosByPrepId?: Map<number, PedidoCambioEstado[]>;
  asignacionCrossCodeByPrepId?: Map<number, { destino_nombre: string | null; destino_id: string | null; sigma_sync_estado: SigmaSyncEstado }>;
  fecha?: string;
}

const TABS_CONFIG = [
  { value: "individual", label: "Pedido suelto", tipo: "Pedidos individuales" },
  {
    value: "misma_direccion",
    label: "Misma Dirección",
    tipo: "Agrupa por direccion de entrega",
  },
  {
    value: "consolidado",
    label: "Consolidado",
    tipo: "Consolidado de pedidos",
  },
];

export function PendingSidebar({ preparaciones, codigosDespacho = [], ocupadasEnOtraBiblia, onDragStart, onDragEnd, onModificado, onAutoAsignar, draggedPrep, onDesasignar, sigmaEstadoByPrepId, pedidoCambiosByPrepId, asignacionCrossCodeByPrepId, fecha }: PendingSidebarProps) {
  const [activeTab, setActiveTab] = useState("individual");
  const [busqueda, setBusqueda] = useState("");
  const [modalPreparacion, setModalPreparacion] = useState<Preparacion | null>(
    null,
  );
  const [autoAsignando, setAutoAsignando] = useState(false);
  const [autoAsignMsg, setAutoAsignMsg] = useState<string | null>(null);

  const handleAutoAsignar = useCallback(async () => {
    // El guard "if (!onAutoAsignar) return" es inalcanzable en la práctica: handleAutoAsignar
    // solo se invoca desde el botón "Auto-asignar", que a su vez solo se renderiza cuando
    // onAutoAsignar está definido (ver `{onAutoAsignar && (...)}` más abajo). No se fuerza un test.
    if (!onAutoAsignar) return;
    setAutoAsignando(true);
    setAutoAsignMsg(null);
    try {
      const n = await onAutoAsignar();
      setAutoAsignMsg(n > 0 ? `${n} asignada${n !== 1 ? 's' : ''}` : 'Nada para asignar');
    } finally {
      setAutoAsignando(false);
    }
  }, [onAutoAsignar]);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of preparaciones) {
      const tipo = p.tipo === "Consolidado que luego se va a desconsolidar."
        ? "Consolidado de pedidos"
        : p.tipo;
      counts[tipo] = (counts[tipo] || 0) + 1;
    }
    return counts;
  }, [preparaciones]);

  const filtered = useMemo(() => {
    const tab = TABS_CONFIG.find((t) => t.value === activeTab);
    const byTab = tab
      ? preparaciones.filter((p) =>
          p.tipo === tab.tipo ||
          (tab.value === "consolidado" && p.tipo === "Consolidado que luego se va a desconsolidar.")
        )
      : preparaciones;
    const lista = busqueda.trim() ? (() => {
      const q = normalizeForSearch(busqueda);
      return byTab.filter(p => {
        if (normalizeForSearch(p.codigo_envio ?? '').includes(q)) return true;
        if (normalizeForSearch(String(p.id)).includes(q)) return true;
        return p.pedidos.some(ped =>
          normalizeForSearch(ped.codigo ?? '').includes(q) ||
          normalizeForSearch(ped.cliente_nombre ?? '').includes(q) ||
          normalizeForSearch(ped.codigo_despacho ?? '').includes(q)
        );
      });
    })() : byTab;
    const ORDER = ['completada', 'completo', 'en preparacion', 'pendiente'];
    const estadoIdx = (p: typeof lista[0]) => {
      const idx = ORDER.indexOf(normalizeForSearch(p.estado ?? ''));
      return idx === -1 ? ORDER.length : idx;
    };
    // 1. Por estado: completadas → en preparacion → pendiente
    // 2. Asignadas a otra biblia al final
    return [...lista].sort((a, b) => {
      const aOcupada = ocupadasEnOtraBiblia?.has(a.id) ? 1 : 0;
      const bOcupada = ocupadasEnOtraBiblia?.has(b.id) ? 1 : 0;
      if (aOcupada !== bOcupada) return aOcupada - bOcupada;
      return estadoIdx(a) - estadoIdx(b);
    });
  }, [preparaciones, activeTab, busqueda, ocupadasEnOtraBiblia]);

  const [draggedId, setDraggedId] = useState<number | null>(null)
  const [dropOver, setDropOver] = useState(false)

  // Drag que viene de ChoferesList (prep asignada): la prep NO está en el sidebar
  const isExternalDrag = draggedPrep != null && !preparaciones.some(p => p.id === draggedPrep.id)

  useEffect(() => {
    if (draggedId !== null && !preparaciones.some(p => p.id === draggedId)) {
      setDraggedId(null)
    }
  }, [preparaciones, draggedId])

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, p: Preparacion) => {
    e.dataTransfer.setData('text/plain', String(p.id));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedId(p.id);
    // Diferido: dejar que el navegador "tome" el arrastre antes de que la vista de choferes
    // se comprima a la grilla (si no, el cambio de DOM durante el dragstart cancela el drag).
    requestAnimationFrame(() => onDragStart?.(p));
  }, [onDragStart]);

  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
    onDragEnd?.();
  }, [onDragEnd]);

  return (
    <Card
      className="w-[320px] shrink-0 flex flex-col overflow-hidden"
      onDragOver={isExternalDrag ? e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropOver(true) } : undefined}
      onDragLeave={isExternalDrag ? e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropOver(false) } : undefined}
      // El guard "if (draggedPrep)" es inalcanzable en la práctica: onDrop solo se asigna cuando
      // isExternalDrag es true, y eso implica por definición que draggedPrep != null. No se fuerza un test.
      onDrop={isExternalDrag ? e => { e.preventDefault(); setDropOver(false); if (draggedPrep) { onDesasignar?.(draggedPrep.id); onDragEnd?.() } } : undefined}
    >
      <div className="px-3 pt-3 pb-2 border-b border-border">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
            Preparaciones
          </h2>
          {onAutoAsignar && (
            <div className="flex items-center gap-1.5">
              {autoAsignMsg && <span className="text-xs text-slate-400">{autoAsignMsg}</span>}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1"
                disabled={autoAsignando}
                onClick={handleAutoAsignar}
                title="Asignar automáticamente las pendientes cuyo código de despacho atiende un solo chofer"
              >
                <Wand2 className="w-3.5 h-3.5" />
                {autoAsignando ? 'Asignando…' : 'Auto-asignar'}
              </Button>
            </div>
          )}
        </div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full h-auto p-0.5">
            <div className="grid grid-cols-3 w-full gap-0.5">
              {TABS_CONFIG.map((tab) => {
                const count = tabCounts[tab.tipo] || 0;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex-col gap-0 whitespace-normal text-xs px-1 py-1.5 leading-tight data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                  >
                    <span>{tab.label}</span>
                    <span className="text-xs opacity-70">({count})</span>
                  </TabsTrigger>
                );
              })}
            </div>
          </TabsList>
        </Tabs>
      </div>

      <div className="px-3 pt-1.5 pb-1.5 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
          <input
            className="w-full h-7 pl-7 pr-7 text-xs rounded-md border border-input bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Buscar por código, despacho o cliente…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
          {busqueda && (
            <button
              className="absolute right-2 top-1.5 text-slate-400 hover:text-slate-600"
              onClick={() => setBusqueda("")}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1.5">
        {isExternalDrag && (
          <div className={cn(
            "flex items-center gap-2 p-3 rounded-lg border-2 border-dashed text-sm transition-colors",
            dropOver ? "border-orange-500 bg-orange-100 text-orange-700" : "border-orange-300 bg-orange-50 text-orange-500"
          )}>
            <CornerUpLeft className="w-4 h-4 shrink-0" />
            <span>Soltar aquí para desasignar</span>
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Package className="w-10 h-10 mb-2 text-muted-foreground/50" />
            <span className="text-sm">No hay preparaciones</span>
          </div>
        ) : (
          filtered.map((preparacion) => {
            const pedido = preparacion.pedidos[0];
            const bibliaBloqueada = ocupadasEnOtraBiblia?.get(preparacion.id);
            const bloqueada = !!bibliaBloqueada;
            const bibliaBloqueadaLabel = bibliaBloqueada
              ? new Date(bibliaBloqueada + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
              : null;

            return (
              <Card
                key={preparacion.id}
                draggable={!bloqueada}
                onDragStart={bloqueada ? undefined : e => handleDragStart(e, preparacion)}
                onDragEnd={bloqueada ? undefined : handleDragEnd}
                className={cn(
                  "group border-l-4 transition-shadow",
                  // El fallback "bg-white" es inalcanzable en la práctica: solo se renderiza
                  // una tarjeta si su tipo pasó el filtro de la pestaña activa, y los 3 tipos
                  // que puede pasar ese filtro están siempre en TIPO_BG. No se fuerza un test.
                  TIPO_BG[preparacion.tipo] || "bg-white",
                  ESTADO_BORDER[preparacion.estado?.toLowerCase() ?? ''] || "border-l-slate-400",
                  bloqueada
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:shadow-md cursor-grab active:cursor-grabbing",
                  draggedId === preparacion.id && "opacity-40"
                )}
              >
                <CardContent className="p-2 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {bloqueada
                        ? <Lock className="w-3 h-3 shrink-0 text-slate-400" />
                        : <GripVertical className="w-3 h-3 shrink-0 text-slate-400" />
                      }
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {activeTab === "individual" ? pedido?.codigo : (preparacion.codigo_envio || `#${preparacion.id}`)}
                      </span>
                      {sigmaEstadoByPrepId?.get(preparacion.id) === 'pendiente' && (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-300 px-1 py-0.5 rounded" title="Cambio de código pendiente de impactar en Sigma">
                          sigma
                        </span>
                      )}
                      {sigmaEstadoByPrepId?.get(preparacion.id) === 'ok' && (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 border border-amber-300 px-1 py-0.5 rounded" title="Impactado en Sigma — esperando sincronización con Digip">
                          sync
                        </span>
                      )}
                      {sigmaEstadoByPrepId?.get(preparacion.id) === 'fallido' && (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-red-700 bg-red-100 border border-red-300 px-1 py-0.5 rounded" title="No se pudo impactar en Sigma — los pedidos ya no estaban Pendiente al intentar">
                          sigma!
                        </span>
                      )}
                      {sigmaEstadoByPrepId?.get(preparacion.id) === 'bloqueado' && (
                        <span className="shrink-0 text-[9px] font-bold uppercase tracking-wide text-red-700 bg-red-100 border border-red-300 px-1 py-0.5 rounded" title="No se puede impactar en Sigma — los pedidos ya no están en estado Pendiente">
                          bloq
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-emerald-700 shrink-0">
                      {formatCurrency(activeTab === "individual" ? (pedido?.importe || 0) : preparacion.importe_total)}
                    </span>
                  </div>
                  {bloqueada && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 ml-5">
                      <Lock className="w-2.5 h-2.5" />
                      <span>Asignada el {bibliaBloqueadaLabel}</span>
                    </div>
                  )}
                  {!bloqueada && pedido?.codigo_despacho && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground ml-5">
                      <span>{pedido.codigo_despacho}</span>
                      {preparacion.peso > 0 && <span>· {preparacion.peso_text}</span>}
                    </div>
                  )}
                  {!bloqueada && !pedido?.codigo_despacho && preparacion.peso > 0 && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground ml-5">
                      <span>{preparacion.peso_text}</span>
                    </div>
                  )}
                  {!bloqueada && (activeTab === "individual" || activeTab === "misma_direccion") && pedido?.cliente_nombre && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground ml-5 truncate">
                      <span className="truncate">{pedido.cliente_nombre}</span>
                    </div>
                  )}
                  {!bloqueada && activeTab !== "individual" && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground ml-5">
                      <span>{preparacion.cantidad_pedidos} pedido{preparacion.cantidad_pedidos !== 1 ? "s" : ""} · {preparacion.cantidad_clientes} cliente{preparacion.cantidad_clientes !== 1 ? "s" : ""}</span>
                    </div>
                  )}
                  <div className="h-0 overflow-hidden group-hover:h-6 group-hover:mt-0.5 transition-all">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-6 text-xs"
                      onClick={() => setModalPreparacion(preparacion)}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Ver detalle
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {modalPreparacion && (
        <PreparacionDetalleModal
          preparacion={modalPreparacion}
          open={true}
          onClose={() => setModalPreparacion(null)}
          codigosDespacho={codigosDespacho}
          onModificado={onModificado}
          readonly={!!ocupadasEnOtraBiblia?.has(modalPreparacion.id)}
          bibliaFecha={fecha ?? ''}
          pedidoCambios={pedidoCambiosByPrepId?.get(modalPreparacion.id)}
          asignacionCrossCode={asignacionCrossCodeByPrepId?.get(modalPreparacion.id)}
        />
      )}
    </Card>
  );
}