// src/components/recibos/RecibosConciliacionActions.tsx

import React, { useState, useEffect } from "react";
import { Link2, Unlink } from "lucide-react";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/useToast";
import { useDraggable } from "@/hooks/useDraggable";

export interface ConciliadoValor {
  valorId: number;
  extractoId: number | null;
  cobranzaId: number | null;
  operacion: string | null;
  documento: string | null;
  importe: number | null;
  tipoCobro: string;

  manyMatches?: boolean;
  candidatos?: any[];
}

interface Props {
  hojaRutas: string[];
  hojaFecha?: string;
  fechaMinHDR?: string;
  fechaMaxHDR?: string;
  conciliadosExternos: Record<number, ConciliadoValor>;
  seleccionadosExternos: Set<number>;
  enviadosIds: Set<number>;
  onConciliados: (mapa: Record<number, ConciliadoValor | null>) => void;
}

const RecibosConciliacionActions: React.FC<Props> = ({
  hojaRutas,
  hojaFecha,
  fechaMinHDR,
  fechaMaxHDR,
  conciliadosExternos,
  seleccionadosExternos,
  enviadosIds,
  onConciliados,
}) => {
  const { toast } = useToast();

  const [mostrarModalAuto, setMostrarModalAuto] = useState(false);
  const [mostrarModalDesvincular, setMostrarModalDesvincular] = useState(false);
  const { dialogStyle: dialogStyleAuto, handleProps: handlePropsAuto } = useDraggable(mostrarModalAuto);
  const { dialogStyle: dialogStyleDesvincular, handleProps: handlePropsDesvincular } = useDraggable(mostrarModalDesvincular);

  const [ignorarCentavos, setIgnorarCentavos] = useState(false);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [modoTipoCobro, setModoTipoCobro] = useState<"exacto" | "omitir" | "efe">("exacto");
  const [loading, setLoading] = useState(false);

  const [conciliadosData, setConciliadosData] =
    useState<Record<number, ConciliadoValor>>({});

  useEffect(() => {
    setConciliadosData(conciliadosExternos);
  }, [conciliadosExternos]);

  // Inicializar fechas con el rango de las HDR al abrir el modal
  useEffect(() => {
    if (!mostrarModalAuto) return;
    const desde = fechaMinHDR ?? hojaFecha;
    const hasta = fechaMaxHDR ?? hojaFecha;
    if (desde) setFechaDesde(desde);
    if (hasta) setFechaHasta(hasta);
  }, [mostrarModalAuto]);

  // ------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------

  const equalConc = (a: any, b: any) => {
    if (!a || !b) return false;
    return (
      a.extractoId === b.extractoId &&
      (a.documento || "") === (b.documento || "") &&
      (a.operacion || "") === (b.operacion || "") &&
      Number(a.importe || 0) === Number(b.importe || 0) &&
      a.manyMatches === b.manyMatches
    );
  };

  // ------------------------------------------------------
  // AUTO CONCILIACIÓN
  // ------------------------------------------------------

  const ejecutarAutoConciliacion = async () => {
    setMostrarModalAuto(false);
    if (!hojaRutas.length) return;

    try {
      setLoading(true);

      const omitirTipoCobro = modoTipoCobro === "omitir";
      const validarEfectivo = modoTipoCobro === "efe";

      const resultados = await Promise.all(
        hojaRutas.map((hr) =>
          fetchWithAuth("/api/gestor/conciliacion/hdr/preview", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ hojaRuta: hr, ignorarCentavos, fechaDesde, fechaHasta, omitirTipoCobro, validarEfectivo }),
          }).then((r) => r.json())
        )
      );

      const errores = resultados.filter((j) => !j.success);
      if (errores.length) {
        toast({
          variant: "destructive",
          title: "Error en conciliación",
          description: errores[0].message,
        });
        return;
      }

      const allData = resultados.flatMap((j) => j.data ?? []);

      const nuevos: Record<number, ConciliadoValor> = {};

      // Construcción inicial
      allData.forEach((r: any) => {
        const valorId = r.valorId;
        if (!valorId) return;

        if (r.matchStatus === "multi") {
          nuevos[valorId] = {
            valorId,
            extractoId: null,
            operacion: null,
            documento: null,
            importe: null,
            tipoCobro: r.codigo,
            cobranzaId: r.cobranzaId ?? null,
            manyMatches: true,
            candidatos: r.candidatos,
          };
        } else {
          nuevos[valorId] = {
            valorId,
            extractoId: r.elegido?.id ?? null,
            operacion: r.elegido?.operacion ?? null,
            documento: r.elegido?.documento
              ? r.elegido.documento.trim().replace(/\D+/g, "")
              : null,
            importe: r.elegido?.importe ?? null,
            tipoCobro: r.elegido?.codigo_cobranza ?? r.codigo,
            cobranzaId: r.cobranzaId ?? null,
            manyMatches: false,
            candidatos: [],
          };
        }
      });

      // ---------------------------------------------------------
      // 🚫 BLOQUE CRÍTICO: NO PROCESAR valores ya conciliados
      // ---------------------------------------------------------
      Object.entries(nuevos).forEach(([id]) => {
        const vid = Number(id);
        if (conciliadosExternos[vid]?.extractoId || enviadosIds.has(vid)) {
          delete nuevos[vid]; // ya conciliado o ya enviado → no entra en autoconciliación
        }
      });

      // ---------------------------------------------------------
      // MERGE SEGURO
      // ---------------------------------------------------------
      const merged = { ...conciliadosExternos };

      Object.entries(nuevos).forEach(([id, nuevo]) => {
        const vid = Number(id);
        const previo = conciliadosExternos[vid];

        const cambioReal =
          !previo || !equalConc(previo, nuevo);

        if (cambioReal) merged[vid] = nuevo;
      });

      setConciliadosData((prev) => {
        const igual =
          Object.keys(prev).length === Object.keys(merged).length &&
          Object.keys(prev).every((k) => equalConc(prev[Number(k)], merged[Number(k)]));

        return igual ? prev : merged;
      });

      // ---------------------------------------------------------
      // DETECTAR CAMBIOS REALES (solo matches efectivos: único o múltiple)
      // ---------------------------------------------------------
      const cambiosReales: Record<number, ConciliadoValor> = {};

      Object.entries(nuevos).forEach(([id, nuevo]) => {
        // Solo cuenta como cambio real si hay extracto asignado o hay múltiples candidatos
        if (nuevo.extractoId !== null || nuevo.manyMatches) {
          cambiosReales[Number(id)] = nuevo;
        }
      });

      if (Object.keys(cambiosReales).length > 0) {
        // Persistir inmediatamente los matches únicos (no manyMatches)
        const paresSimples = Object.values(cambiosReales)
          .filter((c) => c.extractoId && !c.manyMatches)
          .map((c) => ({ extractoId: c.extractoId!, valorId: c.valorId }));

        if (paresSimples.length > 0) {
          await fetchWithAuth("/api/gestor/conciliacion/hdr/aplicar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pares: paresSimples }),
          });
        }

        onConciliados(cambiosReales);
        toast({
          title: "Conciliación completa",
          description: "Se generaron coincidencias.",
        });
      } else {
        onConciliados({});
        toast({
          title: "Sin nuevos resultados",
          description: "No se encontraron conciliaciones nuevas.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "Error inesperado",
        description: "No se pudo procesar la conciliación.",
      });
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------
  // DESVINCULAR
  // ------------------------------------------------------

  const abrirModalDesvincular = () => {
    if (seleccionadosExternos.size === 0) {
      toast({
        variant: "destructive",
        title: "No hay seleccionados",
        description: "Seleccioná al menos un valor.",
      });
      return;
    }
    setMostrarModalDesvincular(true);
  };

  const ejecutarDesvinculacion = async () => {
    setMostrarModalDesvincular(false);

    const extractos = Object.values(conciliadosData)
      .filter((c) => seleccionadosExternos.has(c.valorId) && c.extractoId)
      .map((c) => c.extractoId!) as number[];

    if (extractos.length === 0) {
      toast({
        variant: "destructive",
        title: "Nada para desvincular",
        description: "Los seleccionados no están conciliados.",
      });
      return;
    }

    try {
      setLoading(true);

      await fetchWithAuth("/api/gestor/conciliacion/hdr/desvincular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extractos }),
      });

      const nuevo = { ...conciliadosData };

      extractos.forEach((extId) => {
        for (const vid in nuevo) {
          if (nuevo[vid]?.extractoId === extId) delete nuevo[vid];
        }
      });

      setConciliadosData(nuevo);

      const updates: Record<number, null> = {};
      extractos.forEach((extId) => {
        for (const vid in conciliadosExternos) {
          if (conciliadosExternos[vid]?.extractoId === extId) {
            updates[Number(vid)] = null;
          }
        }
      });

      onConciliados(updates);

      toast({
        title: "Desvinculado",
        description: `${extractos.length} valor(es) fueron liberados.`,
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo desvincular.",
      });
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------
  // UI
  // ------------------------------------------------------

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setMostrarModalAuto(true)}
          disabled={loading || hojaRutas.length === 0}
          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg shadow-sm transition-colors"
        >
          <Link2 className="w-3 h-3" /> Conciliar
        </button>

        <button
          onClick={abrirModalDesvincular}
          disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg shadow-sm transition-colors"
        >
          <Unlink className="w-3 h-3" /> Desvincular
        </button>

      </div>

      {/* MODAL AUTO */}
      <Dialog open={mostrarModalAuto} onOpenChange={setMostrarModalAuto}>
        <DialogContent style={dialogStyleAuto}>
          <DialogHeader {...handlePropsAuto}>
            <DialogTitle>Auto-Conciliar valores</DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-4 text-gray-700">

            {/* Rango de fechas */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Rango de fechas</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Desde</label>
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Hasta</label>
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                    className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            </div>

            {/* Tipo de cobro */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Modo</p>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="modoCobro"
                    checked={modoTipoCobro === "exacto"}
                    onChange={() => setModoTipoCobro("exacto")}
                    className="accent-blue-600"
                  />
                  Tipo de cobro exacto
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="modoCobro"
                    checked={modoTipoCobro === "omitir"}
                    onChange={() => setModoTipoCobro("omitir")}
                    className="accent-blue-600"
                  />
                  Omitir tipo de cobro
                </label>
                <label className="flex items-start gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="modoCobro"
                    checked={modoTipoCobro === "efe"}
                    onChange={() => setModoTipoCobro("efe")}
                    className="accent-amber-500 mt-0.5"
                  />
                  <span>
                    <span className="font-medium text-amber-700">Validar efectivo</span>
                    <span className="block text-xs text-gray-400 mt-0.5">
                      Busca match bancario para valores EFE ignorando el tipo de cobro. Un match puede indicar un recibo mal cargado.
                    </span>
                  </span>
                </label>
              </div>
            </div>

            {/* Importe */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Importe</p>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={ignorarCentavos}
                  onChange={(e) => setIgnorarCentavos(e.target.checked)}
                  className="accent-blue-600"
                />
                Ignorar centavos al comparar importes
              </label>
            </div>

          </div>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setMostrarModalAuto(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={ejecutarAutoConciliacion}
              disabled={!fechaDesde || !fechaHasta}
              title={!fechaDesde || !fechaHasta ? "Completá ambas fechas para continuar" : undefined}
            >
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DESVINCULAR */}
      <Dialog
        open={mostrarModalDesvincular}
        onOpenChange={setMostrarModalDesvincular}
      >
        <DialogContent style={dialogStyleDesvincular}>
          <DialogHeader {...handlePropsDesvincular}>
            <DialogTitle>Desvincular seleccionados</DialogTitle>
          </DialogHeader>

          <p className="mt-4 text-gray-700">
            ¿Deseás desvincular los valores seleccionados?
          </p>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={() => setMostrarModalDesvincular(false)}
            >
              Cancelar
            </Button>
            <Button onClick={ejecutarDesvinculacion}>Desvincular</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecibosConciliacionActions;
