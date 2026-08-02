/* --------------------------------------------------------------
   Recibos.tsx — versión estable + indicador de pendientes
   -------------------------------------------------------------- */

   import React, { useState, useMemo, useEffect } from "react";
   import * as XLSX from "xlsx";
   import { FileText, Download, Send, XCircle, Scale, RefreshCw, Building2, Printer } from "lucide-react";
   
   import RecibosHojaRutaSelector from "./components/RecibosHojaRutaSelector";
   import RecibosTabla from "./components/RecibosTabla";
   
   import RecibosEditarModal from "./components/RecibosEditarModal";
   import ConfirmModal from "./components/ReciboConfirmObserv";
   import ReciboModoObservModal, { type ModoObservacion } from "./components/ReciboModoObservModal";
   import RecibosResumenHDR from "./components/RecibosResumenHDR";
   import RecibosConciliacionActions from "./components/RecibosConciliacionActions";
   import RecibosTransmitirHDR from "./components/RecibosTransmitirHDR";
   import RecibosCancelarHDR from "./components/RecibosCancelarHDR";
   import RecibosImprimirModal from "./components/RecibosImprimirModal";
   
   import RecibosFiltros from "./components/RecibosFiltros";
   import { useModalEscClose } from "@/hooks/useModalEscClose";
   import { useDraggable } from "@/hooks/useDraggable";
   
   import { useToast } from "@/hooks/useToast";
   import { fetchWithAuth } from "@/utils/fetchWithAuth";
   
   
   // ---------------------------------------------------------
   // TIPOS
   // ---------------------------------------------------------
   
   export interface HojaRuta {
     hoja_ruta: string;
     fecha: string;
     vendedor: string;
     chofer: string;
     total: number | string;
     cant_recibos: number;
   }
   
   export interface Recibo {
     valorId: number;
     cobranzaId: number;
     clienteId: string;
     nombre_cliente: string;
     documento: string;
     codigo: string;
     monto: number;
     observacion: string;
     empresa: string;
     empresa_nombre: string;
     empresa_division: string;
     estado: "pendiente" | "enviado" | "error";
     response_json?: any;
     recibo: string;
     fecha: string;
     hojaRuta: string;
     aCuenta: number;
   }
   
   export interface ConciliadoValor {
    valorId: number;
    extractoId: number | null;
    cobranzaId: number | null;
    operacion: string | null;
    documento: string | null;
    importe: number | null;
    tipoCobro: string;
  
    // 🔥 necesarios para conciliar múltiples
    manyMatches?: boolean;
    candidatos?: any[];
  }
  
   
   
   // ================================================================
   // COMPONENTE
   // ================================================================
   
   const Recibos: React.FC = () => {
     const { toast } = useToast();
   
     const [hojasSeleccionadas, setHojasSeleccionadas] = useState<HojaRuta[]>([]);
     const hojaUnica = hojasSeleccionadas.length === 1 ? hojasSeleccionadas[0] : null;
     const hayHDRSeleccionada = hojasSeleccionadas.length > 0;
     const esMultipleHDR = hojasSeleccionadas.length > 1;
     const fechaComun = useMemo(() => {
       if (!hojasSeleccionadas.length) return undefined;
       const fechas = new Set(hojasSeleccionadas.map((h) => h.fecha.slice(0, 10)));
       return fechas.size === 1 ? [...fechas][0] : undefined;
     }, [hojasSeleccionadas]);
     const fechaMinHDR = useMemo(() => {
       if (!hojasSeleccionadas.length) return undefined;
       return hojasSeleccionadas.map((h) => h.fecha.slice(0, 10)).sort()[0];
     }, [hojasSeleccionadas]);
     const fechaMaxHDR = useMemo(() => {
       if (!hojasSeleccionadas.length) return undefined;
       return [...hojasSeleccionadas.map((h) => h.fecha.slice(0, 10)).sort()].reverse()[0];
     }, [hojasSeleccionadas]);
     const [refreshKey, setRefreshKey] = useState(0);
   
     const [datosDG, setDatosDG] = useState<Recibo[]>([]);
     const [conciliados, setConciliados] = useState<Record<number, ConciliadoValor>>({});
   
     const [filtroTipo, setFiltroTipo] = useState<Set<string>>(new Set(["TODOS"]));
     const [filtroEmpresa, setFiltroEmpresa] = useState<Set<string>>(new Set(["TODAS"]));
     const [filtroDivision, setFiltroDivision] = useState<Set<string>>(new Set(["TODAS"]));
     const [filtroEstado, setFiltroEstado] = useState<Set<string>>(new Set(["TODOS"]));
     const [filtroConciliacion, setFiltroConciliacion] = useState<Set<string>>(new Set(["TODOS"]));
   
     const [tiposCobro, setTiposCobro] = useState<any[]>([]);
     const [tipoNombres, setTipoNombres] = useState<Record<string, string>>({});
   
     const [modalResumen, setModalResumen] = useState(false);
     const [modalTransmitir, setModalTransmitir] = useState(false);
     const [modalAdvertenciaImportes, setModalAdvertenciaImportes] = useState(false);
     const [discrepanciasTransmitir, setDiscrepanciasTransmitir] = useState<Set<number>>(new Set());
     const [modalCancelar, setModalCancelar] = useState(false);
    const [hojasParaCerrar, setHojasParaCerrar] = useState<string[]>([]);
     const [modalImprimir, setModalImprimir] = useState(false);
   
     const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
     const [editarId, setEditarId] = useState<number | null>(null);
   
     const [confirmObs, setConfirmObs] = useState(false);
     const [pendingUpdates, setPendingUpdates] = useState<any[]>([]);
     const [modalModoObs, setModalModoObs] = useState(false);
   
     const [needConciliadosRefresh, setNeedConciliadosRefresh] = useState(false);
   

     const [modalCambiarHR, setModalCambiarHR] = useState<{ proceed: () => void } | null>(null);
     const [modalEliminarRecibo, setModalEliminarRecibo] = useState<{ cobranzas: Array<{ cobranzaId: number; nombre: string; rows: any[] }>; totalGeneral: number } | null>(null);
     const [eliminandoRecibo, setEliminandoRecibo] = useState(false);
     const [modalQuitarDecimales, setModalQuitarDecimales] = useState<{ aplicados: any[]; omitidos: any[] } | null>(null);
     const [quitandoDecimales, setQuitandoDecimales] = useState(false);

     useModalEscClose(!!modalCambiarHR, () => setModalCambiarHR(null));
     useModalEscClose(!!modalEliminarRecibo && !eliminandoRecibo, () => setModalEliminarRecibo(null));
     useModalEscClose(!!modalQuitarDecimales, () => setModalQuitarDecimales(null));
     const { style: styleCambiarHR, handleProps: handlePropsCambiarHR } = useDraggable(!!modalCambiarHR);
     const { style: styleEliminarRecibo, handleProps: handlePropsEliminarRecibo } = useDraggable(!!modalEliminarRecibo);
     const { style: styleQuitarDecimales, handleProps: handlePropsQuitarDecimales } = useDraggable(!!modalQuitarDecimales);
     const [discrepancias, setDiscrepancias] = useState<Set<number>>(new Set());
     const [discrepanciasEmpresa, setDiscrepanciasEmpresa] = useState<Set<number>>(new Set());
     const [discrepanciasEmpresaTransmitir, setDiscrepanciasEmpresaTransmitir] = useState<Set<number>>(new Set());
     const [modalAdvertenciaEmpresaTransmitir, setModalAdvertenciaEmpresaTransmitir] = useState(false);
     const [recibosConACuenta, setRecibosConACuenta] = useState<Set<number>>(new Set());
     const [modalAdvertenciaACuenta, setModalAdvertenciaACuenta] = useState(false);
     const [recibosConEFEConflicto, setRecibosConEFEConflicto] = useState<Set<string>>(new Set());
     const [modalAdvertenciaEFE, setModalAdvertenciaEFE] = useState(false);
     const [recibosConTipoCobroDifiere, setRecibosConTipoCobroDifiere] = useState<Set<number>>(new Set());
     const [modalAdvertenciaTipoCobro, setModalAdvertenciaTipoCobro] = useState(false);
     const [cobranzasNoConciliadasTransmitir, setCobranzasNoConciliadasTransmitir] = useState<Set<number>>(new Set());
     const [modalAdvertenciaConciliacion, setModalAdvertenciaConciliacion] = useState(false);
     const [idsTransmitidos, setIdsTransmitidos] = useState<Set<number>>(new Set());
     const [modalConfirmarQuitarDecimales, setModalConfirmarQuitarDecimales] = useState(false);
   
     // ========================================================
     // 1) CARGA TIPOS
     // ========================================================
     useEffect(() => {
       (async () => {
         const res = await fetchWithAuth("/api/distrigestion/tipos-cobro");
         const json = await res.json();
   
         if (json.success) {
           const map: Record<string, string> = {};
           json.data.forEach((t: any) => {
             map[t.codigo.trim().toUpperCase()] = t.nombre.trim();
           });
   
           setTiposCobro(json.data);
           setTipoNombres(map);
         }
       })();
     }, []);
   
     // ========================================================
     // CARGA RECIBOS
     // ========================================================
     const normalizar = (r: any, hojaRuta = ''): Recibo => ({
       valorId: Number(r.valorId),
       cobranzaId: Number(r.cobranzaId),
       clienteId: r.clienteId,
       nombre_cliente: r.nombre_cliente,
       documento: (r.documento || "").replace(/\D+/g, ""),
       codigo: r.codigo,
       monto: Number(r.monto),
       observacion: r.observacion,
       empresa: r.empresa,
       empresa_nombre: r.empresa_nombre,
       empresa_division: r.empresa_division,
       estado: r.estado,
       response_json: r.response_json,
       recibo: r.recibo ?? "",
       fecha: r.fecha,
       hojaRuta,
       aCuenta: Number(r.aCuenta || 0),
     });

     const cargarRecibosMultiple = async (hojas: HojaRuta[], skipValidation = false): Promise<Recibo[]> => {
       if (!hojas.length) { setDatosDG([]); return []; }
       try {
         const resultados = await Promise.all(
           hojas.map((h) =>
             fetchWithAuth(`/api/distrigestion/recibos-valores/${h.hoja_ruta}`)
               .then((r) => r.json())
               .then((json) => ({ json, hojaRuta: h.hoja_ruta }))
           )
         );
         const normalizados: Recibo[] = resultados
           .filter(({ json }) => json.success)
           .flatMap(({ json, hojaRuta }) => json.data.map((r: any) => normalizar(r, hojaRuta)));
         setDatosDG(normalizados);
         if (!skipValidation) handleValidarEmpresaRecibo(normalizados, true);
         return normalizados;
       } catch {
         setDatosDG([]);
         return [];
       }
     };

     useEffect(() => {
       if (!hojasSeleccionadas.length) return;
       cargarRecibosMultiple(hojasSeleccionadas);
     }, [hojasSeleccionadas]);
   
     // ========================================================
     // SELECCIÓN HDR
     // ========================================================
     const handleSelectHR = (hojas: HojaRuta[]) => {
       setHojasSeleccionadas(hojas);
       setRefreshKey((p) => p + 1);
       setDatosDG([]);
       setConciliados({});
       setSeleccionados(new Set());
       setDiscrepancias(new Set());
       setDiscrepanciasEmpresa(new Set());
       setDiscrepanciasEmpresaTransmitir(new Set());
       setRecibosConACuenta(new Set());
       setRecibosConEFEConflicto(new Set());
       setCobranzasNoConciliadasTransmitir(new Set());
       setFiltroConciliacion(new Set(["TODOS"]));
     };
   
     // ========================================================
     // OBSERVACIONES (sin cambios)
     // ========================================================
     const handleActualizarObservaciones = () => {
       if (!hayHDRSeleccionada) return;

       const tieneValidos = Object.values(conciliados).some(
         (c) => seleccionados.has(c.valorId) && c.operacion && c.operacion.trim() !== ""
       );

       if (!tieneValidos) {
         return toast({
           variant: "destructive",
           title: "No hay datos para actualizar",
           description: "Seleccioná filas conciliadas con operación válida.",
         });
       }

       setModalModoObs(true);
     };

     const handleModoObsSeleccionado = (modo: ModoObservacion) => {
       setModalModoObs(false);

       const extraerNumeroFinal = (texto: string): string => {
         const matches = texto.match(/\d+/g);
         return matches ? matches[matches.length - 1] : texto;
       };

       const updates = Object.values(conciliados)
         .filter(
           (c) =>
             seleccionados.has(c.valorId) &&
             c.operacion &&
             c.operacion.trim() !== ""
         )
         .map((c) => ({
           valorId: c.valorId,
           observacion: modo === "sin_texto"
             ? extraerNumeroFinal(c.operacion)
             : c.operacion,
         }));

       setPendingUpdates(updates);
       setConfirmObs(true);
     };
   
     const aplicarObservacionesConfirmado = async () => {
       setConfirmObs(false);
   
       const res = await fetchWithAuth("/api/distrigestion/recibos-valores/actualizar-observacion", {
         method: "PUT",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ updates: pendingUpdates }),
       });
   
       const json = await res.json();
   
       if (json.success) {
         cargarRecibosMultiple(hojasSeleccionadas, true);
         toast({
           title: "Observaciones actualizadas",
           description: `${pendingUpdates.length} registro(s) modificados.`,
         });
       } else {
         toast({
           variant: "destructive",
           title: "Error al actualizar",
           description: json.message,
         });
       }
     };
   
     // ========================================================
     // VALIDAR EMPRESA DEL RECIBO
     // ========================================================
     const validarEmpresaConDatos = (source: Recibo[], silent = false) => {
       const conDiscrepancia = source
         .filter((r) => {
           if (r.estado === "enviado") return false;
           const tipoCobro = tiposCobro.find(
             (t) => t.codigo?.trim().toUpperCase() === r.codigo?.trim().toUpperCase() && t.concilia === "S"
           );
           if (!tipoCobro || !tipoCobro.Empresas) return false;
           return tipoCobro.Empresas.trim() !== (r.empresa || "").trim();
         })
         .map((r) => r.valorId);

       setDiscrepanciasEmpresa(new Set(conDiscrepancia));

       if (conDiscrepancia.length === 0) {
         if (!silent) toast({ title: "Sin discrepancias", description: "Todos los recibos pertenecen a la empresa del tipo de cobro." });
       } else {
         toast({
           variant: "destructive",
           title: `${conDiscrepancia.length} discrepancia(s) encontrada(s)`,
           description: "Los recibos marcados en amarillo no coinciden con la empresa del tipo de cobro.",
         });
       }
     };

     // Cuando se llama desde el botón: limpia el amarillo, recarga datos frescos y re-valida.
     // Cuando se llama desde la carga (con data): valida directamente sobre los datos provistos.
     const handleValidarEmpresaRecibo = async (data?: Recibo[], silent = false) => {
       if (data) {
         validarEmpresaConDatos(data, silent);
         return;
       }
       setDiscrepanciasEmpresa(new Set());
       const frescos = await cargarRecibosMultiple(hojasSeleccionadas, true);
       validarEmpresaConDatos(frescos, silent);
     };

     const verificarImportesYAbrir = () => {
       const conDiferencia = datosDG
         .filter((r) => {
           if (!seleccionados.has(r.valorId)) return false;
           if (r.estado === "enviado") return false;
           const conc = conciliados[r.valorId];
           return conc?.extractoId && Number(r.monto) !== Number(conc.importe);
         })
         .map((r) => r.valorId);

       if (conDiferencia.length > 0) {
         setDiscrepanciasTransmitir(new Set(conDiferencia));
         setModalAdvertenciaImportes(true);
       } else {
         setModalTransmitir(true);
       }
     };

     const verificarACuentaYAbrir = () => {
       const conACuenta = new Set<number>(
         datosDG
           .filter((r) =>
             seleccionados.has(r.valorId) &&
             r.estado !== "enviado" &&
             r.aCuenta > 10
           )
           .map((r) => r.valorId)
       );
       console.log(
         "[Transmitir] seleccionados aCuenta:",
         datosDG
           .filter((r) => seleccionados.has(r.valorId))
           .map((r) => ({ valorId: r.valorId, nombre: r.nombre_cliente, aCuenta: r.aCuenta, estado: r.estado }))
       );
       if (conACuenta.size > 0) {
         setRecibosConACuenta(conACuenta);
         setModalAdvertenciaACuenta(true);
         return;
       }
       abrirTransmitir();
     };

     const abrirTransmitir = () => {
       // Verificar valores sin conciliar en los recibos que se van a transmitir
       const recibosSeleccionados = new Set(
         datosDG.filter((r) => seleccionados.has(r.valorId)).map((r) => r.recibo)
       );
       const sinConciliar = new Set<number>(
         datosDG
           .filter((r) =>
             recibosSeleccionados.has(r.recibo) &&
             r.codigo.trim().toUpperCase() !== "EFE" &&
             Number(r.monto) > 0 &&
             !conciliados[r.valorId]?.extractoId
           )
           .map((r) => r.cobranzaId)
       );

       if (sinConciliar.size > 0) {
         setCobranzasNoConciliadasTransmitir(sinConciliar);
         setModalAdvertenciaConciliacion(true);
         return;
       }

       verificarImportesYAbrir();
     };

     // ========================================================
     // REFRESCO DE CONCILIADOS
     // ========================================================
     useEffect(() => {
       if (!hojasSeleccionadas.length) return;
       if (!needConciliadosRefresh) return;

       const cargarConciliados = async () => {
         try {
           const resultados = await Promise.all(
             hojasSeleccionadas.map((h) =>
               fetchWithAuth("/api/distrigestion/conciliacion/hdr/estado", {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ hojaRuta: h.hoja_ruta }),
               }).then((r) => r.json())
             )
           );

           const mapa: Record<number, ConciliadoValor> = {};
           resultados.filter((j) => j.success).forEach((json) => {
             json.data.forEach((r: any) => {
               mapa[r.valorId] = {
                 valorId: r.valorId,
                 operacion: r.operacion,
                 documento: (r.documento || "").trim().replace(/\D+/g, ""),
                 importe: r.importe,
                 tipoCobro: r.extractoCodigo ?? r.codigo,
                 extractoId: r.extractoId,
                 cobranzaId: r.cobranzaId,
               };
             });
           });

           setConciliados((prev) => {
             const nuevo = { ...prev };
             let huboCambio = false;

             Object.entries(mapa).forEach(([id, data]) => {
               const vid = Number(id);
               const previo = prev[vid];
               const sonIguales =
                 previo &&
                 previo.extractoId === data.extractoId &&
                 (previo.documento || "") === (data.documento || "") &&
                 (previo.operacion || "") === (data.operacion || "") &&
                 Number(previo.importe || 0) === Number(data.importe || 0);
               if (!sonIguales) {
                 nuevo[vid] = data;
                 huboCambio = true;
               }
             });

             return huboCambio ? nuevo : prev;
           });
         } catch {
           setConciliados({});
         }

         setNeedConciliadosRefresh(false);
       };

       cargarConciliados();
     }, [needConciliadosRefresh, hojasSeleccionadas]);
   
     // ========================================================
     // CARGA INICIAL DE CONCILIADOS
     // ========================================================
     useEffect(() => {
       if (!hojasSeleccionadas.length) return;

       const cargarConciliadosInicial = async () => {
         try {
           const resultados = await Promise.all(
             hojasSeleccionadas.map((h) =>
               fetchWithAuth("/api/distrigestion/conciliacion/hdr/estado", {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ hojaRuta: h.hoja_ruta }),
               }).then((r) => r.json())
             )
           );

           const mapa: Record<number, ConciliadoValor> = {};
           resultados.filter((j) => j.success).forEach((json) => {
             json.data.forEach((r: any) => {
               mapa[r.valorId] = {
                 valorId: r.valorId,
                 operacion: r.operacion,
                 documento: (r.documento || "").trim().replace(/\D+/g, ""),
                 importe: r.importe,
                 tipoCobro: r.extractoCodigo ?? r.codigo,
                 extractoId: r.extractoId,
                 cobranzaId: r.cobranzaId,
               };
             });
           });

           setConciliados((prev) => ({ ...prev, ...mapa }));
         } catch {}
       };

       cargarConciliadosInicial();
     }, [hojasSeleccionadas]);
   
     // ========================================================
     // FILTRADO
     // ========================================================
     const datosFiltrados = useMemo(() => {
       return datosDG.filter((r) => {
         const okTipo = filtroTipo.has("TODOS") || filtroTipo.has(r.codigo);
         const okEmpresa = filtroEmpresa.has("TODAS") || filtroEmpresa.has(r.empresa_nombre);
         const okDivision = filtroDivision.has("TODAS") || filtroDivision.has(r.empresa_division);
         const okEstado = filtroEstado.has("TODOS") || filtroEstado.has(r.estado);
         const esConciliado = !!conciliados[r.valorId]?.extractoId;
         const okConciliacion = filtroConciliacion.has("TODOS")
           || (filtroConciliacion.has("conciliado") && esConciliado)
           || (filtroConciliacion.has("no conciliado") && !esConciliado);
         return okTipo && okEmpresa && okDivision && okEstado && okConciliacion;
       });
     }, [datosDG, filtroTipo, filtroEmpresa, filtroDivision, filtroEstado, filtroConciliacion, conciliados]);
   
     const tipos = Array.from(new Set(datosDG.map((r) => r.codigo)));
     const empresas = Array.from(new Set(datosDG.map((r) => r.empresa_nombre)));
     const divisiones = Array.from(new Set(datosDG.map((r) => r.empresa_division)));
     const estados = ["pendiente", "enviado", "error"];
   
     // ========================================================
     // RESUMEN HDR
     // ========================================================
     const resumenHDR = useMemo(() => {
       if (!datosDG.length) return null;
   
       const empresas = Array.from(new Set(datosDG.map((r) => r.empresa_nombre || r.empresa || "-")));
       const divisionesPorEmpresaSet: Record<string, Set<string>> = {};
       empresas.forEach((e) => (divisionesPorEmpresaSet[e] = new Set()));
   
       const tipos = Array.from(new Set(datosDG.map((r) => r.codigo)));
   
       const matrizEmpresa: Record<string, Record<string, number>> = {};
       const matrizEmpresaDivision: Record<string, Record<string, number>> = {};
   
       let totalGeneral = 0;
   
       tipos.forEach((tipo) => {
         matrizEmpresa[tipo] = {};
         matrizEmpresaDivision[tipo] = {};
         empresas.forEach((emp) => {
           matrizEmpresa[tipo][emp] = 0;
         });
       });
   
       datosDG.forEach((r) => {
         const emp = r.empresa_nombre || r.empresa || "-";
         const div = r.empresa_division || "-";
   
         divisionesPorEmpresaSet[emp].add(div);
   
         matrizEmpresa[r.codigo][emp] += r.monto;
   
         const key = `${emp}|||${div}`;
         matrizEmpresaDivision[r.codigo][key] = (matrizEmpresaDivision[r.codigo][key] || 0) + r.monto;
   
         totalGeneral += r.monto;
       });
   
       const divisionesPorEmpresa: Record<string, string[]> = {};
       empresas.forEach((e) => {
         divisionesPorEmpresa[e] = Array.from(divisionesPorEmpresaSet[e]).sort();
       });
   
       return {
         empresas,
         tipos,
         tipoNombres,
         matrizEmpresa,
         matrizEmpresaDivision,
         divisionesPorEmpresa,
         totalGeneral,
       };
     }, [datosDG, tipoNombres]);
   
     const ejecutarQuitarDecimales = async () => {
       if (seleccionados.size === 0) return;
       const cobranzaIds = [...new Set(
         [...seleccionados].map((vId) => datosDG.find((r) => r.valorId === vId)?.cobranzaId).filter(Boolean) as number[]
       )];
       if (!cobranzaIds.length) return;
       setQuitandoDecimales(true);
       try {
         const res = await fetchWithAuth("/api/distrigestion/recibos-valores/quitar-decimales", {
           method: "POST",
           headers: { "Content-Type": "application/json" },
           body: JSON.stringify({ cobranzaIds }),
         });
         const json = await res.json();
         if (!json.success) {
           toast({ variant: "destructive", title: "Error", description: json.message });
           return;
         }
         setModalQuitarDecimales({ aplicados: json.aplicados || [], omitidos: json.omitidos || [] });
         if (json.aplicados?.length) {
           cargarRecibosMultiple(hojasSeleccionadas, true);
         }
       } catch (err: any) {
         toast({ variant: "destructive", title: "Error", description: err?.message || "Error inesperado." });
       } finally {
         setQuitandoDecimales(false);
       }
     };

     // ========================================================
     // RENDER
     // ========================================================
     return (
       <div className="space-y-1">
   
        {/* MODAL ADVERTENCIA IMPORTES */}
       {modalAdvertenciaImportes && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
             <h3 className="text-base font-bold text-red-600 mb-3 flex items-center gap-2">
               <Scale className="w-4 h-4" /> Advertencia — Diferencias de importe
             </h3>
             <p className="text-sm text-gray-700 mb-2">
               Se encontraron <strong>{discrepanciasTransmitir.size}</strong> registro(s) seleccionado(s) cuyo monto difiere del importe conciliado.
             </p>
             <p className="text-sm text-gray-500 mb-5">¿Deseás corregirlos antes de transmitir o continuar de todos modos?</p>
             <div className="flex justify-end gap-2">
               <button
                 onClick={() => {
                   setDiscrepancias(discrepanciasTransmitir);
                   setModalAdvertenciaImportes(false);
                 }}
                 className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
               >
                 Corregir
               </button>
               <button
                 onClick={() => {
                   setModalAdvertenciaImportes(false);
                   setModalTransmitir(true);
                 }}
                 className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold"
               >
                 Continuar de todos modos
               </button>
             </div>
           </div>
         </div>
       )}

       {/* MODAL ADVERTENCIA EFE */}
        {modalAdvertenciaEFE && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-base font-bold text-amber-600 mb-3 flex items-center gap-2">
                <Send className="w-4 h-4" /> Advertencia — Tipo EFE detectado
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                Se detectaron Tipo de cobro <strong>EFE</strong> además de transferencia para un mismo recibo.
                ¿Deseás corregirlos o continuar de todos modos?
              </p>
              <p className="text-xs text-gray-500 mb-5">
                Recibos afectados: {[...recibosConEFEConflicto].join(", ")}
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setModalAdvertenciaEFE(false);
                    toast({
                      variant: "destructive",
                      title: "Recibos con Transferencia y Efectivo identificados con celeste en el Nro de Recibo",
                    });
                  }}
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                >
                  Corregir
                </button>
                <button
                  onClick={() => {
                    setModalAdvertenciaEFE(false);
                    setRecibosConEFEConflicto(new Set());
                    verificarACuentaYAbrir();
                  }}
                  className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold"
                >
                  Continuar de todos modos
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL ADVERTENCIA TIPO COBRO DIFIERE */}
        {modalAdvertenciaTipoCobro && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
              <h3 className="text-base font-bold text-red-600 mb-3 flex items-center gap-2">
                <Send className="w-4 h-4" /> Advertencia — Tipo de cobro difiere del conciliado
              </h3>
              <p className="text-sm text-gray-700 mb-2">
                Se encontraron <strong>{recibosConTipoCobroDifiere.size}</strong> registro(s) seleccionado(s) cuyo tipo de cobro no coincide con el tipo de cobro de la conciliación.
              </p>
              <div className="max-h-40 overflow-y-auto mb-4 text-xs border rounded-lg divide-y">
                {datosDG
                  .filter((r) => recibosConTipoCobroDifiere.has(r.valorId))
                  .map((r) => (
                    <div key={r.valorId} className="flex items-center justify-between px-3 py-1.5 bg-red-50">
                      <span className="font-medium text-gray-800 truncate max-w-[55%]">{r.nombre_cliente}</span>
                      <span className="text-red-700 font-semibold">{r.codigo}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-blue-700 font-semibold">{conciliados[r.valorId]?.tipoCobro}</span>
                    </div>
                  ))}
              </div>
              <p className="text-xs text-gray-500 mb-5">
                Los registros marcados en rojo en la columna Tipo pueden corregirse haciendo click sobre el tipo.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setModalAdvertenciaTipoCobro(false);
                    setRecibosConTipoCobroDifiere(new Set());
                    toast({
                      variant: "destructive",
                      title: "Tipos de cobro con diferencias marcados en rojo en la columna Tipo",
                    });
                  }}
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                >
                  Corregir
                </button>
                <button
                  onClick={() => {
                    setModalAdvertenciaTipoCobro(false);
                    setRecibosConTipoCobroDifiere(new Set());
                    verificarACuentaYAbrir();
                  }}
                  className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold"
                >
                  Continuar de todos modos
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL ADVERTENCIA CONCILIACIÓN */}
       {/* MODAL ADVERTENCIA EMPRESA RECIBO */}
       {modalAdvertenciaEmpresaTransmitir && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
             <h3 className="text-base font-bold text-teal-700 mb-3 flex items-center gap-2">
               <Building2 className="w-4 h-4" /> Advertencia — Empresa del recibo no coincide
             </h3>
             <p className="text-sm text-gray-700 mb-2">
               Se encontraron <strong>{discrepanciasEmpresaTransmitir.size}</strong> registro(s) seleccionado(s) cuya empresa no coincide con la del tipo de cobro.
             </p>
             <p className="text-sm text-gray-500 mb-5">
               Los registros afectados están marcados en amarillo en la tabla. ¿Deseás corregirlos antes de transmitir o continuar de todos modos?
             </p>
             <div className="flex justify-end gap-2">
               <button
                 onClick={() => {
                   setDiscrepanciasEmpresa(discrepanciasEmpresaTransmitir);
                   setModalAdvertenciaEmpresaTransmitir(false);
                 }}
                 className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
               >
                 Corregir
               </button>
               <button
                 onClick={() => {
                   setModalAdvertenciaEmpresaTransmitir(false);
                   setDiscrepanciasEmpresaTransmitir(new Set());
                   verificarACuentaYAbrir();
                 }}
                 className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold"
               >
                 Continuar de todos modos
               </button>
             </div>
           </div>
         </div>
       )}

       {/* MODAL ADVERTENCIA aCuenta */}
       {modalAdvertenciaACuenta && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
             <h3 className="text-base font-bold text-green-700 mb-3 flex items-center gap-2">
               <Scale className="w-4 h-4" /> Advertencia — Importe a cuenta elevado
             </h3>
             <p className="text-sm text-gray-700 mb-2">
               Se encontraron <strong>{recibosConACuenta.size}</strong> registro(s) seleccionado(s) con un importe <em>a cuenta</em> mayor a $10.
             </p>
             <p className="text-sm text-gray-500 mb-5">
               Los registros afectados están marcados en verde en la columna Nombre. ¿Deseás corregirlos antes de transmitir o continuar de todos modos?
             </p>
             <div className="flex justify-end gap-2">
               <button
                 onClick={() => {
                   setModalAdvertenciaACuenta(false);
                   toast({
                     title: "Registros con aCuenta > $10 marcados en verde en la columna Nombre",
                   });
                 }}
                 className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
               >
                 Corregir
               </button>
               <button
                 onClick={() => {
                   setModalAdvertenciaACuenta(false);
                   setRecibosConACuenta(new Set());
                   abrirTransmitir();
                 }}
                 className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold"
               >
                 Continuar de todos modos
               </button>
             </div>
           </div>
         </div>
       )}

       {modalAdvertenciaConciliacion && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-md">
             <h3 className="text-base font-bold text-pink-600 mb-3 flex items-center gap-2">
               <Send className="w-4 h-4" /> Advertencia — Valores sin conciliar
             </h3>
             <p className="text-sm text-gray-700 mb-2">
               Se encontraron <strong>{cobranzasNoConciliadasTransmitir.size}</strong> recibo(s) con valores que no están conciliados con un extracto.
             </p>
             <p className="text-sm text-gray-500 mb-5">
               Los clientes afectados están marcados en rosa en la tabla. ¿Deseás corregirlos antes de transmitir o continuar de todos modos?
             </p>
             <div className="flex justify-end gap-2">
               <button
                 onClick={() => {
                   setModalAdvertenciaConciliacion(false);
                   toast({
                     variant: "destructive",
                     title: "Recibos sin conciliar marcados en rosa en la columna Cliente",
                   });
                 }}
                 className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
               >
                 Corregir
               </button>
               <button
                 onClick={() => {
                   setModalAdvertenciaConciliacion(false);
                   setCobranzasNoConciliadasTransmitir(new Set());
                   verificarImportesYAbrir();
                 }}
                 className="px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold"
               >
                 Continuar de todos modos
               </button>
             </div>
           </div>
         </div>
       )}

       {/* MODAL CONFIRMAR QUITAR DECIMALES */}
        {modalConfirmarQuitarDecimales && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
              <h3 className="text-base font-bold text-cyan-700 mb-3">Quitar Decimales</h3>
              <p className="text-sm text-gray-700 mb-2">
                Esta acción pondrá en cero los decimales del importe en imputaciones, valores y aCuenta de los recibos seleccionados.
              </p>
              <p className="text-sm text-gray-500 mb-5">
                Solo aplica a recibos con 1 sola imputación y 1 solo valor. ¿Confirmás?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setModalConfirmarQuitarDecimales(false)}
                  className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setModalConfirmarQuitarDecimales(false);
                    ejecutarQuitarDecimales();
                  }}
                  className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        )}

         {/* MODAL IMPRIMIR */}
         {modalImprimir && (
           <RecibosImprimirModal
             onClose={() => setModalImprimir(false)}
             datosDG={datosDG}
             datosFiltrados={datosFiltrados}
             conciliados={conciliados}
             hojasSeleccionadas={hojasSeleccionadas}
             hojaUnica={hojaUnica}
             esMultipleHDR={esMultipleHDR}
             seleccionados={seleccionados}
           />
         )}

         {/* MODAL RESUMEN HDR */}
         {modalResumen && (
           <RecibosResumenHDR
             onClose={() => setModalResumen(false)}
             hojaSeleccionada={hojaUnica ?? {
               hoja_ruta: `${hojasSeleccionadas.length} HDRs seleccionadas`,
               fecha: "",
               vendedor: "",
               chofer: "",
               total: 0,
               cant_recibos: 0,
             }}
             resumenHDR={resumenHDR}
             formatMoneda={(v) =>
               Number(v).toLocaleString("es-AR", {
                 style: "currency",
                 currency: "ARS",
               })
             }
           />
         )}
   
         {/* PANEL SUPERIOR */}
         <div className="bg-gradient-to-r from-blue-50 via-white to-blue-50 rounded-2xl shadow-md border p-2">
   
           <div className="grid grid-cols-1 md:grid-cols-[7fr_4fr_9fr] gap-3 items-start">
   
             {/* 1) FILTROS */}
             <div className="flex flex-col gap-1 min-w-0">
               {hayHDRSeleccionada ? (
                 <RecibosFiltros
                   tipos={tipos}
                   empresas={empresas}
                   divisiones={divisiones}
                   estados={estados}
                   filtroTipo={filtroTipo}
                   filtroEmpresa={filtroEmpresa}
                   filtroDivision={filtroDivision}
                   filtroEstado={filtroEstado}
                   filtroConciliacion={filtroConciliacion}
                   setFiltroTipo={setFiltroTipo}
                   setFiltroEmpresa={setFiltroEmpresa}
                   setFiltroDivision={setFiltroDivision}
                   setFiltroEstado={setFiltroEstado}
                   setFiltroConciliacion={setFiltroConciliacion}
                 />
               ) : (
                 <div className="text-gray-600">No hay hoja seleccionada</div>
               )}
             </div>
   
             {/* 2) DATOS HDR CENTRADOS */}
             <div className="flex flex-col items-center justify-start gap-0.5 min-w-0">
               <RecibosHojaRutaSelector
                 onSelect={handleSelectHR}
                 compact={hayHDRSeleccionada}
                 onCambiarHR={(proceed) => { proceed(); }}
                 onCerrarHDR={(hojas) => {
                   setHojasParaCerrar(hojas.map((h) => h.hoja_ruta));
                   setModalCancelar(true);
                 }}
               />
               {hayHDRSeleccionada && (
                 <>
                   {esMultipleHDR ? (
                     <>
                       <span className="font-bold text-blue-800 text-base tracking-wide">
                         Múltiples HDR
                       </span>
                       <div className="text-xs text-gray-500 italic">
                         {hojasSeleccionadas.length} hojas de ruta
                       </div>
                     </>
                   ) : (
                     <>
                       <span className="font-bold text-blue-800 text-base tracking-wide">
                         {hojaUnica!.hoja_ruta}
                       </span>
                       <div className="flex gap-3 text-xs text-gray-500">
                         <span>{hojaUnica!.fecha.substring(0, 10)}</span>
                         <span className="text-gray-400">·</span>
                         <span>{hojaUnica!.vendedor}</span>
                         <span className="text-gray-400">·</span>
                         <span className="font-medium text-gray-700">{hojaUnica!.chofer}</span>
                       </div>
                     </>
                   )}

                   <div className="text-xs">
                     <span className="text-gray-500">Total Cobrado: </span>
                     <span className="font-bold text-green-700 text-sm">
                       {datosDG.reduce((s, r) => s + Number(r.monto), 0).toLocaleString("es-AR", {
                         style: "currency",
                         currency: "ARS",
                       })}
                     </span>
                   </div>

                   <button
                     onClick={() => setModalResumen(true)}
                     className="mt-1 flex items-center gap-1 px-2.5 py-0.5 text-xs bg-black text-white rounded-lg shadow"
                   >
                     <FileText className="w-4 h-4" /> Resumen HDR
                   </button>


                 </>
               )}
             </div>
   
             {/* 3) ACCIONES */}
             <div className="flex flex-col gap-2 min-w-0">

               {hayHDRSeleccionada && (
                 <div className="flex flex-col gap-1.5">

                   {/* Acciones HDR */}
                   <div className="rounded-xl border border-slate-200 bg-white/70 p-2 shadow-sm">
                     <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Acciones HDR</p>
                     <div className="flex flex-wrap gap-1.5">
                       <button
                         onClick={() => {
                           const estadoLabel: Record<string, string> = {
                             enviado: "Enviado",
                             pendiente: "Pendiente",
                             error: "Error",
                           };
                           const rows = datosFiltrados.map((r) => {
                             const conc = conciliados[r.valorId];
                             return {
                               "Estado":           estadoLabel[r.estado] ?? r.estado,
                               "Empresa":          `${r.empresa_nombre} (${r.empresa_division})`,
                               "Recibo":           r.recibo,
                               "Fecha":            r.fecha ? r.fecha.slice(0, 10) : "",
                               "Cliente":          r.clienteId,
                               "Nombre":           r.nombre_cliente,
                               "Documento":        r.documento,
                               "Tipo":             r.codigo,
                               "Observación":      r.observacion || "",
                               "Monto":            Number(r.monto),
                               "Operación conc.":  conc?.operacion || "",
                               "Documento conc.":  conc?.documento || "",
                               "Importe conc.":    conc?.importe ? Number(conc.importe) : "",
                             };
                           });
                           const ws = XLSX.utils.json_to_sheet(rows);
                           ws["!cols"] = [
                             { wch: 11 }, // Estado
                             { wch: 28 }, // Empresa
                             { wch: 10 }, // Recibo
                             { wch: 12 }, // Fecha
                             { wch: 10 }, // Cliente
                             { wch: 32 }, // Nombre
                             { wch: 14 }, // Documento
                             { wch:  8 }, // Tipo
                             { wch: 32 }, // Observación
                             { wch: 14 }, // Monto
                             { wch: 20 }, // Operación conc.
                             { wch: 16 }, // Documento conc.
                             { wch: 14 }, // Importe conc.
                           ];
                           const hdrNombre = esMultipleHDR
                             ? "Multiples_HDR"
                             : (hojaUnica?.hoja_ruta ?? "HDR");
                           const fecha = new Date().toISOString().slice(0, 10);
                           const wb = XLSX.utils.book_new();
                           XLSX.utils.book_append_sheet(wb, ws, "Recibos");
                           XLSX.writeFile(wb, `Recibos_${hdrNombre}_${fecha}.xlsx`);
                         }}
                         className="flex items-center gap-1 px-2.5 py-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-sm transition-colors"
                       >
                         <Download className="w-3 h-3" /> Exportar
                       </button>

                       <button
                         onClick={() => setModalImprimir(true)}
                         className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors"
                       >
                         <Printer className="w-3 h-3" /> Imprimir
                       </button>

                       <button
                         onClick={() => {
                           if (seleccionados.size === 0)
                             return toast({
                               variant: "destructive",
                               title: "No hay registros seleccionados",
                             });
                           // Detección de recibos con EFE + otro tipo de cobro
                           // Primero obtenemos los números de recibo de los registros seleccionados
                           const recibosSeleccionados = new Set(
                             datosDG.filter((r) => seleccionados.has(r.valorId)).map((r) => r.recibo)
                           );
                           // Luego agrupamos TODOS los valores de esos recibos en datosDG (no solo los seleccionados)
                           const porRecibo: Record<string, string[]> = {};
                           datosDG
                             .filter((r) => recibosSeleccionados.has(r.recibo))
                             .forEach((r) => {
                               if (!porRecibo[r.recibo]) porRecibo[r.recibo] = [];
                               // EFE con monto 0 no participa del control de conflicto
                               if (r.codigo.trim().toUpperCase() === "EFE" && Number(r.monto) <= 0) return;
                               porRecibo[r.recibo].push(r.codigo.trim().toUpperCase());
                             });
                           const conflictos = new Set(
                             Object.entries(porRecibo)
                               .filter(([, codigos]) =>
                                 codigos.length > 1 &&
                                 codigos.includes("EFE") &&
                                 codigos.some((c) => c !== "EFE")
                               )
                               .map(([recibo]) => recibo)
                           );
                           if (conflictos.size > 0) {
                             setRecibosConEFEConflicto(conflictos);
                             setModalAdvertenciaEFE(true);
                             return;
                           }
                           // Verificar tipo de cobro del recibo vs tipo de cobro conciliado
                           const conTipoDifiere = new Set<number>(
                             datosDG
                               .filter((r) => {
                                 if (!seleccionados.has(r.valorId)) return false;
                                 if (r.estado === "enviado") return false;
                                 const conc = conciliados[r.valorId];
                                 return (
                                   !!conc?.extractoId &&
                                   !!conc?.tipoCobro &&
                                   conc.tipoCobro.trim().toUpperCase() !== r.codigo.trim().toUpperCase()
                                 );
                               })
                               .map((r) => r.valorId)
                           );
                           if (conTipoDifiere.size > 0) {
                             setRecibosConTipoCobroDifiere(conTipoDifiere);
                             setModalAdvertenciaTipoCobro(true);
                             return;
                           }
                           // Validación empresa: solo registros seleccionados
                           const conEmpresaDifiere = new Set<number>(
                             datosDG
                               .filter((r) => {
                                 if (!seleccionados.has(r.valorId)) return false;
                                 if (r.estado === "enviado") return false;
                                 const tipoCobro = tiposCobro.find(
                                   (t) => t.codigo?.trim().toUpperCase() === r.codigo?.trim().toUpperCase() && t.concilia === "S"
                                 );
                                 if (!tipoCobro || !tipoCobro.Empresas) return false;
                                 return tipoCobro.Empresas.trim() !== (r.empresa || "").trim();
                               })
                               .map((r) => r.valorId)
                           );
                           if (conEmpresaDifiere.size > 0) {
                             setDiscrepanciasEmpresaTransmitir(conEmpresaDifiere);
                             setModalAdvertenciaEmpresaTransmitir(true);
                             return;
                           }
                           verificarACuentaYAbrir();
                         }}
                         className="flex items-center gap-1 px-2.5 py-1 text-xs bg-violet-600 hover:bg-violet-700 text-white rounded-lg shadow-sm transition-colors"
                       >
                         <Send className="w-3 h-3" /> Transmitir
                       </button>

                       <button
                         onClick={() => {
                           setHojasParaCerrar(hojaUnica ? [hojaUnica.hoja_ruta] : []);
                           setModalCancelar(true);
                         }}
                         disabled={esMultipleHDR}
                         title={esMultipleHDR ? "Solo disponible con una única HDR seleccionada" : "Se da por finalizada la hoja de ruta y no figura más en pendientes"}
                         className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white rounded-lg shadow-sm transition-colors"
                       >
                         <XCircle className="w-3 h-3" /> Cerrar HDR
                       </button>
                     </div>
                   </div>

                   {/* Conciliación */}
                   <div className="rounded-xl border border-slate-200 bg-white/70 p-2 shadow-sm">
                     <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Conciliación</p>
                     <RecibosConciliacionActions
                     hojaRutas={hojasSeleccionadas.map((h) => h.hoja_ruta)}
                     hojaFecha={fechaComun}
                     fechaMinHDR={fechaMinHDR}
                     fechaMaxHDR={fechaMaxHDR}
                     conciliadosExternos={conciliados}
                     seleccionadosExternos={seleccionados}
                     enviadosIds={new Set(datosDG.filter((r) => r.estado === "enviado").map((r) => r.valorId))}
                     
                     onConciliados={(mapa) => {
                      setConciliados((prev) => {
                        const nuevo = { ...prev };
                        Object.entries(mapa).forEach(([valorId, data]) => {
                          const id = Number(valorId);
                          const previo = prev[id];
                          if (data === null) {
                            if (previo) delete nuevo[id];
                            return;
                          }
                          if (data.manyMatches) { nuevo[id] = data; return; }
                          const cambioReal =
                            !previo ||
                            previo.extractoId !== data.extractoId ||
                            previo.documento !== data.documento ||
                            previo.operacion !== data.operacion ||
                            Number(previo.importe) !== Number(data.importe);
                          if (cambioReal) nuevo[id] = data;
                        });
                        return nuevo;
                      });
                      // Refrescar estado de conciliados tras desvinculaciones
                      const hayDesvinculados = Object.values(mapa).some((v) => v === null);
                      if (hayDesvinculados) setNeedConciliadosRefresh(true);
                    }}
                    
                    

                   />
                   </div>

                   {/* Acciones Recibos */}
                   <div className="rounded-xl border border-slate-200 bg-white/70 p-2 shadow-sm">
                     <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-widest mb-1">Acciones Recibos</p>
                     <div className="flex flex-wrap gap-1.5">

                       <button
                         onClick={() => handleValidarEmpresaRecibo()}
                         title="Valida que el recibo pertenezca a la empresa"
                         className="flex items-center gap-1 px-2.5 py-1 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow-sm transition-colors"
                       >
                         <Building2 className="w-3 h-3" /> Val. Rec. Empr.
                       </button>

                       <button
                         title="Compara el Monto del recibo con el Importe conciliado para los registros que tienen conciliación aplicada. Marca en rojo las filas con diferencia."
                         onClick={() => {
                           const conDiferencia = datosDG
                             .filter((r) => {
                               if (r.estado === "enviado") return false;
                               const conc = conciliados[r.valorId];
                               return conc?.extractoId && Number(r.monto) !== Number(conc.importe);
                             })
                             .map((r) => r.valorId);

                           if (conDiferencia.length === 0) {
                             setDiscrepancias(new Set());
                             toast({
                               title: "Sin discrepancias",
                               description: "No se hallaron diferencias entre los importes de los recibos y los conciliados.",
                             });
                           } else {
                             setDiscrepancias(new Set(conDiferencia));
                             toast({
                               variant: "destructive",
                               title: `${conDiferencia.length} diferencia(s) encontrada(s)`,
                               description: "Los registros con diferencia están marcados en rojo en la columna Monto.",
                             });
                           }
                         }}
                         className="flex items-center gap-1 px-2.5 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors"
                       >
                         <Scale className="w-3 h-3" /> Val. Importes
                       </button>

                       <button
                         title="Se eliminará el recibo completo del cliente seleccionado"
                         disabled={seleccionados.size === 0}
                         onClick={() => {
                           const cobranzaIdsSet = new Set(
                             datosDG.filter((r) => seleccionados.has(r.valorId)).map((r) => r.cobranzaId)
                           );
                           const cobranzas = [...cobranzaIdsSet].map((cobranzaId) => ({
                             cobranzaId,
                             nombre: datosDG.find((r) => r.cobranzaId === cobranzaId)?.nombre_cliente ?? "",
                             rows: datosDG.filter((r) => r.cobranzaId === cobranzaId),
                           }));
                           const totalGeneral = cobranzas.reduce(
                             (s, c) => s + c.rows.reduce((rs, r) => rs + Number(r.monto), 0), 0
                           );
                           setModalEliminarRecibo({ cobranzas, totalGeneral });
                         }}
                         className="flex items-center gap-1 px-2.5 py-1 text-xs bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white rounded-lg shadow-sm transition-colors"
                       >
                         <XCircle className="w-3 h-3" /> Eliminar Recibo
                       </button>

                       <button
                         title="Pone en cero los decimales del importe en imputaciones, valores y aCuenta de los recibos marcados. Solo aplica a recibos con 1 sola imputación y 1 solo valor."
                         disabled={seleccionados.size === 0 || quitandoDecimales}
                         onClick={() => setModalConfirmarQuitarDecimales(true)}
                         className="flex items-center gap-1 px-2.5 py-1 text-xs bg-cyan-600 hover:bg-cyan-700 disabled:opacity-40 text-white rounded-lg shadow-sm transition-colors"
                       >
                         <XCircle className="w-3 h-3" /> Quitar Decimales
                       </button>

                       <button
                         onClick={handleActualizarObservaciones}
                         title="Reemplaza las observaciones del recibo seleccionado por las del registro conciliado"
                         className="flex items-center gap-1 px-2.5 py-1 text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-sm transition-colors"
                       >
                         <RefreshCw className="w-3 h-3" /> Oper. conc. =&gt; Observ.
                       </button>

                     </div>
                   </div>

                 </div>
               )}
             </div>
   
           </div>
         </div>

         {/* TABLA */}
         {hayHDRSeleccionada ? (
           <RecibosTabla
             key={refreshKey}
             hojaRuta={hojaUnica?.hoja_ruta ?? ""}
             rows={datosFiltrados}
             conciliados={conciliados}
             pendientesAplicar={new Set()}
             discrepancias={discrepancias}
             discrepanciasEmpresa={discrepanciasEmpresa}
             recibosConEFEConflicto={recibosConEFEConflicto}
             cobranzasNoConciliadasTransmitir={cobranzasNoConciliadasTransmitir}
             recibosConACuenta={recibosConACuenta}
             choferMap={Object.fromEntries(hojasSeleccionadas.map(h => [h.hoja_ruta, h.chofer]))}
             idsADeseleccionar={idsTransmitidos}
             fechaMinHDR={fechaMinHDR}
             fechaMaxHDR={fechaMaxHDR}
             onSelectChange={setSeleccionados}
             onEditar={(id) => setEditarId(id)}
             onConciliadoManual={(valorId, data) => {
               setConciliados((prev) => ({
                 ...prev,
                 [valorId]: {
                   valorId,
                   extractoId: data.extractoId,
                   operacion: data.operacion,
                   documento: data.documento,
                   importe: data.importe,
                   tipoCobro: data.tipoCobro,
                   cobranzaId: prev[valorId]?.cobranzaId ?? null,
                 },
               }));
               // Persistir inmediatamente en la base de datos
               fetchWithAuth("/api/distrigestion/conciliacion/hdr/aplicar", {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ pares: [{ extractoId: data.extractoId, valorId }] }),
               });
             }}
             onDesvinculado={(valorId) => {
               setConciliados((prev) => {
                 const n = { ...prev };
                 delete n[valorId];
                 return n;
               });
               setNeedConciliadosRefresh(true);
             }}
            onReplicarTipoCobro={async (valorId, nuevoCodigo) => {
              try {
                const res = await fetchWithAuth("/api/distrigestion/recibos-valores/actualizar-codigo", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ valorId, codigo: nuevoCodigo }),
                });
                if (!res.ok) {
                  toast({ variant: "destructive", title: "Error", description: (res as any).message || "No se pudo actualizar el tipo de cobro." });
                  return;
                }
                setDatosDG((prev) =>
                  prev.map((r) => (r.valorId === valorId ? { ...r, codigo: nuevoCodigo } : r))
                );
                toast({ title: "Tipo de cobro actualizado" });

                // Validación empresa post-replicación
                // La empresa del registro no cambia, solo cambió el código → buscar el nuevo tipoCobro
                const registroActual = datosDG.find((r) => r.valorId === valorId);
                const tipoCobro = tiposCobro.find(
                  (t) => t.codigo?.trim().toUpperCase() === nuevoCodigo?.trim().toUpperCase() && t.concilia === "S"
                );
                const tieneDiscrepanciaEmpresa =
                  !!registroActual &&
                  !!tipoCobro &&
                  !!tipoCobro.Empresas &&
                  tipoCobro.Empresas.trim() !== (registroActual.empresa || "").trim();

                setDiscrepanciasEmpresa((prev) => {
                  const next = new Set(prev);
                  if (tieneDiscrepanciaEmpresa) next.add(valorId);
                  else next.delete(valorId);
                  return next;
                });

                if (tieneDiscrepanciaEmpresa) {
                  toast({
                    variant: "destructive",
                    title: "Empresa del recibo no coincide",
                    description: "El tipo de cobro replicado corresponde a una empresa diferente. El registro fue marcado en amarillo.",
                  });
                }
              } catch (err: any) {
                toast({ variant: "destructive", title: "Error", description: err?.message || "Error inesperado." });
              }
            }}
           />
         ) : (
           <div className="text-center py-12 text-gray-500">
             <FileText className="w-8 h-8 mx-auto mb-2" />
             Seleccioná una HDR para ver los valores.
           </div>
         )}
   
         {/* MODALES */}
         <RecibosEditarModal
           open={editarId !== null}
           reciboId={editarId}
           onClose={() => setEditarId(null)}
           onUpdated={() => cargarRecibosMultiple(hojasSeleccionadas, true)}
           tiposCobro={tiposCobro}
           conciliados={conciliados}
         />
   
         <RecibosTransmitirHDR
           open={modalTransmitir}
           onClose={() => setModalTransmitir(false)}
           hojaRuta={hojasSeleccionadas.map((h) => h.hoja_ruta).join(", ")}
           seleccionados={seleccionados}
           rows={datosFiltrados}
           onTerminado={(_reset, transmittedValorIds) => {
             if (transmittedValorIds?.length) setIdsTransmitidos(new Set(transmittedValorIds));
             cargarRecibosMultiple(hojasSeleccionadas, true);
           }}
         />
   
         <RecibosCancelarHDR
           open={modalCancelar}
           onClose={() => setModalCancelar(false)}
           hojaRutas={hojasParaCerrar}
           onTerminado={() => {
             setHojasSeleccionadas([]);
             setDatosDG([]);
             setConciliados({});
             setSeleccionados(new Set());
           }}
         />
   
         <ReciboModoObservModal
           open={modalModoObs}
           onCancel={() => setModalModoObs(false)}
           onConfirm={handleModoObsSeleccionado}
         />

         <ConfirmModal
           open={confirmObs}
           title="Actualizar observaciones"
           message={`Se actualizarán ${pendingUpdates.length} observación(es). ¿Desea continuar?`}
           onConfirm={aplicarObservacionesConfirmado}
           onCancel={() => setConfirmObs(false)}
         />

         {/* Modal: Cambiar HR con pendientes sin aplicar */}
         {modalCambiarHR && (
           <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
             <div style={styleCambiarHR} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
               <h3 {...handlePropsCambiarHR} className="text-base font-bold text-amber-600 mb-3">Conciliaciones sin aplicar</h3>
               <p className="text-sm text-gray-700 mb-5">
                 Hay conciliaciones pendientes de aplicar en esta HDR. Si cambiás de hoja de ruta se perderán. ¿Deseás continuar igualmente o quedarte a aplicar?
               </p>
               <div className="flex justify-end gap-2">
                 <button
                   onClick={() => setModalCambiarHR(null)}
                   className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
                 >
                   Quedarse y aplicar
                 </button>
                 <button
                   onClick={() => {
                     const proceed = modalCambiarHR.proceed;
                     setModalCambiarHR(null);
                     proceed();
                   }}
                   className="px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
                 >
                   Continuar igual
                 </button>
               </div>
             </div>
           </div>
         )}

         {/* Modal: Confirmar eliminación de recibo */}
         {modalEliminarRecibo && (
           <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
             <div style={styleEliminarRecibo} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md">
               <h3 {...handlePropsEliminarRecibo} className="text-base font-bold text-red-600 mb-3">
                 Eliminar Recibo{modalEliminarRecibo.cobranzas.length > 1 ? "s" : ""}
               </h3>
               <div className="space-y-3 mb-3 max-h-64 overflow-y-auto pr-1">
                 {modalEliminarRecibo.cobranzas.map((c) => (
                   <div key={c.cobranzaId}>
                     <p className="text-sm text-gray-700 mb-1">
                       Cliente: <span className="font-semibold">{c.nombre}</span>
                     </p>
                     <ul className="text-sm space-y-0.5">
                       {c.rows.map((r) => (
                         <li key={r.valorId} className="flex justify-between text-gray-700 border-b py-0.5">
                           <span className="font-mono text-xs text-blue-700 w-12">{r.codigo}</span>
                           <span>{Number(r.monto).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}</span>
                         </li>
                       ))}
                     </ul>
                   </div>
                 ))}
               </div>
               <p className="text-sm font-semibold text-right mb-5">
                 Total: {Number(modalEliminarRecibo.totalGeneral).toLocaleString("es-AR", { style: "currency", currency: "ARS" })}
               </p>
               <div className="flex justify-end gap-2">
                 <button
                   onClick={() => setModalEliminarRecibo(null)}
                   disabled={eliminandoRecibo}
                   className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                 >
                   Cancelar
                 </button>
                 <button
                   disabled={eliminandoRecibo}
                   onClick={async () => {
                     setEliminandoRecibo(true);
                     try {
                       const eliminadosCobranzaIds: number[] = [];
                       const eliminadosValorIds: number[] = [];
                       const errores: string[] = [];

                       for (const c of modalEliminarRecibo.cobranzas) {
                         const res = await fetchWithAuth(
                           `/api/distrigestion/recibos/${c.cobranzaId}`,
                           { method: "DELETE" }
                         );
                         if (!res.ok) {
                           errores.push(c.nombre);
                         } else {
                           eliminadosCobranzaIds.push(c.cobranzaId);
                           eliminadosValorIds.push(...c.rows.map((r: any) => r.valorId));
                         }
                       }

                       if (eliminadosCobranzaIds.length > 0) {
                         const cobranzaIdsSet = new Set(eliminadosCobranzaIds);
                         setDatosDG((prev) => prev.filter((r) => !cobranzaIdsSet.has(r.cobranzaId)));
                         setConciliados((prev) => {
                           const n = { ...prev };
                           eliminadosValorIds.forEach((id) => delete n[id]);
                           return n;
                         });
                         setSeleccionados((prev) => {
                           const n = new Set(prev);
                           eliminadosValorIds.forEach((id) => n.delete(id));
                           return n;
                         });
                       }

                       if (errores.length) {
                         toast({ variant: "destructive", title: "Errores al eliminar", description: `No se pudieron eliminar: ${errores.join(", ")}` });
                       } else {
                         toast({ title: "Recibos eliminados", description: `${eliminadosCobranzaIds.length} recibo(s) — ${eliminadosValorIds.length} registro(s) eliminado(s).` });
                       }
                       setModalEliminarRecibo(null);
                     } catch (err: any) {
                       toast({ variant: "destructive", title: "Error", description: err?.message || "Error inesperado." });
                     } finally {
                       setEliminandoRecibo(false);
                     }
                   }}
                   className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
                 >
                   {eliminandoRecibo ? "Eliminando…" : "Eliminar"}
                 </button>
               </div>
             </div>
           </div>
         )}

         {/* Modal: Resultado Quitar Decimales */}
         {modalQuitarDecimales && (
           <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
             <div style={styleQuitarDecimales} className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg">
               <h3 {...handlePropsQuitarDecimales} className="text-base font-bold text-cyan-700 mb-3">Quitar Decimales — Resultado</h3>

               {modalQuitarDecimales.aplicados.length > 0 ? (
                 <p className="text-sm text-gray-700 mb-3">
                   Se aplicaron los cambios a <span className="font-semibold">{modalQuitarDecimales.aplicados.length}</span> recibo(s) correctamente.
                 </p>
               ) : (
                 <p className="text-sm text-gray-500 mb-3">No se aplicaron cambios.</p>
               )}

               {modalQuitarDecimales.omitidos.length > 0 && (
                 <>
                   <p className="text-sm text-amber-700 font-semibold mb-1">
                     Los siguientes recibos deben editarse manualmente por tener más de un valor de cobro o imputación:
                   </p>
                   <div className="overflow-y-auto max-h-48 border border-amber-200 rounded-lg">
                     <table className="min-w-full text-xs">
                       <thead className="bg-amber-50 text-amber-700">
                         <tr>
                           <th className="px-3 py-1 border text-left">Recibo</th>
                           <th className="px-3 py-1 border text-left">ID Cliente</th>
                           <th className="px-3 py-1 border text-left">Nombre Cliente</th>
                         </tr>
                       </thead>
                       <tbody>
                         {modalQuitarDecimales.omitidos.map((o) => (
                           <tr key={o.cobranzaId} className="border-t">
                             <td className="px-3 py-1 border font-mono">{o.recibo || "-"}</td>
                             <td className="px-3 py-1 border">{o.clienteId}</td>
                             <td className="px-3 py-1 border">{o.nombre_cliente}</td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </>
               )}

               <div className="flex justify-end mt-5">
                 <button
                   onClick={() => setModalQuitarDecimales(null)}
                   className="px-4 py-2 text-sm bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg"
                 >
                   Cerrar
                 </button>
               </div>
             </div>
           </div>
         )}

       </div>
     );
   };

   export default Recibos;
   