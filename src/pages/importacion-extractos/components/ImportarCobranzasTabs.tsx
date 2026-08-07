// components/tabs/ImportarCobranzasTabs.tsx
import React, { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchWithAuth } from "@/utils/fetchWithAuth";
import { ImportarCobranzasImportarExtractosForm } from "./ImportarCobranzasImportarExtractosForm";
import { ImportarCobranzasVerExtractosTable } from "./ImportarCobranzasVerExtractosTable";

export interface TipoCobro {
  codigo_cobranza: string;
  nombre_cobranza: string;
}

export interface Extracto {
  id: number;
  codigo_cobranza: string;
  nombre_cobranza?: string;
  fecha: string;
  documento: string;
  operacion: string;
  importe: number;
  id_cobranza: number | null;
  hdr?: string | null;
  cobranza_id?: number | null;
  datos_extra?: string | null;
  forzado_conciliado?: 0 | 1;
  observacion_forzado?: string | null;
}

type ConciliadosFiltro = "todos" | "si" | "no";

export function ImportarCobranzasTabs() {
  const [tabValue, setTabValue] = useState<"importar" | "ver">("importar");

  const [tiposCobro, setTiposCobro] = useState<TipoCobro[]>([]);

  // Filtros y resultados para "Ver extractos"
  const [tipoFiltro, setTipoFiltro] = useState<string[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [conciliados, setConciliados] = useState<ConciliadosFiltro>("todos");
  const [resultados, setResultados] = useState<Extracto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);

  // contador de filas en la pestaña "Ver extractos"
  const [countResultados, setCountResultados] = useState(0);

  useEffect(() => {
    setCountResultados(resultados.length);
  }, [resultados]);

  useEffect(() => {
    cargarTiposCobro();
  }, []);

  async function cargarTiposCobro() {
    const res = await fetchWithAuth("/api/gestor/tiposCobroConcilia");
    if (res.success) {
      setTiposCobro(res.data || []);
    }
  }

  async function buscarExtractos(auto = false, override?: { codigo_cobranza?: string; desde?: string; hasta?: string; conciliados?: ConciliadosFiltro }) {
    setBuscando(true);
    setErrorBusqueda(null);

    const codigos = override?.codigo_cobranza ? [override.codigo_cobranza] : tipoFiltro;
    const d = override?.desde ?? desde;
    const h = override?.hasta ?? hasta;
    const conc = override?.conciliados ?? conciliados;

    const params = new URLSearchParams();
    if (codigos.length === 1) params.append("codigo_cobranza", codigos[0]);
    if (d) params.append("desde", d);
    if (h) params.append("hasta", h);
    if (conc && conc !== "todos") params.append("conciliados", conc);

    const url = `/api/gestor/extractos${params.toString() ? `?${params.toString()}` : ""}`;
    const res = await fetchWithAuth(url);
    setBuscando(false);

    if (!res.success) {
      const msg = res.message || "Error al buscar extractos";
      if (!auto) {
        setErrorBusqueda(msg);
      }
      setResultados([]);
      return;
    }

    setResultados(res.data || []);
  }

  // Actualiza un extracto puntual en memoria (evita re-fetch completo y pérdida
  // de posición/paginación al forzar o deshacer una conciliación).
  function actualizarExtractoLocal(id: number, patch: Partial<Extracto>) {
    setResultados((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  // callback desde el form de importación cuando se importa OK
  function handleAfterImport({ codigo_cobranza, fecha }: { codigo_cobranza: string; fecha: string }) {
    // Seteo filtros para esa fecha/tipo
    setTipoFiltro([codigo_cobranza]);
    setDesde(fecha);
    setHasta(fecha);
    // Lanzo búsqueda automática
    buscarExtractos(true, {
      codigo_cobranza,
      desde: fecha,
      hasta: fecha,
      conciliados,
    });
    // Cambio a tab "ver"
    setTabValue("ver");
  }

  return (
    <Card className="border border-border/60 shadow-sm">
      <CardContent className="pt-4">
        <Tabs value={tabValue} onValueChange={(v) => setTabValue(v as "importar" | "ver")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
            <TabsList className="w-full md:w-auto">
              <TabsTrigger value="importar" className="flex-1 md:flex-none">
                Importar extractos
              </TabsTrigger>
              <TabsTrigger value="ver" className="flex-1 md:flex-none flex items-center gap-2">
                Ver extractos
                {countResultados > 0 && (
                  <Badge variant="secondary" className="text-[11px] px-2 py-0.5">
                    {countResultados}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="importar" className="mt-0">
            <ImportarCobranzasImportarExtractosForm
              tiposCobro={tiposCobro}
              onAfterImport={handleAfterImport}
            />
          </TabsContent>

          <TabsContent value="ver" className="mt-0">
            <ImportarCobranzasVerExtractosTable
              tiposCobro={tiposCobro}
              tipoFiltro={tipoFiltro}
              setTipoFiltro={setTipoFiltro}
              desde={desde}
              setDesde={setDesde}
              hasta={hasta}
              setHasta={setHasta}
              conciliados={conciliados}
              setConciliados={setConciliados}
              resultados={resultados}
              buscando={buscando}
              errorBusqueda={errorBusqueda}
              onBuscar={() => buscarExtractos(false)}
              onExtractoActualizado={actualizarExtractoLocal}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
