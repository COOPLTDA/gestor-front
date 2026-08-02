import React, { useEffect, useState } from "react";
import {
  User,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileDown,
  Pencil
} from "lucide-react";
import PedidoDetalleModal from "./components/PedidoDetalleModal";
import { fetchWithAuth } from "@/utils/fetchWithAuth";

const DIAS = [
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" },
  { value: "7", label: "Domingo" },
];
const DIAS_MAP: Record<string, string> = Object.fromEntries(DIAS.map(d => [d.value, d.label]));

const ESTADOS = [
  { value: "Iniciado", label: "Iniciado", color: "bg-yellow-200 text-yellow-900 border-yellow-300" },
  { value: "Finalizado", label: "Finalizado", color: "bg-blue-200 text-blue-900 border-blue-300" },
  { value: "Confirmado", label: "Confirmado", color: "bg-green-200 text-green-900 border-green-300" },
  { value: "Cancelado", label: "Cancelado", color: "bg-red-200 text-red-900 border-red-300" },
];
const ESTADOS_ALL = ESTADOS.map(e => e.value);

const estadoProps = {
  "Iniciado": { icon: <Clock className="w-4 h-4" />, color: "bg-yellow-200 text-yellow-900" },
  "Finalizado": { icon: <Clock className="w-4 h-4" />, color: "bg-blue-200 text-blue-900" },
  "Confirmado": { icon: <CheckCircle className="w-4 h-4" />, color: "bg-green-200 text-green-900" },
  "Cancelado": { icon: <XCircle className="w-4 h-4" />, color: "bg-red-200 text-red-900" }
};

function formatCurrency(num?: number) {
  if (num == null) return "-";
  return num.toLocaleString("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
}

const getDefaultFechaDesde = () => {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
};

// --- CORRECCIÓN: fecha local (no UTC) ---
function formatDateTime(fecha?: string, hora?: string) {
  if (!fecha) return "-";

  // Si viene como ISO con "T"
  if (/^\d{4}-\d{2}-\d{2}T/.test(fecha)) {
    const cleanDate = fecha.slice(0, 10); // "2025-10-28"
    const [y, m, d] = cleanDate.split("-");
    let hh = "00", mm = "00";
    if (hora && hora.includes(":")) {
      [hh, mm] = hora.split(":");
    }
    return `${d}/${m}/${y} ${hh}:${mm}`;
  }

  // Si viene como "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [y, m, d] = fecha.split("-");
    let hh = "00", mm = "00";
    if (hora && hora.includes(":")) {
      [hh, mm] = hora.split(":");
    }
    return `${d}/${m}/${y} ${hh}:${mm}`;
  }

  // Cualquier otro formato: limpiar T/Z
  let cleaned = fecha.replace(/[Tt]/, " ").replace(/(\.\d+)?Z$/, "");
  cleaned = cleaned.split(":").slice(0, 2).join(":"); // hh:mm
  return `${cleaned} ${hora || ""}`.trim();
}


interface Pedido {
  id_pedido: number;
  fecha: string;
  hora: string;
  clienteId: string;
  nombre_cliente?: string;
  nombre_contacto?: string;
  celular_contacto?: string;
  estado: string;
  total_pedido?: number;
  diaDeVisita?: string; // del 1 al 7
  motivo_anulacion?: string; 
  pedido_cancelado?: string;
}

type PedidoModal = {
  id_pedido: number;
  clienteId: string;
  nombre_cliente: string;
};

const Pedidos: React.FC = () => {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [filtered, setFiltered] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<keyof Pedido | "total_pedido" | "">("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedEstados, setSelectedEstados] = useState<string[]>(["Iniciado", "Finalizado"]);
  const [fechaDesde, setFechaDesde] = useState(getDefaultFechaDesde());
  const [fechaHasta, setFechaHasta] = useState("");
  const [selectedDias, setSelectedDias] = useState<string[]>([]);
  const [detallePedido, setDetallePedido] = useState<PedidoModal | null>(null);
  const [showMotivo, setShowMotivo] = useState<{ motivo: string } | null>(null);

  // NUEVO: paginación front
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [total, setTotal] = useState(0);

  // --- FETCH pedidos ---
  const fetchPedidos = async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      selectedEstados.forEach(e => params.append("estados", e));
      if (fechaDesde) params.append("fecha_desde", fechaDesde);
      if (fechaHasta) params.append("fecha_hasta", fechaHasta);
      selectedDias.forEach(d => params.append("dias", d));

      // NUEVO: enviar page y limit
      params.append("page", String(page));
      params.append("limit", String(limit));

      const response = await fetchWithAuth(`/api/distrigestion/pedidos?${params.toString()}`);
      const result = await response.json();
      if (!result.success) throw new Error(result.message || "Error cargando pedidos");
      setPedidos(result.data);
      setTotal(result.total || 0); // NUEVO: total para calcular páginas
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- Filtros y sort ---
  useEffect(() => {
    let temp = [...pedidos];
  
    // Excluir "Enviado ERP" SIEMPRE
    temp = temp.filter(p => p.estado !== "Enviado ERP");
  
    if (search.trim()) {
      const s = search.toLowerCase();
      temp = temp.filter(p =>
        (p.clienteId && p.clienteId.toLowerCase().includes(s)) ||
        (p.nombre_cliente && p.nombre_cliente.toLowerCase().includes(s)) ||
        (p.nombre_contacto && p.nombre_contacto.toLowerCase().includes(s))
      );
    }
    if (selectedDias.length > 0 && !selectedDias.includes("todos")) {
      temp = temp.filter(p => selectedDias.includes(String(p.diaDeVisita || "")));
    }
    if (sortBy) {
      temp.sort((a, b) => {
        let vA: any = a[sortBy as keyof Pedido];
        let vB: any = b[sortBy as keyof Pedido];
        if (sortBy === "total_pedido") {
          vA = a.total_pedido || 0;
          vB = b.total_pedido || 0;
        }
        if (typeof vA === "string") vA = vA.toLowerCase();
        if (typeof vB === "string") vB = vB.toLowerCase();
        if (vA < vB) return sortDir === "asc" ? -1 : 1;
        if (vA > vB) return sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }
    setFiltered(temp);
  }, [search, pedidos, sortBy, sortDir, selectedDias]);
  

  // IMPORTANTE: ahora también cuando cambian page/limit
  useEffect(() => { fetchPedidos(); }, [selectedEstados, fechaDesde, fechaHasta, selectedDias, page, limit]);

  // --- Columnas redimensionables ---
  const resizableCol = "resize-x overflow-auto min-w-[80px]";
  const resizableColLong = "resize-x overflow-auto min-w-[170px]";
  const resizableColDay = "resize-x overflow-auto min-w-[90px]";

  // --- Handlers ---
  const handleSort = (col: keyof Pedido | "total_pedido") => {
    if (sortBy === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("asc");
    }
  };
  const handleEstados = (value: string) => {
    if (value === "todos") {
      if (selectedEstados.length === ESTADOS_ALL.length) {
        setSelectedEstados([]); // desmarca todos
      } else {
        setSelectedEstados([...ESTADOS_ALL]); // marca todos
      }
      // opcional: reset de página
      setPage(1);
    } else {
      setSelectedEstados(prev =>
        prev.includes(value) ? prev.filter(e => e !== value) : [...prev, value]
      );
      setPage(1);
    }
  };
  const handleDias = (value: string) => {
    if (value === "todos") {
      if (selectedDias.length === DIAS.length) {
        setSelectedDias([]); // desmarca todos
      } else {
        setSelectedDias(DIAS.map(d => d.value)); // marca todos
      }
      setPage(1);
    } else {
      setSelectedDias(prev =>
        prev.includes(value)
          ? prev.filter(d => d !== value)
          : [...prev, value]
      );
      setPage(1);
    }
  };

  const handleClearFilters = () => {
    setSearch("");
    setFechaDesde(getDefaultFechaDesde()); // ←
    setFechaHasta("");
    setSelectedDias([]);
    setSelectedEstados(["Iniciado", "Finalizado"]); // ←
    setPage(1); // NUEVO: al limpiar filtros, volvemos a la primera página
  };
  

  // --- Exportar ---
  const handleExport = async () => {
    if (filtered.length === 0) return;
    const headers = [
      "ID Cliente", "Cliente", "Día", "Celular", "Contacto", "Fecha", "Estado", "Total"
    ];
    const rows = filtered.map(p =>
      [
        p.clienteId,
        p.nombre_cliente || "-",
        DIAS_MAP[p.diaDeVisita || ""] || "-",
        p.celular_contacto || "-",
        p.nombre_contacto || "-",
        formatDateTime(p.fecha, p.hora),
        p.estado,
        formatCurrency(p.total_pedido)
      ]
    );
    const xlsxData = [headers, ...rows];
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet(xlsxData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
    XLSX.writeFile(wb, "pedidos.xlsx");
  };

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
      <div className="flex items-center space-x-3">
        <XCircle className="w-6 h-6 text-red-600" />
        <div>
          <h3 className="text-lg font-medium text-red-800">Error</h3>
          <p className="text-red-700">{error}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filtros en 2 filas */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-4 py-3 flex flex-col gap-2">
        {/* FILA 1: Cliente + Estados + Botón Actualizar */}
        <div className="flex flex-row items-start gap-3 w-full">
          {/* Filtro cliente */}
          <div className="flex-1 min-w-[270px] max-w-[370px]">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Buscar cliente (ID, nombre, contacto)
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Ej: 000451, Juan, Pérez"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>
          </div>

          {/* Estados */}
          <div className="flex flex-col min-w-[360px] flex-[2]">
            <span className="block text-xs font-medium text-gray-700 mb-1">Estados:</span>
            <div className="flex flex-row flex-wrap items-center gap-2">
              <label className="flex items-center px-2 py-1 rounded-full border text-xs cursor-pointer select-none bg-gray-100">
                <input
                  type="checkbox"
                  className="mr-1"
                  checked={selectedEstados.length === ESTADOS.length}
                  onChange={() => handleEstados("todos")}
                />
                Todos
              </label>
              {ESTADOS.map(e => (
                <label
                  key={e.value}
                  className={`flex items-center px-3 py-1 rounded-full border text-xs cursor-pointer select-none ${e.color} ${selectedEstados.includes(e.value) ? "ring-2 ring-blue-500" : ""}`}
                >
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={selectedEstados.includes(e.value)}
                    onChange={() => handleEstados(e.value)}
                  />
                  {e.label}
                </label>
              ))}
            </div>
          </div>

          {/* Botón Actualizar */}
          <div className="flex flex-col justify-start ml-auto">
            <button
              onClick={fetchPedidos}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2"
              title="Actualizar"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* FILA 2: Fechas + Días + Botón Limpiar */}
        <div className="flex flex-row items-start gap-3 w-full mt-1">
          {/* Fechas */}
          <div className="flex gap-2 min-w-[270px] max-w-[370px]">
            <div>
              <label className="block text-xs font-medium text-gray-700">Fecha desde</label>
              <input
                type="date"
                value={fechaDesde}
                onChange={e => { setFechaDesde(e.target.value); setPage(1); }}
                className="border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                max={fechaHasta || undefined}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Fecha hasta</label>
              <input
                type="date"
                value={fechaHasta}
                onChange={e => { setFechaHasta(e.target.value); setPage(1); }}
                className="border rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                min={fechaDesde || undefined}
              />
            </div>
          </div>

          {/* Días */}
          <div className="flex flex-col min-w-[360px] flex-[2]">
            <span className="block text-xs font-medium text-gray-700 mb-1">Día de Visita:</span>
            <div className="flex flex-row flex-wrap items-center gap-2">
              <label className="flex items-center px-2 py-1 rounded-full border text-xs cursor-pointer select-none bg-gray-100">
                <input
                  type="checkbox"
                  className="mr-1"
                  checked={selectedDias.length === DIAS.length}
                  onChange={() => { handleDias("todos"); }}
                />
                Todos
              </label>
              {DIAS.map(d => (
                <label
                  key={d.value}
                  className={`flex items-center px-3 py-1 rounded-full border text-xs cursor-pointer select-none ${selectedDias.includes(d.value) ? "bg-blue-50 ring-2 ring-blue-400" : "bg-white"}`}
                >
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={selectedDias.includes(d.value)}
                    onChange={() => handleDias(d.value)}
                  />
                  {d.label}
                </label>
              ))}
            </div>
          </div>

          {/* Botón Limpiar */}
          <div className="flex flex-col justify-start ml-auto">
            <button
              onClick={handleClearFilters}
              className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 transition-colors"
              title="Limpiar filtros"
            >
              Limpiar filtros
            </button>
          </div>
        </div>
      </div>

      {/* Cantidad de pedidos encontrados */}
      <div className="text-sm text-gray-700 font-medium px-1">
        {loading ? "Cargando pedidos..." : `${filtered.length} pedidos encontrados`}
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 relative">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Lista de Pedidos</h2>
          <button
            onClick={handleExport}
            className="flex items-center bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
            title="Exportar pedidos a Excel"
          >
            <FileDown className="w-5 h-5 mr-2" />
            Exportar Excel
          </button>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex items-center space-x-4">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-lg text-gray-600">Cargando pedidos...</span>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No se encontraron pedidos
              </h3>
              <p className="text-gray-500">
                Ajusta los filtros para ver diferentes resultados.
              </p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <colgroup>
                <col className="w-[40px]" />
                <col className={resizableCol} />
                <col className={resizableColLong} />
                <col className={resizableColDay} />
                <col className={resizableCol} />
                <col className={resizableCol} />
                <col className={resizableCol} />
                <col className={resizableCol} />
                <col className={resizableCol} />
              </colgroup>
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-xs font-semibold text-gray-600 text-center resize-x overflow-auto min-w-[40px]"></th>
                  <Th col="clienteId" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">ID Cliente</Th>
                  <Th col="nombre_cliente" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">Cliente</Th>
                  <Th col="diaDeVisita" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">Día de Visita</Th>
                  <Th col="celular_contacto" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">Celular</Th>
                  <Th col="nombre_contacto" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">Contacto</Th>
                  <Th col="fecha" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">Fecha Inicio</Th>
                  <Th col="estado" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">Estado</Th>
                  <Th col="total_pedido" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="text-center">Total</Th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filtered.map((pedido) => (
                  <tr key={pedido.id_pedido} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-3">
                      <button
                        className="text-blue-700 hover:text-blue-900"
                        title="Editar items del pedido"
                        onClick={() =>
                          setDetallePedido({
                            id_pedido: pedido.id_pedido,
                            clienteId: pedido.clienteId,
                            nombre_cliente: pedido.nombre_cliente || "",
                          })
                        }
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">{pedido.clienteId}</td>
                    <td className="px-4 py-3 text-center">{pedido.nombre_cliente || "-"}</td>
                    <td className="px-4 py-3 text-center">{DIAS_MAP[pedido.diaDeVisita || ""] || "-"}</td>
                    <td className="px-4 py-3 text-center">{pedido.celular_contacto || "-"}</td>
                    <td className="px-4 py-3 text-center">{pedido.nombre_contacto || "-"}</td>
                    <td className="px-4 py-3 text-center">{formatDateTime(pedido.fecha, pedido.hora)}</td>
                    <td className="px-4 py-3 text-center">
                      {pedido.estado === "Cancelado" ? (
                        <button
                          type="button"
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoProps[pedido.estado as keyof typeof estadoProps]?.color || "bg-gray-100 text-gray-800"} underline`}
                          title="Ver motivo de anulación"
                          onClick={() => {
                            let textoCancelado = "-";
                          
                            if (pedido.pedido_cancelado) {
                              const fecha = new Date(pedido.pedido_cancelado);
                          
                              // Día de la semana con mayúscula inicial
                              const diaSemana = fecha.toLocaleDateString("es-AR", {
                                weekday: "long",
                                timeZone: "America/Argentina/Buenos_Aires",
                              });
                              const diaSemanaCapitalizado =
                                diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
                          
                              // Fecha en formato dd/mm/yyyy
                              const fechaStr = fecha.toLocaleDateString("es-AR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                timeZone: "America/Argentina/Buenos_Aires",
                              });
                          
                              // Hora y minutos (formato 24h)
                              const horaStr = fecha.toLocaleTimeString("es-AR", {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                                timeZone: "America/Argentina/Buenos_Aires",
                              });
                          
                              textoCancelado = `Cancelado el ${diaSemanaCapitalizado} ${fechaStr} a las ${horaStr}`;
                            }
                          
                            setShowMotivo({
                              motivo:
                                `${textoCancelado}` +
                                (pedido.motivo_anulacion
                                  ? `\n\nMotivo: ${pedido.motivo_anulacion}`
                                  : "\n\nMotivo: Sin especificar."),
                            });
                          }}                                                    
                        >
                          {estadoProps[pedido.estado as keyof typeof estadoProps]?.icon}
                          <span className="ml-1">{pedido.estado}</span>
                        </button>
                      ) : (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoProps[pedido.estado as keyof typeof estadoProps]?.color || "bg-gray-100 text-gray-800"}`}>
                          {estadoProps[pedido.estado as keyof typeof estadoProps]?.icon}
                          <span className="ml-1">{pedido.estado}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(pedido.total_pedido)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* NUEVO: Controles de paginación (no afectan otros bloques) */}
        <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-gray-200 text-sm text-gray-700">
          {/* Selector de cantidad */}
          <div className="flex items-center gap-2 mb-2 sm:mb-0">
            <span>Mostrar</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              {[15, 30, 45].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <span>por página</span>
          </div>

          {/* Botones de paginación */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1 || loading}
              className="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
            >
              ← Anterior
            </button>
            <span className="text-sm text-gray-700">
              Página {page} de {Math.max(1, Math.ceil(total / limit))}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * limit >= total || loading}
              className="px-3 py-1 rounded-md bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
            >
              Siguiente →
            </button>
          </div>
        </div>
      </div>
      {detallePedido && (
        <PedidoDetalleModal
          pedido={detallePedido}
          onClose={() => setDetallePedido(null)}
          onSave={() => {
            setDetallePedido(null);
            fetchPedidos();
          }}
        />
      )}
      {showMotivo && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-black/40 absolute inset-0" />
        <div className="relative bg-white rounded-2xl shadow-xl border border-red-200 px-8 py-8 max-w-md w-full flex flex-col items-center gap-3 z-50">
          <XCircle className="w-10 h-10 text-red-500 mb-1" />
          <h2 className="text-xl font-semibold text-red-700 mb-2 text-center">Motivo Anulación</h2>
          <div className="text-base text-gray-800 mb-4 text-center whitespace-pre-line max-h-48 overflow-y-auto">
            {showMotivo.motivo}
          </div>
          <button
            className="bg-red-600 text-white px-5 py-2 rounded-lg font-medium shadow hover:bg-red-700 mt-2"
            onClick={() => setShowMotivo(null)}
          >
            OK
          </button>
        </div>
      </div>
    )}
    </div>
  );
};

// --- Componente TH ordenable ---
type ThProps = {
  col: keyof Pedido | "total_pedido",
  sortBy: string,
  sortDir: "asc" | "desc",
  onSort: (col: any) => void,
  className?: string,
  children: React.ReactNode
};
const Th: React.FC<ThProps> = ({ col, sortBy, sortDir, onSort, className = "", children }) => (
  <th
    className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-blue-700 ${className} resize-x overflow-auto`}
    onClick={() => onSort(col)}
  >
    <span className="flex items-center justify-center">
      {children}
      {sortBy === col && (
        <span className="ml-1">{sortDir === "asc" ? "▲" : "▼"}</span>
      )}
    </span>
  </th>
);

export default Pedidos;
